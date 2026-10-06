#!/bin/sh
set -eu

# A aplicacao recebe apenas acesso ao bucket; as credenciais root ficam aqui.
attempt=0
until mc alias set local http://iholding-minio:9000 "$MINIO_ROOT_USER" "$MINIO_ROOT_PASSWORD" >/dev/null 2>&1; do
  attempt=$((attempt + 1))
  if [ "$attempt" -ge 60 ]; then
    echo 'MinIO nao ficou disponivel em 120 segundos.' >&2
    exit 1
  fi
  sleep 2
done

case "$MINIO_BUCKET" in
  ''|*[!a-z0-9.-]*) echo 'MINIO_BUCKET deve ser um nome S3 valido.' >&2; exit 1 ;;
esac
if [ "$MINIO_ACCESS_KEY" = "$MINIO_ROOT_USER" ]; then
  echo 'Use uma credencial de aplicacao diferente do usuario root.' >&2
  exit 1
fi

mc mb --ignore-existing "local/$MINIO_BUCKET"
cat > /tmp/app-policy.json <<EOF
{"Version":"2012-10-17","Statement":[
  {"Effect":"Allow","Action":["s3:ListBucket","s3:GetBucketLocation"],"Resource":["arn:aws:s3:::$MINIO_BUCKET"]},
  {"Effect":"Allow","Action":["s3:GetObject","s3:PutObject","s3:DeleteObject"],"Resource":["arn:aws:s3:::$MINIO_BUCKET/*"]}
]}
EOF
mc admin user add local "$MINIO_ACCESS_KEY" "$MINIO_SECRET_KEY"
mc admin policy create local iholding-app /tmp/app-policy.json
mc admin policy attach local iholding-app --user "$MINIO_ACCESS_KEY"

# Mesmo modelo de URLs publicas do sistema existente: GET de objetos, sem
# listagem publica do bucket nem escrita anonima.
cat > /tmp/public-policy.json <<EOF
{"Version":"2012-10-17","Statement":[
  {"Effect":"Allow","Principal":{"AWS":["*"]},"Action":["s3:GetObject"],"Resource":["arn:aws:s3:::$MINIO_BUCKET/*"]}
]}
EOF
mc anonymous set-json /tmp/public-policy.json "local/$MINIO_BUCKET"
echo 'Bucket e credencial de aplicacao configurados.'
