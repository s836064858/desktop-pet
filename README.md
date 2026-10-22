# 植物分身 · 桌面宠物

> 公司/园区「绿植领养活动」的桌面配套工具：领养真实植物后，在桌面养一株对应的卡通数字分身；按植物习性提醒浇水、晒太阳，线下照护后回到桌面互动打卡，积累积分兑换线下权益。

![platform](https://img.shields.io/badge/platform-macOS%20%7C%20Windows-blue) ![stack](https://img.shields.io/badge/Tauri%202-Vue3-42b883)

## 功能

- **数字分身**：领养物种生成专属卡通分身（绿萝 / 龟背竹 / 多肉 / 仙人球），常驻桌面，可拖拽、可抚摸、会眨眼
- **养护提醒**：按物种习性调度浇水/晒太阳任务，到期系统通知 + 分身头顶悬浮 💧/☀️ 按钮（平时隐藏，到期高亮脉冲）
- **互动即打卡**：随时可浇水/晒太阳，计分看时机——提前 +8 / 按时 +10 / 逾期补做 +5，每日积分上限 20 防刷
- **养成体系**：积分流水（只记流水可审计）、好感度（抚摸+互动）、连击 streak、完全体阶段（累计完成 30 次）
- **面板**：我的植物（任务列表/稍后/积分）+ 设置（免打扰时段/鼠标穿透/开机自启/重新领养）；关闭即隐藏，托盘常驻
- **纯单机**：零网络依赖，数据本地 SQLite

## 技术栈

Tauri 2 · Vue3 `<script setup>` + TypeScript · Vite · Pinia · Element Plus · SQLite（tauri-plugin-sql）

架构要点：双窗口（`pet` 常驻宠物窗承载调度器与互动 / `main` 面板窗），窗口间经 `care-changed` / `plant-changed` 事件同步；Rust 侧仅插件注册声明，业务逻辑全部在 TS。

## 快速开始

环境要求：Node 22+、pnpm 10+、Rust stable（依赖版本已锁定，详见 AGENTS.md 约束）

```bash
pnpm install
pnpm tauri dev     # 开发运行（秒级启动）
pnpm tauri build   # 打包安装包（.app / .dmg / 平台安装包）
```

| 命令                                    | 说明                                       |
| --------------------------------------- | ------------------------------------------ |
| `pnpm tauri dev`                        | 开发模式运行                               |
| `pnpm tauri build`                      | 打包                                       |
| `pnpm typecheck`                        | vue-tsc 类型检查                           |
| `pnpm build`                            | 类型检查 + 前端构建（质量门禁）            |
| `pnpm icon`                             | 重新生成应用图标                           |
| `node scripts/process-sprites.mjs`      | 素材切图管线（AI 生图 → 程序资产）         |
| `pnpm sprite <probe\|ask\|gen\|commit>` | 素材生图自动化（需 `.env` 配置密钥，见下） |

### 素材生图自动化（可选）

新增植物物种的素材可由 `pnpm sprite` 半自动生成：AI 起草物种文案 → AI 生成 6 帧候选 → 人工目检定稿 → 切图入库。密钥为火山方舟 Ark 的 API Key，填入仓库根 `.env`（模板见 `.env.example`，该文件不入库）：

```bash
ARK_API_KEY=你的密钥   # 图生图 + 文案（火山方舟 Ark）：到 https://console.volcengine.com/ark/region:cn-beijing/apiKey?apikey=%7B%7D 创建 API Key
```

图生图模型与尺寸可在 `scripts/sprite-config.json` 调整。

设计与流程闸门详见《[生图自动化脚本设计](docs/生图自动化脚本设计.md)》；不加密钥不影响应用本身的使用。

## 目录结构

```
├─ docs/                  # 技术方案、AI 生图与切图管线
├─ assets-src/            # AI 生成的原始图（按物种分目录，不入包）
├─ scripts/
│  ├─ process-sprites.mjs # 切图管线：抠底/羽化/归一化 → src/assets/pets
│  ├─ sprite-studio.mjs   # 素材生图自动化：probe/ask/gen/commit
│  └─ gen-icon.mjs        # 占位图标生成
├─ src/
│  ├─ config/species.ts   # 物种库（习性间隔配置）
│  ├─ lib/                # database / scheduler / capabilities / petView / speciesArt
│  ├─ stores/             # Pinia：care（面板侧）
│  ├─ components/         # care / settings 面板组件
│  ├─ pet.ts              # 宠物窗入口（互动手势/调度接线）
│  └─ main.ts             # 面板窗入口（托盘/关闭守卫）
├─ src-tauri/             # Tauri 壳（main.rs 仅插件注册）
└─ pet.html               # 宠物窗页面（透明置顶）
```

## 文档

- [技术方案](docs/技术方案-植物数字分身桌面宠物.md) —— 选型、业务流程、分期规划、决策记录
- [AI 生图与切图管线](docs/AI生图与切图管线.md) —— 提示词结构、一致性方法、素材入库流程
- [生图自动化脚本设计](docs/生图自动化脚本设计.md) —— sprite-studio：接口适配、流程闸门、密钥获取

## 平台状态

| 平台                         | 状态                                                                 |
| ---------------------------- | -------------------------------------------------------------------- |
| macOS（Intel/Apple Silicon） | ✅ 已验证；当前产物为 x64（AS 走 Rosetta），arm64 原生包待工具链就绪 |
| Windows                      | ⏳ 待验证（Phase 1 剩余项）                                          |
