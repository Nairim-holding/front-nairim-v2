import type { LeasesRepository } from '@/core/repositories/leases-repository';
import type { Storage } from '@/core/storage/storage';
import { NotFoundError, ValidationError } from '@/core/errors/domain-errors';

export interface LeaseDocumentFile {
  buffer: Buffer;
  filename: string;
  contentType: string;
}

export interface UpdateLeaseDocumentsInput {
  leaseId: string;
  userId: string;
  removedDocumentIds?: string[];
  newFiles?: LeaseDocumentFile[];
}

/**
 * Caso de uso: anexa/remove documentos (ex.: contrato) de uma locação.
 * Substitui `LeaseController.updateLeaseDocuments` +
 * `DocumentService.removeLeaseDocuments` + `DocumentService.uploadLeaseDocuments`.
 *
 * Mesma decisão de upload síncrono do Módulo 7 (Properties): sobe cada arquivo
 * e só retorna quando tudo estiver concluído.
 *
 * Camada: core. Roda dentro do contexto de tenant (withTenant).
 * Origem: api-nairim-v2/src/services/DocumentService.ts
 * (uploadLeaseDocuments/removeLeaseDocuments).
 */
export class UpdateLeaseDocumentsUseCase {
  constructor(
    private readonly leases: LeasesRepository,
    private readonly storage: Storage,
  ) {}

  async execute(input: UpdateLeaseDocumentsInput): Promise<void> {
    const { leaseId, userId, removedDocumentIds = [], newFiles = [] } = input;
    if (!leaseId) throw new ValidationError('O ID é obrigatório');

    if (!(await this.leases.exists(leaseId))) {
      throw new NotFoundError('Locação não encontrada');
    }

    if (removedDocumentIds.length > 0) {
      await this.leases.removeDocuments(leaseId, removedDocumentIds);
    }

    if (newFiles.length > 0) {
      const uploaded: Array<{ url: string; mimetype: string; description: string; createdBy: string | null }> = [];
      for (const file of newFiles) {
        // Documentos de locação (contratos) não recebem conversão AVIF — usa
        // upload simples, igual ao `uploadLeaseDocuments` original.
        const url = await this.storage.upload(
          { buffer: file.buffer, filename: file.filename, contentType: file.contentType, size: file.buffer.length },
          'leases/documents',
        );
        uploaded.push({
          url,
          mimetype: file.contentType,
          description: 'Lease Contract',
          createdBy: userId?.trim() || null,
        });
      }
      await this.leases.createDocuments(leaseId, uploaded);
    }
  }
}
