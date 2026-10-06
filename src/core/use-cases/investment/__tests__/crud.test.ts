import { describe, expect, it, vi } from 'vitest';
import { CreateInvestmentUseCase, UpdateInvestmentUseCase, CreateInvestmentTransactionUseCase } from '../crud';
import type { InvestmentsRepository } from '@/core/repositories/investments-repository';
import { createInvestmentSchema, updateInvestmentSchema, investmentTransactionSchema } from '@/shared/validators/investment';

const input = { financial_institution_id: 'bank', issuer: 'Banco', product_type: 'CDB' as const,
  product: 'CDB teste', application_date: '2025-01-01', invested_amount: 0 };

describe('valor investido zero', () => {
  it('aceita zero nos schemas de criação e edição', () => {
    expect(createInvestmentSchema.parse(input).invested_amount).toBe(0);
    expect(updateInvestmentSchema.parse({ invested_amount: 0 }).invested_amount).toBe(0);
  });
  it.each([-1, Infinity, NaN])('rejeita valor inicial inválido %s', async amount => {
    const repo = { create: vi.fn() } as unknown as InvestmentsRepository;
    expect(createInvestmentSchema.safeParse({ ...input, invested_amount: amount }).success).toBe(false);
    await expect(new CreateInvestmentUseCase(repo).execute({ ...input, invested_amount: amount })).rejects.toThrow();
    expect(repo.create).not.toHaveBeenCalled();
  });
  it('envia o valor zero ao repositório ao criar e editar', async () => {
    const repo = { create: vi.fn().mockResolvedValue(input), findById: vi.fn().mockResolvedValue({ ...input, invested_amount: 100 }), update: vi.fn().mockResolvedValue(input) } as unknown as InvestmentsRepository;
    await new CreateInvestmentUseCase(repo).execute(input);
    expect(repo.create).toHaveBeenCalledWith(input);
    await new UpdateInvestmentUseCase(repo).execute('investment', { invested_amount: 0 });
    expect(repo.update).toHaveBeenCalledWith('investment', { invested_amount: 0 });
  });
  it('continua exigindo valor positivo para aportes e resgates novos', async () => {
    const transaction = { investment_id: 'investment', type: 'CONTRIBUTION' as const, date: '2025-01-01', amount: 0 };
    const repo = { findById: vi.fn().mockResolvedValue(input), createTransaction: vi.fn() } as unknown as InvestmentsRepository;
    expect(investmentTransactionSchema.safeParse(transaction).success).toBe(false);
    await expect(new CreateInvestmentTransactionUseCase(repo).execute(transaction)).rejects.toThrow('maior que zero');
    expect(repo.createTransaction).not.toHaveBeenCalled();
  });
});
