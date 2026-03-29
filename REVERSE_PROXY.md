# 反向代理配置示例

## 使用场景

- 容器端口: `7567` (前端)
- 公网地址: `https://coffee.stanleywind.org:88`

## Nginx 反代配置

```nginx
server {
    listen 88 ssl http2;
    server_name coffee.stanleywind.org;

    # SSL 证书配置
    ssl_certificate /path/to/your/cert.pem;
    ssl_certificate_key /path/to/your/key.pem;

    # 前端静态资源
    location / {
        proxy_pass http://127.0.0.1:7567;
        proxy_http_version 1.1;
        
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        # WebSocket 支持 (如果需要)
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }

    # API 后端（如果使用子路径反代）
    location /api/ {
        proxy_pass http://127.0.0.1:3001/;
        proxy_http_version 1.1;
        
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

## 方案对比

### 方案 1：单端口（推荐）

前端和后端都通过 7567 访问，前端内部转发 API 请求到后端。

```yaml
environment:
  - NEXT_PUBLIC_API_URL=https://coffee.stanleywind.org:88/api
```

### 方案 2：独立 API 端口

如果需要直接访问后端 API：

```yaml
ports:
  - "7567:3000"     # 前端
  - "7568:3001"     # 后端 API（可选）
environment:
  - NEXT_PUBLIC_API_URL=https://api.coffee.stanleywind.org:88
```

Nginx 配置两个 server 块分别反代。

## 启动命令

```bash
# 使用示例配置
cp docker-compose.example.yml docker-compose.yml

# 启动
docker-compose up -d

# 查看日志
docker-compose logs -f
```
