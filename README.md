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
- **养护提醒**：按植物各自的浇水 / 光照频率安排任务，通过系统通知与宠物气泡提醒；桌宠浇水 / 光照互动即完成，面板仅展示计划与时间。植物习性以一段富文本介绍展示，供了解植物。
- **互动即打卡**：随时可浇水 / 晒太阳，提前完成 +8、按时完成 +10、逾期补做 +5；每日互动积分上限 20，无待办任务时互动不计分。
- **共同成长**：每天首次摸摸（抚摸或点击）、浇水或光照互动自动记录一个有效养育日，14 日进入成年体、累计 42 日进入完全体。无需单独打卡，漏做不扣进度；摸摸和成长不增加积分，养护任务仍按原规则结算，每日上限 20。
- **三阶段外观**：绿萝、龟背竹、多肉（桃太郎）、仙人球、狗尾巴草已配齐幼年体 / 成年体 / 完全体各六种状态，统一花盆大小与脚底位置；未配齐阶段素材的新物种仍回退原有形象，成长照常记录。
- **管理面板**：领养、养护计划与陪伴状态、免打扰、鼠标穿透、开机自启与重新领养；关闭面板时隐藏，托盘可再次唤起。
- **AI 创建植物（可选）**：通过图文对话识别植物、确定外形与养护习性，先确认幼年体 / 成年体 / 完全体三个主形象，再生成各阶段的互动状态；共 18 帧完整后加入本机素材库。
- **本地优先**：养护、积分与设置保存在本机，基础功能可离线使用；可选 AI 创建功能连接独立的芽伴 AI 服务。

## 开始使用

从仓库的 [Releases](https://github.com/s836064858/desktop-pet/releases) 下载对应平台安装包。

1. 安装并启动 **Sproutkin**，通过托盘打开芽伴面板。
2. 选择植物、填写昵称并确认养护间隔，点击「领养」。
3. 在桌面伙伴上悬浮显示 💧 / ☀️，点击完成对应养护；抚摸或拖动花盆与它互动。
4. 在面板查看任务与积分，并按需开启开机自启、免打扰等设置。

应用仅保留一个运行实例；运行期间再次打开 App，会唤起已有面板。关闭面板只会隐藏窗口，彻底退出请使用托盘菜单「退出」。

当前安装包未签名：macOS 挂载 DMG 后将 `Sproutkin.app` 拖入「应用程序」，首次打开若提示「已损坏，无法打开」或「无法验证开发者」，文件并没有损坏——打开「系统设置 → 隐私与安全性」滑到底部点「仍要打开」，或在终端执行 `xattr -d com.apple.quarantine /Applications/Sproutkin.app` 后重新打开；Windows 遇到 SmartScreen 提示时选择「仍要运行」。

应用内置自动更新：新版本正式发布后，已安装的用户启动应用即可自动收到更新（后台静默下载，完成后自动重启），无需重新下载安装包；也可在面板「偏好设置 → 检查更新」手动触发。

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

继续制作三阶段素材时，先阅读 [植物素材制作交接](SPRITE-HANDOFF.md)：包含五种植物的资源、提示词、锚点规范、废稿选择和脚本边界。

面板入口：「AI 创建植物」。用户以邀请码和名称激活；方舟和私有 TOS 由管理后台统一配置，不在桌面端填写供应商密钥。本地服务与管理后台的启动方式见 [AI 服务说明](server/README.md)。

桌面根目录、`admin/` 和 `server/` 各有 `.env.example`。桌面从根目录 `.env` 构建读取 `VITE_AI_API_ORIGIN`，默认 `http://127.0.0.1:3000`；改地址时同步更新 Tauri 的精确白名单并重新启动开发环境或构建。该变量是公开地址，不得存放凭证。

支持文字和植物参考图（PNG / JPEG / WebP，≤10 MB、1600 万像素）。服务端先生成三阶段档案和主形象，确认后生成各阶段的五张衍生帧。下载的 18 帧由桌面端自动检查并对齐，通过后可写入本机植物库。重新生成某阶段主形象会使该阶段衍生结果失效。关闭向导只停止本地等待，重新打开可恢复云端草稿；更换照片需重新确认档案。

每帧生成后，算法根据统一陶土花盆的颜色、连通区域与口沿轮廓自动取得中心和盆宽，从花盆相连的脚部检测基线，排除浅色地面阴影、绿色垂藤与独立特效。输出统一为透明 400×400、花盆中心 x=200、脚底 y=380、盆宽 180px；输出后再次检测位置、尺寸及脚底，衍生帧还需符合主形象的花盆几何比例。空图、无法可靠识别、原图触边、输出裁切或几何漂移会显示失败原因并阻止入库，可单独重生成异常帧；不会额外自动发起付费重生成。可选使用固定基线预览切换状态，入库保留归一化图片与自动锚点记录。算法校验范围是图像几何与裁切，三个主形象的造型仍由用户确认。

自定义物种保存在本机应用数据目录的 `sprite-library/`，新物种按 `juvenile` / `adult` / `full` 分目录保存。旧自定义物种保留原 `stage0`，三个成长阶段共用原有形象，不自动补图或迁移。入库后不提供独立修改习性的入口。

领养时仅需确认浇水、光照各每几天一次；AI 对话规划时同步生成这两项频率及一段习性介绍。习性介绍只供阅读，不参与额外判断。默认频率是养护提醒节奏，可在创建时结合实际环境调整。

旧版植物升级后一次性从幼年开始，保留积分与已完成养护历史；旧习性自动兼容，旧版未完成计划一次性重建。之后重启不会再次重置成长。

开发环境面板底部提供「DEV · 成长阶段调试」，可切换幼年体 / 成年体 / 完全体，面板与桌宠同步。预览写入独立调试数据库，不改变真实养育日、积分和任务；点击「恢复真实进度」结束预览。正式构建不包含该入口。

三阶段素材按物种映射生成：`node scripts/process-sprites.mjs <species> --growth-only`（例如 `pothos` 或 `monstera`）。该命令要求目标物种 18 帧齐全、归一化后不裁切，只生成三阶段帧，不覆盖旧 `stage0` 或其他物种已修正帧；加 `--preview` 可将候选输出到本机 `test/growth-preview/`。多物种映射与锚点保存在 `scripts/growth-sprites.json`，原始素材仍仅保留本机 `assets-src/`。

维护者素材 CLI（独立于桌面应用）：在仓库根目录的 `.env` 中配置脚本密钥（参照 `.env.example`，不要提交密钥）：

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
