FROM node:20-alpine AS base
WORKDIR /app

COPY package.json tsconfig.json ./
COPY src ./src

RUN npm install --production=false && npm run build

FROM node:20-alpine
WORKDIR /app
ENV NODE_ENV=production

COPY --from=base /app/package.json ./package.json
COPY --from=base /app/node_modules ./node_modules
COPY --from=base /app/dist ./dist

EXPOSE 4000
CMD ["node", "dist/server.js"]
