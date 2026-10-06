#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/../.."
dc=(docker compose --env-file .env.iholding -f docker-compose.iholding.yml)

if [[ ! -f .env.iholding ]]; then
  printf 'Execute bash deploy/iholding/create-env.sh e preencha .env.iholding primeiro.\n' >&2
  exit 1
fi
if ! command -v docker >/dev/null 2>&1; then
  printf 'Docker nao esta instalado ou nao esta no PATH.\n' >&2
  exit 1
fi

printf 'Validando acesso ao Docker e configuracao da iholding...\n'
docker info >/dev/null
"${dc[@]}" config --quiet

images="$("${dc[@]}" config --images)"
if grep -Fxq 'iholding-minio:2025-10-15' <<< "$images"; then
  printf 'Construindo MinIO com a correcao CVE-2025-62506...\n'
  # Contexto vazio: nenhum arquivo .env ou dado local e enviado ao build.
  docker build --tag iholding-minio:2025-10-15 - < deploy/iholding/Minio.Dockerfile
fi

if grep -Fxq 'iholding-mc:2025-08-13' <<< "$images"; then
  printf 'Construindo o cliente MinIO a partir da release oficial...\n'
  docker build --tag iholding-mc:2025-08-13 - < deploy/iholding/Mc.Dockerfile
fi

printf 'Construindo a aplicacao e as ferramentas de inicializacao...\n'
"${dc[@]}" build iholding-front iholding-migrate

printf 'Iniciando bancos e armazenamento exclusivos da iholding...\n'
"${dc[@]}" up -d iholding-postgres iholding-mongodb iholding-minio
"${dc[@]}" run --rm iholding-migrate
"${dc[@]}" run --rm iholding-storage-init

user_count="$("${dc[@]}" exec -T iholding-postgres psql -U iholding -d iholding_db -At -c 'SELECT COUNT(*) FROM "User"')"
case "$user_count" in
  ''|*[!0-9]*) printf 'Nao foi possivel conferir o cadastro inicial.\n' >&2; exit 1 ;;
  0) "${dc[@]}" --profile setup run --rm iholding-bootstrap ;;
  *) printf 'Usuarios ja cadastrados; preservando os acessos existentes.\n' ;;
esac

printf 'Subindo aplicacao, transferencia de logs e agendador...\n'
"${dc[@]}" up -d --no-build --wait --wait-timeout 300
"${dc[@]}" ps -a
printf '\nAmbiente iniciado. Valide DNS/HTTPS, login, uploads e auditoria conforme o guia.\n'
