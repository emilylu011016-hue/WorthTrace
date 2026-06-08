# V1 Release

发布日期：2026-06-07

## 版本

- App 版本：1.0.0
- 标记：V1
- 维护目录：`/Users/emilylu/Documents/Codex/financial_planning `

## 代码来源

V1 以当前测试验收通过的代码作为正式代码来源：

- 前端入口：`src/App.tsx`
- 全局样式：`src/styles/global.css`
- 后端逻辑：`src-tauri/src/lib.rs`
- Tauri 配置：`src-tauri/tauri.conf.json`

项目内不再保留多套前端/后端版本。测试版和正式版共用同一份代码。

## 数据库规则

正式版默认使用：

```text
~/Library/Application Support/com.emilylu.financial-planning/financial_planning.sqlite3
```

测试版使用：

```text
backups/test-databases/monthly_update_test.sqlite3
backups/test-databases/dashboard_test.sqlite3
```

测试库来自正式库复制。测试写入不影响正式库。

## 启动方式

正式 V1：

```text
/Applications/Financial Planning.app
```

源码启动：

```text
scripts/start_latest.command
```

测试验收：

```text
scripts/start_test.command
```

## 上线前备份

正式数据库 V1 备份：

```text
backups/v1-release/financial_planning_v1_2026-06-07.sqlite3
```

## V1 范围

- 月底财务信息更新
- 收入/支出导入、编辑、确认、异常处理
- 资产录入、定投计划、定投日历、买入/卖出/分红
- 资产持有 / 已清仓 / 暂不统计
- 信用卡调整
- 生成本月分析并同步到财务健康看板
- 财务健康看板
- 内容模板设置
- 香槟 / 鼠尾草 / 石墨主题

## 已知保留项

- 汇率覆盖仍使用临时输入框，后续单独优化。
- Playwright CLI 在当前环境因无法访问 npm registry，不能自动化截图验收。
