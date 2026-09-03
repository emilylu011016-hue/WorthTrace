# 版本与环境说明

## 核心原则

代码只用一套 Git 管理；正式版、测试版、Demo 版通过不同数据库和启动方式区分。

## Git 分支

- `main`：正式稳定代码。
- `dev`：日常开发和测试代码。
- `tag`：稳定版本标记，例如 `v1.0.0`、`v1.0.1`、`v1.1.0`。

## 三个环境

### 正式版

- 用途：真实使用。
- 代码来源：`main` 的稳定代码。
- 数据库：正式数据库。
- 打开说法：打开正式版 APP。
- GitHub 下载版：给用户下载的正式安装包，对应某个 `tag` 版本。
- 新用户首次打开 GitHub 下载版时，本机还没有正式数据库，App 会根据迁移脚本创建一个新的空数据库，再由用户初始化和录入数据。

### 测试版

- 用途：验收新功能。
- 代码来源：通常是 `dev`。
- 数据库：测试数据库。
- 打开说法：打开最新版测试版 APP。

### Demo 版

- 用途：演示、脱敏测试。
- 代码来源：通常是 `dev` 或已发布版本。
- 数据库：Demo 数据库。
- 打开说法：打开 Demo 版 APP。
- Demo 版不是用户自己的空库。它带脱敏示例数据，用来演示完整界面和流程。
- 如果要模拟“新用户空库首次使用”，应使用正式版新安装数据库，或专门的空库初始化包。

## GitHub 下载版和数据库关系

- GitHub 只发布代码或安装包，不发布用户正式数据库。
- 用户下载正式版后，数据库在用户自己的电脑本地创建：
  `~/Library/Application Support/com.emilylu.financial-planning/financial_planning.sqlite3`
- 这个数据库一开始可以是空库/初始化状态；用户录入收支、资产、信用卡后，数据库才逐步建立。
- 测试库、Demo 库、备份库不应随 GitHub 正式下载包一起作为用户正式数据发布。
- 如果要给用户“试试看”的版本，用 Demo 包。
- 如果要给用户“真正开始使用”的版本，用正式包，让 App 自己创建用户本机数据库。

## 常用工作流

### 修改功能

1. 在 `dev` 修改代码。
2. 打开测试版 APP 验收。
3. 确认无误后提交 Git 记录。
4. 需要上线时，把 `dev` 合并到 `main`。
5. 打新版本标签。
6. 重新打包正式 APP。

### 手机跨网络/离线功能发布验收

涉及手机端或手机链接时，正式发布前额外确认：

1. `https://worth-trace.vercel.app` 已部署最新 PWA 版本。
2. 桌面 App “复制手机链接”生成公网 HTTPS 地址，不是局域网 IP。
3. 手机使用流量或另一 Wi-Fi 可以登录并记账。
4. 关闭电脑 App 后，手机仍能打开已缓存的 PWA。
5. 手机断网新增记录，恢复联网后记录进入云端草稿。
6. 电脑端登录同一账号后能拉取草稿；正式 SQLite 不上传云端。

### 修改数据

数据不进 Git。需要明确说修改哪个数据库：

- 只改正式数据库
- 只改测试数据库
- 只改 Demo 数据库

## 版本号规则

- `v1.0.0`：大版本正式发布。
- `v1.0.1`：小修复。
- `v1.1.0`：新功能发布。

## 自动更新（Tauri Updater）

桌面端通过 Tauri 2 官方 Updater 从 GitHub Release 自动更新。旧版 App 启动时检查 `https://github.com/emilylu011016-hue/WorthTrace/releases/latest/download/latest.json`，发现新版本则下载带签名的更新包，校验 Ed25519 签名后安装并重启。

### 发布新版本的步骤

1. 同步 bump 三处版本号：`package.json`、`src-tauri/Cargo.toml`、`src-tauri/tauri.conf.json`。
2. 合并到 `main` 后打 tag：`v<版本号>`（例如 `v2.9.1`）。
3. push tag 触发 `.github/workflows/release.yml`：CI 构建 macOS arm64/Intel 和 Windows，生成 `.sig` 签名和 updater 构件（`.app.tar.gz` / NSIS），自动创建 GitHub Release 并上传 `latest.json`。
4. **发布后必查 `latest.json`**：CI 的 tauri-action 存在已知时序问题——上传完 `.sig` 后立即读取 Release 资产列表，GitHub API 可能还没同步，导致日志出现 `Signature not found for the updater JSON. Skipping upload...`，`latest.json` 缺失。验证方法：`curl -sL https://github.com/emilylu011016-hue/WorthTrace/releases/latest/download/latest.json` 应返回 200 和当前版本号。若缺失，手动补传：按以下格式用 `gh release upload v<版本> latest.json --clobber` 上传，其中每个 platform 的 `signature` 是对应 `.sig` 文件的完整内容（用 `gh release download` 取回），`url` 是该平台更新包的 Release 下载地址，platform 键为 `darwin-aarch64` / `darwin-x86_64` / `windows-x86_64`：
   ```json
   {"version":"2.10.0","notes":"...","pub_date":"2026-09-03T11:30:00Z","platforms":{"darwin-aarch64":{"signature":"<.sig 文件内容>","url":"https://github.com/emilylu011016-hue/WorthTrace/releases/download/v2.10.0/<更新包文件名>"}}}
   ```
5. 用户侧旧版 App 自动检查更新，下载、校验、安装、重启。

### GitHub 仓库需要配置的 Secrets

- `TAURI_SIGNING_PRIVATE_KEY`：Ed25519 签名私钥（本机生成于 `src-tauri/keys/tauri-updater.key`，该目录已 gitignore，不进 Git）。
- `TAURI_SIGNING_PRIVATE_KEY_PASSWORD`：私钥密码。**注意：当前密钥是"空密码加密"格式（生成时用了 `--ci`），不是完全无密码**。CI 中此 secret 不配置时会得到空字符串，恰好能解锁；但本地命令行构建必须显式传 `TAURI_SIGNING_PRIVATE_KEY_PASSWORD=""`，否则 tauri CLI 会尝试交互式询问密码而失败（`Device not configured`）。

### 注意事项

- 私钥丢失或更换后，所有旧版本 App 都无法验证新更新包；换密钥必须同时更新 `src-tauri/tauri.conf.json` 里的 `plugins.updater.pubkey` 并让用户手动重装一次。
- 老版本（没有 updater 代码的版本）不会自动更新，必须手动从 GitHub Release 下载一次带 updater 的新版本安装包。
- 私钥只存在本机和 GitHub Secrets，不得提交进 Git，不得写进文档或聊天记录以外的共享位置。

## 推荐说法

- “打开测试版 APP，我要验收并修改这个功能。”
- “测试通过，把当前测试版发布到正式版，并打一个新版本号。”
- “只改 Demo 数据库，不影响正式版和测试版。”
