# --- Build Stage ---
FROM node:20-alpine AS build
WORKDIR /app

# Install dependencies (only package.json + lock if present for better caching)
COPY package.json package-lock.json* ./
RUN npm install --production=false

# Copy source
COPY tsconfig.json ./
COPY src ./src

# Build TypeScript
RUN npm run build

# --- Runtime Stage ---
FROM node:20-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production

# Copy only needed files
COPY package.json package-lock.json* ./
RUN npm install --production --omit=dev

# Copy built dist and any runtime assets
COPY --from=build /app/dist ./dist
COPY .env.example ./

# Non-root user for security
RUN addgroup -S app && adduser -S app -G app
USER app

# Expose default port (can override at runtime)
EXPOSE 6060

# Healthcheck (optional basic TCP check)
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 CMD node -e "fetch('http://localhost:'+(process.env.PORT||6060)+'/api/health').then(r=>r.ok?process.exit(0):process.exit(1)).catch(()=>process.exit(1))" || exit 1

CMD ["node", "dist/server.js"]
