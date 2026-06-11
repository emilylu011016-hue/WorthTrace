# 钱迹WorthTrace 项目结构说明

更新时间：2026-06-11

## 这个项目在哪里

项目主文件夹：

`/Users/emilylu/Documents/Codex/financial_planning `

这里放的是钱迹WorthTrace 的源码、脚本、文档、图标、测试库和 demo 库。

## 不在项目文件夹里的重要东西

正式 App：

`/Applications/钱迹WorthTrace.app`

用户目录里的正式 App 副本：

`/Users/emilylu/Applications/钱迹WorthTrace.app`

测试 App：

`/Users/emilylu/Applications/钱迹WorthTrace 测试版.app`

正式数据库：

`/Users/emilylu/Library/Application Support/com.emilylu.financial-planning/financial_planning.sqlite3`

说明：正式数据库不放在项目文件夹里，这是 macOS App 的正常数据位置。

## 需要保留的核心源码

`src/`

前端界面代码。主要页面、交互、看板、初始化、偏好设置都在这里。

`src/styles/`

前端样式。视觉风格、布局、浮窗、图表外观相关。

`src-tauri/src/`

后端逻辑。数据库读写、导入、汇率、月报、同步、看板数据计算等都在这里。

`src-tauri/migrations/`

数据库初始化和迁移脚本。新用户建库时会用。

`src-tauri/icons/`

App 图标。现在正式版和测试版图标都在这里。

`scripts/`

辅助脚本。包括打开测试版、打开 demo、创建 demo 数据库、导出检查表等。

`docs/`

项目说明文档。包括架构、公式、版本流程和当前这份结构说明。

`brand/`

当前品牌资产。保留钱迹 WorthTrace 的 logo 源文件和品牌说明。

## 依赖和配置

`package.json`

前端项目配置。记录怎么启动、构建，以及用到哪些前端依赖。

`package-lock.json`

前端依赖锁定文件。保证别人安装出来的依赖版本一致。

`node_modules/`

前端依赖包。可以理解为“工具零件仓库”。删除不会丢代码，但下次开发或打包前要重新安装。

`src-tauri/Cargo.toml`

后端项目配置。

`src-tauri/Cargo.lock`

后端依赖锁定文件。

`src-tauri/tauri.conf.json`

桌面 App 配置。App 名字、窗口大小、打包图标等在这里。

## 数据库相关

`backups/test-databases/`

测试环境当前使用的数据库。测试版 App 会读这里。

`backups/demo-databases/`

Demo 环境当前使用的数据库。Demo App 会读这里。

`backups/archive/`

旧数据库备份归档。保留历史快照，但不参与当前 App 运行。

`database/demo/`

Demo 数据库导出和可编辑资料。不是正式 App 的运行库。

`database/financial_planning_db_check.xlsx`

数据库检查导出表。用于人工查看数据库内容。

## 可以重新生成的文件

`dist/`

前端构建产物。已经删除。下次构建会重新生成。

`src-tauri/target/`

桌面 App 编译缓存。已经删除。下次打包会重新生成，可能比较慢。

`output/`

临时分析、截图、notebook 输出。已经按本次整理删除。

`.codex-runtime/`

本地启动记录和日志。已经删除。

`.playwright-cli/`

浏览器自动测试记录。已经删除。

`.DS_Store`

macOS 自动生成的文件夹显示配置。已经删除。

## 已删除的历史文件

`demo/`

之前的品牌探索、宣传视频、截图和 demo 素材。已按要求删除。当前正式品牌资料已整理到 `brand/`。

`/Users/emilylu/Documents/Codex/financial-planning-v2.0.0.bundle`

旧 Git 打包快照。已删除。

`/Users/emilylu/Documents/Codex/financial-planning-v2.0.0.zip`

旧压缩包。已删除。

`/Users/emilylu/Documents/Codex/financial-planning-demo-v2.0.0.bundle`

旧 demo Git 打包快照。已删除。

`/Users/emilylu/Documents/Codex/financial-planning-demo-v2.0.0.zip`

旧 demo 压缩包。已删除。

## 当前三套环境

正式版：

使用正式 App 和正式数据库。适合真实使用。

测试版：

使用测试 App 和测试数据库。适合功能验收，不影响正式数据库。

Demo 版：

使用 demo 数据库。适合给别人演示或模拟新用户。

## 日常使用建议

如果要继续改功能：先改测试版。

如果测试通过：再发布到正式版。

如果要给朋友体验：用 demo 数据库或新用户初始化数据库，不要给正式数据库。

如果文件夹又变乱：优先检查这些地方：

- `src-tauri/target/`：编译缓存，可删。
- `dist/`：构建产物，可删。
- `output/`：临时输出，可删。
- `.codex-runtime/`：启动日志，可删。
- `.playwright-cli/`：测试日志，可删。
