FROM node:20-alpine AS base
WORKDIR /app

# Dependencies
COPY package.json ./
RUN npm install --production

# Application code
COPY src/ ./src/
COPY data/ ./data/

ENV NODE_ENV=production
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://localhost:3000/health || exit 1

CMD ["node", "src/index.js"]
