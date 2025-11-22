FROM node:20-alpine

WORKDIR /app

COPY prisma/schema.prisma ./schema.prisma
COPY ops/prisma-studio/package*.json ./

RUN npm ci --omit=dev

COPY ops/prisma-studio/start.sh ./start.sh
RUN chmod +x ./start.sh

ENV PORT=5555
EXPOSE 5555

CMD ["./start.sh"]
