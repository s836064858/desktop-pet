# AGENTS.md · 项目协作约定

芽伴 · Sproutkin，植物数字分身桌面宠物（Tauri 2 + Vue3）。个人代码规范见 `~/AGENTS.md`，本文件是**项目特有**的约定，冲突时以本文件为准。

## 本地维护文档

`docs/` 仅在维护者本机保留，已取消 Git 跟踪并加入忽略规则。禁止强制添加、提交或上传该目录。新克隆仓库不包含这些文件，以本文件与 README 为协作依据；本地文档存在时，修改相关模块前应阅读对应内容：

- `docs/技术方案-植物数字分身桌面宠物.md`：业务流程、分期规划、决策记录。
- `docs/AI生图与切图管线.md`：植物素材入库流程。
- `docs/生图自动化脚本设计.md`：素材生图自动化（`pnpm sprite`：probe/ask/gen/commit）。
- `docs/branding/品牌规范.md`：正式品牌名称与 v2 Logo 使用约定。

## 命令

```bash
pnpm tauri dev      # 开发运行
pnpm typecheck      # 类型检查（交付前必须）
pnpm build          # 类型检查 + 前端构建（交付门禁）
pnpm icon           # 从正式 Logo 仅更新配置引用的 macOS / Windows 图标
node scripts/process-sprites.mjs   # 素材切图
pnpm sprite <probe|ask|gen|commit> # 素材生图自动化（仓库根 .env 配 ARK_API_KEY）
```

## 发布（.github/workflows/release.yml）

- 一键发版：`pnpm release 0.2.0`（同步四处版本号 package.json / tauri.conf.json / Cargo.toml / Cargo.lock → `pnpm build` 门禁 → 提交推送 main → 打 tag 触发打包）；`pnpm release`（无参数）= 版本号已改好时只补打 tag；加 `--dry-run` 预演不落盘。脚本为 `scripts/release.mjs`，Rust 侧编译由 CI 验证
- 三路构建：macOS arm64 原生 + macOS x86_64（交叉编译）+ Windows x64（MSI/NSIS）；CI 工具链锁定 rustc 1.86.0 / pnpm 9 / node 20，与本地一致，勿在 workflow 里放开
- 产物进**草稿 Release**，人工核对后手动发布；临时试打包走 Actions 页 workflow_dispatch（产物在 run 的 Artifacts，不建 Release）
- 包未签名：macOS 首次打开右键 →「打开」或 `xattr -cr`；Windows SmartScreen 点「仍要运行」

## 硬约束（违反即返工）

1. **Rust 零业务代码**：`src-tauri/src/main.rs` 只允许插件注册声明。新系统能力一律优先：官方插件 + `@tauri-apps/api` JS + capability 声明（`src-tauri/capabilities/default.json`）。
2. **依赖版本已锁定，禁止升级**：本机 rustc 1.86，Rust 侧全部固定在兼容线（tauri `=2.11.6` 等，Cargo.toml 有注释）；npm 侧 `@tauri-apps/*` 与 Rust crate 版本必须同 minor（CLI 构建期强校验）。**禁止 `cargo update` / 改版本号**；升级工具链是独立任务（rustc ≥1.90 后统一放开）。
3. **素材不手改**：`src/assets/pets/` 全部由 `scripts/process-sprites.mjs` 生成；新物种 = assets-src 建目录 + 脚本 MAP 加条目 + `src/config/species.ts` 加配置，三步缺一不可。
4. **面板关闭 = 隐藏**：main 窗口的 `onCloseRequested` 已拦截为 hide（托盘回调注册在面板 JS，销毁即失联），不要改回销毁语义。
5. **积分只记流水**：`points_ledger` 只追加，余额 = 聚合；`care_task` 有 `(plant_id,type,scheduled_at)` 唯一键，完成/入账必须走 `completeTask`（含日上限 20 的闸门），禁止绕开直写。

## 架构速记

- 品牌：界面「芽伴 · Sproutkin」，安装包 `Sproutkin`；名称常量在 `src/config/brand.ts`，正式 v2 Logo 在 `src/assets/brand/logo.png`。更新图标执行 `pnpm icon`，不要重建旧占位图。
- 平台：本期仅 macOS / Windows，无 iOS / Android；图标脚本仅保留 `tauri.conf.json` 引用的桌面图标，不提交移动端或未使用的 AppX 素材。
- 品牌兼容：保留应用标识 `com.desktoppet.plantpet`、数据库 `plant-pet.db` 与配置文件 `phase0.json`，不要因更名重置已有用户数据；仓库地址仍为 `desktop-pet`。
- 双窗口：`pet`（透明置顶常驻，调度器+互动手势+帧动画）/ `main`（面板，默认隐藏）
- 跨窗事件：`care-changed`（调度器每 tick 广播，面板刷新）/ `plant-changed`（领养/重置广播，宠物窗换帧 + 调度器缓存失效）
- 计时器：调度器 15s tick（宠物窗）；互动帧切换/眨眼定时器集中在 `petView.ts`，由 `disposeViewTimers` 统一清理
- 阶段：成熟期（默认）→ 完全体（累计完成 30 次）

## 已知坑（改相关代码前先看）

- `tauri.conf.json`：`macOSPrivateApi: true`（透明窗必需）+ Cargo 侧 `tray-icon` / `macos-private-api` feature，动配置前先理解 tauri-build 的 feature 校验
- capability 权限名：`sql:default` 不含 `allow-execute/select`；是 `allow-get-all-windows` 不是 `allow-get-all`
- plugin-log 必须保持 `.level(Info)`，否则 tao TRACE 日志刷屏
- dev 端口 5173 被残留进程占用时：`lsof -ti:5173 | xargs kill`
- pet 窗口热更新会整页重载（`start()` 重跑），验证日志看 `[pet]` 前缀
- 图生图与文案统一走火山方舟 Ark（`ARK_API_KEY`，标准 HTTP 状态码）；模型/尺寸在 `scripts/sprite-config.json`。ark 图片接口 `watermark` 默认 true、`output_format` 默认 jpeg，脚本与面板均已显式覆盖为关水印 + PNG；衍生帧提示词必须显式拆「脸表情 + 植物状态」两处变化（seedream 参考图服从性强，只写植物状态脸不会动）
- 面板「AI 生成新物种」：接口走 `tauri-plugin-http`（capability 仅放行 ark 域名），素材库在 `appData/sprite-library/`（`tauri-plugin-fs`，appData 读写），两个插件锁 rustc 1.86 兼容线（http 2.8+/fs 2.7+ 需 Rust 1.90）；自定义物种经 `speciesRegistry` 与内置 4 种合并，`speciesArt` 支持运行时注册帧
- **`src/assets/pets` 既有帧以仓库现状为准**：龟背竹（happy/sleep/sun）与多肉（happy/sleep/sun/thirsty/water）共 8 帧曾文件名错位、已人工改名修正；全量重跑切图会把错位还原回来覆盖修正。需要重切时用 `node scripts/process-sprites.mjs <species>` 按物种过滤（`sprite-studio commit` 已自带此过滤），不要"顺手"全量重切或按 MAP 修正这 8 帧
