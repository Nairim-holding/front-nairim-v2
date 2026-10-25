import 'server-only';
import { z } from 'zod';
import prisma from '@/infra/database/prisma';
import { withPermission } from '@/infra/auth/session';
import { NotFoundError } from '@/core/errors/domain-errors';
import { buildCreditCardDashboard } from '@/core/entities/credit-card-dashboard';

export const creditCardDashboardSchema = z.object({
  year: z.number().int().min(1900).max(2100), month: z.number().int().min(1).max(12),
  cardIds: z.array(z.string().trim().min(1)).max(500).optional().transform(ids => ids ? [...new Set(ids)] : undefined),
});

export async function getCreditCardDashboardData(input: Record<string, unknown>) {
  const { year, month, cardIds } = creditCardDashboardSchema.parse(input);
  return withPermission('financial-cards', 'view', async session => {
    const companyId = session.company_id;
    const cards = await prisma.card.findMany({ where: { company_id: companyId, deleted_at: null },
      select: { id: true, name: true, limit: true, closing_day: true, due_day: true, is_active: true }, orderBy: { name: 'asc' } });
    if (cardIds?.some(id => !cards.some(card => card.id === id))) throw new NotFoundError('Cartão não encontrado.');
    // Todas as miniaturas mostram o mesmo mês. A seleção restringe gráfico,
    // composição e lançamentos; nunca troca a empresa da sessão.
    const entries = cards.length ? await prisma.transaction.findMany({
      where: { company_id: companyId, deleted_at: null, canceled_at: null, is_transfer: false,
        card_id: { in: cards.map(card => card.id) }, category: { company_id: companyId, type: 'EXPENSE' },
        OR: [{ invoice: { is: { company_id: companyId, deleted_at: null, year } } },
          { invoice_id: null, effective_date: { gte: new Date(Date.UTC(year, 0, 1)), lt: new Date(Date.UTC(year + 1, 0, 1)) } }],
      },
      select: { id: true, card_id: true, description: true, amount: true, event_date: true, effective_date: true, status: true,
        installment_number: true, total_installments: true, category: { select: { id: true, name: true } },
        subcategory: { select: { name: true, company_id: true } }, invoice: { select: { year: true, month: true } } },
      orderBy: [{ event_date: 'asc' }, { id: 'asc' }],
    }) : [];
    return buildCreditCardDashboard(cards.map(card => ({ id: card.id, name: card.name, limit: card.limit == null ? null : Number(card.limit),
      closingDay: card.closing_day, dueDay: card.due_day, active: card.is_active })), entries.map(entry => ({
        id: entry.id, cardId: entry.card_id!, cardName: cards.find(card => card.id === entry.card_id)!.name,
        date: entry.event_date.toISOString().slice(0, 10), effectiveDate: entry.effective_date.toISOString().slice(0, 10),
        description: entry.description, amount: Number(entry.amount), status: entry.status,
        year: entry.invoice?.year ?? entry.effective_date.getUTCFullYear(), month: entry.invoice?.month ?? entry.effective_date.getUTCMonth() + 1,
        categoryId: entry.category.id, categoryName: entry.category.name,
        subcategory: entry.subcategory?.company_id === companyId ? entry.subcategory.name : null,
        installment: entry.installment_number && entry.total_installments ? `${entry.installment_number}/${entry.total_installments}` : null,
      })), year, month, cardIds);
  });
}
