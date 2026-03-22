FROM node:20-bookworm-slim AS build
WORKDIR /app

RUN apt-get update && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*
ENV PUPPETEER_SKIP_DOWNLOAD=true

COPY package.json package-lock.json ./
RUN npm install --production=false

COPY prisma ./prisma
RUN npx prisma generate

COPY tsconfig.json ./
COPY src ./src
RUN npm run build
RUN mkdir -p dist/templates && cp -r src/templates/* dist/templates/
RUN npx esbuild src/prisma/seed.ts --bundle --platform=node --outfile=dist/seed.js


FROM node:20-bookworm-slim AS runtime
WORKDIR /app

RUN apt-get update && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY package.json ./
COPY --from=build /app/prisma ./prisma

RUN groupadd --system app && useradd --system --gid app app
USER app

ENV NODE_ENV=production
EXPOSE 10000
CMD ["sh", "-c", "npx prisma db push && node dist/seed.js && node dist/server.js"]

