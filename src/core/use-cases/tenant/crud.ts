import type { TenantsRepository } from '@/core/repositories/tenants-repository';
import type { ContactSuggestion } from '@/core/entities/agency';
import type {
  CreateTenantData,
  ListTenantsParams,
  PaginatedTenants,
  Tenant,
  UpdateTenantData,
} from '@/core/entities/tenant';
import { ConflictError, NotFoundError, ValidationError } from '@/core/errors/domain-errors';

/**
 * Casos de uso de Inquilino (Tenant).
 * Camada: core.
 * Origem: api-nairim-v2/src/services/TenantService.ts + TenantController.ts.
 * Rodam dentro do contexto de tenant (withTenant).
 *
 * ⚠️ FIDELIDADE AO BACKEND: ao contrário de Owner, aqui NÃO há exclusão mútua
 * PF/PJ (os campos são gravados como recebidos, sem zerar o lado oposto) e
 * `DeleteTenantUseCase` não verifica existência antes de excluir — um id
 * inexistente propaga o erro do Prisma (P2025 → 404 pelo error-handler), em
 * vez de uma mensagem customizada. Ambos os comportamentos são preservados
 * intencionalmente do TenantService original.
 */

export class ListTenantsUseCase {
  constructor(private readonly tenants: TenantsRepository) {}
  async execute(params: ListTenantsParams): Promise<PaginatedTenants> {
    return this.tenants.list(params);
  }
}

export class GetTenantFiltersUseCase {
  constructor(private readonly tenants: TenantsRepository) {}
  async execute(filters: Record<string, unknown>): Promise<Record<string, unknown>> {
    return this.tenants.getFilters(filters);
  }
}

export class GetTenantContactSuggestionsUseCase {
  constructor(private readonly tenants: TenantsRepository) {}
  async execute(search: string): Promise<ContactSuggestion[]> {
    return this.tenants.getAvailableContacts(search ?? '');
  }
}

export class GetTenantByIdUseCase {
  constructor(private readonly tenants: TenantsRepository) {}
  async execute(id: string): Promise<Tenant> {
    if (!id) throw new ValidationError('ID é obrigatório');
    const tenant = await this.tenants.findById(id);
    if (!tenant) throw new NotFoundError('Inquilino não encontrado');
    return tenant;
  }
}

/**
 * Cria inquilino. Origem: createTenant.
 * Regras: internal_code/CPF/CNPJ únicos (409, sempre verificados, sem
 * condicionar a PF/PJ). Todos os demais campos são gravados como recebidos.
 */
export class CreateTenantUseCase {
  constructor(private readonly tenants: TenantsRepository) {}

  async execute(data: CreateTenantData): Promise<Tenant> {
    if (data.internal_code && (await this.tenants.internalCodeExists(data.internal_code))) {
      throw new ConflictError('O Código Interno informado já está em uso por outro inquilino');
    }
    if (data.cpf && (await this.tenants.cpfExists(data.cpf))) {
      throw new ConflictError('O CPF informado já está cadastrado');
    }
    if (data.cnpj && (await this.tenants.cnpjExists(data.cnpj))) {
      throw new ConflictError('O CNPJ informado já está cadastrado');
    }
    return this.tenants.create(data);
  }
}

/** Atualiza inquilino. Origem: updateTenant (mesmas regras de unicidade da criação). */
export class UpdateTenantUseCase {
  constructor(private readonly tenants: TenantsRepository) {}

  async execute(id: string, data: UpdateTenantData): Promise<Tenant> {
    if (!id) throw new ValidationError('ID é obrigatório');

    const existing = await this.tenants.findById(id);
    if (!existing) throw new NotFoundError('Inquilino não encontrado');

    if (data.internal_code !== undefined && data.internal_code !== existing.internal_code) {
      if (await this.tenants.internalCodeExistsExcept(data.internal_code, id)) {
        throw new ConflictError('O Código Interno informado já está em uso por outro inquilino');
      }
    }
    if (data.cpf && data.cpf !== existing.cpf) {
      if (await this.tenants.cpfExistsExcept(data.cpf, id)) {
        throw new ConflictError('O CPF informado já está cadastrado para outro inquilino');
      }
    }
    if (data.cnpj && data.cnpj !== existing.cnpj) {
      if (await this.tenants.cnpjExistsExcept(data.cnpj, id)) {
        throw new ConflictError('O CNPJ informado já está cadastrado para outro inquilino');
      }
    }

    return this.tenants.update(id, data);
  }
}

/** Soft-delete. Origem: deleteTenant — SEM checagem prévia de existência (fiel ao backend). */
export class DeleteTenantUseCase {
  constructor(private readonly tenants: TenantsRepository) {}
  async execute(id: string): Promise<{ name: string }> {
    if (!id) throw new ValidationError('ID é obrigatório');
    return this.tenants.softDelete(id);
  }
}

/**
 * Próximo código interno sugerido para novos inquilinos.
 * Origem: TenantService.getNextInternalCode (endpoint GET /tenants/next-internal-code,
 * adicionado ao Express após o mapeamento inicial — portado na recuperação).
 * Retorna MAX numérico + 1 no escopo da empresa (extension injeta company_id).
 */
export class GetNextTenantInternalCodeUseCase {
  constructor(private readonly tenants: TenantsRepository) {}
  async execute(): Promise<string> {
    return this.tenants.getNextInternalCode();
  }
}

export class RestoreTenantUseCase {
  constructor(private readonly tenants: TenantsRepository) {}
  async execute(id: string): Promise<Tenant> {
    if (!id) throw new ValidationError('ID é obrigatório');
    const state = await this.tenants.findDeletionState(id);
    if (!state) throw new NotFoundError('Inquilino não encontrado');
    if (!state.deleted_at) throw new ValidationError('O inquilino não está excluído');
    return this.tenants.restore(id);
  }
}
