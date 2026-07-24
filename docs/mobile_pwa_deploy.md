# 手机端 PWA 发布流程

## 目标

手机端发布为一个公开 HTTPS 网址。用户用手机 Safari 打开网址，登录账号，然后添加到主屏幕。之后手机和电脑不需要在同一个 Wi-Fi 或热点下，手机记账变更先进入云端草稿箱，电脑端登录同一账号并拉取后自动应用到本地统计。

## 发布到 Vercel

1. 把当前仓库推到 GitHub。
2. 打开 Vercel，选择 New Project，导入 `WorthTrace` 仓库。
3. Framework Preset 选择 Other。
4. Build Command 填：

```bash
npm run build:mobile
```

5. Output Directory 填：

```bash
dist-mobile
```

6. 部署完成后，复制 Vercel 给出的 `https://...vercel.app` 网址。

## Supabase 设置

在 Supabase 项目里打开 Authentication -> URL Configuration：

- Site URL：填上面 Vercel 的正式网址。
- Redirect URLs：增加 `https://你的域名/**`。

在 Supabase SQL Editor 里执行：

```sql
-- 见 docs/supabase_mobile_dashboard_snapshots.sql
```

这张表用于保存电脑端已发布月报看板。手机和电脑登录同一个账号后，手机可以远程读取资产、收支、资产配置和目标偏离。

## 用户使用流程

1. 手机 Safari 打开正式网址。
2. 输入邮箱和密码登录或注册。
3. 点 Safari 分享按钮，选择“添加到主屏幕”。
4. 以后从桌面图标打开即可记账。
5. 电脑端打开钱迹 WorthTrace，登录同一个账号。
6. 在账号同步里点击“同步看板到手机”，手机即可显示电脑端已发布月报看板。
7. 手机记账后，电脑端刷新并拉取云端变更；系统自动应用并刷新已发布看板。

## 注意

`127.0.0.1` 和 `localhost` 只能在本机使用。手机用流量或不在同一个网络时，必须使用 Vercel 这种公开 HTTPS 网址。
