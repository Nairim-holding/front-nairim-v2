export interface TransferTable {
  key: string; label: string; resource: string; path: string; model: string; children: string[];
  admin?: boolean; global?: boolean;
}

// Each file contains one cadastro and its owned detail tables. References to
// other cadastros keep their IDs and must be imported before dependent files.
export const TRANSFER_TABLES: TransferTable[] = [
  { key: 'companies', label: 'Empresas', resource: 'companies', path: 'empresas', model: 'Company', children: ['CompanyBranding'], global: true },
  { key: 'users', label: 'Usuários', resource: 'users', path: 'administradores', model: 'User', children: ['UserAccessSchedule'], admin: true },
  { key: 'user-groups', label: 'Grupos de usuário', resource: 'user-groups', path: 'grupos-usuario', model: 'UserGroup', children: ['UserGroupPermission'], admin: true },
  { key: 'property-types', label: 'Tipos de imóvel', resource: 'property-types', path: 'tipo-imovel', model: 'PropertyType', children: [] },
  { key: 'owners', label: 'Proprietários', resource: 'owners', path: 'proprietarios', model: 'Owner', children: ['Address', 'OwnerAddress', 'Contact', 'ContactChannel'] },
  { key: 'agencies', label: 'Imobiliárias', resource: 'agencies', path: 'imobiliarias', model: 'Agency', children: ['Address', 'AgencyAddress', 'Contact', 'ContactChannel'] },
  { key: 'tenants', label: 'Inquilinos', resource: 'tenants', path: 'inquilinos', model: 'Tenant', children: ['Address', 'TenantAddress', 'Contact', 'ContactChannel'] },
  { key: 'suppliers', label: 'Contatos', resource: 'financial-suppliers', path: 'fornecedores', model: 'Supplier', children: ['Address', 'SupplierAddress', 'Contact', 'ContactChannel'] },
  { key: 'properties', label: 'Imóveis', resource: 'properties', path: 'imoveis', model: 'Property', children: ['Address', 'PropertyAddress', 'PropertyValue', 'PropertyIptu', 'Document'] },
  { key: 'leases', label: 'Locações', resource: 'leases', path: 'locacoes', model: 'Lease', children: ['Document'] },
  { key: 'lease-notifications', label: 'Notificações de locações', resource: 'leases', path: 'locacoes/atrasadas', model: 'LeaseNotification', children: [] },
  { key: 'adjustment-indexes', label: 'Índices de reajuste', resource: 'adjustment-indexes', path: 'indices-reajuste', model: 'AdjustmentIndex', children: ['AdjustmentIndexValue'] },
  { key: 'financial-institutions', label: 'Instituições financeiras', resource: 'financial-institutions', path: 'instituicoes-financeiras', model: 'FinancialInstitution', children: [] },
  { key: 'categories', label: 'Categorias', resource: 'financial-categories', path: 'categorias', model: 'Category', children: ['Subcategory'] },
  { key: 'subcategories', label: 'Subcategorias', resource: 'financial-categories', path: 'categorias', model: 'Subcategory', children: [] },
  { key: 'centers', label: 'Centros', resource: 'financial-centers', path: 'centros', model: 'Center', children: [] },
  { key: 'cards', label: 'Cartões', resource: 'financial-cards', path: 'cartoes', model: 'Card', children: [] },
  { key: 'transactions', label: 'Lançamentos', resource: 'financial-transactions', path: 'lancamentos', model: 'Transaction', children: ['Document'] },
  { key: 'invoices', label: 'Faturas', resource: 'financial-transactions', path: 'lancamentos', model: 'Invoice', children: [] },
  { key: 'recurring-configs', label: 'Recorrências', resource: 'financial-transactions', path: 'lancamentos', model: 'RecurringConfig', children: [] },
  { key: 'holidays', label: 'Feriados', resource: 'financial-transactions', path: 'lancamentos', model: 'Holiday', children: [] },
  { key: 'planning', label: 'Planejamento', resource: 'planning', path: 'planejamento', model: 'Planning', children: ['PlanningMonth'] },
  { key: 'investments', label: 'Investimentos', resource: 'investments', path: 'investimentos', model: 'Investment', children: ['InvestmentTransaction', 'InvestmentMonthBalance', 'InvestmentSettings'] },
  { key: 'repairs', label: 'Reparos', resource: 'repairs', path: 'reparos', model: 'Repair', children: ['RepairProfessional', 'RepairItem', 'RepairMedia'] },
];
export const TABLE_TRANSFER_MAX_BYTES = 40 * 1024 * 1024;
export const TABLE_TRANSFER_FORMAT_VERSION = 1;
export function transferTablesForPath(pathname: string) {
  const suffix = pathname.split('/dashboard/')[1]?.replace(/\/$/, '');
  return TRANSFER_TABLES.filter(table => table.path === suffix);
}
export function getTransferTable(key: string) {
  return TRANSFER_TABLES.find(table => table.key === key);
}

export type TableTransferImportMode = 'current' | 'copy-all' | 'restore-all';
export interface TableTransferImportOutcome { company: string; slug: string; ok: boolean; created: number; updated: number; error?: string }
export interface TableTransferImportResult { created: number; updated: number; results?: TableTransferImportOutcome[] }
