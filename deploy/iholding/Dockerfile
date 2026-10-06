FROM node:22-alpine AS dependencies
WORKDIR /app
RUN apk add --no-cache libc6-compat openssl
COPY package.json package-lock.json ./
RUN npm ci

FROM dependencies AS operations
COPY prisma ./prisma
COPY prisma.config.ts ./
COPY deploy/iholding/bootstrap.mjs deploy/iholding/scheduler.mjs deploy/iholding/init-database.mjs ./deploy/iholding/
COPY worker/logs ./worker/logs
RUN DATABASE_URL=postgresql://build:build@127.0.0.1:5432/build \
    npx prisma migrate diff --from-empty --to-schema prisma/schema.prisma --script --output deploy/iholding/schema.sql
RUN mkdir -p /state && chown node:node /state
USER node
CMD ["node", "worker/logs/run.mjs"]

FROM dependencies AS builder
COPY . .
ARG NEXT_PUBLIC_URL_API
ARG NEXT_PUBLIC_COMPANY_SLUG=iholding
ARG NEXT_PUBLIC_COMPANY_NAME="I Holding"
ARG NEXT_PUBLIC_CARTO_API_KEY
ENV NEXT_PUBLIC_URL_API=$NEXT_PUBLIC_URL_API \
    NEXT_PUBLIC_COMPANY_SLUG=$NEXT_PUBLIC_COMPANY_SLUG \
    NEXT_PUBLIC_COMPANY_NAME=$NEXT_PUBLIC_COMPANY_NAME \
    NEXT_PUBLIC_CARTO_API_KEY=$NEXT_PUBLIC_CARTO_API_KEY \
    DATABASE_URL=postgresql://build:build@127.0.0.1:5432/build \
    JWT_SECRET=build-only-placeholder-not-used-at-runtime \
    MINIO_ENDPOINT=http://iholding-minio:9000 \
    NEXT_TELEMETRY_DISABLED=1
RUN npx prisma generate && npm run build

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production HOSTNAME=0.0.0.0 PORT=3000 NEXT_TELEMETRY_DISABLED=1
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs && \
    mkdir -p /app/backup && chown nextjs:nodejs /app/backup
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
USER nextjs
EXPOSE 3000
CMD ["node", "server.js"]
