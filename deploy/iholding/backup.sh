#!/usr/bin/env bash
# Execute na VPS Linux, a partir de qualquer diretorio.
set -euo pipefail
umask 077
cd "$(dirname "$0")/../.."
dc=(docker compose --env-file .env.iholding -f docker-compose.iholding.yml)
stamp="$(date -u +%Y%m%dT%H%M%SZ)"
folder="backups/iholding/$stamp"
mkdir -p "$folder"

# Pausa somente os escritores deste ambiente. Resume apenas os que estavam
# rodando, inclusive se alguma exportacao falhar.
running=()
for service in iholding-front iholding-logs-worker iholding-scheduler; do
  if [[ -n "$("${dc[@]}" ps --status running -q "$service")" ]]; then
    running+=("$service")
  fi
done
resume() {
  if [[ ${#running[@]} -gt 0 ]]; then "${dc[@]}" start "${running[@]}"; fi
}
trap resume EXIT
if [[ ${#running[@]} -gt 0 ]]; then "${dc[@]}" stop "${running[@]}"; fi

"${dc[@]}" exec -T iholding-postgres pg_dump -U iholding -d iholding_db -Fc > "$folder/postgres.dump"
"${dc[@]}" exec -T iholding-mongodb sh -ec \
  'mongodump --username "$MONGO_INITDB_ROOT_USERNAME" --password "$MONGO_INITDB_ROOT_PASSWORD" --authenticationDatabase admin --db iholding_logs --archive --gzip' \
  > "$folder/mongodb.archive.gz"
"${dc[@]}" --profile operations run --rm --no-deps -e BACKUP_STAMP="$stamp" iholding-storage-admin \
  'mc alias set local http://iholding-minio:9000 "$MINIO_ROOT_USER" "$MINIO_ROOT_PASSWORD" >/dev/null; mc mirror "local/$MINIO_BUCKET" "/backup/$BACKUP_STAMP/minio/$MINIO_BUCKET"'

# Inclui tambem os backups JSON da interface, se o front ja foi criado.
front_id="$("${dc[@]}" ps -a -q iholding-front)"
if [[ -n "$front_id" ]]; then
  docker cp "$front_id:/app/backup" "$folder/app-backups"
fi
"${dc[@]}" images > "$folder/images.txt"
find "$folder" -type f ! -name SHA256SUMS -exec sha256sum {} + > "$folder/SHA256SUMS"
printf 'Backup concluido: %s\nCopie este diretorio para armazenamento fora da VPS.\n' "$folder"
