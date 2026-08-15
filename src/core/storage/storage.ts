/**
 * Contrato de armazenamento de arquivos (inversão de dependência).
 *
 * Os casos de uso dependem desta interface; a implementação concreta (MinIO/S3)
 * vive em infra/storage/minio-storage.ts.
 *
 * Camada: core.
 * Origem: api-nairim-v2/src/lib/minioService.ts + blobService.ts (abstraídos).
 */

/** Arquivo a enviar (já lido em memória). */
export interface UploadInput {
  /** Conteúdo do arquivo. */
  buffer: Buffer;
  /** Nome original do arquivo (usado na key e no Content-Disposition). */
  filename: string;
  /** MIME type. */
  contentType: string;
  /** Tamanho em bytes (para validações de limite). */
  size: number;
}

/** Resultado de um upload com possível conversão de imagem. */
export interface UploadMediaResult {
  /** URL pública final (já em `.avif` quando a conversão ocorreu). */
  url: string;
  /** MIME type final salvo (`image/avif` quando convertido; original caso contrário). */
  contentType: string;
}

export interface Storage {
  /**
   * Envia um arquivo para uma pasta lógica e retorna a URL pública final.
   * @param input Arquivo em memória.
   * @param folder Prefixo/pasta no bucket (ex: `companies/<id>`).
   */
  upload(input: UploadInput, folder: string): Promise<string>;

  /** Remove um arquivo a partir da sua URL pública (no-op se não pertencer ao bucket). */
  delete(url: string): Promise<void>;

  /**
   * Envia um arquivo de mídia (documento de imóvel): se for imagem suportada,
   * converte para AVIF ANTES de subir (síncrono — ver nota em
   * infra/storage/image-converter.ts); senão, sobe o arquivo original.
   * @param input Arquivo em memória.
   * @param folder Prefixo/pasta no bucket.
   */
  uploadMedia(input: UploadInput, folder: string): Promise<UploadMediaResult>;
}
