import type { AgenciesRepository } from '@/core/repositories/agencies-repository';
import type {
  Agency,
  ContactSuggestion,
  CreateAgencyData,
  ListAgenciesParams,
  PaginatedAgencies,
  UpdateAgencyData,
} from '@/core/entities/agency';
import { ConflictError, NotFoundError, ValidationError } from '@/core/errors/domain-errors';

/**
 * Casos de uso de Imobiliária (Agency).
 * Camada: core.
 * Origem: api-nairim-v2/src/services/AgencyService.ts + AgencyController.ts.
 * Rodam dentro do contexto de tenant (withTenant).
 */

/** Lista imobiliárias. Origem: getAgencies. */
export class ListAgenciesUseCase {
  constructor(private readonly agencies: AgenciesRepository) {}
  async execute(params: ListAgenciesParams): Promise<PaginatedAgencies> {
    return this.agencies.list(params);
  }
}

/** Filtros contextuais. Origem: getAgencyFilters. */
export class GetAgencyFiltersUseCase {
  constructor(private readonly agencies: AgenciesRepository) {}
  async execute(filters: Record<string, unknown>): Promise<Record<string, unknown>> {
    return this.agencies.getFilters(filters);
  }
}

/** Sugestões de contato (autocomplete). Origem: getAvailableContacts. */
export class GetContactSuggestionsUseCase {
  constructor(private readonly agencies: AgenciesRepository) {}
  async execute(search: string): Promise<ContactSuggestion[]> {
    return this.agencies.getAvailableContacts(search ?? '');
  }
}

/** Busca por ID. Origem: getAgencyById (404 se não existir). */
export class GetAgencyByIdUseCase {
  constructor(private readonly agencies: AgenciesRepository) {}
  async execute(id: string): Promise<Agency> {
    if (!id) throw new ValidationError('O ID é obrigatório');
    const agency = await this.agencies.findById(id);
    if (!agency) throw new NotFoundError('Imobiliária não encontrada');
    return agency;
  }
}

/**
 * Cria imobiliária. Origem: createAgency.
 * Regra: CNPJ único entre ativas (409).
 */
export class CreateAgencyUseCase {
  constructor(private readonly agencies: AgenciesRepository) {}
  async execute(data: CreateAgencyData): Promise<Agency> {
    if (await this.agencies.cnpjExists(data.cnpj)) {
      throw new ConflictError('CNPJ já cadastrado');
    }
    return this.agencies.create(data);
  }
}

/**
 * Atualiza imobiliária. Origem: updateAgency.
 * Regras: 404 se não existir; CNPJ único entre outras ativas (409).
 */
export class UpdateAgencyUseCase {
  constructor(private readonly agencies: AgenciesRepository) {}
  async execute(id: string, data: UpdateAgencyData): Promise<Agency> {
    if (!id) throw new ValidationError('O ID é obrigatório');

    const existing = await this.agencies.findById(id);
    if (!existing) throw new NotFoundError('Imobiliária não encontrada');

    if (data.cnpj && data.cnpj !== existing.cnpj) {
      if (await this.agencies.cnpjExistsExcept(data.cnpj, id)) {
        throw new ConflictError('CNPJ já cadastrado para outra imobiliária');
      }
    }
    return this.agencies.update(id, data);
  }
}

/** Soft-delete. Origem: deleteAgency (404 se não existir/já excluída). */
export class DeleteAgencyUseCase {
  constructor(private readonly agencies: AgenciesRepository) {}
  async execute(id: string): Promise<{ legal_name: string }> {
    if (!id) throw new ValidationError('O ID é obrigatório');
    const existing = await this.agencies.findById(id);
    if (!existing) throw new NotFoundError('Imobiliária não encontrada ou já excluída');
    return this.agencies.softDelete(id);
  }
}

/** Restaura. Origem: restoreAgency (404 se não existir; 400 se não excluída). */
export class RestoreAgencyUseCase {
  constructor(private readonly agencies: AgenciesRepository) {}
  async execute(id: string): Promise<{ legal_name: string }> {
    if (!id) throw new ValidationError('O ID é obrigatório');
    const state = await this.agencies.findDeletionState(id);
    if (!state) throw new NotFoundError('Imobiliária não encontrada');
    if (!state.deleted_at) throw new ValidationError('A imobiliária não está excluída');
    return this.agencies.restore(id);
  }
}
