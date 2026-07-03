# ---- Build client ----
FROM node:20-alpine AS client-builder
WORKDIR /app/client
COPY client/package*.json ./
RUN npm ci
COPY client/ .
RUN npm run build

# ---- Build server ----
FROM node:20-alpine AS server-builder
WORKDIR /app/server
COPY server/package*.json ./
RUN npm ci --production
COPY server/ .

# ---- Runtime ----
FROM node:20-alpine
WORKDIR /app

COPY --from=client-builder /app/client/dist ./client/dist
COPY --from=server-builder /app/server ./server

EXPOSE 3000

ENV NODE_ENV=production

CMD ["node", "server/index.js"]
