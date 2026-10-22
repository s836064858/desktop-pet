<p align="center">
  <img src="src/assets/brand/logo.png" alt="芽伴 Sproutkin Logo" width="96" height="96" />
</p>

# 芽伴 · Sproutkin

> 桌上有芽，日常有伴。

芽伴是公司 / 园区绿植领养活动的桌面配套应用：领养真实植物后，在桌面养一株对应的卡通数字分身，按植物习性提醒浇水、晒太阳，照护后通过桌面互动打卡、积累积分。

![platform](https://img.shields.io/badge/platform-macOS%20%7C%20Windows-blue) ![stack](https://img.shields.io/badge/Tauri%202-Vue3-42b883)

本期仅支持 macOS 与 Windows，不包含 iOS / Android 移动端。

## 功能

- **桌面伙伴**：内置绿萝、龟背竹、多肉、仙人球、狗尾巴草，支持拖拽、抚摸、眨眼与表情反馈。
- **养护提醒**：按物种习性调度浇水 / 晒太阳任务，到期通过系统通知与宠物气泡提醒；悬浮宠物可显示养护按钮，到期按钮高亮。
- **互动即打卡**：随时可浇水 / 晒太阳，提前完成 +8、按时完成 +10、逾期补做 +5；每日互动积分上限 20，无待办任务时互动不计分。
- **共同成长**：好感度、连续打卡与积分流水；累计完成 30 次养护后进入完全体阶段。
- **管理面板**：领养、任务列表、稍后提醒、免打扰、鼠标穿透、开机自启与重新领养；关闭面板时隐藏，托盘可再次唤起。
- **AI 新物种（可选）**：在面板中输入物种名称、编辑 AI 文案、生成并预览六种状态帧，确认后加入本机素材库。
- **本地优先**：养护、积分与设置保存在本机，基础功能可离线使用；仅可选 AI 生成功能需要联网调用火山方舟。

## 开始使用

从仓库的 [Releases](https://github.com/s836064858/desktop-pet/releases) 下载对应平台安装包。

1. 安装并启动 **Sproutkin**，通过托盘打开芽伴面板。
2. 选择植物、填写昵称并确认养护间隔，点击「领养」。
3. 在桌面伙伴上悬浮显示 💧 / ☀️，点击完成对应养护；抚摸或拖动花盆与它互动。
4. 在面板查看任务与积分，并按需开启开机自启、免打扰等设置。

当前安装包未签名：macOS 挂载 DMG 后将 `Sproutkin.app` 拖入「应用程序」，首次打开可右键 →「打开」；必要时执行 `xattr -cr /Applications/Sproutkin.app`。Windows 遇到 SmartScreen 提示时选择「仍要运行」。

积分兑换线下权益由活动方另行组织，当前应用仅提供本地积分记录。

## 本地开发

技术栈：Tauri 2 · Vue 3 `<script setup>` + TypeScript · Vite · Pinia · Element Plus · SQLite。

CI 固定使用 Node 20、pnpm 9、Rust 1.86.0；本地 Node 20+、pnpm 9+。Rust 与 Tauri 依赖已锁定在兼容线，不升级依赖、不执行 `cargo update`，具体约束见 [AGENTS.md](AGENTS.md)。

```bash
pnpm install --frozen-lockfile
pnpm tauri dev
```

| 命令                                         | 说明                                                   |
| -------------------------------------------- | ------------------------------------------------------ |
| `pnpm tauri dev`                             | 启动桌面开发环境                                       |
| `pnpm typecheck`                             | Vue / TypeScript 类型检查                              |
| `pnpm build`                                 | 类型检查与前端构建，交付门禁                           |
| `pnpm tauri build`                           | 打包当前平台安装包                                     |
| `pnpm icon`                                  | 从正式 v2 Logo 生成 macOS / Windows 桌面图标           |
| `pnpm release 0.2.0`                         | 同步版本、构建、提交推送并打 tag；产物进入草稿 Release |
| `node scripts/process-sprites.mjs <species>` | 按物种切图，避免覆盖其他物种已修正帧                   |
| `pnpm sprite <probe\|ask\|gen\|commit>`      | 素材生图自动化，需配置密钥                             |

### 品牌与图标

- 中文名称：**芽伴**；英文名称与安装包名称：**Sproutkin**。
- 采用 **v2 圆角 Y 字母标**，表达相伴与成长，与植物宠物角色分离。
- 正式原图：[src/assets/brand/logo.png](src/assets/brand/logo.png)；名称常量：[src/config/brand.ts](src/config/brand.ts)。
- 面板、HTML 图标、README 与 `pnpm icon` 共用正式原图；更新原图后执行 `pnpm icon`，仅将 Tauri 配置引用的 macOS / Windows 图标写入 `src-tauri/icons/`。

品牌更新保留原应用标识 `com.desktoppet.plantpet`、数据库 `plant-pet.db` 与配置文件 `phase0.json`，以继续使用已有领养、积分、设置和本地素材库。仓库地址仍为 `desktop-pet`。

从旧名版本升级时，先关闭旧程序，再启动 Sproutkin。若旧版已开启开机自启，请先在旧版关闭，再在新版重新开启，以更新系统启动项名称与安装路径。

### AI 素材生成（可选）

面板入口：「AI 生成新物种」。先在设置中配置火山方舟密钥，再按向导完成物种文案、六帧生成、逐帧预览与确认入库；自定义物种保存在本机应用数据目录的 `sprite-library/`。

CLI 入口：在仓库根目录的 `.env` 中配置密钥（参照 `.env.example`，不要提交密钥）：

```bash
ARK_API_KEY=你的密钥
```

```bash
pnpm sprite ask 薰衣草 --write
pnpm sprite gen --species lavender --all
pnpm sprite commit --species lavender
```

`lavender` 仅为示例，实际使用 `ask` 生成并写入的物种 code。入库前必须逐帧目检；养护参数由人工确认，按命令输出补齐配置。模型与尺寸见 `scripts/sprite-config.json`。不配置密钥也可使用内置植物与全部基础养护功能。

## 架构与目录

双窗口：`pet` 常驻宠物窗承载调度与互动，`main` 面板管理领养与设置；通过 `care-changed` / `plant-changed` 事件同步。Rust 侧仅做插件注册，业务逻辑在 TypeScript 前端。

```text
├─ assets-src/            # 植物原始生图（本地，不入包）
├─ scripts/
│  ├─ process-sprites.mjs # 按物种切图与归一化
│  ├─ sprite-studio.mjs   # 素材文案与生图自动化
│  ├─ gen-icon.mjs        # 仅更新配置引用的桌面图标
│  └─ release.mjs         # 版本同步与发布
├─ src/
│  ├─ assets/brand/       # 正式 Logo 原图
│  ├─ assets/pets/        # 管线生成的植物状态帧
│  ├─ config/             # 品牌名称与物种配置
│  ├─ components/         # 养护、领养、AI 生成与设置
│  ├─ lib/                # 数据、调度、互动、素材库与系统能力
│  ├─ stores/             # Pinia 面板状态
│  ├─ pet.ts              # 宠物窗入口
│  └─ main.ts             # 面板入口与托盘
├─ src-tauri/             # Tauri 壳、权限与桌面图标
└─ pet.html               # 透明宠物窗页面
```

## 发布与本地文档

发布工作流构建 macOS Apple Silicon、macOS Intel 与 Windows x64 三路产物。tag 触发后创建草稿 Release，人工核对后发布；也可手动触发 Actions，仅上传构建产物。macOS 已完成本机验证，Windows 安装与运行仍需真机验收。

维护过程、技术方案与生成记录仅保存在本机 `docs/`，不随仓库分发；该目录已取消 Git 跟踪并加入 `.gitignore`，后续文档变更不会上传。
