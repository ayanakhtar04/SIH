# --- Runtime Stage ---
FROM node:20-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
ENV PUPPETEER_SKIP_DOWNLOAD=true

# Copy node_modules from build stage (IMPORTANT)
COPY --from=build /app/node_modules ./node_modules

# Copy built output
COPY --from=build /app/dist ./dist
COPY package.json ./

# Non-root user
RUN addgroup -S app && adduser -S app -G app
USER app

CMD ["node", "dist/server.js"]
