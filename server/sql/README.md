# 本地 MySQL 5.7 数据库

本目录包含芽伴一期 AI 服务的 MySQL 5.7 初始化和增量迁移。服务器应为 `max_allowed_packet` 预留至少 `32M`，以支持参考照片和失败重传的 PNG。

## 程序迁移

在 `server/` 中执行：

```sh
pnpm build
pnpm db:migrate
```

连接只从 Git 忽略的 `server/.env` 读取。先自行创建空数据库，字符集使用 `utf8mb4`、排序规则使用 `utf8mb4_unicode_ci`。不要将本机用户名、密码或连接串写入 SQL。迁移不创建数据库、不删除现有业务数据；只有设置 `ADMIN_PASSWORD_HASH` 时，才同步默认管理员的密码哈希。

`sql/migrations/` 是唯一业务 SQL 来源，按文件名顺序执行。`schema_migrations` 保存执行版本和 SHA-256 摘要；已执行文件不可修改，变更必须新增迁移。若数据库存在未知版本或摘要不符，程序拒绝继续。并发迁移在同一数据库会话中通过命名锁串行化；异常时连接销毁、锁释放。

迁移文件采用每条语句以分号结束并换行的普通 SQL，不支持 `DELIMITER`、存储过程或字符串内的“分号紧跟换行”。不要将动态用户输入拼接进这些文件。

运行编译产物时须同时保留 `server/sql/`，不能只复制 `dist/`。本阶段不涉及部署打包。

## 手工初始化与已有库兼容

先备份已有库并停止应用写入。在 MySQL 命令行中连接到目标数据库，然后从仓库根目录顺序执行：

```sql
SOURCE server/sql/000-schema-migrations.sql;
SOURCE server/sql/migrations/001-admin-auth.sql;
SOURCE server/sql/migrations/002-tos-settings.sql;
SOURCE server/sql/migrations/003-admin-users.sql;
SOURCE server/sql/migrations/004-ai-service.sql;
SOURCE server/sql/migrations/005-ai-user-status.sql;
SOURCE server/sql/migrations/006-ai-invite-codes.sql;
SOURCE server/sql/migrations/007-ai-usage-cost.sql;
```

上述文件可以重复执行，也可用于仅有旧版 `admins`、`admin_sessions`、`tos_settings` 的数据库。缺失的账号字段通过 `INFORMATION_SCHEMA` 检查后添加，不使用 MySQL 5.7 不支持的 `ADD COLUMN IF NOT EXISTS`。已有账号、会话摘要、过期时间、TOS 加密字节及版本保持不变。

手工执行后再运行 `pnpm db:migrate`：程序使用相同 SQL 做一次幂等执行并登记版本。不要手工伪造迁移摘要或版本记录。手工执行期间不得同时运行程序迁移或其他建表操作；不要使用客户端的强制忽略错误选项。

MySQL 5.7 的 DDL 会隐式提交，迁移不是可整体回滚的事务。中断后不要删除数据，修复原因再重试；当前迁移可以重复执行，只在全部语句成功后登记该版本。后续新增迁移也须遵循这一约定。

## 管理员凭证

`admin` 使用服务端 `.env` 中 `ADMIN_PASSWORD_HASH` 对应的固定密码；应用首次登录不要求改密。迁移用参数化 SQL 同步哈希，哈希未变则保留会话，轮换哈希时旧会话失效。未配置时保留已有哈希；空占位记录不可登录。旧数据库的首次改密列仅为兼容保留，不参与新版会话校验。其他账号仍由 `admin` 在后台管理，只读业务页面，无自行改密、找回密码或角色管理功能。

新的环境可以在 `server/` 构建后生成哈希。以下命令（Bash）隐藏输入，不将明文写入历史或命令参数。将输出作为本机 `.env` 中 `ADMIN_PASSWORD_HASH` 的值，再执行 `pnpm db:migrate`；哈希不要提交或分享。

```bash
read -rs -p '管理员密码: ' password; printf '\n'
printf '%s' "$password" | node -e 'const p = require("node:fs").readFileSync(0, "utf8"); const { hashAdminPassword, isNewAdminPassword } = require("./dist/admin-auth/admin-password.js"); if (!isNewAdminPassword(p)) { console.error("密码需为 12–128 字符"); process.exitCode = 1 } else { hashAdminPassword(p).then(console.log) }'
unset password
```

TOS 加密主密钥不是数据库表的一部分。迁移既不读取也不更换它；必须保留本机原有的 `CONFIG_ENCRYPTION_KEY`，否则已有配置无法解密。
