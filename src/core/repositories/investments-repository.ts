import type {
  CreateInvestmentData,
  Investment,
  InvestmentDashboardParams,
  InvestmentDashboardResponse,
  InvestmentSettings,
  InvestmentTransactionEntry,
  UpdateInvestmentData,
  UpsertInvestmentTransactionData,
} from '@/core/entities/investment';

/**
 * Contrato de acesso a dados de Investimentos.
 * Implementação Prisma: infra/repositories/prisma-investments-repository.ts.
 * Tenant-scoped (empresa): roda dentro de `withTenant`.
 *
 * As tabelas filhas (transações e saldos mensais) não têm `company_id` — o
 * isolamento vem de sempre resolver o investimento pai primeiro pelo client
 * estendido, que injeta o tenant. Métodos que recebem `investment_id` devem
 * lançar NotFoundError quando o investimento não é da empresa da sessão.
 *
 * Camada: core.
 */
export interface InvestmentsRepository {
  /** Agregado da tela: linhas + cabeçalho fixo, na janela de meses pedida. */
  getDashboard(params: InvestmentDashboardParams): Promise<InvestmentDashboardResponse>;
  /** Lista crua (sem meses) — usada pelo "Copiar dados" e pelo modal de ordem. */
  list(): Promise<Investment[]>;
  findById(id: string): Promise<Investment | null>;
  create(data: CreateInvestmentData): Promise<Investment>;
  update(id: string, data: UpdateInvestmentData): Promise<Investment>;
  /** Soft-delete (leva junto aportes e saldos por cascade lógico da UI). */
  softDelete(id: string): Promise<void>;
  /** Grava a ordem de exibição na sequência recebida. */
  reorder(orderedIds: string[]): Promise<void>;
  /** Só o campo Observações (modal "Editar Observações"). */
  updateNotes(id: string, notes: string | null): Promise<Investment>;

  /** Aportes/resgates de um investimento em um mês (modal de gerenciamento). */
  listTransactions(investmentId: string, year: number, month: number): Promise<InvestmentTransactionEntry[]>;
  createTransaction(data: UpsertInvestmentTransactionData): Promise<InvestmentTransactionEntry>;
  updateTransaction(id: string, data: Omit<UpsertInvestmentTransactionData, 'investment_id'>): Promise<InvestmentTransactionEntry>;
  deleteTransaction(id: string): Promise<void>;

  /** Saldo total informado para um mês ("Editar Saldo do Mês"). */
  setMonthBalance(investmentId: string, year: number, month: number, balance: number): Promise<void>;
  /** Remove o saldo informado — o mês volta a herdar (saldo anterior + aplicado). */
  clearMonthBalance(investmentId: string, year: number, month: number): Promise<void>;

  /** Filtros dinâmicos da tela (mesmo shape dos endpoints de filtro do Financeiro). */
  getFilters(): Promise<Record<string, unknown>>;

  getSettings(): Promise<InvestmentSettings>;
  saveSettings(data: InvestmentSettings): Promise<InvestmentSettings>;
}
