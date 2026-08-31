import prisma from '@/infra/database/prisma';
import { getCurrentCompanyId } from '@/infra/database/tenant-context';
import type { AdjustmentIndexesRepository } from '@/core/repositories/adjustment-indexes-repository';
import { ConflictError, NotFoundError } from '@/core/errors/domain-errors';
import {
  ADJUSTMENT_INDEX_CODES,
  ADJUSTMENT_INDEX_DESCRIPTIONS,
  SGS_SERIES,
  type AdjustmentIndex,
  type CreateAdjustmentIndexData,
  type ListAdjustmentIndexesParams,
  type PaginatedAdjustmentIndexes,
  type UpdateAdjustmentIndexData,
  type UpsertAdjustmentIndexValueData,
} from '@/core/entities/adjustment-index';

/**
 * Implementação Prisma de {@link AdjustmentIndexesRepository} (Etapa 4).
 *
 * `AdjustmentIndex` tem `company_id` e está em TENANT_MODELS, então a extensão
 * multi-tenant injeta a empresa nas leituras e nos creates. `AdjustmentIndexValue`
 * NÃO tem `company_id`: é escopado pelo indexador pai, que já vem filtrado.
 *
 * Camada: infra.
 */

/** Decimal do Prisma chega como objeto; a tela quer número. */
const toNumber = (value: unknown): number => Number(value ?? 0);

