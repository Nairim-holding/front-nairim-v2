import sharp from 'sharp';

/**
 * Conversão de imagens para AVIF (compressão otimizada) — porte de
 * api-nairim-v2/src/utils/imageConverter.ts.
 *
 * ⚠️ MUDANÇA DE COMPORTAMENTO (aprovada): no backend a conversão rodava em
 * `setImmediate` (fire-and-forget) DEPOIS da resposta HTTP já enviada — um
 * padrão que não existe em Server Actions (que só retornam quando terminam).
 * Aqui a conversão roda de forma SÍNCRONA, antes da action devolver o
 * resultado ao cliente (decisão de arquitetura do Módulo 7: "Server Action
 * síncrona simples").
 *
 * Camada: infra.
 */
export class ImageConverter {
  /** Converte um buffer de imagem para AVIF. Mesma qualidade padrão do backend (80). */
  static async convertToAVIF(inputBuffer: Buffer, quality = 80): Promise<Buffer> {
    return sharp(inputBuffer)
      .avif({ quality: Math.min(Math.max(quality, 1), 100), lossless: false, effort: 2 })
      .toBuffer();
  }

  /** MIME types de imagem aceitos para conversão (mesma lista do backend). */
  static isSupportedImageFormat(mimetype: string): boolean {
    return ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/tiff', 'image/x-icon'].includes(
      mimetype.toLowerCase(),
    );
  }
}
