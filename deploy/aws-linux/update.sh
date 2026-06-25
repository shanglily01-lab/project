#!/usr/bin/env bash
# 仅重新构建并重启（不重复安装系统依赖）
set -euo pipefail

INSTALL_DIR="${INSTALL_DIR:-/opt/projectx-core-share}"
BACKEND_PORT="${BACKEND_PORT:-3060}"

[[ "$(id -u)" -eq 0 ]] || { echo "请 sudo 运行"; exit 1; }

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

echo "[update] 同步代码..."
rsync -a --delete \
  --exclude node_modules \
  --exclude dist \
  --exclude frontend/dist \
  --exclude '**/.env' \
  "$PROJECT_ROOT/" "$INSTALL_DIR/"

echo "[update] 构建后端..."
cd "$INSTALL_DIR/backend"
npm ci
npm run build

echo "[update] 构建前端..."
cd "$INSTALL_DIR/frontend"
npm ci
npm run build

chown -R projectx:projectx "$INSTALL_DIR"
systemctl restart projectx-backend nginx

sleep 2
curl -sf "http://127.0.0.1:$BACKEND_PORT/health" && echo "" && echo "[update] 完成" || echo "[update] 健康检查失败，查看 journalctl -u projectx-backend"
