#!/usr/bin/env bash
set -euo pipefail
umask 077

cd "$(dirname "$0")/../.."
[[ "$PWD" == /var/www/iholding ]] || { echo 'Deploy permitido somente em /var/www/iholding.' >&2; exit 1; }
[[ "${DEPLOY_SHA:-}" =~ ^[a-f0-9]{40}$ ]] || { echo 'Commit de deploy invalido.' >&2; exit 1; }
[[ -f .env.iholding ]] || { echo '.env.iholding nao encontrado.' >&2; exit 1; }
: "${GHCR_USER:?Informe GHCR_USER}" "${GHCR_TOKEN:?Informe GHCR_TOKEN}"

export IHOLDING_FRONT_IMAGE="ghcr.io/nairim-holding/front-nairim-v2:iholding-front-$DEPLOY_SHA"
export IHOLDING_OPERATIONS_IMAGE="ghcr.io/nairim-holding/front-nairim-v2:iholding-operations-$DEPLOY_SHA"
export DOCKER_CONFIG
DOCKER_CONFIG="$(mktemp -d)"
env_temp=''
cleanup() {
  rm -f -- "$DOCKER_CONFIG/config.json"
  rmdir -- "$DOCKER_CONFIG" || true
  if [[ -n "$env_temp" ]]; then rm -f -- "$env_temp"; fi
}
trap cleanup EXIT
printf '%s' "$GHCR_TOKEN" | docker login ghcr.io -u "$GHCR_USER" --password-stdin
unset GHCR_TOKEN

dc=(docker compose --env-file .env.iholding -f docker-compose.iholding.yml)
"${dc[@]}" config --quiet
printf 'Baixando imagens prontas do GitHub...\n'
"${dc[@]}" pull iholding-front iholding-migrate iholding-logs-worker iholding-scheduler

# O banco existente recebe apenas migrations pendentes. Nao executa bootstrap.
printf 'Aplicando atualizacoes do banco da iholding...\n'
"${dc[@]}" run --rm --no-deps iholding-migrate
printf 'Atualizando aplicacao, logs e agendador da iholding...\n'
"${dc[@]}" up -d --no-build --no-deps --wait --wait-timeout 300 iholding-front iholding-logs-worker iholding-scheduler

# Mantem as imagens utilizadas nas proximas operacoes manuais, sem expor o .env.
env_temp="$(mktemp .env.iholding.deploy.XXXXXX)"
awk '!/^IHOLDING_(FRONT|OPERATIONS)_IMAGE=/' .env.iholding > "$env_temp"
printf '\nIHOLDING_FRONT_IMAGE=%s\nIHOLDING_OPERATIONS_IMAGE=%s\n' "$IHOLDING_FRONT_IMAGE" "$IHOLDING_OPERATIONS_IMAGE" >> "$env_temp"
chmod 600 "$env_temp"
mv -- "$env_temp" .env.iholding
env_temp=''
"${dc[@]}" ps iholding-front iholding-logs-worker iholding-scheduler
printf 'Deploy iholding concluido: %s\n' "$DEPLOY_SHA"
