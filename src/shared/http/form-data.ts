import type { PropertyUploadFile, PropertyUploadFiles } from '@/core/entities/property';

/**
 * Helpers de extração de campos e arquivos de um `FormData` recebido por uma
 * Server Action — substitui o parsing que o `busboy`/`multer` faziam no
 * Express.
 *
 * Camada: shared.
 */

/** Lê um campo de texto (JSON) do FormData e faz o parse; `undefined` se ausente. */
export function readJsonField<T>(fd: FormData, key: string): T | undefined {
  const raw = fd.get(key);
  if (typeof raw !== 'string' || raw === '') return undefined;
  return JSON.parse(raw) as T;
}

/** Lê um campo de texto simples do FormData; `''` se ausente. */
export function readStringField(fd: FormData, key: string): string {
  const raw = fd.get(key);
  return typeof raw === 'string' ? raw : '';
}

/** Converte um `File` do FormData em {@link PropertyUploadFile} (buffer em memória). */
async function toUploadFile(file: File): Promise<PropertyUploadFile> {
  const buffer = Buffer.from(await file.arrayBuffer());
  return { buffer, filename: file.name, contentType: file.type || 'application/octet-stream' };
}

/** Nomes dos campos de arquivo aceitos no fluxo unificado de imóveis. */
const PROPERTY_FILE_FIELDS = ['arquivosImagens', 'arquivosMatricula', 'arquivosRegistro', 'arquivosEscritura', 'arquivosOutros'] as const;

/** Extrai todos os arquivos de um FormData de imóvel, agrupados por campo. */
export async function readPropertyUploadFiles(fd: FormData): Promise<PropertyUploadFiles> {
  const result: PropertyUploadFiles = {};
  for (const field of PROPERTY_FILE_FIELDS) {
    const files = fd.getAll(field).filter((v): v is File => v instanceof File && v.size > 0);
    if (files.length > 0) {
      result[field] = await Promise.all(files.map(toUploadFile));
    }
  }
  return result;
}
