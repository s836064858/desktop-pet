#!/usr/bin/env bash
set -euo pipefail

function fail() {
  printf '%s\n' "$*" >&2
  exit 1
}

function usage() {
  printf 'Usage: %s [--prepare] [commit]\n' "${0##*/}"
  printf 'Fetch GitHub main, build a release, then update the existing Sproutkin Compose stack.\n'
  printf 'With --prepare, leave the running stack alone. If omitted, commit defaults to GitHub main.\n'
}

function cleanup() {
  local status=$?
  trap - EXIT
  set +e
  if [[ -n $buildDirectory ]]; then
    find "$buildDirectory" -depth -delete
  fi
  if [[ -n $nextCompose ]]; then
    unlink "$nextCompose"
  fi

  case $phase in
    maintenance)
      printf 'Update stopped before migration. Restarting the previous containers.\n' >&2
      docker compose --profile tunnel start api web tunnel >&2 ||
        printf 'Could not restart the previous stack. Check docker compose ps.\n' >&2
      ;;
    migrating)
      printf 'Migration failed. The app is stopped and the original Compose file is still available.\n' >&2
      printf 'Inspect the migration and rerun deploy %s after correcting the error.\n' "$revision" >&2
      ;;
    starting)
      printf 'The new Compose file is active. Check containers and the tunnel before retrying.\n' >&2
      ;;
  esac
  exit "$status"
}

function resolveRevision() {
  local requested=$1
  local upstream=refs/remotes/origin/main
  if [[ ! -d repo.git ]]; then
    git init --bare repo.git >&2 || fail 'Could not initialize the deployment repository.'
  fi
  GIT_TERMINAL_PROMPT=0 git --git-dir=repo.git fetch --no-tags \
    "$repository" "refs/heads/main:$upstream" >&2 || fail 'Could not fetch GitHub main.'

  local resolved
  resolved=$(git --git-dir=repo.git rev-parse --verify "${requested:-$upstream}^{commit}") ||
    fail 'Requested commit was not found.'
  git --git-dir=repo.git merge-base --is-ancestor "$resolved" "$upstream" ||
    fail 'Requested commit must be on GitHub main.'
  git --git-dir=repo.git cat-file -e "$resolved:server/package.json" &&
    git --git-dir=repo.git cat-file -e "$resolved:admin/package.json" ||
      fail 'Requested commit does not contain the server and admin projects.'
  printf '%s\n' "$resolved"
}

function buildRelease() {
  local directory=$1
  if [[ -d $directory ]]; then
    [[ -f $directory/.revision && $(<"$directory/.revision") == "$revision" &&
      -f $directory/server/dist/main.js && -f $directory/admin/dist/index.html ]] ||
      fail "Release directory is incomplete or belongs to another commit: $directory"
    return
  fi

  local nodeImage
  nodeImage=$(docker compose config --images | awk '/^node:/ { print }')
  [[ -n $nodeImage && $nodeImage != *$'\n'* ]] || fail 'Expected one Node image in compose.yaml.'
  buildDirectory=$(mktemp -d "releases/.build-${revision:0:12}.XXXXXXXX")
  git --git-dir=repo.git archive "$revision" | tar -xf - -C "$buildDirectory"
  docker run --rm --init --memory 760m --memory-swap 1200m \
    -e CI=true -e NODE_OPTIONS=--max-old-space-size=550 \
    -v "$PWD/$buildDirectory:/app" -w /app "$nodeImage" sh -eu -c '
      npm install -g pnpm@10.20.0
      pnpm install --frozen-lockfile
      pnpm --dir server install --frozen-lockfile
      pnpm --dir admin install --frozen-lockfile
      pnpm --dir server build
      pnpm --dir admin build
    '
  [[ -f $buildDirectory/server/dist/main.js && -f $buildDirectory/admin/dist/index.html ]] ||
    fail 'Build artifacts are missing.'
  printf '%s\n' "$revision" > "$buildDirectory/.revision"
  chmod 0755 "$buildDirectory"
  mv -T "$buildDirectory" "$directory"
  buildDirectory=
}

