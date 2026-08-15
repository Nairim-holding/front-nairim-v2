/**
 * Entidades da Auditoria de IPTU: compara, por imóvel, a restituição de IPTU
 * recebida do inquilino (receita) contra o IPTU pago pela empresa (despesa).
 * Porte de api-nairim-v2/src/services/AuditService.ts.
 *
 * Camada: core.
 */

export interface IptuAuditSettings {
  id: string;
  company_id: string;
  income_category_id: string | null;
  income_subcategory_id: string | null;
  expense_category_id: string | null;
  expense_subcategory_id: string | null;
  created_at: Date;
  updated_at: Date;
  income_category: { id: string; name: string } | null;
  income_subcategory: { id: string; name: string } | null;
  expense_category: { id: string; name: string } | null;
  expense_subcategory: { id: string; name: string } | null;
}

export interface IptuAuditSettingsInput {
  income_category_id?: string | null;
  income_subcategory_id?: string | null;
  expense_category_id?: string | null;
  expense_subcategory_id?: string | null;
}

export interface IptuAuditParams {
  startDate: string;
  endDate: string;
}

export interface IptuAuditTransactionDetail {
  id: string;
  description: string;
  amount: number;
  date: string;
  type: 'INCOME' | 'EXPENSE';
}

export interface IptuAuditRow {
  propertyId: string;
  propertyTitle: string;
  address: string | null;
  income: number;
  expense: number;
  balance: number;
  transactions: IptuAuditTransactionDetail[];
}

export interface IptuAuditReport {
  rows: IptuAuditRow[];
  totals: { income: number; expense: number; balance: number };
}
