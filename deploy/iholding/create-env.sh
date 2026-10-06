#!/usr/bin/env bash
set -euo pipefail
umask 077
cd "$(dirname "$0")/../.."

if [[ -e .env.iholding ]]; then
  printf '.env.iholding ja existe; nenhum valor foi alterado.\n'
  exit 0
fi
if ! command -v openssl >/dev/null 2>&1; then
  printf 'Instale openssl para gerar os segredos.\n' >&2
  exit 1
fi

# Nao sobrescreve um arquivo criado simultaneamente por outro processo.
set -o noclobber
while IFS= read -r line || [[ -n "$line" ]]; do
  line="${line%$'\r'}"
  case "$line" in
    POSTGRES_PASSWORD=|MONGODB_LOGS_PASSWORD=|JWT_SECRET=|CRON_SECRET=|MINIO_ROOT_PASSWORD=|MINIO_SECRET_KEY=|BOOTSTRAP_ADMIN_PASSWORD=)
      printf '%s=%s\n' "${line%=}" "$(openssl rand -hex 32)"
      ;;
    *) printf '%s\n' "$line" ;;
  esac
done < .env.iholding.example > .env.iholding

printf '.env.iholding criado com permissoes privadas e 7 segredos distintos.\n'
printf 'Preencha os dados BOOTSTRAP_ADMIN antes de subir; MinIO e mc serao construidos automaticamente.\n'
printf 'A senha inicial do administrador esta em BOOTSTRAP_ADMIN_PASSWORD.\n'
