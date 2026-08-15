import { env } from '@/infra/config/env';
import { PrismaUsersRepository } from '@/infra/repositories/prisma-users-repository';
import { PrismaCompaniesRepository } from '@/infra/repositories/prisma-companies-repository';
import { bcryptHasher } from '@/infra/auth/bcrypt-hasher';
import { jwtService } from '@/infra/auth/jwt-service';

import { LoginUseCase } from '@/core/use-cases/auth/login';
import { VerifyTokenUseCase } from '@/core/use-cases/auth/verify-token';
import { RefreshTokenUseCase } from '@/core/use-cases/auth/refresh-token';
import { GetCurrentUserUseCase } from '@/core/use-cases/auth/get-current-user';
import { ChangePasswordUseCase } from '@/core/use-cases/auth/change-password';
import { RequestPasswordResetUseCase } from '@/core/use-cases/auth/request-password-reset';
import { ResetPasswordUseCase } from '@/core/use-cases/auth/reset-password';

/**
 * Composição (wiring) dos casos de uso de autenticação.
 *
 * Aqui a inversão de dependência se concretiza: injeta as implementações
 * (Prisma, bcrypt, jwt) nos casos de uso, que só conhecem as interfaces do core.
 * Os Route Handlers importam apenas este objeto.
 *
 * Camada: infra (composition root).
 */
const usersRepository = new PrismaUsersRepository();
const companiesRepository = new PrismaCompaniesRepository();

export const authUseCases = {
  login: new LoginUseCase(usersRepository, companiesRepository, bcryptHasher, jwtService, env.JWT_EXPIRES_IN),
  verifyToken: new VerifyTokenUseCase(jwtService),
  refreshToken: new RefreshTokenUseCase(jwtService, env.JWT_EXPIRES_IN),
  getCurrentUser: new GetCurrentUserUseCase(usersRepository, jwtService),
  changePassword: new ChangePasswordUseCase(usersRepository, bcryptHasher),
  requestPasswordReset: new RequestPasswordResetUseCase(usersRepository, jwtService),
  resetPassword: new ResetPasswordUseCase(usersRepository, jwtService, bcryptHasher),
};