function prepareCompose() {
  local releaseName=$1
  local apiRelease adminRelease
  apiRelease=$(sed -nE 's|^[[:space:]]*- \./releases/([0-9a-f]{7,40}):/app:ro[[:space:]]*$|\1|p' compose.yaml)
  adminRelease=$(sed -nE 's|^[[:space:]]*- \./releases/([0-9a-f]{7,40})/admin/dist:/srv:ro[[:space:]]*$|\1|p' compose.yaml)
  [[ $apiRelease =~ ^[0-9a-f]{7,40}$ && $apiRelease == "$adminRelease" ]] ||
    fail 'Expected API and Caddy to mount the same releases/<commit> directory.'

  nextCompose=$(mktemp .compose-next.XXXXXXXX)
  sed -e "s@\./releases/$apiRelease:/app:ro@./releases/$releaseName:/app:ro@" \
    -e "s@\./releases/$apiRelease/admin/dist:/srv:ro@./releases/$releaseName/admin/dist:/srv:ro@" \
    compose.yaml > "$nextCompose"
  docker compose -f "$nextCompose" --profile tunnel config --quiet
}

function backupDatabase() {
  local backupFile=$1
  docker compose exec -T db sh -s <<'DUMP' | gzip > "$backupFile"
set -eu
umask 077
cnf=$(mktemp)
trap 'unlink "$cnf"' EXIT
{
  printf '[client]\nuser=root\npassword='
  cat /run/sproutkin/db-root-password
} > "$cnf"
mysqldump --defaults-extra-file="$cnf" --single-transaction \
  --no-tablespaces --set-gtid-purged=OFF sproutkin_ai
DUMP
  gzip -t "$backupFile"
}

function waitForPublicHealth() {
  local url=$1
  local attempt response
  for attempt in {1..12}; do
    if response=$(curl -fsS --connect-timeout 3 --max-time 5 "$url" 2>/dev/null) &&
      [[ $response == '{"status":"ok","database":"ok"}' ]]; then
      return
    fi
    sleep 2
  done
  fail "Public health check failed: $url"
}

if [[ ${1:-} == --help || ${1:-} == -h ]]; then
  usage
  exit 0
fi

shouldPrepareOnly=0
if [[ ${1:-} == --prepare ]]; then
  shouldPrepareOnly=1
  shift
fi
[[ $# -le 1 && ( $# -eq 0 || $1 =~ ^[0-9a-f]{7,40}$ ) ]] || { usage >&2; exit 2; }

repository=https://github.com/s836064858/desktop-pet.git
umask 077
cd "${SPROUTKIN_DEPLOY_ROOT:-/opt/sproutkin}"
[[ -f compose.yaml && -f config/server.env ]] || fail 'Existing Sproutkin Compose installation required.'
exec 9>.deploy.lock
flock -n 9 || fail 'A Sproutkin deployment is already running.'

buildDirectory=
nextCompose=
phase=prepare
trap cleanup EXIT
trap 'exit 130' INT
trap 'exit 143' TERM

mkdir -p releases backups
revision=$(resolveRevision "${1:-}")
releaseName=${revision:0:12}
buildRelease "releases/$releaseName"
prepareCompose "$releaseName"
printf 'Prepared %s at releases/%s\n' "$revision" "$releaseName"
if (( shouldPrepareOnly )); then
  exit 0
fi

adminOrigin=$(sed -n 's/^ADMIN_ORIGIN=//p' config/server.env)
[[ $adminOrigin =~ ^https://[a-zA-Z0-9.-]+(:[0-9]+)?$ ]] || fail 'Expected the HTTPS ADMIN_ORIGIN in config/server.env.'
backupDirectory=$(mktemp -d "backups/$(date +%Y%m%d-%H%M%S)-$releaseName.XXXXXXXX")
cp -p compose.yaml "$backupDirectory/compose.yaml"

phase=maintenance
docker compose --profile tunnel stop tunnel web api
backupDatabase "$backupDirectory/db.sql.gz"
printf 'Backup verified: %s\n' "$backupDirectory"

# The previous application may be incompatible once a migration starts.
phase=migrating
docker compose -f "$nextCompose" run --rm --no-deps -T api \
  node --env-file=/run/sproutkin/server.env dist/scripts/migrate.js

mv -T "$nextCompose" compose.yaml
nextCompose=
phase=starting
docker compose --profile tunnel up -d --no-deps --force-recreate \
  --wait --wait-timeout 90 api web tunnel
waitForPublicHealth "$adminOrigin/api/health"
phase=complete
printf 'Deployed %s. Public health check passed.\n' "$revision"
