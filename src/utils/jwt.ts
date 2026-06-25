/**
 * Helpers para ler a expiração de um JWT sem validar a assinatura.
 * Usado para sincronizar cookies e agendar o refresh em background —
 * nunca para decidir autorização (isso é responsabilidade do backend).
 */

export function decodeJwtPayload(token: string): Record<string, any> | null {
  try {
    return JSON.parse(atob(token.split('.')[1]));
  } catch {
    return null;
  }
}

export function getTokenExpiryMs(token: string): number | null {
  const payload = decodeJwtPayload(token);
  if (!payload?.exp) return null;
  return payload.exp * 1000;
}

/** Segundos restantes até o token expirar, para usar como max-age do cookie. */
export function getTokenMaxAgeSeconds(token: string, fallbackSeconds: number): number {
  const expiryMs = getTokenExpiryMs(token);
  if (expiryMs === null) return fallbackSeconds;
  return Math.max(0, Math.floor((expiryMs - Date.now()) / 1000));
}
