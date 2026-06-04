FROM node:20-alpine AS base

# 1. Instala as dependências
FROM base AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci

# 2. Constrói o projeto (Build)
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Declara argumentos de build para variáveis públicas
ARG NEXT_PUBLIC_URL_API
ARG NEXT_PUBLIC_COMPANY_SLUG
ARG NEXT_PUBLIC_COMPANY_NAME

# Expõe como variáveis de ambiente para o Next.js no momento do build
ENV NEXT_PUBLIC_URL_API=${NEXT_PUBLIC_URL_API}
ENV NEXT_PUBLIC_COMPANY_SLUG=${NEXT_PUBLIC_COMPANY_SLUG}
ENV NEXT_PUBLIC_COMPANY_NAME=${NEXT_PUBLIC_COMPANY_NAME}

# Permite usar um arquivo .env específico para o build (ex: .env.test)
ARG ENV_FILE
RUN if [ -n "$ENV_FILE" ] && [ -f "$ENV_FILE" ]; then cp "$ENV_FILE" .env; fi

RUN npm run build

# 3. Imagem de Produção (Roda o app)
FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production

# Cria usuário sem privilégios root por segurança
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Copia os arquivos gerados no build
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs

EXPOSE 3000
ENV PORT=3000

CMD ["node", "server.js"]