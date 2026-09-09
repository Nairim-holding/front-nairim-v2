import { AsyncLocalStorage } from 'node:async_hooks';

export interface AuditActor { id: string; name: string; email: string; company_id: string; ip?: string }
const globalAudit = globalThis as unknown as { auditActorStorage?: AsyncLocalStorage<AuditActor> };
const storage = globalAudit.auditActorStorage ??= new AsyncLocalStorage<AuditActor>();
export const getAuditActor = () => storage.getStore();
export const runWithAuditActor = <T>(actor: AuditActor, fn: () => T): T => storage.run(actor, fn);

/**
 * Propaga o autor por SET LOCAL na mesma transação dos triggers de auditoria.
 * Nenhuma configuração de sessão fica no pool depois de commit/rollback.
 */
export function withAuditContext<T extends object>(client: T): T {
  const writes = new Set(['create', 'createMany', 'createManyAndReturn', 'update', 'updateMany', 'updateManyAndReturn', 'upsert', 'delete', 'deleteMany']);
  const delegates = new Map<PropertyKey, unknown>();
  // Prisma exposes dynamic delegates; preserve its public type at the boundary.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const setActor = async (tx: any) => {
    const actor = getAuditActor();
    if (actor) await tx.$executeRaw`SELECT set_config('nairim.audit_actor', ${JSON.stringify(actor)}, true)`;
  };
  return new Proxy(client, {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    get(target: any, key) {
      if (key === '$transaction') {
        // All mutation batches use interactive transactions so the actor is set first.
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        return (callback: any, options?: any) => {
          if (typeof callback !== 'function') {
            throw new Error('Use uma transação com callback para preservar o contexto de auditoria.');
          }
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          return target.$transaction(async (tx: any) => { await setActor(tx); return callback(tx); }, options);
        };
      }
      const value = target[key];
      if (typeof key === 'string' && !key.startsWith('$') && value && typeof value === 'object' && typeof value.findMany === 'function') {
        if (!delegates.has(key)) delegates.set(key, new Proxy(value, {
          get(delegate, operation) {
            const method = delegate[operation];
            if (writes.has(String(operation))) {
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              return (args: any) => {
                if (!getAuditActor()) return method.call(delegate, args);
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                return target.$transaction(async (tx: any) => {
                  await setActor(tx);
                  return tx[key][operation](args);
                });
              };
            }
            return typeof method === 'function' ? method.bind(delegate) : method;
          },
        }));
        return delegates.get(key);
      }
      return typeof value === 'function' ? value.bind(target) : value;
    },
  });
}
