FROM node:20-alpine AS builder
WORKDIR /app

COPY tsconfig.base.json ./tsconfig.base.json
COPY apps/frontend/package.json ./apps/frontend/package.json
COPY apps/frontend/tsconfig.json ./apps/frontend/tsconfig.json
COPY apps/frontend/vite.config.ts ./apps/frontend/vite.config.ts
COPY apps/frontend/index.html ./apps/frontend/index.html
COPY apps/frontend/src ./apps/frontend/src

WORKDIR /app/apps/frontend
RUN npm install --production=false && npm run build

FROM nginx:1.25-alpine
COPY --from=builder /app/apps/frontend/dist /usr/share/nginx/html
RUN printf 'server {\n  listen 80;\n  root /usr/share/nginx/html;\n  index index.html;\n  location / {\n    try_files $uri $uri/ /index.html;\n  }\n}\n' > /etc/nginx/conf.d/default.conf
EXPOSE 80
