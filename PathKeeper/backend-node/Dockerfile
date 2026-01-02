# =====================
# BUILD STAGE
# =====================
FROM node:20-bookworm-slim AS build
WORKDIR /app

ENV PUPPETEER_SKIP_DOWNLOAD=true

COPY package.json package-lock.json ./
RUN npm install --production=false

COPY prisma ./prisma
RUN npx prisma generate

COPY tsconfig.json ./
COPY src ./src

RUN npm run build


# =====================
# RUNTIME STAGE
# =====================
FROM node:20-bookworm-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production

# Copy runtime artifacts
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY package.json ./

# Create non-root user AFTER files are copied
RUN addgroup -S app && adduser -S app -G app
USER app

CMD ["node", "dist/server.js"]
