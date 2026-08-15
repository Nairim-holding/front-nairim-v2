import type { CentersRepository } from '@/core/repositories/financial-centers-repository';
import type {
  Center,
  CreateCenterData,
  ListCentersParams,
  PaginatedCenters,
  UpdateCenterData,
} from '@/core/entities/financial-center';
import type { TransactionType } from '@/core/entities/category';
import { NotFoundError, ValidationError } from '@/core/errors/domain-errors';

/**
 * Casos de uso de Centro de Custo.
 * Camada: core.
 * Origem: api-nairim-v2/src/services/CenterService.ts + CenterController.
 * Rodam dentro do contexto de tenant (withTenant).
 *
 * FIDELIDADE: mensagens e status replicam o backend — `Centro não encontrado`
 * (404), delete com lançamentos vinculados (409, mensagem normalizada com
 * acentuação), restore valida exclusão.
 */

const CENTER_TYPES: TransactionType[] = ['INCOME', 'EXPENSE'];

export class ListCentersUseCase {
  constructor(private readonly centers: CentersRepository) {}
  async execute(params: ListCentersParams): Promise<PaginatedCenters> {
    return this.centers.list(params);
  }
}

export class GetCenterFiltersUseCase {
  constructor(private readonly centers: CentersRepository) {}
  async execute(): Promise<Record<string, unknown>> {
    return this.centers.getFilters();
  }
}

export class GetCenterByIdUseCase {
  constructor(private readonly centers: CentersRepository) {}
  async execute(id: string): Promise<Center> {
    if (!id) throw new ValidationError('O ID é obrigatório');
    const center = await this.centers.findById(id);
    if (!center) throw new NotFoundError('Centro não encontrado');
    return center;
  }
}

export class CreateCenterUseCase {
  constructor(private readonly centers: CentersRepository) {}
  async execute(data: CreateCenterData): Promise<Center> {
    if (!data.name?.trim()) throw new ValidationError('Nome do centro é obrigatório');
    if (!data.type || !CENTER_TYPES.includes(data.type)) {
      throw new ValidationError('Tipo de centro inválido. Deve ser INCOME (Receita) ou EXPENSE (Despesa)');
    }
    return this.centers.create(data);
  }
}

export class UpdateCenterUseCase {
  constructor(private readonly centers: CentersRepository) {}
  async execute(id: string, data: UpdateCenterData): Promise<Center> {
    if (!id) throw new ValidationError('O ID é obrigatório');
    if (data.name !== undefined && !data.name?.trim()) {
      throw new ValidationError('O nome do centro não pode ser vazio');
    }
    if (data.type !== undefined && !CENTER_TYPES.includes(data.type)) {
      throw new ValidationError('Tipo de centro inválido. Deve ser INCOME (Receita) ou EXPENSE (Despesa)');
    }
    const existing = await this.centers.findById(id);
    if (!existing) throw new NotFoundError('Centro não encontrado');
    return this.centers.update(id, data);
  }
}

export class DeleteCenterUseCase {
  constructor(private readonly centers: CentersRepository) {}
  async execute(id: string): Promise<void> {
    if (!id) throw new ValidationError('O ID é obrigatório');
    await this.centers.softDelete(id);
  }
}

export class RestoreCenterUseCase {
  constructor(private readonly centers: CentersRepository) {}
  async execute(id: string): Promise<Center> {
    if (!id) throw new ValidationError('O ID é obrigatório');
    const state = await this.centers.findDeletionState(id);
    if (!state) throw new NotFoundError('Centro não encontrado');
    if (!state.deleted_at) throw new ValidationError('Centro não está excluído');
    return this.centers.restore(id);
  }
}

export class QuickCreateCenterUseCase {
  constructor(private readonly centers: CentersRepository) {}
  async execute(data: { name: string; type: TransactionType }): Promise<Center> {
    if (!data.name?.trim()) throw new ValidationError('Nome é obrigatório');
    if (!data.type || !CENTER_TYPES.includes(data.type)) throw new ValidationError('Tipo é obrigatório');
    return this.centers.quickCreate(data);
  }
}