FROM node:18-alpine

WORKDIR /app

# Install dependencies (including dev for build)
COPY package.json package-lock.json* ./
RUN npm ci --production=false --prefer-offline

# Copy source
COPY prisma ./prisma
COPY tsconfig.json ./
COPY src ./src

# Build and prune dev deps
RUN npm run build && npm prune --production

EXPOSE 4000

ENV NODE_ENV=production

CMD ["node", "dist/server.js"]
