/** Match parsed origins and path boundaries, never URL string prefixes. */
export function isTrustedApiUrl(url: string, apiBase: string, pageUrl: string): boolean {
  if (!apiBase) return false;
  try {
    const target = new URL(url, pageUrl);
    const api = new URL(apiBase, pageUrl);
    const basePath = api.pathname.replace(/\/+$/, '');
    return ['http:', 'https:'].includes(api.protocol) &&
      target.origin === api.origin && !target.username && !target.password &&
      (target.pathname === basePath || target.pathname.startsWith(`${basePath}/`));
  } catch {
    return false;
  }
}
