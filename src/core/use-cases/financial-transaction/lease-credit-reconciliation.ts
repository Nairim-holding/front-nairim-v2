import type {
  CompleteCreditReconciliationInput,
  CreditReconciliationSearchInput,
} from '@/core/entities/credit-reconciliation';
import type { LeaseCreditReconciliationRepository } from '@/core/repositories/lease-credit-reconciliation-repository';
import { NotFoundError, ValidationError } from '@/core/errors/domain-errors';

export class SearchLeaseCreditCandidatesUseCase {
  constructor(private readonly repository: LeaseCreditReconciliationRepository) {}

  async execute(companyId: string, input: CreditReconciliationSearchInput) {
    if (input.agency_ids.length === 0) throw new ValidationError('Selecione ao menos uma imobiliária.');
    return this.repository.search(companyId, input);
  }
}

export class CompleteLeaseCreditReconciliationUseCase {
  constructor(private readonly repository: LeaseCreditReconciliationRepository) {}

  async execute(companyId: string, input: CompleteCreditReconciliationInput) {
    const result = await this.repository.complete(companyId, input);
    if (result.updated_transactions === 0) {
      throw new NotFoundError('Nenhum lançamento pendente correspondente foi encontrado.');
    }
    return result;
  }
}
