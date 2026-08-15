import type { LeasesRepository } from '@/core/repositories/leases-repository';
import type { LeaseFinanceRepository } from '@/core/repositories/lease-finance-repository';
import type {
  CreateLeaseData,
  Lease,
  ListLeasesParams,
  PaginatedLeases,
  UpdateLeaseData,
} from '@/core/entities/lease';
import { ConflictError, NotFoundError, ValidationError } from '@/core/errors/domain-errors';

/**
 * Casos de uso de CRUD de Locação (Lease).
 * Camada: core.
 * Origem: api-nairim-v2/src/services/LeaseService.ts + LeaseController.ts.
 * Rodam dentro do contexto de tenant (withTenant).
 */

export class ListLeasesUseCase {
  constructor(private readonly leases: LeasesRepository) {}
  async execute(params: ListLeasesParams): Promise<PaginatedLeases> {
    return this.leases.list(params);
  }
}

export class GetLeaseFiltersUseCase {
  constructor(private readonly leases: LeasesRepository) {}
  async execute(filters: Record<string, unknown>): Promise<Record<string, unknown>> {
    return this.leases.getFilters(filters);
  }
}

export class GetLeaseByIdUseCase {
  constructor(private readonly leases: LeasesRepository) {}
  async execute(id: string): Promise<Lease> {
    if (!id) throw new ValidationError('O ID é obrigatório');
    const lease = await this.leases.findById(id);
    if (!lease) throw new NotFoundError('Locação não encontrada');
    return lease;
  }
}

/**
 * Cria locação. Origem: createLease.
 *
 * Regras:
 *  - o imóvel precisa ter uma categoria definida (não criada pelo sistema);
 *  - `contract_number` único entre ativas (409);
 *  - após o commit, sincroniza os lançamentos financeiros (aluguel/comissão/
 *    IPTU) via `LeaseFinanceRepository`. Falha na sincronização NÃO invalida a
 *    locação já criada — apenas anexa um aviso (`finance_warning`).
 */
export class CreateLeaseUseCase {
  constructor(
    private readonly leases: LeasesRepository,
    private readonly finance: LeaseFinanceRepository,
  ) {}

  async execute(data: CreateLeaseData): Promise<Lease & { finance_warning?: string }> {
    const categoryId = await this.leases.getPropertyCategoryId(data.property_id);
    if (!categoryId) {
      throw new ValidationError('É necessário selecionar uma categoria no imóvel antes de criar a locação.');
    }
    if (data.contract_number && (await this.leases.contractNumberExists(data.contract_number))) {
      throw new ConflictError('Este número de contrato já está registrado');
    }

    const lease = await this.leases.create(data);

    const result: Lease & { finance_warning?: string } = { ...lease };
    try {
      const sync = await this.finance.syncLeaseTransactions(lease.id, lease.company_id);
      if (sync.warning) result.finance_warning = sync.warning;
    } catch {
      result.finance_warning = 'Locação salva, mas houve um erro ao gerar os lançamentos financeiros.';
    }
    return result;
  }
}

/**
 * Atualiza locação. Origem: updateLease.
 * Regras: 404 se não existir; contract_number único entre outras (409);
 * re-sincroniza os lançamentos financeiros após a edição (idempotente).
 */
export class UpdateLeaseUseCase {
  constructor(
    private readonly leases: LeasesRepository,
    private readonly finance: LeaseFinanceRepository,
  ) {}

  async execute(id: string, data: UpdateLeaseData): Promise<Lease & { finance_warning?: string }> {
    if (!id) throw new ValidationError('O ID é obrigatório');

    const existing = await this.leases.findById(id);
    if (!existing) throw new NotFoundError('Locação não encontrada');

    if (data.contract_number && data.contract_number !== existing.contract_number) {
      if (await this.leases.contractNumberExistsExcept(data.contract_number, id)) {
        throw new ConflictError('Número de contrato já registrado para outra locação');
      }
    }

    const lease = await this.leases.update(id, data);

    const result: Lease & { finance_warning?: string } = { ...lease };
    try {
      const sync = await this.finance.syncLeaseTransactions(lease.id, lease.company_id);
      if (sync.warning) result.finance_warning = sync.warning;
    } catch {
      result.finance_warning = 'Locação atualizada, mas houve um erro ao sincronizar os lançamentos financeiros.';
    }
    return result;
  }
}

/** Soft-delete (cancela). Origem: deleteLease. */
export class DeleteLeaseUseCase {
  constructor(private readonly leases: LeasesRepository) {}
  async execute(id: string): Promise<Lease> {
    if (!id) throw new ValidationError('O ID é obrigatório');
    const result = await this.leases.softDelete(id);
    if (!result) throw new NotFoundError('Locação não encontrada');
    return result;
  }
}

/** Hard delete + cascata de transações. Origem: permanentlyDeleteLease. */
export class PermanentlyDeleteLeaseUseCase {
  constructor(private readonly leases: LeasesRepository) {}
  async execute(id: string): Promise<Lease> {
    if (!id) throw new ValidationError('O ID é obrigatório');
    const result = await this.leases.permanentlyDelete(id);
    if (!result) throw new NotFoundError('Locação não encontrada');
    return result;
  }
}

/** Restaura locação excluída/cancelada. Origem: restoreLease. */
export class RestoreLeaseUseCase {
  constructor(private readonly leases: LeasesRepository) {}
  async execute(id: string): Promise<Lease> {
    if (!id) throw new ValidationError('O ID é obrigatório');
    const result = await this.leases.restore(id);
    if (!result) throw new NotFoundError('Locação não encontrada');
    return result;
  }
}
