'use server';

import { randomUUID } from 'node:crypto';
import prisma from '@/infra/database/prisma';
import { authUseCases } from '@/infra/factories/auth-factory';
import {
  loginSchema,
  changePasswordSchema,
  requestPasswordResetSchema,
  resetPasswordSchema,
} from '@/shared/validators/auth';
import { type ActionResult, runAction, actionFail } from '@/shared/actions/action-result';
import {
  setSessionCookie,
  clearSessionCookie,
  getSessionToken,
  requireSession,
  getRequestIp,
} from '@/infra/auth/session';
import { loginRateLimiter } from '@/infra/security/login-rate-limiter';
import { InvalidCredentialsError, ForbiddenError } from '@/core/errors/domain-errors';
import { validateLiveSession } from '@/infra/auth/live-session';
import { jwtService } from '@/infra/auth/jwt-service';
import { env } from '@/infra/config/env';
import type { LoginActionResult, RefreshActionResult } from './auth-types';

/**
 * Server Actions de autenticação (SSR) — substituem os endpoints `/auth/*` do
 * Express. Os casos de uso (core) são os mesmos; aqui muda só a apresentação:
 * em vez de handlers HTTP, funções `'use server'` que gravam o cookie de sessão
 * no servidor via next/headers.
 *
 * Camada: server (apresentação). Runtime Node (herdado do core/infra).
 * Origem: api-nairim-v2/src/routes/auth.ts + AuthController + authRateLimit.
 */

/**
 * Autentica e grava o cookie de sessão no servidor.
 * Limita por conta: 5 falhas → bloqueio de 5 min, mesmo se o IP informado mudar.
 * Origem: POST /auth/login.
 */
export async function loginAction(input: { email: string; password: string }): Promise<LoginActionResult> {
  const parsed = loginSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? 'Erro de validação' };
  }

  const emailKey = parsed.data.email.toLowerCase().trim();
  let ip = 'desconhecido';

  try {
    ip = await getRequestIp();

    const blockedMessage = loginRateLimiter.checkBlocked(emailKey, ip);
    if (blockedMessage) return { ok: false, message: blockedMessage };

    const result = await authUseCases.login.execute(parsed.data);
    await validateLiveSession(jwtService.verify(result.token));
    await prisma.auditLog.create({ data: {
      company_id: result.user.company_id, user_id: result.user.id,
      user_name: result.user.name, user_email: result.user.email,
      action: 'LOGIN', table_name: 'Auth', record_id: result.user.id, ip: ip.slice(0, 45),
    } });
    loginRateLimiter.reset(emailKey, ip);
    await setSessionCookie(result.token, result.user.company_slug || undefined);
    return { ok: true, token: result.token, user: result.user, slug: result.user.company_slug };
  } catch (err) {
    if (err instanceof InvalidCredentialsError) {
      loginRateLimiter.registerFailure(emailKey, ip);
      try {
        const user = await prisma.user.findFirst({ where: { email: { equals: emailKey, mode: 'insensitive' } }, select: { id: true, company_id: true, name: true } });
        await prisma.auditLog.create({ data: {
          company_id: user?.company_id, user_id: user?.id, user_name: user?.name,
          user_email: emailKey, action: 'LOGIN_FAILED', table_name: 'Auth', ip: ip.slice(0, 45),
        } });
      } catch (auditError) {
        console.error('[audit] Falha ao registrar tentativa de login', auditError);
      }
      return { ok: false, message: 'Email ou senha incorretos', rateLimit: loginRateLimiter.getStatus(emailKey, ip) };
    }

    // Falha que NÃO é credencial inválida (banco fora do ar, JWT_SECRET
    // ausente, hash de senha corrompido, cookie recusado…). O usuário via
    // apenas "Erro interno do servidor", sem nada que ligasse a tela ao log do
    // servidor (Tarefa 8). Agora cada ocorrência recebe um código: o mesmo
    // código aparece na tela e na linha de log, com causa e stack.
    const errorId = randomUUID().slice(0, 8);
    const cause = err as { name?: string; message?: string; code?: string; stack?: string };
    console.error(
      `[loginAction] Falha inesperada no login (código ${errorId})`,
      {
        errorId,
        email: emailKey,
        ip,
        name: cause?.name,
        code: cause?.code,
        message: cause?.message,
      },
      cause?.stack,
    );

    const failed = actionFail(err);
    return { ok: false, message: `${failed.error} (código ${errorId})` };
  }
}

/**
 * Renova o JWT de sessão (grace period de 5 min) e regrava o cookie.
 * Lê o token atual do cookie. Origem: POST /auth/refresh-token.
 */
export async function refreshSessionAction(): Promise<RefreshActionResult> {
  const current = await getSessionToken();
  if (!current) return { ok: false, message: 'Sessão ausente' };
  try {
    // First enforce expiration/grace and token purpose; then reload authority.
    const refreshed = await authUseCases.refreshToken.execute(current);
    const session = await validateLiveSession(jwtService.verify(refreshed.token));
    const { iat: _iat, exp: _exp, ...payload } = session;
    const token = jwtService.sign(payload, { expiresIn: env.JWT_EXPIRES_IN });
    await setSessionCookie(token);
    return { ok: true, token };
  } catch (err) {
    return { ok: false, message: actionFail(err).error };
  }
}

/**
 * Logout — apaga o cookie de sessão no servidor.
 * Origem: POST /auth/logout (stateless).
 */
export async function logoutAction(): Promise<ActionResult<null>> {
  return runAction(async () => {
    await clearSessionCookie();
    return null;
  });
}

/**
 * Troca a senha do usuário informado, validando a senha atual.
 * Exige sessão válida (mais forte que o backend, que só exigia Bearer presente).
 * Origem: POST /auth/change-password/:id.
 */
export async function changePasswordAction(
  userId: string,
  input: { oldPassword: string; newPassword: string },
): Promise<ActionResult<null>> {
  return runAction(async () => {
    const session = await requireSession();
    if (session.id !== userId) throw new ForbiddenError('Você só pode trocar a própria senha.');
    const data = changePasswordSchema.parse(input);
    await authUseCases.changePassword.execute({ userId, ...data });
    return null;
  });
}

/**
 * Solicita redefinição de senha (resposta genérica; e-mail não é enviado — ver
 * CHANGELOG). Origem: POST /auth/request-password-reset.
 */
export async function requestPasswordResetAction(email: string): Promise<ActionResult<{ message: string }>> {
  return runAction(async () => {
    const { email: parsed } = requestPasswordResetSchema.parse({ email });
    const result = await authUseCases.requestPasswordReset.execute(parsed);
    return { message: result.message };
  });
}

/**
 * Redefine a senha via token de reset. Origem: POST /auth/reset-password.
 */
export async function resetPasswordAction(
  input: { token: string; newPassword: string },
): Promise<ActionResult<{ message: string }>> {
  return runAction(async () => {
    const data = resetPasswordSchema.parse(input);
    const result = await authUseCases.resetPassword.execute(data.token, data.newPassword);
    return { message: result.message };
  });
}
