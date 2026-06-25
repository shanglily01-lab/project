#!/usr/bin/env bash
# 仅重新构建并重启（不重复安装系统依赖）
set -euo pipefail

INSTALL_DIR="${INSTALL_DIR:-/opt/projectx-core-share}"
BACKEND_PORT="${BACKEND_PORT:-3060}"
APP_USER="${APP_USER:-projectx}"

[[ "$(id -u)" -eq 0 ]] || { echo "请 sudo 运行"; exit 1; }

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

mkdir -p "$INSTALL_DIR"

echo "[update] 同步代码..."
rsync -a --delete \
  --exclude node_modules \
  --exclude dist \
  --exclude frontend/dist \
  --exclude '**/.env' \
  "$PROJECT_ROOT/" "$INSTALL_DIR/"

# 首次更新时把本地 .env 同步到安装目录（若尚未存在）
if [[ -f "$PROJECT_ROOT/backend/.env" && ! -f "$INSTALL_DIR/backend/.env" ]]; then
  cp "$PROJECT_ROOT/backend/.env" "$INSTALL_DIR/backend/.env"
  echo "[update] 已复制 backend/.env 到 $INSTALL_DIR"
fi

echo "[update] 构建后端..."
cd "$INSTALL_DIR/backend"
npm ci
npm run build

echo "[update] 构建前端..."
cd "$INSTALL_DIR/frontend"
npm ci
npm run build

if ! id "$APP_USER" &>/dev/null; then
  echo "[update] 创建系统用户 $APP_USER ..."
  useradd --system --home-dir "$INSTALL_DIR" --shell /sbin/nologin "$APP_USER"
fi
chown -R "$APP_USER:$APP_USER" "$INSTALL_DIR"

SERVICE_FILE="/etc/systemd/system/projectx-backend.service"
if [[ ! -f "$SERVICE_FILE" ]]; then
  echo "[update] 注册 systemd 服务..."
  sed "s|__INSTALL_DIR__|$INSTALL_DIR|g; s|__APP_USER__|$APP_USER|g" \
    "$SCRIPT_DIR/projectx-backend.service" > "$SERVICE_FILE"
  systemctl daemon-reload
  systemctl enable projectx-backend
fi

systemctl restart projectx-backend

if command -v nginx &>/dev/null && [[ -f /etc/nginx/conf.d/projectx-api.conf || -f /etc/nginx/conf.d/projectx.conf ]]; then
  nginx -t && systemctl reload nginx
fi

sleep 2
if curl -sf "http://127.0.0.1:$BACKEND_PORT/health" >/dev/null; then
  echo "[update] 完成 — http://$(curl -sf http://169.254.169.254/latest/meta-data/public-ipv4 2>/dev/null || echo '127.0.0.1')/"
else
  echo "[update] 健康检查失败，查看: journalctl -u projectx-backend -f"
  exit 1
fi
