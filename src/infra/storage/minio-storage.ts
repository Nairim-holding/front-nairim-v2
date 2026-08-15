import { S3Client, PutObjectCommand, DeleteObjectCommand, ListObjectsV2Command } from '@aws-sdk/client-s3';
import { env } from '@/infra/config/env';
import type { Storage, UploadInput, UploadMediaResult } from '@/core/storage/storage';
import { ImageConverter } from './image-converter';

/**
 * Implementação de {@link Storage} sobre o MinIO self-hosted (S3 compatível).
 *
 * `forcePathStyle` é obrigatório: o MinIO resolve buckets via path
 * (http://endpoint/bucket/key), não via subdomínio como a AWS.
 *
 * NOTA: para assets de branding (imagens pequenas ≤10MB) usamos `PutObject` com
 * o buffer em memória — suficiente e simples. O upload multipart em streaming
 * (para vídeos grandes) será tratado no módulo de Imóveis.
 *
 * Camada: infra.
 * Origem: api-nairim-v2/src/lib/minioService.ts.
 */
const s3Client = new S3Client({
  endpoint: env.MINIO_ENDPOINT,
  region: env.MINIO_REGION,
  forcePathStyle: true,
  credentials: {
    accessKeyId: env.MINIO_ACCESS_KEY,
    secretAccessKey: env.MINIO_SECRET_KEY,
  },
});

const publicPrefix = () => `${env.MINIO_PUBLIC_URL}/${env.MINIO_BUCKET}/`;

/**
 * Monta o header `Content-Disposition` com um nome de arquivo seguro para
 * HTTP (RFC 6266/5987). Valores de header só aceitam ASCII — um nome com
 * acento (ex.: "Químicos.png") quebrava a assinatura SigV4 do S3/MinIO ao
 * ser enviado cru, causando `SignatureDoesNotMatch`. `filename` é o
 * fallback ASCII; `filename*` carrega o nome original (UTF-8, percent-encoded)
 * para navegadores que o suportam.
 */
function buildContentDisposition(filename: string): string {
  // eslint-disable-next-line no-control-regex
  const asciiFallback = filename.replace(/[^\x20-\x7e]/g, '_').replace(/"/g, "'");
  const encoded = encodeURIComponent(filename);
  return `inline; filename="${asciiFallback}"; filename*=UTF-8''${encoded}`;
}

/** Objeto do bucket: key e tamanho em bytes (sem metadados extras). */
export interface MinioObjectInfo {
  key: string;
  size: number;
}

export class MinioStorage implements Storage {
  /** Monta a URL pública final a partir da key. */
  private urlFromKey(key: string): string {
    return `${publicPrefix()}${key}`;
  }

  /** Extrai a key do objeto a partir da URL pública (ou `null` se não for do bucket). */
  keyFromUrl(url: string): string | null {
    const prefix = publicPrefix();
    return url.startsWith(prefix) ? url.slice(prefix.length) : null;
  }

  /**
   * Lista todos os objetos do bucket (ou de um prefixo), com o tamanho de cada um.
   * O ListObjectsV2 já devolve `Size` em bytes junto com a key, então o custo é de
   * uma chamada por página de 1000 objetos — não é preciso um HEAD por arquivo.
   * Usado apenas para leitura/estatística (StorageUsageService); não participa do
   * fluxo de upload.
   */
  async listAllObjects(prefix?: string): Promise<MinioObjectInfo[]> {
    const objects: MinioObjectInfo[] = [];
    let continuationToken: string | undefined;

    do {
      const page = await s3Client.send(
        new ListObjectsV2Command({
          Bucket: env.MINIO_BUCKET,
          Prefix: prefix,
          ContinuationToken: continuationToken,
        }),
      );

      for (const item of page.Contents ?? []) {
        if (!item.Key) continue;
        objects.push({ key: item.Key, size: item.Size ?? 0 });
      }

      continuationToken = page.IsTruncated ? page.NextContinuationToken : undefined;
    } while (continuationToken);

    return objects;
  }

  /** @inheritdoc */
  async upload(input: UploadInput, folder: string): Promise<string> {
    const safeFilename = input.filename.replace(/[<>:"/\\|?*\x00-\x1f]/g, '_');
    // path.posix.join equivalente sem dependência de 'path'
    const key = `${folder.replace(/\/+$/, '')}/${Date.now()}-${safeFilename}`;

    await s3Client.send(
      new PutObjectCommand({
        Bucket: env.MINIO_BUCKET,
        Key: key,
        Body: input.buffer,
        ContentType: input.contentType,
        ContentDisposition: buildContentDisposition(input.filename),
      }),
    );

    return this.urlFromKey(key);
  }

  /** @inheritdoc */
  async delete(url: string): Promise<void> {
    const key = this.keyFromUrl(url);
    if (!key) return;
    await s3Client
      .send(new DeleteObjectCommand({ Bucket: env.MINIO_BUCKET, Key: key }))
      .catch(() => {});
  }

  /** @inheritdoc */
  async uploadMedia(input: UploadInput, folder: string): Promise<UploadMediaResult> {
    if (!ImageConverter.isSupportedImageFormat(input.contentType)) {
      const url = await this.upload(input, folder);
      return { url, contentType: input.contentType };
    }

    // Converte para AVIF ANTES de subir — síncrono, dentro da Server Action
    // (ver nota em infra/storage/image-converter.ts).
    const avifBuffer = await ImageConverter.convertToAVIF(input.buffer, 80);
    const avifFilename = input.filename.replace(/\.[^/.]+$/, '') + '.avif';
    const url = await this.upload({ ...input, buffer: avifBuffer, filename: avifFilename, contentType: 'image/avif' }, folder);
    return { url, contentType: 'image/avif' };
  }
}

/** Instância compartilhada. */
export const minioStorage = new MinioStorage();
