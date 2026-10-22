# AGENTS.md · 项目协作约定

植物数字分身桌面宠物（Tauri 2 + Vue3）。个人代码规范见 `~/AGENTS.md`，本文件是**项目特有**的约定，冲突时以本文件为准。

## 必读文档

- [docs/技术方案-植物数字分身桌面宠物.md](docs/技术方案-植物数字分身桌面宠物.md)：业务流程、分期规划、决策记录（§2 D1~D10）
- [docs/AI生图与切图管线.md](docs/AI生图与切图管线.md)：素材入库唯一流程

## 命令

```bash
pnpm tauri dev      # 开发运行
pnpm typecheck      # 类型检查（交付前必须）
pnpm build          # 类型检查 + 前端构建（交付门禁）
node scripts/process-sprites.mjs   # 素材切图
```

## 硬约束（违反即返工）

1. **Rust 零业务代码**：`src-tauri/src/main.rs` 只允许插件注册声明。新系统能力一律优先：官方插件 + `@tauri-apps/api` JS + capability 声明（`src-tauri/capabilities/default.json`）。
2. **依赖版本已锁定，禁止升级**：本机 rustc 1.86，Rust 侧全部固定在兼容线（tauri `=2.11.6` 等，Cargo.toml 有注释）；npm 侧 `@tauri-apps/*` 与 Rust crate 版本必须同 minor（CLI 构建期强校验）。**禁止 `cargo update` / 改版本号**；升级工具链是独立任务（rustc ≥1.90 后统一放开）。
3. **素材不手改**：`src/assets/pets/` 全部由 `scripts/process-sprites.mjs` 生成；新物种 = assets-src 建目录 + 脚本 MAP 加条目 + `src/config/species.ts` 加配置，三步缺一不可。
4. **面板关闭 = 隐藏**：main 窗口的 `onCloseRequested` 已拦截为 hide（托盘回调注册在面板 JS，销毁即失联），不要改回销毁语义。
5. **积分只记流水**：`points_ledger` 只追加，余额 = 聚合；`care_task` 有 `(plant_id,type,scheduled_at)` 唯一键，完成/入账必须走 `completeTask`（含日上限 20 的闸门），禁止绕开直写。

## 架构速记

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
