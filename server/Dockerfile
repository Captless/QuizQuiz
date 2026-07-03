# ---- Build stage ----
FROM node:20-alpine AS builder
WORKDIR /app

# Copy all package.json files for workspace install
COPY package*.json ./
COPY client/package*.json ./client/
COPY server/package*.json ./server/

# Install ALL dependencies (devDeps needed for client build)
RUN npm ci

# Copy source code
COPY client/ ./client/
COPY server/ ./server/

# Build client
RUN npm run build -w client

# Remove devDependencies — only keep runtime deps
RUN npm prune --omit=dev

# ---- Runtime stage ----
FROM node:20-alpine
WORKDIR /app

COPY --from=builder /app/client/dist ./client/dist
COPY --from=builder /app/server ./server
COPY --from=builder /app/node_modules ./node_modules

EXPOSE 3000

ENV NODE_ENV=production

CMD ["node", "server/index.js"]
