# AWS Linux 部署说明

## 架构

```
浏览器
    ↓
  Nginx（已有或新建）
    ├── 静态前端 → frontend/dist
    └── /api /data /scoring /actions /socket.io → 后端 :3060
              ↓
         远程 MySQL
```

## 前置条件

1. **EC2 实例**：Amazon Linux 2023 / AL2
2. **MySQL**：已建库并跑过 `npm run db:migrate`
3. **backend/.env**：含 `DATABASE_URL`、`PORT=3060`、OpenProject 配置等

---

## 场景 A：服务器已有 Nginx（推荐）

只部署应用 + 写入 API 反代片段，**不安装、不覆盖**你现有的 `:80` 配置。

```bash
git clone https://github.com/shanglily01-lab/project.git
cd project
cp backend/.env.example backend/.env && vim backend/.env

sudo NGINX_MODE=snippet bash deploy/aws-linux/deploy.sh
```

脚本会生成 `/etc/nginx/conf.d/projectx-api.conf`。在你现有的 `server { }` 里加入：

```nginx
server {
    listen 80;
    server_name your-domain.com;

    # 你的其他配置...

    # ── ProjectX 前端（选一个路径或单独 server）──
    location / {
        root /opt/projectx-core-share/frontend/dist;
        try_files $uri $uri/ /index.html;
    }

    # ── ProjectX API 反代（必须）──
    include /etc/nginx/conf.d/projectx-api.conf;
}
```

然后：

```bash
sudo nginx -t && sudo systemctl reload nginx
```

---

## 场景 B：独立端口（不动现有 :80）

在 **8080** 提供完整站点（前端 + API），与现有 Nginx 不冲突：

```bash
sudo NGINX_MODE=site NGINX_HTTP_PORT=8080 bash deploy/aws-linux/deploy.sh
```

访问：`http://<EC2公网IP>:8080/`（安全组需放行 8080）

---

## 场景 C：全新机器 / 空 Nginx

自动监听 `:80`：

```bash
sudo bash deploy/aws-linux/deploy.sh
```

---

## 场景 D：只部署后端，自己配 Nginx

```bash
sudo SKIP_NGINX=1 bash deploy/aws-linux/deploy.sh
```

后端监听 `3060`，自行反代到该端口。

---

## 更新代码

```bash
cd ~/project
git pull
sudo bash deploy/aws-linux/update.sh
```

---

## 常用运维

| 操作 | 命令 |
|------|------|
| 后端日志 | `sudo journalctl -u projectx-backend -f` |
| 重启后端 | `sudo systemctl restart projectx-backend` |
| 重载 Nginx | `sudo nginx -t && sudo systemctl reload nginx` |
| 健康检查 | `curl http://127.0.0.1:3060/health` |

## 环境变量

| 变量 | 默认值 | 说明 |
|------|--------|------|
| `SKIP_NGINX` | `0` | `1` = 完全不配置 Nginx |
| `NGINX_MODE` | `auto` | `snippet` / `site` / `auto` |
| `NGINX_HTTP_PORT` | `8080` | `site` 模式监听端口（`auto` 空环境用 80） |
| `BACKEND_PORT` | `3060` | 后端端口 |
| `INSTALL_DIR` | `/opt/projectx-core-share` | 安装目录 |
