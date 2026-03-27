# Brew Guide SQLite 部署指南

## 架构变更

- **前端**: Next.js (Standalone 模式)
- **后端**: Express + better-sqlite3
- **部署**: Docker + GitHub Container Registry

## 本地开发

```bash
# 1. 安装依赖
pnpm install
cd server && npm install

# 2. 启动后端
npm run dev

# 3. 启动前端
pnpm dev

# 前端访问: http://localhost:3000
# API 访问: http://localhost:3001
```

## Docker 部署

```bash
# 构建镜像
docker build -t brew-guide .

# 运行
docker run -d \
  -p 3000:3000 \
  -p 3001:3001 \
  -v $(pwd)/data:/data \
  --name brew-guide \
  brew-guide
```

## GitHub Container Registry

打 tag 自动发布：

```bash
git tag v1.0.0
git push origin v1.0.0
```

镜像地址：`ghcr.io/<user>/brew-guide:v1.0.0`

## API 端点

| 端点 | 方法 | 说明 |
|------|------|------|
| `/api/health` | GET | 健康检查 |
| `/api/beans` | GET/POST | 咖啡豆列表/创建 |
| `/api/beans/:id` | GET/PATCH/DELETE | 咖啡豆详情/更新/删除 |
| `/api/notes` | GET/POST | 冲煮笔记列表/创建 |
| `/api/notes/:id` | GET/PATCH/DELETE | 笔记详情/更新/删除 |
| `/api/equipments` | GET/POST | 器具列表/创建 |
| `/api/methods` | GET/POST | 方案列表/创建 |
| `/api/grinders` | GET/POST | 磨豆机列表/创建 |
| `/api/settings` | GET/PUT | 应用设置 |
| `/api/export` | GET | 导出所有数据 |
| `/api/import` | POST | 导入数据 |

## 环境变量

```
PORT=3001              # 后端端口
DATA_DIR=/data         # SQLite 数据目录
NEXT_PUBLIC_API_URL=http://localhost:3001
```

## 数据持久化

SQLite 文件存储在 `/data/brew-guide.db`，建议挂载 volume：

```yaml
volumes:
  - ./data:/data
```

## Skill 调用示例

```bash
# 添加咖啡豆
curl -X POST http://localhost:3001/api/beans \
  -H "Content-Type: application/json" \
  -d '{"name":"Ethiopia Yirgacheffe","roastLevel":"浅烘","capacity":250}'

# 获取所有咖啡豆
curl http://localhost:3001/api/beans

# 更新剩余量
curl -X PATCH http://localhost:3001/api/beans/<id> \
  -d '{"remaining":180}'
```
