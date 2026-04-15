# syntax=docker/dockerfile:1
FROM node:20-alpine AS base
WORKDIR /app

# Copy lockfile + manifest first — this layer is cached until deps change.
COPY package*.json ./
# Use cache mount so npm registry data is reused across builds.
RUN --mount=type=cache,target=/root/.npm \
    npm install --omit=dev --prefer-offline

COPY src/ ./src/
COPY data/ ./data/

ENV NODE_ENV=production
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://localhost:3000/health || exit 1

CMD ["node", "src/index.js"]
