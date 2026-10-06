# Cliente oficial compilado de uma release fixa, sem depender das imagens MinIO.
# https://github.com/minio/mc/releases/tag/RELEASE.2025-08-13T08-35-41Z
FROM golang:1.24-alpine AS builder
ENV CGO_ENABLED=0 GOMAXPROCS=2 GOMEMLIMIT=512MiB
RUN apk add --no-cache ca-certificates
RUN go install -p=2 -trimpath github.com/minio/mc@RELEASE.2025-08-13T08-35-41Z

FROM alpine:3.22
RUN apk add --no-cache ca-certificates
COPY --from=builder /go/bin/mc /usr/local/bin/mc
LABEL org.opencontainers.image.source="https://github.com/minio/mc" \
      org.opencontainers.image.version="RELEASE.2025-08-13T08-35-41Z" \
      org.opencontainers.image.licenses="AGPL-3.0-only"
ENTRYPOINT ["mc"]