const toNullableNumber = (value: unknown): number | null =>
  value === null || value === undefined ? null : Number(value);

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapValue(row: any) {
  return {
    id: row.id,
    adjustment_index_id: row.adjustment_index_id,
    reference_month: row.reference_month,
    reference_year: row.reference_year,
    monthly_rate: toNumber(row.monthly_rate),
    accumulated_12m: toNullableNumber(row.accumulated_12m),
    synced_at: row.synced_at,
    from_api: row.from_api,
    created_at: row.created_at,
    updated_at: row.updated_at,
    deleted_at: row.deleted_at,
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapIndex(row: any): AdjustmentIndex {
  return {
    id: row.id,
    company_id: row.company_id,
    code: row.code,
    description: row.description,
    sgs_code: row.sgs_code ?? null,
    sgs_code_12m: row.sgs_code_12m ?? null,
    is_active: row.is_active,
    created_at: row.created_at,
    updated_at: row.updated_at,
    deleted_at: row.deleted_at,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    values: row.values ? row.values.map((v: any) => mapValue(v)) : undefined,
  };
}

/** Valores mensais do mais recente para o mais antigo, como a tabela exibe. */
const VALUES_INCLUDE = {
  values: {
    where: { deleted_at: null },
    orderBy: [{ reference_year: 'desc' as const }, { reference_month: 'desc' as const }],
  },
};

export class PrismaAdjustmentIndexesRepository implements AdjustmentIndexesRepository {
  async list(params: ListAdjustmentIndexesParams): Promise<PaginatedAdjustmentIndexes> {
    const page = Math.max(1, params.page ?? 1);
    const limit = Math.min(Math.max(1, params.limit ?? 30), 150);

    const where: Record<string, unknown> = {};
    if (!params.includeInactive) where.deleted_at = null;
    if (params.search) {
      where.OR = [
        { code: { contains: params.search, mode: 'insensitive' } },
        { description: { contains: params.search, mode: 'insensitive' } },
      ];
    }

    const [rows, total] = await Promise.all([
      prisma.adjustmentIndex.findMany({
        where: where as never,
        include: VALUES_INCLUDE,
        orderBy: { code: 'asc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.adjustmentIndex.count({ where: where as never }),
    ]);

    return {
      data: rows.map(mapIndex),
      total,
      page,
      limit,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    };
  }

  async findById(id: string): Promise<AdjustmentIndex | null> {
    const row = await prisma.adjustmentIndex.findFirst({
      where: { id, deleted_at: null } as never,
      include: VALUES_INCLUDE,
    });
    return row ? mapIndex(row) : null;
  }

  async findByCode(code: string): Promise<AdjustmentIndex | null> {
    const row = await prisma.adjustmentIndex.findFirst({
      where: { code, deleted_at: null } as never,
      include: VALUES_INCLUDE,
    });
    return row ? mapIndex(row) : null;
  }

  async create(data: CreateAdjustmentIndexData): Promise<AdjustmentIndex> {
    const code = data.code.trim();
    const existing = await prisma.adjustmentIndex.findFirst({ where: { code, deleted_at: null } as never });
    if (existing) throw new ConflictError('Já existe um índice com essa sigla.');

    const row = await prisma.adjustmentIndex.create({
      data: {
        code,
        description: data.description.trim(),
        sgs_code: data.sgs_code ?? null,
        sgs_code_12m: data.sgs_code_12m ?? null,
        is_active: data.is_active ?? true,
      } as never,
      include: VALUES_INCLUDE,
    });
    return mapIndex(row);
  }

  async update(id: string, data: UpdateAdjustmentIndexData): Promise<AdjustmentIndex> {
    const current = await prisma.adjustmentIndex.findFirst({ where: { id, deleted_at: null } as never });
    if (!current) throw new NotFoundError('Índice de reajuste não encontrado.');

    if (data.code && data.code.trim() !== current.code) {
      const clash = await prisma.adjustmentIndex.findFirst({
        where: { code: data.code.trim(), deleted_at: null, NOT: { id } } as never,
      });
      if (clash) throw new ConflictError('Já existe um índice com essa sigla.');
    }

    const payload: Record<string, unknown> = {};
    if (data.code !== undefined) payload.code = data.code.trim();
    if (data.description !== undefined) payload.description = data.description.trim();
    if (data.sgs_code !== undefined) payload.sgs_code = data.sgs_code;
    if (data.sgs_code_12m !== undefined) payload.sgs_code_12m = data.sgs_code_12m;
    if (data.is_active !== undefined) payload.is_active = data.is_active;

    const row = await prisma.adjustmentIndex.update({
      where: { id },
      data: payload as never,
      include: VALUES_INCLUDE,
    });
    return mapIndex(row);
  }

  async softDelete(id: string): Promise<AdjustmentIndex> {
    const current = await prisma.adjustmentIndex.findFirst({ where: { id, deleted_at: null } as never });
    if (!current) throw new NotFoundError('Índice de reajuste não encontrado.');

    // Um índice em uso por contrato não pode sumir: o reajuste da locação
    // perderia a referência do indexador combinado.
    const inUse = await prisma.lease.count({ where: { adjustment_index_id: id, deleted_at: null } as never });
    if (inUse > 0) {
      throw new ConflictError('Não é possível excluir: existem locações usando este índice de reajuste.');
    }

    const row = await prisma.adjustmentIndex.update({
      where: { id },
      data: { deleted_at: new Date() },
      include: VALUES_INCLUDE,
    });
    return mapIndex(row);
  }

  async listOptions(): Promise<Array<{ label: string; value: string }>> {
    const rows = await prisma.adjustmentIndex.findMany({
      where: { deleted_at: null, is_active: true } as never,
      orderBy: { code: 'asc' },
    });
    // O ComboBox da locação mostra a sigla (é como o contrato se refere ao
    // índice); a descrição completa fica no cadastro.
    return rows.map((row) => ({ label: row.code, value: row.id }));
  }

  async upsertValue(data: UpsertAdjustmentIndexValueData): Promise<void> {
    await prisma.adjustmentIndexValue.upsert({
      where: {
        adjustment_index_id_reference_year_reference_month: {
          adjustment_index_id: data.adjustment_index_id,
          reference_year: data.reference_year,
          reference_month: data.reference_month,
        },
      } as never,
      create: {
        adjustment_index_id: data.adjustment_index_id,
        reference_month: data.reference_month,
        reference_year: data.reference_year,
        monthly_rate: data.monthly_rate,
        accumulated_12m: data.accumulated_12m ?? null,
        from_api: data.from_api ?? false,
        synced_at: new Date(),
      } as never,
      update: {
        monthly_rate: data.monthly_rate,
        accumulated_12m: data.accumulated_12m ?? null,
        from_api: data.from_api ?? false,
        synced_at: new Date(),
        // Um valor reimportado volta a valer mesmo que tenha sido apagado antes.
        deleted_at: null,
      } as never,
    });
  }

  async upsertValues(values: UpsertAdjustmentIndexValueData[]): Promise<number> {
    let count = 0;
    for (const value of values) {
      await this.upsertValue(value);
      count += 1;
    }
    return count;
  }

  async deleteValue(id: string): Promise<void> {
    await prisma.adjustmentIndexValue.update({ where: { id }, data: { deleted_at: new Date() } });
  }

  async seedDefaults(): Promise<number> {
    const companyId = getCurrentCompanyId();
    if (!companyId) return 0;

    const existing = await prisma.adjustmentIndex.findMany({
      where: { deleted_at: null } as never,
      select: { code: true },
    });
    const known = new Set(existing.map((row) => row.code));

    let created = 0;
    for (const code of ADJUSTMENT_INDEX_CODES) {
      if (known.has(code)) continue;
      const series = SGS_SERIES[code];
      await prisma.adjustmentIndex.create({
        data: {
          code,
          description: ADJUSTMENT_INDEX_DESCRIPTIONS[code],
          sgs_code: series?.monthly ?? null,
          sgs_code_12m: series?.accumulated12m ?? null,
          is_active: true,
        } as never,
      });
      created += 1;
    }
    return created;
  }
}
