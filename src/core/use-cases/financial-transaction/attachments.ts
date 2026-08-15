import type { TransactionsRepository } from '@/core/repositories/financial-transactions-repository';
import type { Storage } from '@/core/storage/storage';
import type { TransactionAttachmentFile, TransactionDocument } from '@/core/entities/financial-transaction';
import { NotFoundError, ValidationError } from '@/core/errors/domain-errors';

/**
 * Casos de uso de ANEXOS do lançamento financeiro (TransactionAttachmentsModal).
 * Camada: core. Origem: DocumentService.uploadTransactionDocuments,
 * getTransactionDocuments e removeTransactionDocuments (e seus controllers).
 *
 * Mesma decisão de upload síncrono dos Módulos 7/8: sobe cada arquivo e só
 * retorna quando tudo estiver concluído.
 */

/** Máximo de anexos por lançamento (DocumentService.MAX_TRANSACTION_ATTACHMENTS). */
export const MAX_TRANSACTION_ATTACHMENTS = 5;

const ALLOWED_MIME_TYPES = ['application/pdf', 'image/jpeg', 'image/png'];

/** Lista os anexos do lançamento. Origem: GET /financial-transaction/:id/documents. */
export class ListTransactionDocumentsUseCase {
  constructor(private readonly transactions: TransactionsRepository) {}

  async execute(transactionId: string): Promise<TransactionDocument[]> {
    if (!transactionId?.trim()) throw new ValidationError('O ID do lançamento é obrigatório');
    if (!(await this.transactions.findById(transactionId))) {
      throw new NotFoundError('Lançamento não encontrado');
    }
    return this.transactions.listDocuments(transactionId);
  }
}

/**
 * Envia anexos (multipart) para o lançamento. POST /financial-transaction/:id/documents.
 * Valida existência do lançamento, tipo de arquivo e limite de 5 anexos.
 */
export class UploadTransactionDocumentsUseCase {
  constructor(
    private readonly transactions: TransactionsRepository,
    private readonly storage: Storage,
  ) {}

  async execute(transactionId: string, userId: string | null, files: TransactionAttachmentFile[]): Promise<TransactionDocument[]> {
    if (!transactionId?.trim()) throw new ValidationError('O ID do lançamento é obrigatório');
    if (!(await this.transactions.findById(transactionId))) {
      throw new NotFoundError('Lançamento não encontrado');
    }

    if (!files || files.length === 0) return [];

    const invalid = files.find((f) => !ALLOWED_MIME_TYPES.includes(f.contentType));
    if (invalid) {
      throw new ValidationError(`Tipo de arquivo não permitido: ${invalid.contentType}. Envie apenas PDF, JPG ou PNG.`);
    }

    const existingCount = await this.transactions.countDocuments(transactionId);
    if (existingCount + files.length > MAX_TRANSACTION_ATTACHMENTS) {
      throw new ValidationError(
        `Limite de ${MAX_TRANSACTION_ATTACHMENTS} anexos por lançamento excedido (já existem ${existingCount}).`,
      );
    }

    const saved: TransactionDocument[] = [];
    for (const file of files) {
      const url = await this.storage.upload(
        { buffer: file.buffer, filename: file.filename, contentType: file.contentType, size: file.buffer.length },
        'transactions/attachments',
      );
      const [created] = await this.transactions.createDocuments(transactionId, [
        { url, mimetype: file.contentType, description: file.filename, createdBy: userId?.trim() || null },
      ]);
      saved.push(created);
    }

    return saved;
  }
}

/**
 * Remove (soft-delete) um anexo do lançamento e o arquivo do storage.
 * DELETE /financial-transaction/:id/documents/:documentId.
 * Origem: DocumentService.removeTransactionDocuments + deleteTransactionDocument.
 */
export class RemoveTransactionDocumentUseCase {
  constructor(
    private readonly transactions: TransactionsRepository,
    private readonly storage: Storage,
  ) {}

  async execute(transactionId: string, documentId: string): Promise<void> {
    if (!transactionId?.trim() || !documentId?.trim()) {
      throw new ValidationError('O ID do lançamento e do anexo são obrigatórios');
    }

    const [document] = await this.transactions.listDocuments(transactionId);
    const target = document && document.id === documentId ? document : null;
    if (!target) {
      // Fidelidade ao backend: remoção de anexo inexistente/outra empresa é idempotente.
      return;
    }

    try {
      await this.storage.delete(target.file_path);
    } catch {
      // Falha ao apagar o arquivo não impede o soft-delete do registro.
    }
    await this.transactions.removeDocuments(transactionId, [documentId]);
  }
}