import { PrismaUsersRepository } from '@/infra/repositories/prisma-users-repository';
import { PrismaUserPreferencesRepository } from '@/infra/repositories/prisma-user-preferences-repository';
import { bcryptHasher } from '@/infra/auth/bcrypt-hasher';
import { minioStorage } from '@/infra/storage/minio-storage';

import {
  ListUsersUseCase,
  GetUserFiltersUseCase,
  GetUserByIdUseCase,
  CreateUserUseCase,
  UpdateUserUseCase,
  DeleteUserUseCase,
  RestoreUserUseCase,
  SetActiveUserUseCase,
  UploadUserPhotoUseCase,
  GetUserScheduleUseCase,
  SetUserScheduleUseCase,
} from '@/core/use-cases/user/crud';
import {
  GetColumnPreferencesUseCase,
  SaveColumnPreferencesUseCase,
  GetDashboardLayoutUseCase,
  SaveDashboardLayoutUseCase,
} from '@/core/use-cases/user-preferences/preferences';

/**
 * Composition root dos módulos Users e User-preferences.
 * Camada: infra.
 */
const users = new PrismaUsersRepository();
const preferences = new PrismaUserPreferencesRepository();

export const userUseCases = {
  list: new ListUsersUseCase(users),
  getFilters: new GetUserFiltersUseCase(users),
  getById: new GetUserByIdUseCase(users),
  create: new CreateUserUseCase(users, bcryptHasher),
  update: new UpdateUserUseCase(users, bcryptHasher),
  remove: new DeleteUserUseCase(users),
  restore: new RestoreUserUseCase(users),
  setActive: new SetActiveUserUseCase(users),
  uploadPhoto: new UploadUserPhotoUseCase(users, minioStorage),
  getSchedule: new GetUserScheduleUseCase(users),
  setSchedule: new SetUserScheduleUseCase(users),
};

export const userPreferencesUseCases = {
  getColumnPreferences: new GetColumnPreferencesUseCase(preferences),
  saveColumnPreferences: new SaveColumnPreferencesUseCase(preferences),
  getDashboardLayout: new GetDashboardLayoutUseCase(preferences),
  saveDashboardLayout: new SaveDashboardLayoutUseCase(preferences),
};
