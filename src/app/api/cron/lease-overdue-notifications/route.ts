import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/infra/database/prisma';
import { runWithTenant } from '@/infra/database/tenant-context';
import { evolutionWhatsAppConfigured } from '@/infra/services/evolution-whatsapp-client';
import { findOverdueLeasesForCompany } from '@/server/queries/lease-overdue';
import { deliverOverdueWhatsApp } from '@/server/services/lease-overdue-whatsapp';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Cobrança automática diária. O próprio finder só devolve a locação a partir
 * do primeiro dia útil posterior ao repasse esperado, usando os mesmos
 * feriados da conciliação financeira.
 *
 * Agendamento sugerido (todos os dias às 10h de Brasília):
 *   0 13 * * * curl -fsS -H "Authorization: Bearer $CRON_SECRET" \
 *     https://SEU_HOST/api/cron/lease-overdue-notifications
 */
async function handle(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return NextResponse.json({ error: 'CRON_SECRET não configurado.' }, { status: 503 });
  const provided = (request.headers.get('authorization') ?? '').replace(/^Bearer\s+/i, '');
  if (provided !== secret) return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 });
  if (!evolutionWhatsAppConfigured()) {
    return NextResponse.json({ error: 'Evolution API não configurada.' }, { status: 503 });
  }

  const companies = await prisma.company.findMany({
    where: { deleted_at: null, is_active: true },
    select: { id: true },
  });
  const results: Array<{ company_id: string; sent: number; skipped: number; failed: number }> = [];

  for (const company of companies) {
    const counters = { company_id: company.id, sent: 0, skipped: 0, failed: 0 };
    await runWithTenant(company.id, async () => {
      const overdueItems = await findOverdueLeasesForCompany(company.id);
      for (const item of overdueItems) {
        // Uma cobrança automática por competência. Reenvios continuam
        // disponíveis manualmente na central de alertas.
        if (!item.agency_phone || item.whatsapp_notification_count > 0) {
          counters.skipped += 1;
          continue;
        }
        try {
          await deliverOverdueWhatsApp(company.id, item, null);
          counters.sent += 1;
        } catch (error) {
          counters.failed += 1;
          console.error('[lease-overdue-notifications] Falha no envio:', {
            company_id: company.id,
            lease_id: item.lease_id,
            error: error instanceof Error ? error.message : 'Erro desconhecido',
          });
        }
      }
    });
    results.push(counters);
  }

  return NextResponse.json({ ok: true, ran_at: new Date().toISOString(), companies: results });
}

export async function GET(request: NextRequest) { return handle(request); }
export async function POST(request: NextRequest) { return handle(request); }
