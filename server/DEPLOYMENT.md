# 芽伴线上 Docker 部署

## 更新服务

把代码推送到 GitHub `main` 后，在已部署芽伴的服务器上运行：

```bash
/opt/sproutkin/bin/deploy
```

脚本会拉取 `main` 最新提交并构建，随后备份数据库、执行迁移、重建应用容器并检查公网健康。构建期间旧版继续服务，备份和切换期间会短暂停机。如果有 AI 任务正在执行，先在后台暂停派发，等任务结束后再更新，验证通过后恢复派发。

[管理后台](https://sproutkin.raozi666.xyz/admin) · [健康接口](https://sproutkin.raozi666.xyz/api/health)

## 安装或更新部署命令

在已有 Docker Compose 部署的服务器上执行一次。命令只安装更新工具，之后用上一节的命令发布服务。

```bash
installer=$(curl -fsSL https://raw.githubusercontent.com/s836064858/desktop-pet/main/server/install-deploy.sh) && bash -c "$installer"
```

部署目录默认为 `/opt/sproutkin`，其中需要有 `compose.yaml` 和 `config/server.env`。服务器使用 Bash、Git、Docker Compose v2、`flock`、`curl` 和 `gzip`，并能访问 GitHub 与 npm。执行账号需要部署目录的写权限和 Docker 权限。

## 高级用法

可以先构建后择时切换。正式更新时会复用同一提交的构建结果。

```bash
/opt/sproutkin/bin/deploy --prepare
```

需要部署特定版本时，将 GitHub `main` 历史里的提交号传给 `deploy`。桌面安装包通过 `pnpm release <新版本号>` 单独发布。

## 失败处理与回滚

| 失败环节 | 处理方式 |
| --- | --- |
| 拉取或构建 | 旧版继续服务，修复后重试 |
| 备份 | 脚本会尝试启动旧容器，用 `docker compose --profile tunnel ps` 确认状态 |
| 迁移 | 应用保持停机并保留备份。MySQL 的 DDL 可能部分生效，排查后用同一提交重试。详见 [迁移说明](sql/README.md) |
| 启动或公网验证 | 检查 `docker compose --profile tunnel ps` 和相关容器日志。数据库兼容旧版时可恢复旧 Compose 配置 |

回滚时，将对应 `backups/` 目录内的 `compose.yaml` 放回 `/opt/sproutkin`，重建共享网络的三个应用容器。恢复旧数据库备份会丢失备份后的写入。

```bash
cd /opt/sproutkin
docker compose --profile tunnel up -d --no-deps --force-recreate \
  --wait --wait-timeout 90 api web tunnel
```

## 数据与配置

公网请求由 Cloudflare Tunnel 进入 Caddy，Caddy 提供后台页面并将 `/api/` 转发给 NestJS。API 通过 Docker 内网访问独立 MySQL。

| 路径或资源 | 内容 |
| --- | --- |
| `/opt/sproutkin/compose.yaml` | 容器定义和当前版本挂载 |
| `/opt/sproutkin/config/` | 数据库及隧道凭证、Caddy 配置和服务端环境变量 |
| `/opt/sproutkin/repo.git/` 和 `releases/` | GitHub 源码缓存及各版本构建产物 |
| `/opt/sproutkin/backups/` | 发布前的数据库导出和上一份 Compose 配置 |
| Docker 卷 `sproutkin_db-data` | MySQL 数据 |

备份数据时，保留 `config/` 中的原 `CONFIG_ENCRYPTION_KEY`，恢复后仍要用它解密方舟和 TOS 配置。`docker compose down -v` 会删除数据库卷。
