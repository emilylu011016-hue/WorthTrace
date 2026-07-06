#!/bin/zsh
set -euo pipefail

DIR="$(cd "$(dirname "$0")" && pwd)"
MOBILE_DIR="$DIR/pwa"
PORT="${WORTHTRACE_MOBILE_PORT:-5178}"
SYNC_PORT="${WORTHTRACE_SYNC_PORT:-18742}"
IP="$(ipconfig getifaddr en0 2>/dev/null || ipconfig getifaddr en1 2>/dev/null || echo "")"

if [ ! -d "$MOBILE_DIR" ]; then
  echo "找不到手机端文件夹：$MOBILE_DIR"
  echo "请确认已经完整解压 worthtrace-mobile-pwa-0.3.28.zip。"
  read -r "?按回车退出。"
  exit 1
fi

if [ -z "$IP" ]; then
  echo "没有找到局域网 IP。请确认电脑已连接 Wi-Fi 或手机热点。"
  read -r "?按回车退出。"
  exit 1
fi

URL="http://$IP:$PORT/index.html?mobileVersion=0.3.28&resetCache=1&syncUrl=http://$IP:$SYNC_PORT"
RESET_URL="http://$IP:$PORT/index.html?mobileVersion=0.3.28&resetCache=1&resetBinding=1&syncUrl=http://$IP:$SYNC_PORT"
LINK_PAGE="$DIR/手机打开链接.html"

cat > "$LINK_PAGE" <<HTML
<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>钱迹手机端链接</title>
  <style>
    body { margin: 0; font-family: -apple-system, BlinkMacSystemFont, "PingFang SC", sans-serif; background: #f8f0e2; color: #171b18; }
    main { max-width: 720px; margin: 0 auto; padding: 40px 22px; }
    h1 { margin: 0 0 14px; font-size: 30px; }
    p { line-height: 1.7; color: #5f685f; }
    a, code { word-break: break-all; }
    .box { margin: 18px 0; padding: 18px; border: 1px solid #e4d8c7; border-radius: 10px; background: #fffdfa; }
    .url { display: block; margin-top: 8px; font-size: 16px; font-weight: 700; color: #1f5f7a; }
  </style>
</head>
<body>
  <main>
    <h1>钱迹手机端链接</h1>
    <p>请把下面链接发到手机，手机和电脑需要在同一个 Wi-Fi 或热点。电脑 App 和这个终端窗口都要保持打开。</p>
    <div class="box">
      <strong>手机打开：</strong>
      <a class="url" href="$URL">$URL</a>
    </div>
    <div class="box">
      <strong>如果手机之前绑定过旧电脑，先打开这个重置链接：</strong>
      <a class="url" href="$RESET_URL">$RESET_URL</a>
    </div>
  </main>
</body>
</html>
HTML

open "$LINK_PAGE" >/dev/null 2>&1 || true

echo ""
echo "钱迹 WorthTrace 手机端 PWA 0.3.28"
echo ""
echo "请把这个链接发到手机："
echo "$URL"
echo ""
echo "如果手机之前绑定过旧电脑，先打开这个重置链接："
echo "$RESET_URL"
echo ""
echo "保持本窗口打开，手机才能访问。"
echo ""

cd "$MOBILE_DIR"
exec python3 -m http.server "$PORT" --bind 0.0.0.0
