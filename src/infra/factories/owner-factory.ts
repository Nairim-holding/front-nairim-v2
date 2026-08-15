import { PrismaOwnersRepository } from '@/infra/repositories/prisma-owners-repository';
import {
  ListOwnersUseCase,
  GetOwnerFiltersUseCase,
  GetOwnerContactSuggestionsUseCase,
  GetOwnerByIdUseCase,
  CreateOwnerUseCase,
  UpdateOwnerUseCase,
  DeleteOwnerUseCase,
  RestoreOwnerUseCase,
} from '@/core/use-cases/owner/crud';

/** Composition root do módulo Owners. Camada: infra. */
const owners = new PrismaOwnersRepository();

export const ownerUseCases = {
  list: new ListOwnersUseCase(owners),
  getFilters: new GetOwnerFiltersUseCase(owners),
  getContactSuggestions: new GetOwnerContactSuggestionsUseCase(owners),
  getById: new GetOwnerByIdUseCase(owners),
  create: new CreateOwnerUseCase(owners),
  update: new UpdateOwnerUseCase(owners),
  remove: new DeleteOwnerUseCase(owners),
  restore: new RestoreOwnerUseCase(owners),
};
