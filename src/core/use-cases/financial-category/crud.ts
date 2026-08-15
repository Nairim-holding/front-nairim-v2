import type { CategoriesRepository } from '@/core/repositories/financial-categories-repository';
import type {
  Category,
  CreateCategoryData,
  ListCategoriesParams,
  PaginatedCategories,
  UpdateCategoryData,
} from '@/core/entities/category';
import { ForbiddenError, NotFoundError, ValidationError } from '@/core/errors/domain-errors';

/**
 * Casos de uso de Categoria Financeira.
 * Camada: core.
 * Origem: api-nairim-v2/src/services/CategoryService.ts + CategoryController.
 * Rodam dentro do contexto de tenant (withTenant).
 *
 * FIDELIDADE: mensagens e status replicam o backend — categoria de sistema
 * (403), delete com lançamentos (409 'não é possível excluir...'), delete com
 * subcategorias (409), restore valida exclusão prévia.
 */

export class ListCategoriesUseCase {
  constructor(private readonly categories: CategoriesRepository) {}
  async execute(params: ListCategoriesParams): Promise<PaginatedCategories> {
    // Fiel ao backend: garante as categorias internas de transferência antes
    // de listar.
    await this.categories.ensureTransferCategories();
    return this.categories.list(params);
  }
}

export class GetCategoryFiltersUseCase {
  constructor(private readonly categories: CategoriesRepository) {}
  async execute(): Promise<Record<string, unknown>> {
    return this.categories.getFilters();
  }
}

export class GetCategoryByIdUseCase {
  constructor(private readonly categories: CategoriesRepository) {}
  async execute(id: string): Promise<Category> {
    if (!id) throw new ValidationError('O ID é obrigatório');
    const category = await this.categories.findById(id);
    if (!category) throw new NotFoundError('Categoria não encontrada');
    return category;
  }
}

export class CreateCategoryUseCase {
  constructor(private readonly categories: CategoriesRepository) {}
  async execute(data: CreateCategoryData): Promise<Category> {
    if (!data.name?.trim()) throw new ValidationError('Nome da categoria é obrigatório');
    if (!data.type || !['INCOME', 'EXPENSE'].includes(data.type)) {
      throw new ValidationError('Tipo de categoria inválido. Deve ser INCOME ou EXPENSE');
    }
    if (data.dfc_group != null && !['TAXES', 'VARIABLE_EXPENSE', 'FIXED_EXPENSE', 'PAYROLL'].includes(data.dfc_group)) {
      throw new ValidationError('dfc_group deve ser um dos valores: TAXES, VARIABLE_EXPENSE, FIXED_EXPENSE, PAYROLL');
    }
    return this.categories.create(data);
  }
}

export class UpdateCategoryUseCase {
  constructor(private readonly categories: CategoriesRepository) {}
  async execute(id: string, data: UpdateCategoryData): Promise<Category> {
    if (!id) throw new ValidationError('O ID é obrigatório');
    if (data.name !== undefined && !data.name?.trim()) {
      throw new ValidationError('O nome da categoria não pode ser vazio');
    }
    if (data.type !== undefined && !['INCOME', 'EXPENSE'].includes(data.type)) {
      throw new ValidationError('Tipo de categoria inválido. Deve ser INCOME ou EXPENSE');
    }
    if (data.dfc_group != null && !['TAXES', 'VARIABLE_EXPENSE', 'FIXED_EXPENSE', 'PAYROLL'].includes(data.dfc_group)) {
      throw new ValidationError('dfc_group deve ser um dos valores: TAXES, VARIABLE_EXPENSE, FIXED_EXPENSE, PAYROLL');
    }
    const existing = await this.categories.findById(id);
    if (!existing) throw new NotFoundError('Categoria não encontrada');
    if (existing.is_system) throw new ForbiddenError('Não é possível alterar categorias internas do sistema.');
    return this.categories.update(id, data);
  }
}

export class DeleteCategoryUseCase {
  constructor(private readonly categories: CategoriesRepository) {}
  async execute(id: string): Promise<void> {
    if (!id) throw new ValidationError('O ID é obrigatório');
    await this.categories.softDelete(id);
  }
}

export class RestoreCategoryUseCase {
  constructor(private readonly categories: CategoriesRepository) {}
  async execute(id: string): Promise<Category> {
    if (!id) throw new ValidationError('O ID é obrigatório');
    const state = await this.categories.findDeletionState(id);
    if (!state) throw new NotFoundError('Categoria não encontrada');
    if (!state.deleted_at) throw new ValidationError('Categoria não está excluída');
    return this.categories.restore(id);
  }
}

export class QuickCreateCategoryUseCase {
  constructor(private readonly categories: CategoriesRepository) {}
  async execute(data: { name: string; type: 'INCOME' | 'EXPENSE' }): Promise<Category> {
    if (!data.name?.trim()) throw new ValidationError('Nome é obrigatório');
    if (!data.type || !['INCOME', 'EXPENSE'].includes(data.type)) throw new ValidationError('Tipo inválido');
    return this.categories.quickCreate(data);
  }
}