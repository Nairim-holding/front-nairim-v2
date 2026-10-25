#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."

# The connection comes from each currently running app. No host credentials required.
services=("$@")
if [[ ${#services[@]} -eq 0 ]]; then services=(front-nairim front-nairim-test front-nairim-homolog); fi
containers=()
for service in "${services[@]}"; do
  case "$service" in
    front-nairim|front-nairim-test|front-nairim-homolog) ;;
    *) echo "Servico nao permitido: $service" >&2; exit 1 ;;
  esac
  container=$(docker compose --profile test --profile homolog ps -q "$service")
  if [[ -z "$container" ]]; then echo "Container de $service indisponivel; nenhum container sera substituido." >&2; exit 1; fi
  containers+=("$container")
done

sql=$(base64 < prisma/migrations/20261025000000_transaction_statement_order/migration.sql | tr -d '\r\n')
for index in "${!services[@]}"; do
  echo "Aplicando migracao do extrato em ${services[$index]}"
  docker exec -i -w /app -e "NAIRIM_STATEMENT_ORDER_SQL=$sql" "${containers[$index]}" node --input-type=module < scripts/apply-statement-order-migration.mjs
  docker exec -i -w /app "${containers[$index]}" node --input-type=module < scripts/check-statement-order-migration.mjs
done
