import { describe, it, expect, beforeEach } from 'vitest';
import { LoginUseCase } from '@/core/use-cases/auth/login';
import { VerifyTokenUseCase } from '@/core/use-cases/auth/verify-token';
import { RefreshTokenUseCase } from '@/core/use-cases/auth/refresh-token';
import { GetCurrentUserUseCase } from '@/core/use-cases/auth/get-current-user';
import { ChangePasswordUseCase } from '@/core/use-cases/auth/change-password';
import { RequestPasswordResetUseCase } from '@/core/use-cases/auth/request-password-reset';
import { ResetPasswordUseCase } from '@/core/use-cases/auth/reset-password';
import {
  InvalidCredentialsError,
  NotFoundError,
  UnauthorizedError,
  ValidationError,
} from '@/core/errors/domain-errors';
import {
  InMemoryUsersRepository,
  InMemoryCompaniesRepository,
  FakeHasher,
  FakeTokenSigner,
  makeUser,
} from './test-doubles';

/**
 * Testes unitários dos casos de uso de Auth. Garantem equivalência de
 * comportamento com o backend Express (AuthService/AuthController).
 */
describe('Auth use-cases', () => {
  let users: InMemoryUsersRepository;
  let companies: InMemoryCompaniesRepository;
  let hasher: FakeHasher;
  let signer: FakeTokenSigner;

  beforeEach(() => {
    users = new InMemoryUsersRepository();
    companies = new InMemoryCompaniesRepository();
    hasher = new FakeHasher();
    signer = new FakeTokenSigner();
  });

  describe('LoginUseCase', () => {
    it('autentica e mapeia o papel do token (ADMIN → administrador), mantendo o papel bruto no user', async () => {
      users.items.push(makeUser({ role: 'ADMIN', password: 'hashed:secret123' }));
      companies.slugs['company-1'] = 'nairim';
      const login = new LoginUseCase(users, companies, hasher, signer, '12h');

      const out = await login.execute({ email: 'maria@nairim.com', password: 'secret123' });

      expect(out.user.role).toBe('ADMIN'); // objeto user: papel bruto
      expect(out.user.company_slug).toBe('nairim');
      expect(out.expiresIn).toBe('12h');
      const payload = JSON.parse(out.token.replace(/^tok:/, ''));
      expect(payload.role).toBe('administrador'); // token: papel mapeado
      expect(payload.company_id).toBe('company-1');
    });

    it('lança InvalidCredentialsError se o usuário não existe', async () => {
      const login = new LoginUseCase(users, companies, hasher, signer, '12h');
      await expect(login.execute({ email: 'x@x.com', password: 'a' })).rejects.toBeInstanceOf(
        InvalidCredentialsError,
      );
    });

    it('lança InvalidCredentialsError se a senha não confere', async () => {
      users.items.push(makeUser({ password: 'hashed:secret123' }));
      const login = new LoginUseCase(users, companies, hasher, signer, '12h');
      await expect(
        login.execute({ email: 'maria@nairim.com', password: 'errada' }),
      ).rejects.toBeInstanceOf(InvalidCredentialsError);
    });

    it('retorna company_slug vazio quando a empresa não tem slug', async () => {
      users.items.push(makeUser());
      const login = new LoginUseCase(users, companies, hasher, signer, '12h');
      const out = await login.execute({ email: 'maria@nairim.com', password: 'secret123' });
      expect(out.user.company_slug).toBe('');
    });
  });

  describe('VerifyTokenUseCase', () => {
    it('retorna decoded para token válido', async () => {
      const verify = new VerifyTokenUseCase(signer);
      const token = signer.sign({ id: 'user-1' });
      const out = await verify.execute(token);
      expect(out.valid).toBe(true);
      expect(out.message).toBe('Token válido');
    });

    it('lança UnauthorizedError "Token expirado" para token expirado', async () => {
      const verify = new VerifyTokenUseCase(signer);
      const token = signer.sign({ id: 'user-1' });
      signer.expired.add(token);
      await expect(verify.execute(token)).rejects.toMatchObject({ message: 'Token expirado' });
      await expect(verify.execute(token)).rejects.toBeInstanceOf(UnauthorizedError);
    });
  });

  describe('RefreshTokenUseCase', () => {
    it('renova o token válido preservando o payload', async () => {
      const refresh = new RefreshTokenUseCase(signer, '12h');
      const token = signer.sign({ id: 'u', name: 'M', email: 'm@x', role: 'administrador', company_id: 'c' });
      const out = await refresh.execute(token);
      expect(out.expiresIn).toBe('12h');
      const payload = JSON.parse(out.token.replace(/^tok:/, ''));
      expect(payload.company_id).toBe('c');
    });
  });

  describe('GetCurrentUserUseCase', () => {
    it('retorna o perfil do usuário a partir do token', async () => {
      users.items.push(makeUser({ id: 'user-1' }));
      const getCurrent = new GetCurrentUserUseCase(users, signer);
      const token = signer.sign({ id: 'user-1' });
      const out = await getCurrent.execute(token);
      expect(out.id).toBe('user-1');
      expect(out.email).toBe('maria@nairim.com');
    });

    it('lança NotFoundError se o usuário do token não existe', async () => {
      const getCurrent = new GetCurrentUserUseCase(users, signer);
      const token = signer.sign({ id: 'ghost' });
      await expect(getCurrent.execute(token)).rejects.toBeInstanceOf(NotFoundError);
    });
  });

  describe('ChangePasswordUseCase', () => {
    it('troca a senha quando a senha atual confere', async () => {
      users.items.push(makeUser({ id: 'user-1', password: 'hashed:old' }));
      const change = new ChangePasswordUseCase(users, hasher);
      await change.execute({ userId: 'user-1', oldPassword: 'old', newPassword: 'novaSenha' });
      expect(users.items[0].password).toBe('hashed:novaSenha');
    });

    it('lança ValidationError se a senha atual está incorreta', async () => {
      users.items.push(makeUser({ id: 'user-1', password: 'hashed:old' }));
      const change = new ChangePasswordUseCase(users, hasher);
      await expect(
        change.execute({ userId: 'user-1', oldPassword: 'errada', newPassword: 'nova' }),
      ).rejects.toBeInstanceOf(ValidationError);
    });

    it('lança NotFoundError se o usuário não existe', async () => {
      const change = new ChangePasswordUseCase(users, hasher);
      await expect(
        change.execute({ userId: 'ghost', oldPassword: 'x', newPassword: 'yyyyyy' }),
      ).rejects.toBeInstanceOf(NotFoundError);
    });
  });

  describe('RequestPasswordResetUseCase', () => {
    it('gera token de reset quando o e-mail existe', async () => {
      users.items.push(makeUser({ email: 'maria@nairim.com' }));
      const req = new RequestPasswordResetUseCase(users, signer);
      const out = await req.execute('maria@nairim.com');
      expect(out.success).toBe(true);
      expect(out.resetToken).toBeDefined();
      const payload = JSON.parse(out.resetToken!.replace(/^tok:/, ''));
      expect(payload.type).toBe('password_reset');
    });

    it('responde genérico e sem token quando o e-mail não existe', async () => {
      const req = new RequestPasswordResetUseCase(users, signer);
      const out = await req.execute('nao@existe.com');
      expect(out.success).toBe(true);
      expect(out.resetToken).toBeUndefined();
    });
  });

  describe('ResetPasswordUseCase', () => {
    it('redefine a senha com token de reset válido', async () => {
      users.items.push(makeUser({ id: 'user-1', email: 'maria@nairim.com', password: 'hashed:old' }));
      const reset = new ResetPasswordUseCase(users, signer, hasher);
      const token = signer.sign({ id: 'user-1', email: 'maria@nairim.com', type: 'password_reset' });
      const out = await reset.execute(token, 'novaSenha');
      expect(out.success).toBe(true);
      expect(users.items[0].password).toBe('hashed:novaSenha');
    });

    it('lança ValidationError quando o token não é de reset', async () => {
      users.items.push(makeUser({ id: 'user-1' }));
      const reset = new ResetPasswordUseCase(users, signer, hasher);
      const token = signer.sign({ id: 'user-1', email: 'm', type: 'session' });
      await expect(reset.execute(token, 'novaSenha')).rejects.toBeInstanceOf(ValidationError);
    });
  });
});
