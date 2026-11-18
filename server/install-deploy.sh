#!/usr/bin/env bash
set -euo pipefail

cd "${SPROUTKIN_DEPLOY_ROOT:-/opt/sproutkin}"
if [[ ! -f compose.yaml || ! -f config/server.env ]]; then
  printf 'Set up the Sproutkin Docker Compose stack before installing the update command.\n' >&2
  exit 1
fi

umask 077
mkdir -p bin
download=$(mktemp bin/.deploy.XXXXXXXX)
trap 'if [[ -f $download ]]; then unlink "$download"; fi' EXIT
curl -fsSL --connect-timeout 10 --max-time 60 \
  https://raw.githubusercontent.com/s836064858/desktop-pet/main/server/deploy.sh -o "$download"
bash -n "$download"
chmod 0700 "$download"
mv -T "$download" bin/deploy
printf 'Update command installed. Run %s/bin/deploy to update Sproutkin.\n' "$PWD"
