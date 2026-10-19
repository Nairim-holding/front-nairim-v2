export const DELETION_GROUPS = [
  { key: 'transactions', label: 'Lançamentos, faturas e recorrências', resource: 'financial-transactions', models: ['Transaction', 'Invoice', 'RecurringConfig'] },
  { key: 'planning', label: 'Planejamentos', resource: 'planning', models: ['Planning'] },
  { key: 'investments', label: 'Investimentos e saldos', resource: 'investments', models: ['Investment', 'InvestmentSettings'] },
  { key: 'repairs', label: 'Reparos, itens e profissionais', resource: 'repairs', models: ['Repair'] },
  { key: 'leases', label: 'Locações e seus alertas', resource: 'leases', models: ['Lease', 'LeaseNotification', 'LeaseExpiryReminder'] },
  { key: 'properties', label: 'Imóveis, valores, IPTU e favoritos', resource: 'properties', models: ['Property', 'Favorite'] },
  { key: 'owners', label: 'Proprietários', resource: 'owners', models: ['Owner'] },
  { key: 'tenants', label: 'Inquilinos', resource: 'tenants', models: ['Tenant'] },
  { key: 'agencies', label: 'Imobiliárias', resource: 'agencies', models: ['Agency'] },
  { key: 'suppliers', label: 'Contatos e fornecedores', resource: 'financial-suppliers', models: ['Supplier'] },
  { key: 'property-types', label: 'Tipos de imóvel', resource: 'property-types', models: ['PropertyType'] },
  { key: 'categories', label: 'Categorias, subcategorias e configurações DFC/ROI/IPTU', resource: 'financial-categories', models: ['Category', 'Subcategory', 'RoiSettings', 'IptuAuditSettings'] },
  { key: 'centers', label: 'Centros de receita e despesa', resource: 'financial-centers', models: ['Center'] },
  { key: 'institutions', label: 'Instituições financeiras', resource: 'financial-institutions', models: ['FinancialInstitution'] },
  { key: 'cards', label: 'Cartões de crédito', resource: 'financial-cards', models: ['Card'] },
  { key: 'indexes', label: 'Índices de reajuste', resource: 'adjustment-indexes', models: ['AdjustmentIndex'] },
  { key: 'holidays', label: 'Feriados', resource: 'financial-transactions', models: ['Holiday'] },
  { key: 'documents', label: 'Registros de documentos e anexos', resource: 'properties', models: ['Document'] },
] as const;
export type DeletionGroupKey = typeof DELETION_GROUPS[number]['key'];
export interface CompanyDeletionPreview {
  company: { id: string; name: string; slug: string };
  counts: Record<string, number>;
  total: number;
  blockers: string[];
}
