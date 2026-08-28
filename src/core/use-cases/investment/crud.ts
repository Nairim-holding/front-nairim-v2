import type { InvestmentsRepository } from '@/core/repositories/investments-repository';
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
import { NotFoundError, ValidationError } from '@/core/errors/domain-errors';

/**
 * Casos de uso de Investimentos.
 * Camada: core. Rodam dentro do contexto de tenant (`withTenant`).
 *
 * As regras aqui são as que a tela impõe e o schema não consegue expressar:
 *  - liquidez: ou é "apenas no vencimento" (exige vencimento) ou é um prazo em
 *    dias — nunca as duas coisas, nunca nenhuma das duas em branco;
 *  - vencimento nunca antes da aplicação;
 *  - aporte sempre com valor positivo e data ≥ data da aplicação.
 */

const MONTH_RANGE = /^\d{4}-(0[1-9]|1[0-2])$/;

function assertPositive(value: number, field: string): void {
  if (!Number.isFinite(value) || value <= 0) {
    throw new ValidationError(`${field} deve ser um valor maior que zero`);
  }
}

function assertLiquidity(
  data: { liquidity_at_maturity?: boolean; liquidity_days?: number | null; maturity_date?: string | null },
): void {
  if (data.liquidity_at_maturity) {
    if (!data.maturity_date) {
      throw new ValidationError('Informe o vencimento para liquidez apenas no vencimento');
    }
    return;
  }
  if (data.liquidity_days === undefined || data.liquidity_days === null) return;
  if (!Number.isInteger(data.liquidity_days) || data.liquidity_days < 0) {
    throw new ValidationError('A liquidez em dias deve ser um número inteiro de dias');
  }
}

function assertDates(application: string | undefined, maturity: string | null | undefined): void {
  if (!application || !maturity) return;
  if (maturity < application) {
    throw new ValidationError('O vencimento não pode ser anterior à data da aplicação');
  }
}

export class GetInvestmentDashboardUseCase {
  constructor(private readonly investments: InvestmentsRepository) {}
  async execute(params: InvestmentDashboardParams): Promise<InvestmentDashboardResponse> {
    if (!MONTH_RANGE.test(params.startMonth) || !MONTH_RANGE.test(params.endMonth)) {
      throw new ValidationError('O período deve estar no formato AAAA-MM');
    }
    if (params.startMonth > params.endMonth) {
      throw new ValidationError('O mês inicial não pode ser posterior ao mês final');
    }
    return this.investments.getDashboard(params);
  }
}

export class ListInvestmentsUseCase {
  constructor(private readonly investments: InvestmentsRepository) {}
  async execute(): Promise<Investment[]> {
    return this.investments.list();
  }
}

export class GetInvestmentByIdUseCase {
  constructor(private readonly investments: InvestmentsRepository) {}
  async execute(id: string): Promise<Investment> {
    if (!id) throw new ValidationError('O ID é obrigatório');
    const found = await this.investments.findById(id);
    if (!found) throw new NotFoundError('Investimento não encontrado');
    return found;
  }
}

export class CreateInvestmentUseCase {
  constructor(private readonly investments: InvestmentsRepository) {}
  async execute(data: CreateInvestmentData): Promise<Investment> {
    if (!data.financial_institution_id) throw new ValidationError('A instituição financeira é obrigatória');
    if (!data.issuer?.trim()) throw new ValidationError('O emissor é obrigatório');
    if (!data.product?.trim()) throw new ValidationError('O produto é obrigatório');
    if (!data.application_date) throw new ValidationError('A data da aplicação é obrigatória');
    assertPositive(data.invested_amount, 'O valor investido');
    assertDates(data.application_date, data.maturity_date);
    assertLiquidity(data);
    return this.investments.create(data);
  }
}

export class UpdateInvestmentUseCase {
  constructor(private readonly investments: InvestmentsRepository) {}
  async execute(id: string, data: UpdateInvestmentData): Promise<Investment> {
    if (!id) throw new ValidationError('O ID é obrigatório');
    const existing = await this.investments.findById(id);
    if (!existing) throw new NotFoundError('Investimento não encontrado');

    if (data.issuer !== undefined && !data.issuer?.trim()) throw new ValidationError('O emissor não pode ser vazio');
    if (data.product !== undefined && !data.product?.trim()) throw new ValidationError('O produto não pode ser vazio');
    if (data.invested_amount !== undefined) assertPositive(data.invested_amount, 'O valor investido');

    // `null` enviado de propósito limpa o campo — por isso a checagem é pela
    // presença da chave, não por `??` (que trataria a limpeza como "não mudou").
    const maturity = 'maturity_date' in data ? (data.maturity_date ?? null) : existing.maturity_date;
    const application = data.application_date ?? existing.application_date;
    const liquidityAtMaturity = data.liquidity_at_maturity ?? existing.liquidity_at_maturity;
    const liquidityDays = 'liquidity_days' in data ? (data.liquidity_days ?? null) : existing.liquidity_days;

    assertDates(application, maturity);
    assertLiquidity({
      liquidity_at_maturity: liquidityAtMaturity,
      liquidity_days: liquidityDays,
      maturity_date: maturity,
    });

    return this.investments.update(id, data);
  }
}

