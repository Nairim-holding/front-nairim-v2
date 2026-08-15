import type { OwnersRepository } from '@/core/repositories/owners-repository';
import type { ContactSuggestion } from '@/core/entities/agency';
import type {
  CreateOwnerData,
  ListOwnersParams,
  Owner,
  PaginatedOwners,
  UpdateOwnerData,
} from '@/core/entities/owner';
import { ConflictError, NotFoundError, ValidationError } from '@/core/errors/domain-errors';

/**
 * Casos de uso de Proprietário (Owner).
 * Camada: core.
 * Origem: api-nairim-v2/src/services/OwnerService.ts + OwnerController.ts.
 * Rodam dentro do contexto de tenant (withTenant).
 */

export class ListOwnersUseCase {
  constructor(private readonly owners: OwnersRepository) {}
  async execute(params: ListOwnersParams): Promise<PaginatedOwners> {
    return this.owners.list(params);
  }
}

export class GetOwnerFiltersUseCase {
  constructor(private readonly owners: OwnersRepository) {}
  async execute(filters: Record<string, unknown>): Promise<Record<string, unknown>> {
    return this.owners.getFilters(filters);
  }
}

export class GetOwnerContactSuggestionsUseCase {
  constructor(private readonly owners: OwnersRepository) {}
  async execute(search: string): Promise<ContactSuggestion[]> {
    return this.owners.getAvailableContacts(search ?? '');
  }
}

export class GetOwnerByIdUseCase {
  constructor(private readonly owners: OwnersRepository) {}
  async execute(id: string): Promise<Owner> {
    if (!id) throw new ValidationError('O ID é obrigatório');
    const owner = await this.owners.findById(id);
    if (!owner) throw new NotFoundError('Proprietário não encontrado');
    return owner;
  }
}

/**
 * Cria proprietário. Origem: createOwner.
 *
 * Regras (fiéis ao backend):
 *  - internal_code único (409).
 *  - PF (`cpf` informado): CPF único (409); campos de PJ são zerados.
 *  - PJ (`cnpj` informado): CNPJ único (409); campos de PF são zerados.
 */
export class CreateOwnerUseCase {
  constructor(private readonly owners: OwnersRepository) {}

  async execute(data: CreateOwnerData): Promise<Owner> {
    const isPessoaFisica = !!data.cpf;
    const isPessoaJuridica = !!data.cnpj;

    if (data.internal_code && (await this.owners.internalCodeExists(data.internal_code))) {
      throw new ConflictError('O Código Interno informado já está em uso por outro proprietário');
    }
    if (isPessoaFisica && data.cpf && (await this.owners.cpfExists(data.cpf))) {
      throw new ConflictError('O CPF informado já está cadastrado');
    }
    if (isPessoaJuridica && data.cnpj && (await this.owners.cnpjExists(data.cnpj))) {
      throw new ConflictError('O CNPJ informado já está cadastrado');
    }

    const payload: CreateOwnerData = { name: data.name, internal_code: data.internal_code };
    if (isPessoaFisica) {
      payload.occupation = data.occupation;
      payload.marital_status = data.marital_status;
      payload.cpf = data.cpf;
      payload.cnpj = null;
      payload.state_registration = null;
      payload.municipal_registration = null;
    } else if (isPessoaJuridica) {
      payload.cnpj = data.cnpj;
      payload.state_registration = data.state_registration;
      payload.municipal_registration = data.municipal_registration;
      payload.occupation = null;
      payload.marital_status = null;
      payload.cpf = null;
    }
    payload.contacts = data.contacts;
    payload.addresses = data.addresses;

    return this.owners.create(payload);
  }
}

/**
 * Atualiza proprietário. Origem: updateOwner.
 * PF/PJ inferido por `data.cpf`/`data.cnpj`, com fallback para o registro
 * existente (replica `isPessoaFisica = data.cpf || (!data.cnpj && existing.cpf)`).
 */
export class UpdateOwnerUseCase {
  constructor(private readonly owners: OwnersRepository) {}

  async execute(id: string, data: UpdateOwnerData): Promise<Owner> {
    if (!id) throw new ValidationError('O ID é obrigatório');

    const existing = await this.owners.findById(id);
    if (!existing) throw new NotFoundError('Proprietário não encontrado');

    const isPessoaFisica = !!data.cpf || (!data.cnpj && !!existing.cpf);
    const isPessoaJuridica = !!data.cnpj || (!data.cpf && !!existing.cnpj);

    if (data.internal_code !== undefined && data.internal_code !== existing.internal_code) {
      if (await this.owners.internalCodeExistsExcept(data.internal_code, id)) {
        throw new ConflictError('O Código Interno informado já está em uso por outro proprietário');
      }
    }
    if (isPessoaFisica && data.cpf && data.cpf !== existing.cpf) {
      if (await this.owners.cpfExistsExcept(data.cpf, id)) {
        throw new ConflictError('O CPF informado já está cadastrado para outro proprietário');
      }
    }
    if (isPessoaJuridica && data.cnpj && data.cnpj !== existing.cnpj) {
      if (await this.owners.cnpjExistsExcept(data.cnpj, id)) {
        throw new ConflictError('O CNPJ informado já está cadastrado para outro proprietário');
      }
    }

    const payload: UpdateOwnerData = {};
    if (data.name !== undefined) payload.name = data.name;
    if (data.internal_code !== undefined) payload.internal_code = data.internal_code;

    if (isPessoaFisica) {
      if (data.occupation !== undefined) payload.occupation = data.occupation;
      if (data.marital_status !== undefined) payload.marital_status = data.marital_status;
      if (data.cpf !== undefined) payload.cpf = data.cpf;
      payload.cnpj = null;
      payload.state_registration = null;
      payload.municipal_registration = null;
    } else if (isPessoaJuridica) {
      if (data.cnpj !== undefined) payload.cnpj = data.cnpj;
      if (data.state_registration !== undefined) payload.state_registration = data.state_registration;
      if (data.municipal_registration !== undefined) payload.municipal_registration = data.municipal_registration;
      payload.occupation = null;
      payload.marital_status = null;
      payload.cpf = null;
    }
    if (data.contacts !== undefined) payload.contacts = data.contacts;
    if (data.addresses !== undefined) payload.addresses = data.addresses;

    return this.owners.update(id, payload);
  }
}

export class DeleteOwnerUseCase {
  constructor(private readonly owners: OwnersRepository) {}
  async execute(id: string): Promise<{ name: string }> {
    if (!id) throw new ValidationError('O ID é obrigatório');
    const result = await this.owners.softDelete(id);
    if (!result) throw new NotFoundError('Proprietário não encontrado ou já excluído');
    return result;
  }
}

export class RestoreOwnerUseCase {
  constructor(private readonly owners: OwnersRepository) {}
  async execute(id: string): Promise<Owner> {
    if (!id) throw new ValidationError('O ID é obrigatório');
    const state = await this.owners.findDeletionState(id);
    if (!state) throw new NotFoundError('Proprietário não encontrado');
    if (!state.deleted_at) throw new ValidationError('O proprietário não está excluído');
    return this.owners.restore(id);
  }
}
