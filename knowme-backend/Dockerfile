FROM node:20-alpine AS base
WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev

COPY prisma ./prisma
RUN npx prisma generate

COPY src ./src
COPY .env.example ./.env.example

ENV NODE_ENV=production
EXPOSE 5000
CMD ["node", "src/server.js"]
