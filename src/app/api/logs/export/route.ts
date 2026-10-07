import { assertAdmin, withPermission } from '@/infra/auth/session';
import { logsCollection } from '@/infra/database/mongodb';
import { buildLogSelection } from '@/shared/validators/log-management';
import { actionFail } from '@/shared/actions/action-result';
import prisma from '@/infra/database/prisma';
import { getAuditActor, runWithAuditActor } from '@/infra/database/audit-context';
import { writeTransferAuditEvent } from '@/infra/database/audit-events';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    return await withPermission('audit-logs', 'export', async session => {
      assertAdmin(session);
      const params = Object.fromEntries(new URL(request.url).searchParams);
      const filter = buildLogSelection(session.company_id, params);
      const cursor = (await logsCollection()).find(filter, { projection: { _id: 0 } }).sort({ created_at: 1, id: 1 });
      // Establish the query before sending HTTP 200; outages return an actionable error.
      let next = await cursor.next();
      let started = false;
      let recordCount = 0;
      const actor = getAuditActor();
      if (!actor) throw new Error('Contexto de auditoria indisponível.');
      const encoder = new TextEncoder();
      const stream = new ReadableStream({
        async pull(controller) {
          try {
            if (!started) {
              controller.enqueue(encoder.encode('{"format":"nairim-logs-v1","exportedAt":' + JSON.stringify(new Date().toISOString()) + ',"logs":['));
              started = true;
            }
            if (next) {
              const current = next;
              recordCount++;
              next = await cursor.next();
              controller.enqueue(encoder.encode(JSON.stringify(current) + (next ? ',' : '')));
            } else {
              await runWithAuditActor(actor, () => writeTransferAuditEvent(prisma, {
                action: 'EXPORT', tableName: 'AuditLog', companyId: session.company_id,
                description: 'Exportação dos logs de auditoria', format: 'JSON', recordCount,
              }));
              controller.enqueue(encoder.encode(']}'));
              await cursor.close();
              controller.close();
            }
          } catch (error) { await cursor.close(); controller.error(error); }
        },
        async cancel() { await cursor.close(); },
      });
      return new Response(stream, { headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Content-Disposition': `attachment; filename="logs-${new Date().toISOString().slice(0, 10)}.json"`,
        'Cache-Control': 'no-store',
        'X-Content-Type-Options': 'nosniff',
      } });
    });
  } catch (error) {
    const failure = actionFail(error);
    return Response.json({ error: failure.status === 500 ? 'Não foi possível exportar. Verifique a conexão do banco de logs.' : failure.error }, { status: failure.status });
  }
}
