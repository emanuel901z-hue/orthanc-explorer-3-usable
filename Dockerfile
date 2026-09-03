# OE3 Production Dockerfile — multi-stage build
# Build: docker build -t oe3 .
# Runtime: nginx:alpine serving static SPA + config.js

# ── Stage 1: Build SPA ──
FROM node:20-slim AS builder

WORKDIR /app

# Install bun (OE3 uses bun.lock)
RUN npm install -g bun

# Copy lock files first for cache
COPY package.json bun.lock bun.lockb ./

# Install deps
RUN bun install

# Copy source
COPY . .

# Build production bundle
RUN bun run build

# Replace dev config.js with production config
RUN cp public/config.prod.js dist/config.js

# ── Stage 2: Serve with nginx ──
FROM nginx:alpine

# Copy built assets
COPY --from=builder /app/dist /usr/share/nginx/html

# Copy custom nginx config (SPA fallback)
COPY docker/oe3-nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
