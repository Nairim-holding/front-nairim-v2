/**
 * Alguns componentes de listagem usam a `resource` prop como caminho da API
 * (ex.: "financial-institution", singular, porque a rota é /financial-institution),
 * enquanto o catálogo de diretivas de acesso (MENU_RESOURCES, no backend) usa a
 * chave no plural ("financial-institutions"). Esta tabela só existe para
 * cobrir esses casos divergentes — a maioria dos recursos já bate 1:1.
 */
const RESOURCE_KEY_ALIASES: Record<string, string> = {
  'financial-institution': 'financial-institutions',
  'financial-card': 'financial-cards',
  'financial-supplier': 'financial-suppliers',
  'financial-transaction': 'financial-transactions',
  'property-type': 'property-types',
};

export function normalizeResourceKey(resource: string): string {
  return RESOURCE_KEY_ALIASES[resource] ?? resource;
}

/**
 * Fonte única de verdade para "que recurso do catálogo de diretivas cobre esta
 * rota do dashboard". Usada tanto pelo Sidebar (que rota mostrar no menu)
 * quanto pelo PermissionGate (que rota bloquear ao navegar direto pela URL) —
 * as duas features de permissão do front-end concordam por construção, sem
 * duas listas que possam divergir com o tempo.
 */
export const RESOURCE_ROUTES: { path: string; resource: string }[] = [
  { path: '/dashboard', resource: 'dashboard' },
  { path: '/dashboard/administradores', resource: 'users' },
  { path: '/dashboard/grupos-usuario', resource: 'user-groups' },
  { path: '/dashboard/empresas', resource: 'companies' },
  { path: '/dashboard/imoveis', resource: 'properties' },
  { path: '/dashboard/imobiliarias', resource: 'agencies' },
  { path: '/dashboard/inquilinos', resource: 'tenants' },
  { path: '/dashboard/proprietarios', resource: 'owners' },
  { path: '/dashboard/tipo-imovel', resource: 'property-types' },
  { path: '/dashboard/locacoes', resource: 'leases' },
  { path: '/dashboard/instituicoes-financeiras', resource: 'financial-institutions' },
  { path: '/dashboard/categorias', resource: 'financial-categories' },
  { path: '/dashboard/cartoes', resource: 'financial-cards' },
  { path: '/dashboard/centros', resource: 'financial-centers' },
  { path: '/dashboard/fornecedores', resource: 'financial-suppliers' },
  { path: '/dashboard/lancamentos', resource: 'financial-transactions' },
  { path: '/dashboard/planejamento', resource: 'planning' },
  { path: '/dashboard/relatorios', resource: 'financial-reports' },
  { path: '/dashboard/configuracoes', resource: 'settings' },
  { path: '/dashboard/auditoria', resource: 'audit-logs' },
];

/** Recurso do catálogo correspondente a um href exato (usado pelo Sidebar). */
export function resourceForHref(href: string): string | undefined {
  return RESOURCE_ROUTES.find((r) => r.path === href)?.resource;
}

/**
 * Recurso do catálogo correspondente à rota atual (usado pelo PermissionGate).
 * Casa pelo prefixo mais específico primeiro — sem isso, `/dashboard` (a
 * entrada mais curta) "vazaria" por cima de rotas mais específicas como
 * `/dashboard/imoveis/editar/123`.
 */
export function resourceForPathname(pathname: string): string | undefined {
  const byLongestPrefix = [...RESOURCE_ROUTES].sort((a, b) => b.path.length - a.path.length);
  const match = byLongestPrefix.find(
    (r) => pathname === r.path || pathname.startsWith(`${r.path}/`)
  );
  return match?.resource;
}
