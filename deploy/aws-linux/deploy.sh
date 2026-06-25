#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────
# ProjectX Data Core — Amazon Linux 2023 / AL2 一键部署
#
# 用法:
#   sudo bash deploy/aws-linux/deploy.sh
#
# 服务器已有 Nginx 时（推荐）:
#   sudo SKIP_NGINX=0 NGINX_MODE=snippet bash deploy/aws-linux/deploy.sh
#   然后在你的 server {} 里: include /etc/nginx/conf.d/projectx-api.conf;
#
# 或使用独立端口提供完整站点（不占用 :80）:
#   sudo NGINX_MODE=site NGINX_HTTP_PORT=8080 bash deploy/aws-linux/deploy.sh
#
# 完全跳过 Nginx（只部署后端 + 构建前端）:
#   sudo SKIP_NGINX=1 bash deploy/aws-linux/deploy.sh
# ─────────────────────────────────────────────────────────────
set -euo pipefail

BACKEND_PORT="${BACKEND_PORT:-3060}"
APP_USER="${APP_USER:-projectx}"
INSTALL_DIR="${INSTALL_DIR:-/opt/projectx-core-share}"
SKIP_NGINX="${SKIP_NGINX:-0}"
NGINX_MODE="${NGINX_MODE:-auto}"       # auto | snippet | site | skip
NGINX_HTTP_PORT="${NGINX_HTTP_PORT:-8080}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

log() { echo "[deploy] $*"; }
die() { echo "[deploy] ERROR: $*" >&2; exit 1; }

[[ "$(id -u)" -eq 0 ]] || die "请使用 root 运行: sudo bash $0"

# ─── 1. 系统依赖 ───────────────────────────────────────────
log "安装系统依赖..."
if command -v dnf &>/dev/null; then
  PKG=dnf
elif command -v yum &>/dev/null; then
  PKG=yum
else
  die "未找到 dnf/yum，仅支持 Amazon Linux / RHEL 系"
fi

# 仅安装缺失的包；Amazon Linux 2023 自带 curl-minimal，勿再装 curl（会冲突）
install_missing_pkgs() {
  local want=("$@")
  local need=()
  for p in "${want[@]}"; do
    rpm -q "$p" &>/dev/null || need+=("$p")
  done
  if [[ ${#need[@]} -gt 0 ]]; then
    $PKG install -y "${need[@]}"
  else
    log "系统包已满足: ${want[*]}"
  fi
}

if ! command -v curl &>/dev/null; then
  die "需要 curl 命令，请执行: dnf install -y curl-minimal"
fi
install_missing_pkgs git rsync tar

if [[ "$SKIP_NGINX" != "1" ]] && ! command -v nginx &>/dev/null; then
  log "未检测到 Nginx，正在安装..."
  $PKG install -y nginx
fi

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

# ─── 6. Nginx（可选，兼容已有 Nginx）──────────────────────
configure_nginx() {
  local api_snippet="/etc/nginx/snippets/projectx-api.conf"
  mkdir -p /etc/nginx/snippets
  # 旧版误放在 conf.d 会导致 nginx -t 失败，清理
  rm -f /etc/nginx/conf.d/projectx-api.conf

  sed "s|__BACKEND_PORT__|$BACKEND_PORT|g" \
    "$SCRIPT_DIR/nginx-projectx-api.conf" > "$api_snippet"

  case "$NGINX_MODE" in
    snippet)
      log "Nginx 片段: $api_snippet"
      log "在你的 server {} 里加入: include $api_snippet;"
      log "前端静态目录: $INSTALL_DIR/frontend/dist"
      log "片段模式不自动 reload Nginx（避免未 include 时配置无效）"
      return 0
      ;;
    site)
      local site_conf="/etc/nginx/conf.d/projectx.conf"
      sed "s|__INSTALL_DIR__|$INSTALL_DIR|g; s|__NGINX_HTTP_PORT__|$NGINX_HTTP_PORT|g" \
        "$SCRIPT_DIR/nginx-projectx.conf" > "$site_conf"
      log "Nginx 独立站点: 端口 $NGINX_HTTP_PORT → $site_conf"
      ;;
    *)
      die "未知 NGINX_MODE=$NGINX_MODE"
      ;;
  esac

  nginx -t
  systemctl reload nginx 2>/dev/null || systemctl restart nginx
  log "Nginx 已 reload"
}

if [[ "$SKIP_NGINX" == "1" ]]; then
  log "跳过 Nginx 配置（SKIP_NGINX=1）"
elif ! command -v nginx &>/dev/null; then
  log "未安装 Nginx，跳过 Web 配置"
else
  if [[ "$NGINX_MODE" == "auto" ]]; then
    if [[ -f /etc/nginx/nginx.conf ]] && grep -rq "server {" /etc/nginx/conf.d/ 2>/dev/null; then
      NGINX_MODE=snippet
      log "检测到已有 Nginx 站点，使用 snippet 模式（不覆盖 :80 default）"
    else
      NGINX_MODE=site
      NGINX_HTTP_PORT=80
      log "空 Nginx 环境，使用 site 模式监听 :80"
    fi
  fi
  configure_nginx
fi

# ─── 7. Systemd 后端服务 ───────────────────────────────────
log "配置 systemd 服务..."
sed "s|__INSTALL_DIR__|$INSTALL_DIR|g; s|__APP_USER__|$APP_USER|g" \
  "$SCRIPT_DIR/projectx-backend.service" \
  > /etc/systemd/system/projectx-backend.service

chown -R "$APP_USER:$APP_USER" "$INSTALL_DIR"
systemctl daemon-reload
systemctl enable projectx-backend
systemctl restart projectx-backend

# ─── 8. 防火墙 ─────────────────────────────────────────────
if systemctl is-active firewalld &>/dev/null; then
  firewall-cmd --permanent --add-service=http || true
  [[ "$NGINX_MODE" == "site" && "$NGINX_HTTP_PORT" != "80" ]] && \
    firewall-cmd --permanent --add-port="${NGINX_HTTP_PORT}/tcp" || true
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
echo " 后端 API:  http://127.0.0.1:$BACKEND_PORT/health"
if [[ "$SKIP_NGINX" == "1" ]]; then
  echo " Nginx:     已跳过，请自行配置反代"
elif [[ "$NGINX_MODE" == "snippet" ]]; then
  echo " Nginx:     已写入 /etc/nginx/conf.d/projectx-api.conf"
  echo "            在你的 server {} 里 include 该文件"
  echo " 前端目录:  $INSTALL_DIR/frontend/dist"
elif [[ "$NGINX_MODE" == "site" ]]; then
  echo " 前端访问:  http://$PUBLIC_IP:$NGINX_HTTP_PORT/"
fi
echo " 日志:      journalctl -u projectx-backend -f"
echo "══════════════════════════════════════════════════════"
