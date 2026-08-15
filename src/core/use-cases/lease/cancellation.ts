import type { LeasesRepository } from '@/core/repositories/leases-repository';
import type { CancelLeaseInput, CancelLeaseResult, CancellationPreview } from '@/core/entities/lease';
import { NotFoundError, ValidationError } from '@/core/errors/domain-errors';

/**
 * Casos de uso de cancelamento de Locação.
 * Camada: core.
 * Origem: api-nairim-v2/src/services/LeaseService.ts (getCancellationPreview, cancelLease).
 */

/**
 * Prévia dos lançamentos a excluir no cancelamento (da data informada até o
 * término do contrato). Não exclui nada — só lista para confirmação do usuário.
 * Origem: getCancellationPreview.
 */
export class GetCancellationPreviewUseCase {
  constructor(private readonly leases: LeasesRepository) {}
  async execute(id: string, date: string): Promise<CancellationPreview> {
    if (!id) throw new ValidationError('O ID é obrigatório');
    if (!date) throw new ValidationError('A data do cancelamento é obrigatória');
    const preview = await this.leases.getCancellationPreview(id, date);
    if (!preview) throw new NotFoundError('Locação não encontrada');
    return preview;
  }
}

/**
 * Efetiva o cancelamento: soft-delete dos lançamentos confirmados, encargo
 * opcional, marca CANCELED, libera o imóvel. Origem: cancelLease.
 */
export class CancelLeaseUseCase {
  constructor(private readonly leases: LeasesRepository) {}
  async execute(id: string, input: CancelLeaseInput, companyId: string): Promise<CancelLeaseResult> {
    if (!id) throw new ValidationError('O ID é obrigatório');
    if (!input.date) throw new ValidationError('A data do cancelamento é obrigatória');
    const result = await this.leases.cancel(id, input, companyId);
    if (!result) throw new NotFoundError('Locação não encontrada');
    return result;
  }
}
