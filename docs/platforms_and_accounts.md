# WorthTrace 平台与账号说明

本文件记录 WorthTrace 当前用到的平台、各自用途、关键配置和注意事项。它只记录项目连接关系，不保存私密密码。

## 总览

| 平台 / 工具 | 当前用途 | 谁使用 | 是否直接存用户财务数据 |
| --- | --- | --- | --- |
| GitHub | 源码托管、版本 tag、Release 安装包 | 开发者、新用户下载桌面版 | 否 |
| GitHub Actions | 自动构建 macOS / Windows 安装包 | 开发者 | 否 |
| Vercel | 托管手机端 PWA 网址 | 手机用户 | 否，前端只访问 Supabase |
| Supabase | 账号登录、云端草稿箱、云端看板快照 | 手机端和电脑端 | 是，存手机草稿和看板快照 |
| Resend | Supabase 登录验证邮件发送 | 注册 / 验证邮箱用户 | 否 |
| 本地 SQLite | 电脑端正式财务数据库 | 桌面 App | 是，核心正式数据 |
| Tauri | 桌面 App 框架 | 开发 / 打包 | 否 |
| React / Vite | 桌面前端和手机 PWA 前端 | 开发 / 构建 | 否 |
| Rust / Cargo | Tauri 后端、本地数据库逻辑、打包 | 开发 / 构建 | 否 |

## GitHub

用途：

- 托管 WorthTrace 源码。
- 保存正式版本 tag，例如 `v2.7.7`。
- 发布桌面 App 安装包。
- 触发 GitHub Actions 自动打包。

当前仓库：

```text
emilylu011016-hue/WorthTrace
```

当前分支规则：

- `main`：正式发布分支。
- `dev`：开发和测试分支。目前通常和最新正式版保持同步。
- `tag`：正式版本标记，例如 `v2.7.7`。

注意：

- GitHub 不应该包含用户正式数据库。
- GitHub 不应该包含测试库、demo 库、备份库。
- 新用户从 GitHub 下载桌面版后，本机数据库是空的，用户自己初始化后才产生自己的数据。

## GitHub Actions

用途：

- 根据 GitHub 代码自动构建发布安装包。
- 当前主要用于 macOS / Windows 桌面版发布。

相关文件：

```text
.github/workflows/release.yml
```

注意：

- 它只负责打包 App，不负责上传或生成用户数据库。
- 构建产物进入 GitHub Release。

## Vercel

用途：

- 托管手机端 PWA。
- 让手机在不和电脑同一个 Wi-Fi / 热点时，也能打开手机记账页面。
- 手机用户用 Safari 打开后，可以添加到主屏幕，形成一个 App 壳。

当前正式手机网址：

```text
https://worth-trace.vercel.app
```

当前构建配置：

```text
Build Command: npm run build:mobile
Output Directory: dist-mobile
```

相关文件：

```text
vercel.json
mobile/pwa/
scripts/build-mobile-pwa.mjs
```

注意：

- Vercel 只托管前端静态页面。
- Vercel 不保存用户财务数据。
- 手机端的数据同步依赖 Supabase。
- 每次手机 PWA 逻辑更新后，需要更新 `mobile/pwa` 里的版本号，避免手机继续使用旧缓存。

## Supabase

用途：

- 提供账号登录 / 注册。
- 保存手机端记账草稿。
- 保存电脑端上传的已发布月报看板快照。
- 让手机和电脑即使不在同一网络，也能通过同一个账号同步。

当前 Supabase 项目：

```text
Project name: worthtrace
Project URL: https://yyhuxgxohiguyaskhqco.supabase.co
```

当前前端使用的 publishable key：

```text
sb_publishable_TW9SJoYzougEOl5vvHZVpg_17iMWHH9
```

当前主要表：

```text
mobile_cloud_drafts
mobile_dashboard_snapshots
```

表用途：

- `mobile_cloud_drafts`：手机记账草稿箱。手机写入，电脑拉取到本地收件箱后再确认入库。
- `mobile_dashboard_snapshots`：电脑端已发布月报看板快照。电脑上传，手机读取，用于显示净资产、收支、资产配置、目标偏离等。

