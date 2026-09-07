/**
 * Acesso e validação das variáveis de ambiente server-side.
 *
 * Espelha api-nairim-v2/src/env.ts. No Next.js as variáveis de servidor são
 * lidas de `process.env` (disponíveis apenas no runtime Node — todos os Route
 * Handlers que usam este módulo devem declarar `export const runtime = 'nodejs'`).
 *
 * Import obrigatório apenas em código server-side. Nunca importe em Client
 * Components (exporia segredos como JWT_SECRET / DATABASE_URL).
 *
 * Origem: api-nairim-v2/src/env.ts
 */

/** Lê uma variável obrigatória; lança se ausente (falha rápida no boot). */
function required(key: string): string {
  const value = process.env[key];
  if (!value) {
    throw new Error(`❌ Variável de ambiente ${key} não definida`);
  }
  return value;
}

export const env = {
  NODE_ENV: process.env.NODE_ENV ?? 'development',

  DATABASE_URL: required('DATABASE_URL'),

  JWT_SECRET: required('JWT_SECRET'),

  // Expiração ABSOLUTA do token de sessão (após esse tempo exige novo login).
  // A expiração por inatividade é tratada no frontend (cookie de sessão).
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN ?? '8h',

  BASE_URL: process.env.BASE_URL ?? 'http://localhost:3000',

  // Cota padrão de banco de dados em MB, usada quando a Company não define
  // `db_quota_mb`. Espelha DEFAULT_DB_QUOTA_MB do backend (default 10).
  DEFAULT_DB_QUOTA_MB: Number(process.env.DEFAULT_DB_QUOTA_MB ?? 10),

  // MinIO (CDN self-hosted, S3 compatível) — usado no módulo de uploads.
  MINIO_ENDPOINT: process.env.MINIO_ENDPOINT ?? '',
  MINIO_PUBLIC_URL: process.env.MINIO_PUBLIC_URL ?? '',
  MINIO_ACCESS_KEY: process.env.MINIO_ACCESS_KEY ?? '',
  MINIO_SECRET_KEY: process.env.MINIO_SECRET_KEY ?? '',
  MINIO_BUCKET: process.env.MINIO_BUCKET ?? 'imagens',
  MINIO_REGION: process.env.MINIO_REGION ?? 'us-east-1',

  // WhatsApp automático via Evolution API (self-hosted / Baileys).
  EVOLUTION_API_URL: process.env.EVOLUTION_API_URL ?? '',
  EVOLUTION_API_KEY: process.env.EVOLUTION_API_KEY ?? '',
  EVOLUTION_INSTANCE: process.env.EVOLUTION_INSTANCE ?? '',

  // Rate limiting de login.
  RATE_LIMIT_WINDOW_MS: Number(process.env.RATE_LIMIT_WINDOW_MS ?? 5 * 60 * 1000),
  RATE_LIMIT_MAX_REQUESTS: Number(process.env.RATE_LIMIT_MAX_REQUESTS ?? 10000),
} as const;