export class DeleteInvestmentUseCase {
  constructor(private readonly investments: InvestmentsRepository) {}
  async execute(id: string): Promise<void> {
    if (!id) throw new ValidationError('O ID é obrigatório');
    await this.investments.softDelete(id);
  }
}

export class ReorderInvestmentsUseCase {
  constructor(private readonly investments: InvestmentsRepository) {}
  async execute(orderedIds: string[]): Promise<void> {
    if (!Array.isArray(orderedIds) || orderedIds.length === 0) {
      throw new ValidationError('Informe a nova ordem dos investimentos');
    }
    if (new Set(orderedIds).size !== orderedIds.length) {
      throw new ValidationError('A ordem enviada tem investimentos repetidos');
    }
    await this.investments.reorder(orderedIds);
  }
}

export class UpdateInvestmentNotesUseCase {
  constructor(private readonly investments: InvestmentsRepository) {}
  async execute(id: string, notes: string | null): Promise<Investment> {
    if (!id) throw new ValidationError('O ID é obrigatório');
    const trimmed = notes?.trim() ?? '';
    return this.investments.updateNotes(id, trimmed.length > 0 ? trimmed : null);
  }
}

// ─── Aportes e resgates ───────────────────────────────────────────────────────

export class ListInvestmentTransactionsUseCase {
  constructor(private readonly investments: InvestmentsRepository) {}
  async execute(investmentId: string, year: number, month: number): Promise<InvestmentTransactionEntry[]> {
    if (!investmentId) throw new ValidationError('O investimento é obrigatório');
    if (month < 1 || month > 12) throw new ValidationError('Mês inválido');
    return this.investments.listTransactions(investmentId, year, month);
  }
}

export class CreateInvestmentTransactionUseCase {
  constructor(private readonly investments: InvestmentsRepository) {}
  async execute(data: UpsertInvestmentTransactionData): Promise<InvestmentTransactionEntry> {
    if (!data.investment_id) throw new ValidationError('O investimento é obrigatório');
    if (!data.date) throw new ValidationError('A data da aplicação é obrigatória');
    assertPositive(data.amount, 'O valor');

    const investment = await this.investments.findById(data.investment_id);
    if (!investment) throw new NotFoundError('Investimento não encontrado');
    if (data.date < investment.application_date) {
      throw new ValidationError('O aporte não pode ser anterior à data da aplicação do investimento');
    }
    return this.investments.createTransaction(data);
  }
}

export class UpdateInvestmentTransactionUseCase {
  constructor(private readonly investments: InvestmentsRepository) {}
  async execute(
    id: string,
    data: Omit<UpsertInvestmentTransactionData, 'investment_id'>,
  ): Promise<InvestmentTransactionEntry> {
    if (!id) throw new ValidationError('O ID é obrigatório');
    if (!data.date) throw new ValidationError('A data é obrigatória');
    assertPositive(data.amount, 'O valor');
    return this.investments.updateTransaction(id, data);
  }
}

export class DeleteInvestmentTransactionUseCase {
  constructor(private readonly investments: InvestmentsRepository) {}
  async execute(id: string): Promise<void> {
    if (!id) throw new ValidationError('O ID é obrigatório');
    await this.investments.deleteTransaction(id);
  }
}

// ─── Saldo do mês ─────────────────────────────────────────────────────────────

export class SetInvestmentMonthBalanceUseCase {
  constructor(private readonly investments: InvestmentsRepository) {}
  async execute(investmentId: string, year: number, month: number, balance: number | null): Promise<void> {
    if (!investmentId) throw new ValidationError('O investimento é obrigatório');
    if (month < 1 || month > 12) throw new ValidationError('Mês inválido');

    const investment = await this.investments.findById(investmentId);
    if (!investment) throw new NotFoundError('Investimento não encontrado');

    // null = limpar o saldo informado; o mês volta a herdar do anterior.
    if (balance === null) {
      await this.investments.clearMonthBalance(investmentId, year, month);
      return;
    }
    if (!Number.isFinite(balance) || balance < 0) {
      throw new ValidationError('O saldo do mês deve ser um valor não negativo');
    }
    await this.investments.setMonthBalance(investmentId, year, month, balance);
  }
}

// ─── Filtros e configuração ───────────────────────────────────────────────────

export class GetInvestmentFiltersUseCase {
  constructor(private readonly investments: InvestmentsRepository) {}
  async execute(): Promise<Record<string, unknown>> {
    return this.investments.getFilters();
  }
}

export class GetInvestmentSettingsUseCase {
  constructor(private readonly investments: InvestmentsRepository) {}
  async execute(): Promise<InvestmentSettings> {
    return this.investments.getSettings();
  }
}

export class SaveInvestmentSettingsUseCase {
  constructor(private readonly investments: InvestmentsRepository) {}
  async execute(data: InvestmentSettings): Promise<InvestmentSettings> {
    const amount = data.independence_reference_amount;
    if (amount !== null && amount !== undefined && (!Number.isFinite(amount) || amount < 0)) {
      throw new ValidationError('O valor de referência deve ser um valor não negativo');
    }
    return this.investments.saveSettings({ independence_reference_amount: amount ?? null });
  }
}