相关文件：

```text
src/cloudSync.ts
mobile/pwa/app.js
docs/supabase_mobile_dashboard_snapshots.sql
```

安全规则：

- 已启用 Row Level Security。
- 用户只能读取 / 写入自己的数据。
- 正式本地 SQLite 数据库不会直接上传到 Supabase。
- Supabase 只存“同步所需数据”：手机草稿和看板快照。

注意：

- 如果电脑端提示 `JWT expired`，说明登录 token 过期。当前版本已加自动刷新；如果仍失败，退出账号后重新登录。
- 如果手机资产显示 0，通常说明电脑端还没有点击“同步看板到手机”，或手机仍在使用旧 PWA 缓存。

## Resend

用途：

- 给 Supabase Authentication 发送注册 / 验证邮件。
- 用户注册时，如果 Supabase 要求邮箱验证，会通过邮件完成验证。

当前使用方式：

- Resend 作为 Supabase 的邮件发送服务。
- Gmail 测试可收到邮件。
- 163 邮箱之前出现过收不到验证邮件的问题。

注意：

- Resend 不保存 WorthTrace 财务数据。
- 如果验证邮件收不到，先检查垃圾邮件，再确认 Supabase SMTP / Resend 配置。
- 免费额度和发信限制需要在 Resend 后台查看。

## 本地 SQLite

用途：

- 电脑端正式财务数据库。
- 保存正式资产、收支、月报、配置、密码状态等核心数据。

正式数据库位置：

```text
~/Library/Application Support/com.emilylu.financial-planning/financial_planning.sqlite3
```

注意：

- 这是最重要的数据源。
- GitHub、Vercel 不保存这个数据库。
- 手机记账进入 Supabase 草稿箱后，需要电脑端拉取并确认，才会进入本地正式数据库。
- 新用户安装桌面 App 后，会在自己的电脑上生成自己的空数据库。

## Tauri / Rust / Cargo

用途：

- 构建桌面 App。
- Rust 负责本地 SQLite 读写、导入、月报、手机同步入口等。

相关路径：

```text
src-tauri/
src-tauri/src/lib.rs
src-tauri/migrations/
```

常用命令：

```bash
npm run tauri:dev
npm run tauri:build
```

## React / Vite / npm

用途：

- 桌面端 UI。
- 手机端 PWA UI。
- 前端构建。

相关路径：

```text
src/
src/styles/
mobile/pwa/
```

常用命令：

```bash
npm run build
npm run build:mobile
```

## 当前同步流程

手机记账：

1. 手机打开 `https://worth-trace.vercel.app`。
2. 登录账号。
3. 记收入 / 支出 / 信用卡调整。
4. 手机草稿写入 Supabase `mobile_cloud_drafts`。
5. 电脑端登录同一账号。
6. 电脑端拉取云草稿到本地收件箱。
7. 用户在电脑端确认后，才进入本地 SQLite 正式数据库。

看板同步：

1. 电脑端本地 SQLite 已经生成已发布月报。
2. 电脑端登录账号。
3. 点击“同步看板到手机”。
4. 电脑端把月报看板快照写入 Supabase `mobile_dashboard_snapshots`。
5. 手机端登录同一账号后读取这份快照。

## 用户下载流程

新用户下载桌面版：

1. 从 GitHub Release 下载桌面安装包。
2. 打开桌面 App。
3. 初始化自己的账户和本地数据库。
4. 如需手机同步，注册 / 登录账号。
5. 手机打开 Vercel 网址，登录同一账号。

新用户使用手机版：

1. 手机 Safari 打开 Vercel 网址。
2. 登录 / 注册账号。
3. 添加到主屏幕。
4. 手机端可先记草稿。
5. 后续安装桌面版并登录同一账号后，电脑端可以拉取这些草稿。

## 不要混淆

- GitHub 是代码和安装包，不是数据库。
- Vercel 是手机网页托管，不是数据库。
- Supabase 是账号和云同步，不是正式完整财务数据库。
- Resend 是邮件，不是账号数据库。
- 本地 SQLite 才是电脑端正式财务数据库。
