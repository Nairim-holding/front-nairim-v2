import type { SubcategoriesRepository } from '@/core/repositories/financial-subcategories-repository';
import type {
  CreateSubcategoryData,
  ListSubcategoriesParams,
  PaginatedSubcategories,
  Subcategory,
  UpdateSubcategoryData,
} from '@/core/entities/subcategory';
import { ConflictError, NotFoundError, ValidationError } from '@/core/errors/domain-errors';

/**
 * Casos de uso de Subcategoria Financeira.
 * Camada: core.
 * Origem: api-nairim-v2/src/services/SubcategoryService.ts + SubcategoryController.
 * Rodam dentro do contexto de tenant (withTenant).
 *
 * FIDELIDADE: mensagens e status replicam o backend — `Categoria pai não
 * encontrada` vira 404 no create/update, delete com lançamentos vira 409,
 * restore valida exclusão prévia.
 */

export class ListSubcategoriesUseCase {
  constructor(private readonly subcategories: SubcategoriesRepository) {}
  async execute(params: ListSubcategoriesParams): Promise<PaginatedSubcategories> {
    return this.subcategories.list(params);
  }
}

export class GetSubcategoryFiltersUseCase {
  constructor(private readonly subcategories: SubcategoriesRepository) {}
  async execute(): Promise<Record<string, unknown>> {
    return this.subcategories.getFilters();
  }
}

export class GetSubcategoryByIdUseCase {
  constructor(private readonly subcategories: SubcategoriesRepository) {}
  async execute(id: string): Promise<Subcategory> {
    if (!id) throw new ValidationError('O ID é obrigatório');
    const subcategory = await this.subcategories.findById(id);
    if (!subcategory) throw new NotFoundError('Subcategoria não encontrada');
    return subcategory;
  }
}

export class CreateSubcategoryUseCase {
  constructor(private readonly subcategories: SubcategoriesRepository) {}
  async execute(data: CreateSubcategoryData): Promise<Subcategory> {
    if (!data.name?.trim()) throw new ValidationError('Nome da subcategoria é obrigatório');
    if (!data.category_id?.trim()) throw new ValidationError('O ID da categoria pai é obrigatório');
    const parentExists = await this.subcategories.categoryExists(data.category_id);
    if (!parentExists) throw new NotFoundError('Categoria pai não encontrada');
    return this.subcategories.create(data);
  }
}

export class UpdateSubcategoryUseCase {
  constructor(private readonly subcategories: SubcategoriesRepository) {}
  async execute(id: string, data: UpdateSubcategoryData): Promise<Subcategory> {
    if (!id) throw new ValidationError('O ID é obrigatório');
    if (data.name !== undefined && !data.name?.trim()) {
      throw new ValidationError('O nome da subcategoria não pode ser vazio');
    }
    if (data.category_id !== undefined && !data.category_id?.trim()) {
      throw new ValidationError('O ID da categoria pai não pode ser vazio');
    }
    const existing = await this.subcategories.findById(id);
    if (!existing) throw new NotFoundError('Subcategoria não encontrada');

    // Fiel ao backend: só valida a existência da nova categoria se mudou.
    if (data.category_id && data.category_id !== existing.category_id) {
      const parentExists = await this.subcategories.categoryExists(data.category_id);
      if (!parentExists) throw new NotFoundError('Categoria pai não encontrada');
    }
    return this.subcategories.update(id, data);
  }
}

export class DeleteSubcategoryUseCase {
  constructor(private readonly subcategories: SubcategoriesRepository) {}
  async execute(id: string): Promise<void> {
    if (!id) throw new ValidationError('O ID é obrigatório');
    await this.subcategories.softDelete(id);
  }
}

export class RestoreSubcategoryUseCase {
  constructor(private readonly subcategories: SubcategoriesRepository) {}
  async execute(id: string): Promise<Subcategory> {
    if (!id) throw new ValidationError('O ID é obrigatório');
    const state = await this.subcategories.findDeletionState(id);
    if (!state) throw new NotFoundError('Subcategoria não encontrada');
    if (!state.deleted_at) throw new ValidationError('Subcategoria não está excluída');
    return this.subcategories.restore(id);
  }
}

export class QuickCreateSubcategoryUseCase {
  constructor(private readonly subcategories: SubcategoriesRepository) {}
  async execute(data: { name: string; category_id: string }): Promise<Subcategory> {
    if (!data.name?.trim()) throw new ValidationError('Nome é obrigatório');
    if (!data.category_id?.trim()) throw new ValidationError('Categoria pai é obrigatória');
    return this.subcategories.quickCreate(data);
  }
}