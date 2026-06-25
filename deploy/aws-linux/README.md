# AWS Linux 部署说明

## 架构

```
浏览器 :80
    ↓
  Nginx  ──→  静态前端 (frontend/dist)
    │
    └── /api /data /scoring /actions /socket.io
              ↓
         后端 Node.js :3060
              ↓
         远程 MySQL
```

## 前置条件

1. **EC2 实例**：Amazon Linux 2023 或 Amazon Linux 2，建议 `t3.small` 及以上
2. **安全组**：放行 **TCP 80**（HTTP）；如需直连 API 再放行 **TCP 3060**
3. **MySQL**：已创建库表（本地开发跑过 `npm run db:migrate` 即可）
4. **backend/.env**：在部署前填好，至少包含：

```env
DATABASE_URL=mysql://user:pass@host:3306/project
PORT=3060
OP_TARGET=https://你的-openproject地址
OP_TOKEN=你的token
```

密码含特殊字符时请 URL 编码（如 `@` → `%40`）。

## 首次部署

```bash
# 1. 将项目上传到 EC2（示例：scp / git clone）
git clone <你的仓库> /home/ec2-user/projectx-core-share
cd projectx-core-share

# 2. 编辑环境变量
cp backend/.env.example backend/.env
vim backend/.env

# 3. 一键部署（需 root）
sudo bash deploy/aws-linux/deploy.sh
```

部署完成后访问：`http://<EC2公网IP>/`

## 更新代码

```bash
cd /home/ec2-user/projectx-core-share
git pull
sudo bash deploy/aws-linux/update.sh
```

## 常用运维

| 操作 | 命令 |
|------|------|
| 查看后端日志 | `sudo journalctl -u projectx-backend -f` |
| 重启后端 | `sudo systemctl restart projectx-backend` |
| 重启 Nginx | `sudo systemctl restart nginx` |
| 健康检查 | `curl http://127.0.0.1:3060/health` |
| 数据库迁移 | `cd /opt/projectx-core-share/backend && set -a && source .env && set +a && npm run db:migrate` |
| 导入 OP 数据 | `cd /opt/projectx-core-share/backend && set -a && source .env && set +a && npx tsx src/scripts/op-ingest.ts` |

## 环境变量

| 变量 | 默认值 | 说明 |
|------|--------|------|
| `INSTALL_DIR` | `/opt/projectx-core-share` | 安装目录 |
| `BACKEND_PORT` | `3060` | 后端监听端口 |
| `APP_USER` | `projectx` | 运行服务的系统用户 |

示例：自定义端口

```bash
sudo BACKEND_PORT=3060 bash deploy/aws-linux/deploy.sh
```
