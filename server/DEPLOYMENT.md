# 芽伴线上 Docker 部署

本文对应 `/opt/sproutkin` 的现有 Docker Compose 部署。公网流量从 Cloudflare Tunnel 进入 Caddy，Caddy 提供后台页面并把 `/api/` 转发给 NestJS。API 通过 Docker 内网连接独立 MySQL。后台入口为 [管理后台](https://sproutkin.raozi666.xyz/admin)，健康检查见 [API 健康接口](https://sproutkin.raozi666.xyz/api/health)。

| 服务器路径 | 用途 |
| --- | --- |
| `/opt/sproutkin/compose.yaml` | 正在运行的 `db`、`api`、`web`、`tunnel` 配置及应用版本的挂载路径 |
| `/opt/sproutkin/config/` | 服务端环境变量、数据库凭证、Caddy 配置和隧道凭证 |
| `/opt/sproutkin/repo.git/` | 从 GitHub 拉取的裸仓库 |
| `/opt/sproutkin/releases/<提交号>/` | 每个版本的源码、锁定依赖和构建产物 |
| `/opt/sproutkin/backups/` | 发布前的数据库导出及上一份 Compose 配置 |
| Docker 卷 `sproutkin_db-data` | MySQL 数据目录 |

保留 `config/` 和数据库卷。备份数据库时也要安全备份原有 `CONFIG_ENCRYPTION_KEY`，恢复数据库后仍靠它解密方舟和 TOS 配置。`docker compose down -v` 会删除数据库卷。

## 安装发布命令

脚本适用于当前 Compose 布局。服务器需要 Bash、Git、Docker Compose v2、`flock`、`curl` 和 `gzip`，并能访问 GitHub 与 npm。部署账号需要读写 `/opt/sproutkin` 并能运行 Docker 命令。公开仓库可通过 HTTPS 拉取。

用已经推送到 GitHub `main` 的可信提交安装或更新脚本。把 `release` 改成该提交的完整 SHA，并核对下载的脚本与仓库版本一致。

```bash
set -euo pipefail
cd /opt/sproutkin
release=填写可信提交的完整SHA
download=$(mktemp)
trap 'unlink "$download"' EXIT
curl -fsSL "https://raw.githubusercontent.com/s836064858/desktop-pet/$release/server/deploy.sh" -o "$download"
bash -n "$download"
install -m 0700 "$download" bin/deploy
```

## 从 GitHub 更新服务

1. 把要部署的代码推送到 GitHub `main`，记下提交号。脚本接收 `main` 历史上的提交号。省略提交号时，使用当次拉取到的 `main` 最新提交。
2. 可提前执行 `/opt/sproutkin/bin/deploy --prepare <提交号>`。脚本从 GitHub 拉取代码，导出到独立目录，在现有 Node 镜像中安装锁定依赖并构建服务端和后台。准备失败会清理临时构建目录，线上继续服务。
3. 在后台暂停 AI 派发，等已经开始的任务结束。执行 `/opt/sproutkin/bin/deploy <提交号>`。已完成的构建会复用，脚本会从备份开始进入短暂停机窗口。
4. 确认脚本的公网健康检查通过后，登录管理后台并恢复 AI 派发。

脚本会串行执行发布。它先停止 `tunnel`、`web`、`api`，保留 MySQL 运行，然后备份数据库和原 Compose 文件，用新版本执行迁移并切换 Compose 挂载。`web` 和 `tunnel` 共用 `api` 的网络，因此更新时三者一起重建。桌面安装包的打包和发布仍走项目原有流程。

## 失败处理与回滚

- **构建或准备失败**。线上版本继续运行，修复后可重跑相同的准备命令。
- **停机后备份失败**。脚本会尝试启动旧容器。用 `docker compose --profile tunnel ps` 确认状态，并保留故障输出。
- **迁移失败**。应用保持停机，原 Compose 配置和数据库备份仍可用。根据 [迁移说明](sql/README.md) 排查，修复原因后用同一提交重试。MySQL 的 DDL 可能已经部分生效。
- **迁移成功后启动或公网校验失败**。先查看 `docker compose --profile tunnel ps` 和对应服务日志。如果数据库结构兼容旧版，可以把本次备份目录里的 `compose.yaml` 放回部署根目录，再执行以下命令重建三个应用容器。如果结构已经变化，优先修复并向前发布。恢复旧数据库备份会丢失备份之后的写入。

```bash
cd /opt/sproutkin
docker compose --profile tunnel up -d --no-deps --force-recreate \
  --wait --wait-timeout 90 api web tunnel
```
