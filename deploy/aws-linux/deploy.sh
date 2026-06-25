#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────
# ProjectX Data Core — Amazon Linux 2023 / AL2 一键部署
#
# 用法（在 EC2 上，项目目录已上传或 git clone 后）:
#   sudo bash deploy/aws-linux/deploy.sh
#
# 部署前请准备好 backend/.env（含 DATABASE_URL、OP_* 等）
# 脚本会安装 Node 22、Nginx，构建前后端，后端监听 3060，Nginx :80 对外
# ─────────────────────────────────────────────────────────────
set -euo pipefail

BACKEND_PORT="${BACKEND_PORT:-3060}"
APP_USER="${APP_USER:-projectx}"
INSTALL_DIR="${INSTALL_DIR:-/opt/projectx-core-share}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

log() { echo "[deploy] $*"; }
die() { echo "[deploy] ERROR: $*" >&2; exit 1; }

[[ "$(id -u)" -eq 0 ]] || die "请使用 root 运行: sudo bash $0"

# ─── 1. 系统依赖 ───────────────────────────────────────────
log "安装系统包..."
if command -v dnf &>/dev/null; then
  PKG=dnf
elif command -v yum &>/dev/null; then
  PKG=yum
else
  die "未找到 dnf/yum，仅支持 Amazon Linux / RHEL 系"
fi

$PKG install -y git nginx rsync curl tar

if ! command -v node &>/dev/null || [[ "$(node -v | sed 's/v//' | cut -d. -f1)" -lt 20 ]]; then
  log "安装 Node.js 22..."
  curl -fsSL https://rpm.nodesource.com/setup_22.x | bash -
  $PKG install -y nodejs
fi
log "Node $(node -v)  npm $(npm -v)"

# ─── 2. 应用用户与目录 ─────────────────────────────────────
if ! id "$APP_USER" &>/dev/null; then
  useradd --system --home-dir "$INSTALL_DIR" --shell /sbin/nologin "$APP_USER"
fi
mkdir -p "$INSTALL_DIR"
log "同步代码到 $INSTALL_DIR ..."
rsync -a --delete \
  --exclude node_modules \
  --exclude dist \
  --exclude frontend/dist \
  --exclude '**/.env' \
  "$PROJECT_ROOT/" "$INSTALL_DIR/"

# ─── 3. 环境配置 ───────────────────────────────────────────
ENV_FILE="$INSTALL_DIR/backend/.env"
if [[ ! -f "$ENV_FILE" ]]; then
  if [[ -f "$PROJECT_ROOT/backend/.env" ]]; then
    cp "$PROJECT_ROOT/backend/.env" "$ENV_FILE"
    log "已复制 backend/.env"
  else
    cp "$INSTALL_DIR/backend/.env.example" "$ENV_FILE"
    log "已从 .env.example 生成 .env，请编辑后重新运行部署"
  fi
fi

# 确保 PORT=3060
if grep -q '^PORT=' "$ENV_FILE"; then
  sed -i "s/^PORT=.*/PORT=$BACKEND_PORT/" "$ENV_FILE"
else
  echo "PORT=$BACKEND_PORT" >> "$ENV_FILE"
fi

# ─── 4. 构建后端 ───────────────────────────────────────────
log "构建后端..."
cd "$INSTALL_DIR/backend"
npm ci
npm run build

# 加载 .env 后执行数据库迁移
set -a
# shellcheck disable=SC1090
source "$ENV_FILE"
set +a
npm run db:migrate || log "db:migrate 跳过或失败（若库未就绪请稍后手动执行）"

# ─── 5. 构建前端 ───────────────────────────────────────────
log "构建前端..."
cd "$INSTALL_DIR/frontend"
npm ci
npm run build

# ─── 6. Nginx ──────────────────────────────────────────────
log "配置 Nginx..."
sed "s|__INSTALL_DIR__|$INSTALL_DIR|g; s|__BACKEND_PORT__|$BACKEND_PORT|g" \
  "$SCRIPT_DIR/nginx-projectx.conf" \
  > /etc/nginx/conf.d/projectx.conf

# Amazon Linux 默认站点可能冲突
rm -f /etc/nginx/conf.d/default.conf 2>/dev/null || true
nginx -t
systemctl enable nginx
systemctl restart nginx

# ─── 7. Systemd 后端服务 ───────────────────────────────────
log "配置 systemd 服务..."
sed "s|__INSTALL_DIR__|$INSTALL_DIR|g; s|__APP_USER__|$APP_USER|g" \
  "$SCRIPT_DIR/projectx-backend.service" \
  > /etc/systemd/system/projectx-backend.service

chown -R "$APP_USER:$APP_USER" "$INSTALL_DIR"
systemctl daemon-reload
systemctl enable projectx-backend
systemctl restart projectx-backend

# ─── 8. 防火墙（firewalld 若启用）────────────────────────
if systemctl is-active firewalld &>/dev/null; then
  firewall-cmd --permanent --add-service=http || true
  firewall-cmd --reload || true
fi

# ─── 9. 健康检查 ───────────────────────────────────────────
sleep 2
if curl -sf "http://127.0.0.1:$BACKEND_PORT/health" >/dev/null; then
  log "后端健康检查通过 (port $BACKEND_PORT)"
else
  log "警告: 后端健康检查失败，请查看 journalctl -u projectx-backend -f"
fi

PUBLIC_IP="$(curl -sf http://169.254.169.254/latest/meta-data/public-ipv4 2>/dev/null || hostname -I | awk '{print $1}')"

echo ""
echo "══════════════════════════════════════════════════════"
echo " 部署完成"
echo "──────────────────────────────────────────────────────"
echo " 前端:  http://$PUBLIC_IP/"
echo " 后端:  http://$PUBLIC_IP:$BACKEND_PORT/health (内网直连)"
echo " 日志:  journalctl -u projectx-backend -f"
echo " 重载:  sudo systemctl restart projectx-backend nginx"
echo "──────────────────────────────────────────────────────"
echo " 请在 AWS 安全组放行: TCP 80 (HTTP)"
echo " 若需外网直连 API，另放行 TCP $BACKEND_PORT"
echo "══════════════════════════════════════════════════════"
