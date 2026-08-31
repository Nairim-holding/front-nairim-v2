import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/infra/database/prisma';
import { runWithTenant } from '@/infra/database/tenant-context';
import { adjustmentIndexUseCases } from '@/infra/factories/adjustment-index-factory';

/**
 * Rotina automática de atualização dos Índices de Reajuste (Etapa 4, Parte C).
 *
 * Busca as séries do SGS/Banco Central e grava os percentuais, sem intervenção
 * do usuário. É o MESMO caso de uso do botão "Atualizar pelo Banco Central" da
 * tela, então as duas rotas nunca divergem.
 *
 * ── Por que não usa `withTenant` ────────────────────────────────────────────
 * `withTenant` exige uma sessão logada, e o agendador não tem uma. Aqui a
 * empresa é resolvida explicitamente: percorremos as empresas ativas e rodamos
 * a sincronização dentro de `runWithTenant` para cada uma, que é o que a
 * extensão multi-tenant do Prisma espera.
 *
 * ── Como agendar ────────────────────────────────────────────────────────────
 * Chamar uma vez por mês (os índices são mensais; rodar mais vezes é inócuo,
 * porque a gravação é idempotente por indexador+ano+mês). Exemplos:
 *   • cron do servidor:
 *       0 9 5 * * curl -fsS -H "Authorization: Bearer $CRON_SECRET" \
 *         https://SEU_HOST/api/cron/adjustment-indexes
 *   • Vercel Cron (vercel.json):
 *       { "crons": [{ "path": "/api/cron/adjustment-indexes", "schedule": "0 9 5 * *" }] }
 *
 * O dia 5 é proposital: IBGE e FGV publicam o fechamento do mês anterior nos
 * primeiros dias úteis, então rodar cedo demais traz mês incompleto.
 *
 * Proteção: exige `CRON_SECRET` no header Authorization. Sem a variável
 * definida, a rota recusa — para não ficar um gatilho aberto em produção.
 */

// AsyncLocalStorage (tenant) exige runtime Node, não Edge.
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function handle(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json(
      { error: 'CRON_SECRET não configurado no servidor.' },
      { status: 503 },
    );
  }

  const authorization = request.headers.get('authorization') ?? '';
  const provided = authorization.replace(/^Bearer\s+/i, '');
  if (provided !== secret) {
    return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 });
  }

  const companies = await prisma.company.findMany({
    where: { deleted_at: null },
    select: { id: true, name: true },
  });

  const results: Array<Record<string, unknown>> = [];

  for (const company of companies) {
    try {
      const result = await runWithTenant(company.id, () =>
        adjustmentIndexUseCases.sync.execute({}),
      );
      results.push({
        company_id: company.id,
        company: company.name,
        synced: result.synced,
        skipped: result.skipped,
      });
    } catch (error) {
      // Uma empresa com problema não interrompe as demais.
      results.push({
        company_id: company.id,
        company: company.name,
        error: error instanceof Error ? error.message : 'Falha na sincronização.',
      });
    }
  }

  return NextResponse.json({ ok: true, ran_at: new Date().toISOString(), companies: results });
}

/** GET: usado pelos agendadores (Vercel Cron, cron + curl). */
export async function GET(request: NextRequest) {
  return handle(request);
}

/** POST: mesma rotina, para agendadores que preferem POST. */
export async function POST(request: NextRequest) {
  return handle(request);
}
