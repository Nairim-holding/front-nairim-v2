/**
 * Tradução de rótulos para a tela de Auditoria (Logs).
 * Porte de api-nairim-v2/src/lib/auditModels.ts.
 *
 * `table_name` grava o nome bruto do model Prisma — a tradução é só de
 * exibição/filtro, para que filtrar por tabela continue exato mesmo se o
 * rótulo mudar.
 *
 * Camada: shared (dado estático puro, sem I/O).
 */

export const MODEL_LABELS: Record<string, string> = {
  Agency: 'Imobiliária',
  Property: 'Imóvel',
  PropertyType: 'Tipo de Imóvel',
  User: 'Usuário',
  Document: 'Documento',
  Owner: 'Proprietário',
  Tenant: 'Inquilino',
  Lease: 'Locação',
  FinancialInstitution: 'Instituição Financeira',
  Category: 'Categoria',
  Subcategory: 'Subcategoria',
  Card: 'Cartão',
  Center: 'Centro',
  Supplier: 'Fornecedor',
  Transaction: 'Lançamento',
  Invoice: 'Fatura',
  RecurringConfig: 'Recorrência',
  Planning: 'Planejamento',
  UserGroup: 'Grupo de Usuário',
  Auth: 'Login',
};

export function modelLabel(tableName: string): string {
  return MODEL_LABELS[tableName] ?? tableName;
}

/**
 * "is_active" → "Is Active". Sem mapa manual por model (muitos models ×
 * muitos campos cada seria um investimento grande); rótulo aproximado, não
 * tradução lapidada — a tradução PT-BR de campo por campo (onde existe) é
 * feita no client component (`AuditLogDetailModal`), não aqui.
 */
export function prettifyFieldName(field: string): string {
  return field
    .split('_')
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}
