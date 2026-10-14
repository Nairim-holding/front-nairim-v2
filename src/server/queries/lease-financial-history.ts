import 'server-only';

import prisma from '@/infra/database/prisma';
import { withPermission } from '@/infra/auth/session';
import { NotFoundError } from '@/core/errors/domain-errors';
import { matchReportLease } from '@/core/entities/lease-report-matching';
import {
  installmentLabel,
  leaseHistorySituation,
  leaseHistorySituationLabel,
  summarizeLeaseHistory,
  type LeaseFinancialHistory,
  type LeaseHistoryCandidate,
  type LeaseHistoryRow,
} from '@/core/entities/lease-financial-history';

/**
 * Histórico Financeiro da locação (botão da tela de Locações).
 *
 * Reúne os lançamentos com `lease_id` do contrato — os ativos e os excluídos
 * pelo cancelamento (`canceled_at`); os apagados na regeneração das parcelas
 * ficam de fora, pois foram substituídos. Também aponta lançamentos sem vínculo
 * cuja descrição cita o contrato, para o usuário amarrá-los à locação.
 *
 * Camada: server (leitura).
 */

const isoDate = (date: Date) => date.toISOString().slice(0, 10);

function todayInSaoPaulo(): Date {
  const value = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(new Date());
  return new Date(`${value}T00:00:00.000Z`);
}

/** Lançamentos sem `lease_id` que a descrição liga, sem ambiguidade, a este contrato. */
export async function findLeaseHistoryCandidates(
  lease: { id: string; contract_number: string; property: { title: string } },
): Promise<LeaseHistoryCandidate[]> {
  const [loose, leases] = await Promise.all([
    prisma.transaction.findMany({
      where: {
        lease_id: null,
        deleted_at: null,
        is_transfer: false,
        OR: [
          { description: { contains: lease.contract_number, mode: 'insensitive' } },
          { description: { contains: lease.property.title, mode: 'insensitive' } },
        ],
      },
      select: {
        id: true, description: true, amount: true, status: true, event_date: true, effective_date: true,
        category: { select: { type: true } },
      },
      orderBy: [{ effective_date: 'asc' }, { id: 'asc' }],
    }),
    prisma.lease.findMany({
      where: { deleted_at: null },
      select: {
        id: true, contract_number: true, start_date: true, end_date: true, canceled_at: true,
        property: { select: { title: true } },
      },
    }),
  ]);

  // O casamento considera todos os contratos da empresa: se a descrição servir
  // a mais de um, `matchReportLease` não devolve nenhum e o lançamento não é sugerido.
  return loose
    .filter((tx) => matchReportLease(tx.description, tx.event_date, leases)?.id === lease.id)
    .map((tx) => ({
      id: tx.id,
      description: tx.description,
      type: tx.category.type,
      dueDate: isoDate(tx.effective_date),
      amount: Number(tx.amount),
      status: tx.status,
    }));
}

export async function getLeaseFinancialHistoryData(leaseId: string): Promise<LeaseFinancialHistory> {
  return withPermission('leases', 'view', async () => {
    const lease = await prisma.lease.findFirst({
      where: { id: leaseId, deleted_at: null },
      select: {
        id: true, contract_number: true, status: true,
        property: { select: { title: true } },
        tenant: { select: { name: true } },
      },
    });
    if (!lease) throw new NotFoundError('Locação não encontrada');

    const [linked, candidates] = await Promise.all([
      prisma.transaction.findMany({
        where: { lease_id: lease.id, OR: [{ deleted_at: null }, { canceled_at: { not: null } }] },
        select: {
          id: true, description: true, amount: true, status: true, event_date: true, effective_date: true,
          canceled_at: true, installment_number: true, total_installments: true,
          category: { select: { type: true } },
        },
        orderBy: [{ effective_date: 'asc' }, { description: 'asc' }],
      }),
      findLeaseHistoryCandidates(lease),
    ]);

    const today = todayInSaoPaulo();
    const rows: LeaseHistoryRow[] = linked.map((tx) => {
      const situation = leaseHistorySituation(tx, today);
      return {
        id: tx.id,
        installment: installmentLabel(tx.installment_number, tx.total_installments),
        description: tx.description,
        type: tx.category.type,
        eventDate: isoDate(tx.event_date),
        dueDate: isoDate(tx.effective_date),
        amount: Number(tx.amount),
        status: tx.status,
        situation,
        situationLabel: leaseHistorySituationLabel(situation, tx.category.type),
        canceled: situation === 'CANCELED',
      };
    });

    return {
      lease: {
        id: lease.id,
        contract_number: lease.contract_number,
        property_title: lease.property.title,
        tenant_name: lease.tenant.name,
        canceled: lease.status === 'CANCELED',
      },
      rows,
      totals: summarizeLeaseHistory(rows),
      candidates,
    };
  });
}

/**
 * Amarra à locação lançamentos que estavam sem vínculo. Só aceita os que a
 * própria consulta sugere — o cliente não escolhe IDs arbitrários.
 */
export async function linkTransactionsToLeaseData(leaseId: string, transactionIds: string[]): Promise<{ linked: number }> {
  return withPermission('leases', 'edit', async () => {
    const lease = await prisma.lease.findFirst({
      where: { id: leaseId, deleted_at: null },
      select: { id: true, contract_number: true, property: { select: { title: true } } },
    });
    if (!lease) throw new NotFoundError('Locação não encontrada');

    const allowed = new Set((await findLeaseHistoryCandidates(lease)).map((candidate) => candidate.id));
    const ids = [...new Set(transactionIds.map(String))].filter((id) => allowed.has(id));
    if (ids.length === 0) return { linked: 0 };

    const result = await prisma.transaction.updateMany({
      where: { id: { in: ids }, lease_id: null, deleted_at: null },
      data: { lease_id: lease.id },
    });
    return { linked: result.count };
  });
}
