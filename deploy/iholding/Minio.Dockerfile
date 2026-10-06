# A release oficial com a correcao CVE-2025-62506 e distribuida como fonte.
# https://github.com/minio/minio/releases/tag/RELEASE.2025-10-15T17-29-55Z
FROM golang:1.24-alpine AS builder
ENV CGO_ENABLED=0 GOMAXPROCS=2 GOMEMLIMIT=512MiB
RUN apk add --no-cache ca-certificates
RUN go install -p=2 -trimpath github.com/minio/minio@RELEASE.2025-10-15T17-29-55Z

FROM alpine:3.22
RUN apk add --no-cache ca-certificates && \
    addgroup -S -g 1001 minio && adduser -S -D -u 1001 -G minio -h /home/minio minio && \
    mkdir -p /data && chown minio:minio /data
COPY --from=builder /go/bin/minio /usr/local/bin/minio
LABEL org.opencontainers.image.source="https://github.com/minio/minio" \
      org.opencontainers.image.version="RELEASE.2025-10-15T17-29-55Z" \
      org.opencontainers.image.licenses="AGPL-3.0-only"
USER minio
ENV HOME=/home/minio
EXPOSE 9000 9001
ENTRYPOINT ["minio"]
CMD ["server", "/data", "--console-address", ":9001"]
