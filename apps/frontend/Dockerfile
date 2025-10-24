FROM node:20-alpine AS builder
WORKDIR /app
COPY package.json tsconfig.json index.html vite.config.ts ./ 
COPY src ./src
RUN npm install --production=false && npm run build

FROM nginx:1.25-alpine
COPY --from=builder /app/dist /usr/share/nginx/html
EXPOSE 80
