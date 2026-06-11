# WorthTrace

本地优先的个人财务记录与分析 App。

## 当前状态

- 这是当前唯一维护的最新版源码目录。
- 当前正式版本：2.4.0。
- 桌面 App 使用 Tauri + React + TypeScript + SQLite。
- 已包含月底财务信息更新、财务健康看板、内容模板设置。
- 财务健康看板、首页、月底更新共用同一套香槟 / 鼠尾草 / 石墨主题。
- SQLite schema 和初始 seed 位于 `src-tauri/migrations/`。
- `finance-core` 包含储蓄率、信用卡调整、资产配置、XIRR 等核心计算。
- 当前以前端 `src/`、样式 `src/styles/`、后端 `src-tauri/src/` 为正式来源；数据库、备份和构建产物不进入 GitHub。

## 运行前置

需要：

- Node.js
- npm
- Rust / Cargo

当前本机已经可以完成前端构建和 Tauri/Rust 检查。

## 推荐启动方式

正式 App 通常安装到：

```text
/Applications/钱迹WorthTrace.app
```

日常使用优先双击这个 App。

如果需要从源码目录启动当前最新版开发 App，双击：


```text
scripts/start_latest.command
```

这个脚本会从当前项目目录启动源码版，并清空测试数据库环境变量，避免误连测试库。

测试验收双击：

```text
scripts/start_test.command
```

测试脚本会复制正式数据库到 `backups/test-databases/`，所有调试写入只进入测试库。

Demo 演示可双击：

```text
scripts/start_demo.command
```

Demo 脚本使用 `backups/demo-databases/` 里的脱敏 demo 数据库，不写正式库，也不写测试库。

如需从当前测试库重新生成 demo 数据：

```bash
python3 scripts/create_demo_database.py
```

## 命令

```bash
npm install
npm run tauri:dev
```

## 用户下载

普通用户不需要下载源码。发布后请进入 GitHub 仓库的 Releases 页面：

```text
Releases → WorthTrace v版本号
```

Mac 用户下载对应芯片版本：

```text
macOS Apple Silicon：适合 M1/M2/M3/M4 等新款 Mac
macOS Intel：适合旧款 Intel Mac
```

Windows 用户下载 Windows 安装包：

```text
Windows setup.exe
```

数据只保存在用户自己的电脑本地。第一次打开时，如果本机没有旧数据库，会进入初始化流程。

## 数据说明

App 启动时会在系统应用数据目录创建本地 SQLite 数据库：

```text
financial_planning.sqlite3
```

原始 Numbers 和鲨鱼 CSV 不会被修改。

## 版本整理规则

- 源码只看 `src/` 和 `src-tauri/`。
- `dist/` 是构建产物，可以重新生成，不作为旧版本来源。
- `node_modules/` 和 `src-tauri/target/` 是依赖/编译缓存，不作为旧版本来源。
- 正式安装版通常位于 `/Applications/钱迹WorthTrace.app`。
- 后续修改源码后，如果要更新正式安装版，需要重新打包并复制到 `/Applications`。
