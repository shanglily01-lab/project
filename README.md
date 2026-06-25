# ProjectX Data Core

项目跟踪数据底座 + 运营前端。

---

## 包含 / 不包含

**✅ 包含**
- **后端（数据底座）**：OpenProject + CodeCommit 数据采集、跨源身份对号、MySQL 持久化（10 张数据表）、只读 `/data/*` API + Socket.io 实时刷新。
- **前端（运营看板）**：每日动态 Feed、人员、个人深度页、团队看板、排行、月度、项目与项目详情、OpenProject 任务表、探索、设置；保留 agent 建议交互（收件箱/自辩卡/关联建议）与 chat 问答的前端组件。

---

## ⚠️ 前端页面与后端接口的关系（务必先读）

后端是**纯数据底座**，只提供 `/data/*`。前端保留的多数页面（Feed、Scorecard、Team、
Leaderboard、Monthly、Projects、ProjectDetail、People、Explore 及收件箱/chat 等）原本面向
完整平台，调用的是 `/scoring/*` 和 `/ai/*` 接口——**这些接口本包后端并不提供**。因此：

- **开箱即用**：`OpenProject` 任务表（走 `/data`，由 store 提供）。
- **需要你自行对接后端**：上述调用 `/scoring/*`、`/ai/*` 的页面。前端代码（`api/scoring.ts`、
  `api/agent.ts` 及各页面）完整保留，可据此实现或对接一个提供这些接口的后端。
---

## 已脱敏（使用前请替换）

| 文件 | 内容 |
|---|---|
| `backend/src/ontology/roster.ts` | 团队成员名册（姓名 / OpenProject 显示名 / git 邮箱） |
| `backend/src/config/git-aliases.ts` | git 邮箱别名映射 |
| `backend/src/config/repo-watch.ts` | 要扫描的 CodeCommit 仓库 → 项目映射 |
| `backend/.env.example` | 所有连接配置（数据库 / OpenProject / AWS），全部为空占位 |

---

## 目录结构

```
projectx-core-share/
├── backend/                    # 数据底座
│   ├── .env.example
│   ├── drizzle/0000_init.sql   # 单一干净迁移（10 张数据表）
│   └── src/
│       ├── index.ts            # 数据 API server（轮询 OpenProject → /data/* + WS）
│       ├── pipeline.ts         # 落库 ingest：OpenProject / CodeCommit / 活动日志
│       ├── adapters/ ontology/ db/ config/ scripts/
└── frontend/                   # 运营看板（React 19 + Vite + Zustand）
    ├── vite.config.ts          # dev 代理：/data /scoring /ai /actions /socket.io → :3100
    └── src/{pages,components,store,hooks,layouts,api}
```

---

## 快速开始

### 前置条件

- Node.js 20+
- MySQL 8.0+（本地安装或远程实例）

### 1. 创建数据库

```sql
CREATE DATABASE syphonix CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'syphonix'@'localhost' IDENTIFIED BY 'syphonix';
GRANT ALL PRIVILEGES ON syphonix.* TO 'syphonix'@'localhost';
FLUSH PRIVILEGES;
```

### 2. 后端

```bash
cd backend
cp .env.example .env          # 填入 MySQL / OpenProject / AWS 配置
npm install
npm run db:migrate
npm run db:seed               # 先改 roster.ts
npm run serve                 # → http://localhost:3100
```

### 3. 前端

```bash
cd frontend
npm install
npm run dev                   # → http://localhost:3001
```

### 4. 导入数据（可选）

```bash
cd backend
npm run op:ingest             # 拉取 OpenProject 工作包入库
npm run code:ingest           # 扫描 CodeCommit 提交入库
```

### 后端运维脚本

| 命令 | 作用 |
|---|---|
| `npm run op:check` | 验证 OpenProject 连接 + 列出工作包 |
| `npm run op:users` | 列出 OpenProject 用户 |
| `npm run seed:op` | 从 OpenProject 用户派生名册 |
| `npm run op:ingest` | 拉取 OpenProject 工作包入库 |
| `npm run code:ingest` | 扫描 CodeCommit 提交入库 |
| `npm run repos:list` | 列出 CodeCommit 仓库及监控状态 |

---

## 配置项（backend/.env）

| 变量 | 说明 |
|---|---|
| `DATABASE_URL` | MySQL 连接串，如 `mysql://user:pass@localhost:3306/syphonix` |
| `OP_TARGET` / `OP_TOKEN` | OpenProject 地址（无尾斜杠）+ API token |
| `COMPANY_EMAIL_DOMAIN` | 可选；限定名册派生只取该邮箱域 |
| `AWS_REGION` / `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` | CodeCommit 只读凭证（留空用默认 AWS 凭证链） |
| `PORT` / `POLL_INTERVAL_MS` / `LOG_LEVEL` | server 运行参数 |

---
