import { env } from '@/infra/config/env';
import { PrismaClient } from '@/generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { getCurrentCompanyId } from './tenant-context';
import { withAuditContext } from './audit-context';

/**
 * Client Prisma com extensão MULTI-TENANT.
 *
 * Injeta `company_id` automaticamente nas queries dos modelos com escopo de
 * empresa, lendo o valor do contexto de tenant (AsyncLocalStorage). Isso
 * preserva o comportamento do backend Express, onde os Services não passam
 * `company_id` manualmente — a extensão cuida disso.
 *
 * Origem: api-nairim-v2/src/lib/prisma.ts
 */

// Modelos que têm company_id e devem ser filtrados/populados por empresa.
// Address, Contact, junction tables, PropertyValue, PropertyIptu,
// PlanningMonth, Company e CompanyBranding são excluídos intencionalmente.
const TENANT_MODELS = new Set([
  'Agency', 'Property', 'PropertyType', 'User', 'UserColumnPreference', 'UserDashboardLayout',
  'Document', 'Owner', 'Tenant', 'Lease', 'FinancialInstitution',
  'Category', 'Subcategory', 'Card', 'Center', 'Supplier',
  'Transaction', 'Invoice', 'RecurringConfig', 'Planning', 'Favorite',
  // Grupos de rota portados posteriormente ao mapeamento original (ver
  // MIGRATION_STATUS.md — Módulo 13): também têm company_id e precisam do
  // mesmo isolamento automático dos demais.
  'UserGroup', 'UserGroupPermission', 'UserAccessSchedule', 'AuditLogOutbox',
  'IptuAuditSettings',
  // Investimentos: só a raiz tem company_id. InvestmentTransaction e
  // InvestmentMonthBalance são escopados pelo investimento pai, que é
  // sempre resolvido antes por `prisma.investment.findFirst` (já injetado).
  'Investment', 'InvestmentSettings',
  // Etapa 4/7/8: têm company_id e precisam do mesmo isolamento automático.
  // AdjustmentIndexValue fica de fora de propósito — é escopado pelo
  // indexador pai, que já vem filtrado por empresa (mesmo caso de
  // InvestmentTransaction).
  'AdjustmentIndex', 'Holiday', 'LeaseNotification',
]);

/** Injeta company_id no `where` das queries de leitura. */
export function injectRead<T extends { where?: unknown }>(model: string | undefined, args: T): T {
  const companyId = getCurrentCompanyId();
  if (!companyId || !model || !TENANT_MODELS.has(model)) return args;
  return {
    ...args,
    where: { ...((args?.where ?? {}) as object), company_id: companyId },
  };
}

/**
 * Injeta company_id no `data` dos creates.
 *
 * Impõe a empresa do contexto tanto em inputs escalares como em inputs com
 * relações, preservando a forma aceita pelo Prisma e impedindo sobrescritas.
 */
export function injectCreate<T extends { data?: unknown }>(model: string | undefined, args: T): T {
  const companyId = getCurrentCompanyId();
  if (!companyId || !model || !TENANT_MODELS.has(model)) return args;

  const data = (args?.data ?? {}) as Record<string, unknown>;

  if (data.company !== undefined) {
    const { company: _removed, ...rest } = data;
    // Preserve Prisma's checked input shape for callers using other relations.
    const { company_id: _companyId, ...fields } = rest;
    return { ...args, data: { ...fields, company: { connect: { id: companyId } } } };
  }
  return { ...args, data: { ...data, company_id: companyId } };
}

/** A mutation must neither select another tenant nor transfer ownership. */
export function injectUpdate<T extends { where?: unknown; data?: unknown }>(model: string | undefined, args: T): T {
  const scoped = injectRead(model, args);
  if (scoped === args) return args;
  const { company: _company, company_id: _companyId, ...data } = (args?.data ?? {}) as Record<string, unknown>;
  return { ...scoped, data };
}

/** Constrói o PrismaClient com adapter PG e a extensão de tenant. */
function buildPrismaClient() {
  const adapter = new PrismaPg({ connectionString: env.DATABASE_URL });

  return new PrismaClient({ adapter }).$extends({
    query: {
      $allModels: {
        // ─── Leitura ───────────────────────────────────────────────────────
        async findMany({ model, args, query }) {
          return query(injectRead(model, args));
        },
        async findFirst({ model, args, query }) {
          return query(injectRead(model, args));
        },
        async findUnique({ model, args, query }) {
          return query(injectRead(model, args));
        },
        async findUniqueOrThrow({ model, args, query }) {
          return query(injectRead(model, args));
        },
        async findFirstOrThrow({ model, args, query }) {
          return query(injectRead(model, args));
        },
        async count({ model, args, query }) {
          return query(injectRead(model, args));
        },
        async aggregate({ model, args, query }) {
          return query(injectRead(model, args));
        },
        async groupBy({ model, args, query }) {
          return query(injectRead(model, args));
        },
        // ─── Escrita ───────────────────────────────────────────────────────
        async create({ model, args, query }) {
          return query(injectCreate(model, args));
        },
        async update({ model, args, query }) {
          return query(injectUpdate(model, args));
        },
        async updateMany({ model, args, query }) {
          return query(injectUpdate(model, args));
        },
        async updateManyAndReturn({ model, args, query }) {
          return query(injectUpdate(model, args));
        },
        async delete({ model, args, query }) {
          return query(injectRead(model, args));
        },
        async deleteMany({ model, args, query }) {
          return query(injectRead(model, args));
        },
        async upsert({ model, args, query }) {
          return query({
            ...injectRead(model, args),
            create: injectCreate(model, { data: args.create }).data,
            update: injectUpdate(model, { data: args.update }).data,
          } as typeof args);
        },
        async createMany({ model, args, query }) {
          const companyId = getCurrentCompanyId();
          if (companyId && model && TENANT_MODELS.has(model)) {
            args = {
              ...args,
              data: (Array.isArray(args.data) ? args.data : [args.data]).map((item) =>
                ({ ...item, company_id: companyId }),
              ),
            };
          }
          return query(args);
        },
        async createManyAndReturn({ model, args, query }) {
          const companyId = getCurrentCompanyId();
          if (companyId && model && TENANT_MODELS.has(model)) {
            args = { ...args, data: (Array.isArray(args.data) ? args.data : [args.data])
              .map((item) => ({ ...item, company_id: companyId })) } as typeof args;
          }
          return query(args);
        },
      },
    },
  });
}

type ExtendedPrisma = ReturnType<typeof buildPrismaClient>;

// Singleton global — evita esgotar o pool de conexões no hot reload do dev.
const globalForPrisma = globalThis as unknown as { prisma?: ExtendedPrisma };

const prisma: ExtendedPrisma = globalForPrisma.prisma ?? buildPrismaClient();

if (env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;

export default withAuditContext(prisma);
