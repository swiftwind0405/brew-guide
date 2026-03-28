# Build stage for Next.js frontend
FROM node:22-alpine AS frontend-build

WORKDIR /app

ARG PNPM_VERSION=10.30.2

# Install pnpm
RUN corepack enable && corepack prepare pnpm@${PNPM_VERSION} --activate

# Copy and install frontend deps
COPY package.json pnpm-lock.yaml .pnpmrc ./
RUN pnpm install --frozen-lockfile

# Copy source and build
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN pnpm build

# Production image
FROM node:22-alpine AS production

WORKDIR /app

# Install build tools for better-sqlite3
RUN apk add --no-cache python3 make g++ curl

# Copy frontend standalone build
COPY --from=frontend-build /app/.next/standalone ./
COPY --from=frontend-build /app/.next/static ./.next/static
COPY --from=frontend-build /app/public ./public

# Install backend deps
WORKDIR /app/server
COPY server/package.json server/package-lock.json ./
RUN npm ci --omit=dev

# Copy backend code
COPY server/index.js ./

# Create data directory
RUN mkdir -p /data

# Environment
ENV NODE_ENV=production
ENV DATA_DIR=/data
ENV NEXT_PUBLIC_API_URL=http://localhost:3001

EXPOSE 3000 3001

# Start script
WORKDIR /app
RUN cat > start.sh << 'EOF'
#!/bin/sh
set -e

# Start backend
echo "Starting backend on port 3001..."
node server/index.js &
BACKEND_PID=$!

# Wait for backend to be ready
echo "Waiting for backend..."
for i in $(seq 1 30); do
  if curl -s http://localhost:3001/api/health > /dev/null 2>&1; then
    echo "Backend is ready!"
    break
  fi
  if [ $i -eq 30 ]; then
    echo "Backend failed to start"
    exit 1
  fi
  sleep 1
done

# Start frontend
echo "Starting frontend on port 3000..."
exec node server.js
EOF
RUN chmod +x start.sh

CMD ["./start.sh"]
