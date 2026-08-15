import type { FinancialInstitutionsRepository } from '@/core/repositories/financial-institutions-repository';
import type {
  BalanceSummaryItem,
  CreateFinancialInstitutionData,
  FinancialInstitution,
  ListFinancialInstitutionsParams,
  PaginatedFinancialInstitutions,
  UpdateFinancialInstitutionData,
} from '@/core/entities/financial-institution';
import { ConflictError, NotFoundError, ValidationError } from '@/core/errors/domain-errors';

/**
 * Casos de uso de Instituição Financeira.
 * Camada: core.
 * Origem: api-nairim-v2/src/services/FinancialIntitucion.ts + controller.
 * Rodam dentro do contexto de tenant (withTenant).
 *
 * FIDELIDADE: mensagens de erro e status replicam o controller Express —
 * delete com lançamentos relacionados vira conflito (409) com a mensagem
 * exata do service; restore valida que o registro está realmente excluído.
 */

export class ListFinancialInstitutionsUseCase {
  constructor(private readonly institutions: FinancialInstitutionsRepository) {}
  async execute(params: ListFinancialInstitutionsParams): Promise<PaginatedFinancialInstitutions> {
    return this.institutions.list(params);
  }
}

export class GetFinancialInstitutionFiltersUseCase {
  constructor(private readonly institutions: FinancialInstitutionsRepository) {}
  async execute(): Promise<Record<string, unknown>> {
    return this.institutions.getFilters();
  }
}

export class GetFinancialInstitutionByIdUseCase {
  constructor(private readonly institutions: FinancialInstitutionsRepository) {}
  async execute(id: string): Promise<FinancialInstitution> {
    if (!id) throw new ValidationError('O ID é obrigatório');
    const institution = await this.institutions.findById(id);
    if (!institution) throw new NotFoundError('Instituição não encontrada');
    return institution;
  }
}

export class CreateFinancialInstitutionUseCase {
  constructor(private readonly institutions: FinancialInstitutionsRepository) {}
  async execute(data: CreateFinancialInstitutionData): Promise<FinancialInstitution> {
    if (!data.name?.trim()) throw new ValidationError('Nome da instituição é obrigatório');
    return this.institutions.create(data);
  }
}

export class UpdateFinancialInstitutionUseCase {
  constructor(private readonly institutions: FinancialInstitutionsRepository) {}
  async execute(id: string, data: UpdateFinancialInstitutionData): Promise<FinancialInstitution> {
    if (!id) throw new ValidationError('O ID é obrigatório');
    if (data.name !== undefined && !data.name?.trim()) {
      throw new ValidationError('Nome da instituição não pode ser vazio');
    }
    const existing = await this.institutions.findById(id);
    if (!existing) throw new NotFoundError('Instituição não encontrada');
    return this.institutions.update(id, data);
  }
}

export class DeleteFinancialInstitutionUseCase {
  constructor(private readonly institutions: FinancialInstitutionsRepository) {}
  async execute(id: string): Promise<void> {
    if (!id) throw new ValidationError('O ID é obrigatório');
    await this.institutions.softDelete(id);
  }
}

export class RestoreFinancialInstitutionUseCase {
  constructor(private readonly institutions: FinancialInstitutionsRepository) {}
  async execute(id: string): Promise<FinancialInstitution> {
    if (!id) throw new ValidationError('O ID é obrigatório');
    const state = await this.institutions.findDeletionState(id);
    if (!state) throw new NotFoundError('Instituição não encontrada');
    if (!state.deleted_at) throw new ValidationError('Instituição não está excluída');
    return this.institutions.restore(id);
  }
}

export class QuickCreateFinancialInstitutionUseCase {
  constructor(private readonly institutions: FinancialInstitutionsRepository) {}
  async execute(data: { name: string }): Promise<FinancialInstitution> {
    if (!data.name?.trim()) throw new ValidationError('Nome é obrigatório');
    return this.institutions.quickCreate(data);
  }
}

export class GetFinancialBalanceSummaryUseCase {
  constructor(private readonly institutions: FinancialInstitutionsRepository) {}
  async execute(): Promise<BalanceSummaryItem[]> {
    return this.institutions.getBalanceSummary();
  }
}