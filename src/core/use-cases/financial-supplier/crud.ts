import type { SuppliersRepository } from '@/core/repositories/financial-suppliers-repository';
import type {
  CreateSupplierData,
  ListSuppliersParams,
  PaginatedSuppliers,
  Supplier,
  UpdateSupplierData,
} from '@/core/entities/financial-supplier';
import { ConflictError, NotFoundError, ValidationError } from '@/core/errors/domain-errors';

/**
 * Casos de uso de Fornecedor.
 * Camada: core.
 * Origem: api-nairim-v2/src/services/SupplierService.ts + SupplierController.
 * Rodam dentro do contexto de tenant (withTenant).
 *
 * FIDELIDADE: `O Nome / Razão Social é obrigatório` (400); CNPJ 14 dígitos;
 * CPF 11 dígitos; `Fornecedor não encontrado` (404). Dup de CNPJ/CPF → 409 com
 * mensagem em pt-BR (no backend o CPF caía em 400 inglesado — normalizado).
 */

function cleanDigits(value: string | null | undefined): string {
  return String(value ?? '').replace(/[^\d]/g, '');
}

export class ListSuppliersUseCase {
  constructor(private readonly suppliers: SuppliersRepository) {}
  async execute(params: ListSuppliersParams): Promise<PaginatedSuppliers> {
    return this.suppliers.list(params);
  }
}

export class GetSupplierFiltersUseCase {
  constructor(private readonly suppliers: SuppliersRepository) {}
  async execute(): Promise<Record<string, unknown>> {
    return this.suppliers.getFilters();
  }
}

export class GetSupplierByIdUseCase {
  constructor(private readonly suppliers: SuppliersRepository) {}
  async execute(id: string): Promise<Supplier> {
    if (!id) throw new ValidationError('O ID é obrigatório');
    const supplier = await this.suppliers.findById(id);
    if (!supplier) throw new NotFoundError('Fornecedor não encontrado');
    return supplier;
  }
}

function validateDocuments(payload: { cnpj?: string | null; cpf?: string | null }): void {
  if (payload.cnpj) {
    const cleanCNPJ = cleanDigits(payload.cnpj);
    if (cleanCNPJ.length !== 14) throw new ValidationError('CNPJ inválido. Deve conter 14 dígitos.');
  }
  if (payload.cpf) {
    const cleanCPF = cleanDigits(payload.cpf);
    if (cleanCPF.length !== 11) throw new ValidationError('CPF inválido. Deve conter 11 dígitos.');
  }
}

export class CreateSupplierUseCase {
  constructor(private readonly suppliers: SuppliersRepository) {}
  async execute(data: CreateSupplierData): Promise<Supplier> {
    if (!data.legal_name?.trim()) throw new ValidationError('O Nome / Razão Social é obrigatório');
    validateDocuments(data);
    return this.suppliers.create(data);
  }
}

export class UpdateSupplierUseCase {
  constructor(private readonly suppliers: SuppliersRepository) {}
  async execute(id: string, data: UpdateSupplierData): Promise<Supplier> {
    if (!id) throw new ValidationError('O ID é obrigatório');
    if (data.legal_name !== undefined && !data.legal_name.trim()) {
      throw new ValidationError('O Nome / Razão Social é obrigatório');
    }
    validateDocuments(data);
    const existing = await this.suppliers.findById(id);
    if (!existing) throw new NotFoundError('Fornecedor não encontrado');
    return this.suppliers.update(id, data);
  }
}

export class DeleteSupplierUseCase {
  constructor(private readonly suppliers: SuppliersRepository) {}
  async execute(id: string): Promise<void> {
    if (!id) throw new ValidationError('O ID é obrigatório');
    await this.suppliers.softDelete(id);
  }
}

export class RestoreSupplierUseCase {
  constructor(private readonly suppliers: SuppliersRepository) {}
  async execute(id: string): Promise<Supplier> {
    if (!id) throw new ValidationError('O ID é obrigatório');
    const state = await this.suppliers.findDeletionState(id);
    if (!state) throw new NotFoundError('Fornecedor não encontrado');
    if (!state.deleted_at) throw new ValidationError('Fornecedor não está excluído');
    return this.suppliers.restore(id);
  }
}

export class QuickCreateSupplierUseCase {
  constructor(private readonly suppliers: SuppliersRepository) {}
  async execute(data: { legal_name: string }): Promise<Supplier> {
    const legalName = String(data.legal_name ?? '').trim();
    if (legalName.length < 2 || legalName.length > 150) {
      throw new ValidationError('legal_name é obrigatório e deve ter entre 2 e 150 caracteres.');
    }
    return this.suppliers.quickCreate({ legal_name: legalName });
  }
}

// ─── Mapeamento de conflitos (usado pelo repositório) ──────────────────────

const CONFLICT_MESSAGES = {
  cnpjCreate: 'Este CNPJ já está cadastrado',
  cpfCreate: 'Este CPF já está cadastrado',
  cnpjUpdate: 'Este CNPJ já está cadastrado para outro fornecedor',
  cpfUpdate: 'Este CPF já está cadastrado para outro fornecedor',
} as const;

export { CONFLICT_MESSAGES };

/** Lança ConflictError para dup de CNPJ/CPF (create ou update). */
export function throwDuplicatedDocument(document: 'cnpj' | 'cpf', mode: 'create' | 'update'): never {
  const key = `${document}${mode === 'create' ? 'Create' : 'Update'}` as keyof typeof CONFLICT_MESSAGES;
  throw new ConflictError(CONFLICT_MESSAGES[key]);
}