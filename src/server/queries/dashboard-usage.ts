import 'server-only';
import fs from 'fs/promises';
import path from 'path';
import prisma from '@/infra/database/prisma';
import { minioStorage } from '@/infra/storage/minio-storage';
import { env } from '@/infra/config/env';
import { withTenant } from '@/infra/auth/session';
import { getCurrentCompanyId } from '@/infra/database/tenant-context';
import {
  classifyTenureBucket,
  emptyTenureBuckets,
  tenureInYears,
  toIsoDate,
  toUtcMidnight,
} from '@/core/utils/tenant-tenure';
import type {
  CompanyDatabaseUsage,
  DatabaseUsageResult,
  StorageUsageGroup,
  StorageUsageResult,
  TenantTenureDistribution,
  TenantTenureLease,
} from '@/core/entities/dashboard-usage';

/**
 * Queries (leitura) dos widgets de infra do Dashboard: armazenamento (MinIO),
 * consumo de banco de dados e tempo de permanência dos inquilinos.
 * Guarda: `withTenant`. Camada: server.
 * Origem: StorageUsageService / DatabaseUsageService / DashboardService
 * (getTenantTenureDistribution) do backend.
 */

const BYTES_PER_MB = 1024 * 1024;
const round2 = (value: number) => Math.round(value * 100) / 100;
const toMegabytes = (bytes: number) => round2(bytes / BYTES_PER_MB);

// ─────────────────────────────────────────────────────────────────────────────
// Tempo de permanência (porta fiel de DashboardService.getTenantTenureDistribution)
// ─────────────────────────────────────────────────────────────────────────────

export async function getTenantTenureDistributionData(
  startDate: Date,
  endDate: Date,
): Promise<TenantTenureDistribution> {
  return withTenant(async () => {
    const now = new Date();
    const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));

    const rangeStart = toUtcMidnight(startDate);
    const rangeEnd = toUtcMidnight(endDate);

    const leases = await prisma.lease.findMany({
      where: { deleted_at: null, start_date: { lte: rangeEnd } },
      select: {
        id: true,
        contract_number: true,
        start_date: true,
        end_date: true,
        canceled_at: true,
        status: true,
        tenant: { select: { name: true } },
        property: { select: { title: true } },
      },
      orderBy: { start_date: 'asc' },
    });

    const rows: TenantTenureLease[] = [];

    for (const lease of leases) {
      const start = toUtcMidnight(lease.start_date);

      let effectiveEnd: Date;
      let situation: TenantTenureLease['situation'];

      if (lease.status === 'CANCELED' && lease.canceled_at) {
        effectiveEnd = toUtcMidnight(lease.canceled_at);
        situation = 'Cancelada';
      } else if (toUtcMidnight(lease.end_date) < today) {
        effectiveEnd = toUtcMidnight(lease.end_date);
        situation = lease.status === 'CANCELED' ? 'Cancelada' : 'Encerrada';
      } else {
        effectiveEnd = today;
        situation = lease.status === 'CANCELED' ? 'Cancelada' : 'Em curso';
      }

      if (effectiveEnd < rangeStart) continue;

      const years = tenureInYears(start, effectiveEnd);
      if (years < 0) continue;

      const bucket = classifyTenureBucket(years);
      if (!bucket) continue;

      rows.push({
        id: lease.id,
        tenantName: lease.tenant?.name ?? '—',
        propertyTitle: lease.property?.title ?? '—',
        contractNumber: lease.contract_number,
        startDate: toIsoDate(start),
        endDate: toIsoDate(effectiveEnd),
        situation,
        years: +years.toFixed(2),
        bucketKey: bucket.key,
        bucketLabel: bucket.label,
      });
    }

    const buckets = emptyTenureBuckets().map((b) => ({
      ...b,
      count: rows.filter((r) => r.bucketKey === b.key).length,
    }));

    return { buckets, leases: rows, total: rows.length };
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Consumo de banco de dados (porta fiel de DatabaseUsageService)
// ─────────────────────────────────────────────────────────────────────────────

/** Tabelas que carregam company_id — atribuição direta. */
const DIRECT_TABLES = [
  'Agency', 'Property', 'PropertyType', 'User', 'UserColumnPreference', 'UserDashboardLayout',
  'Document', 'Owner', 'Tenant', 'Lease', 'Favorite', 'FinancialInstitution', 'Category',
  'Subcategory', 'Card', 'Center', 'Supplier', 'Transaction', 'invoices', 'RecurringConfig',
  'Planning', 'CompanyBranding',
] as const;

/** Tabelas filhas sem company_id — sobem até o dono por uma FK simples. */
const JOINED_TABLES: Array<{ table: string; join: string }> = [
  { table: 'PropertyIptu', join: 'JOIN "Property" p ON p.id = t.property_id' },
  { table: 'PropertyValue', join: 'JOIN "Property" p ON p.id = t.property_id' },
  { table: 'PlanningMonth', join: 'JOIN "Planning" p ON p.id = t.planning_id' },
  { table: 'AgencyAddress', join: 'JOIN "Agency" p ON p.id = t.agency_id' },
  { table: 'PropertyAddress', join: 'JOIN "Property" p ON p.id = t.property_id' },
  { table: 'OwnerAddress', join: 'JOIN "Owner" p ON p.id = t.owner_id' },
  { table: 'TenantAddress', join: 'JOIN "Tenant" p ON p.id = t.tenant_id' },
  { table: 'SupplierAddress', join: 'JOIN "Supplier" p ON p.id = t.supplier_id' },
];

function buildUsageQuery(): string {
  const parts: string[] = [];

  for (const table of DIRECT_TABLES) {
    parts.push(
      `SELECT t.company_id AS company_id, SUM(pg_column_size(t.*))::bigint AS bytes
         FROM "${table}" t GROUP BY t.company_id`,
    );
  }

  for (const { table, join } of JOINED_TABLES) {
    parts.push(
      `SELECT p.company_id AS company_id, SUM(pg_column_size(t.*))::bigint AS bytes
         FROM "${table}" t ${join} GROUP BY p.company_id`,
    );
  }

  parts.push(
    `SELECT COALESCE(a.company_id, o.company_id, te.company_id, s.company_id) AS company_id,
            SUM(pg_column_size(t.*))::bigint AS bytes
       FROM "Contact" t
       LEFT JOIN "Agency"   a  ON a.id  = t.agency_id
       LEFT JOIN "Owner"    o  ON o.id  = t.owner_id
       LEFT JOIN "Tenant"   te ON te.id = t.tenant_id
       LEFT JOIN "Supplier" s  ON s.id  = t.supplier_id
      GROUP BY 1`,
  );

  parts.push(
    `SELECT owned.company_id AS company_id, SUM(owned.bytes)::bigint AS bytes
       FROM (
         SELECT DISTINCT ON (a.id) a.id, j.company_id, pg_column_size(a.*) AS bytes
           FROM "Address" a
           JOIN (
             SELECT aa.address_id, ag.company_id FROM "AgencyAddress"   aa JOIN "Agency"   ag ON ag.id = aa.agency_id
             UNION ALL
             SELECT pa.address_id, pr.company_id FROM "PropertyAddress" pa JOIN "Property" pr ON pr.id = pa.property_id
             UNION ALL
             SELECT oa.address_id, ow.company_id FROM "OwnerAddress"    oa JOIN "Owner"    ow ON ow.id = oa.owner_id
             UNION ALL
             SELECT ta.address_id, tn.company_id FROM "TenantAddress"   ta JOIN "Tenant"   tn ON tn.id = ta.tenant_id
             UNION ALL
             SELECT sa.address_id, sp.company_id FROM "SupplierAddress" sa JOIN "Supplier" sp ON sp.id = sa.supplier_id
           ) j ON j.address_id = a.id
       ) owned
      GROUP BY owned.company_id`,
  );

  parts.push(
    `SELECT t.id AS company_id, pg_column_size(t.*)::bigint AS bytes FROM "Company" t`,
  );

  return parts.join('\nUNION ALL\n');
}

const USAGE_QUERY = buildUsageQuery();

const CACHE_TTL_MS = 30 * 1000;
let cache: { rows: UsageRow[]; fetchedAt: number } | null = null;
let inFlight: Promise<UsageRow[]> | null = null;

interface UsageRow {
  company_id: string | null;
  bytes: bigint | number | null;
}

async function getUsageRows(): Promise<UsageRow[]> {
  if (cache && Date.now() - cache.fetchedAt < CACHE_TTL_MS) {
    return cache.rows;
  }

  if (!inFlight) {
    inFlight = prisma
      .$queryRawUnsafe<UsageRow[]>(USAGE_QUERY)
      .then((rows) => {
        cache = { rows, fetchedAt: Date.now() };
        return rows;
      })
      .finally(() => {
        inFlight = null;
      });
  }

  return inFlight;
}

export async function getDatabaseUsageData(): Promise<DatabaseUsageResult> {
  return withTenant(async () => {
    const companyId = getCurrentCompanyId();
    if (!companyId) throw new Error('Contexto de empresa não identificado.');

    const [rows, companies] = await Promise.all([
      getUsageRows(),
      prisma.company.findMany({
        where: { deleted_at: null },
        select: { id: true, name: true, db_quota_mb: true },
        orderBy: { name: 'asc' },
      }),
    ]);

    const bytesByCompany = new Map<string, number>();
    for (const row of rows) {
      if (!row.company_id) continue;
      const bytes = Number(row.bytes ?? 0);
      bytesByCompany.set(row.company_id, (bytesByCompany.get(row.company_id) ?? 0) + bytes);
    }

    const usage: CompanyDatabaseUsage[] = companies.map((company) => {
      const usedBytes = bytesByCompany.get(company.id) ?? 0;
      const usedMb = usedBytes / BYTES_PER_MB;
      const quotaMb = company.db_quota_mb ?? env.DEFAULT_DB_QUOTA_MB;

      return {
        companyId: company.id,
        companyName: company.name,
        usedBytes,
        usedMb: round2(usedMb),
        quotaMb,
        percent: quotaMb > 0 ? round2((usedMb / quotaMb) * 100) : 0,
        isCurrent: company.id === companyId,
      };
    });

    return {
      current: usage.find((item) => item.isCurrent) ?? null,
      companies: usage,
    };
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Uso de armazenamento (porta fiel de StorageUsageService)
// ─────────────────────────────────────────────────────────────────────────────

const STORAGE_GROUP_LABELS: Record<string, string> = {
  properties: 'Imóveis',
  leases: 'Locações',
  transactions: 'Lançamentos Financeiros',
  company: 'Identidade Visual',
  other: 'Outros',
};

const STORAGE_FIXED_GROUPS = ['properties', 'leases', 'transactions', 'company'] as const;

const BUCKET_CACHE_TTL_MS = 5 * 60 * 1000;
const bucketCacheByCompany = new Map<
  string,
  { objects: { key: string; size: number }[]; fetchedAt: number; stamp: string }
>();
const bucketInFlightByCompany = new Map<string, Promise<{ key: string; size: number }[]>>();

/** Assinatura barata do estado dos anexos da empresa (Document + CompanyBranding). */
async function getMediaStamp(companyId: string): Promise<string> {
  const rows = await prisma.$queryRaw<
    Array<{ docs: bigint; docs_last: Date | null; branding_last: Date | null }>
  >`
    SELECT (SELECT COUNT(*)::bigint    FROM "Document" WHERE company_id = ${companyId} AND deleted_at IS NULL) AS docs,
           (SELECT MAX(updated_at)     FROM "Document" WHERE company_id = ${companyId} AND deleted_at IS NULL) AS docs_last,
           (SELECT MAX(updated_at)     FROM "CompanyBranding" WHERE company_id = ${companyId})                    AS branding_last
  `;

  const row = rows[0];
  return [
    row?.docs ?? 0,
    row?.docs_last?.getTime() ?? 0,
    row?.branding_last?.getTime() ?? 0,
  ].join(':');
}

async function getBucketObjects(companyId: string): Promise<{ key: string; size: number }[]> {
  const cachedEntry = bucketCacheByCompany.get(companyId);
  if (cachedEntry && Date.now() - cachedEntry.fetchedAt < BUCKET_CACHE_TTL_MS) {
    const stamp = await getMediaStamp(companyId).catch(() => cachedEntry.stamp);
    if (stamp === cachedEntry.stamp) return cachedEntry.objects;
    bucketCacheByCompany.delete(companyId);
  }

  if (!bucketInFlightByCompany.has(companyId)) {
    const inFlightBucket = Promise.all([minioStorage.listAllObjects(), getMediaStamp(companyId)])
      .then(([objects, stamp]) => {
        bucketCacheByCompany.set(companyId, { objects, fetchedAt: Date.now(), stamp });
        return objects;
      })
      .finally(() => {
        bucketInFlightByCompany.delete(companyId);
      });
    bucketInFlightByCompany.set(companyId, inFlightBucket);
  }

  return bucketInFlightByCompany.get(companyId)!;
}

/** Remove a extensão da key (casa banco↔bucket após conversão AVIF). */
function stripExtension(key: string): string {
  return key.replace(/\.[^/.]+$/, '');
}

function indexBucket(objects: { key: string; size: number }[]) {
  const index = new Map<string, { bytes: number; files: number }>();

  for (const object of objects) {
    const normalized = stripExtension(object.key);
    const entry = index.get(normalized);
    if (entry) {
      entry.bytes += object.size;
      entry.files += 1;
    } else {
      index.set(normalized, { bytes: object.size, files: 1 });
    }
  }

  return index;
}

/** Caminho absoluto em disco para URLs legadas (`BASE_URL/uploads/...`). */
function localPathFromUrl(url: string): string | null {
  const marker = '/uploads/';
  const at = url.indexOf(marker);
  if (at === -1) return null;

  const relative = url.slice(at + marker.length);
  if (!relative || relative.includes('..')) return null;

  return path.join(process.cwd(), 'uploads', relative);
}

export async function getStorageUsageData(): Promise<StorageUsageResult> {
  return withTenant(async () => {
    const companyId = getCurrentCompanyId();
    if (!companyId) throw new Error('Contexto de empresa não identificado.');

    const [documents, branding, objects] = await Promise.all([
      prisma.document.findMany({
        where: { deleted_at: null },
        select: { file_path: true, property_id: true, lease_id: true, transaction_id: true },
      }),
      prisma.companyBranding.findUnique({
        where: { company_id: companyId },
        select: {
          logo_url: true,
          favicon_url: true,
          logo_sidebar_url: true,
          logo_dark_url: true,
          og_image_url: true,
        },
      }),
      getBucketObjects(companyId),
    ]);

    const bucketIndex = indexBucket(objects);

    const bucketKeysByGroup = new Map<string, Set<string>>();
    const localPathsByGroup = new Map<string, Set<string>>();

    const addFile = (group: string, url: string | null | undefined) => {
      if (!url) return;

      const key = minioStorage.keyFromUrl(url);
      if (key) {
        const set = bucketKeysByGroup.get(group) ?? new Set<string>();
        set.add(stripExtension(key));
        bucketKeysByGroup.set(group, set);
        return;
      }

      const localPath = localPathFromUrl(url);
      if (localPath) {
        const set = localPathsByGroup.get(group) ?? new Set<string>();
        set.add(localPath);
        localPathsByGroup.set(group, set);
      }
    };

    for (const document of documents) {
      const group = document.property_id
        ? 'properties'
        : document.lease_id
        ? 'leases'
        : document.transaction_id
        ? 'transactions'
        : 'other';
      addFile(group, document.file_path);
    }

    for (const url of Object.values(branding ?? {})) {
      addFile('company', url);
    }

    const totals = new Map<string, { bytes: number; files: number }>();
    const accumulate = (group: string, bytes: number, files: number) => {
      const entry = totals.get(group) ?? { bytes: 0, files: 0 };
      entry.bytes += bytes;
      entry.files += files;
      totals.set(group, entry);
    };

    for (const [group, keys] of bucketKeysByGroup) {
      for (const key of keys) {
        const entry = bucketIndex.get(key);
        if (entry) accumulate(group, entry.bytes, entry.files);
      }
    }

    for (const [group, paths] of localPathsByGroup) {
      const stats = await Promise.all(
        [...paths].map((filePath) => fs.stat(filePath).catch(() => null)),
      );
      for (const stat of stats) {
        if (stat?.isFile()) accumulate(group, stat.size, 1);
      }
    }

    const groupKeys: string[] = [...STORAGE_FIXED_GROUPS];
    if ((totals.get('other')?.bytes ?? 0) > 0) groupKeys.push('other');

    const groups: StorageUsageGroup[] = groupKeys.map((key) => {
      const entry = totals.get(key) ?? { bytes: 0, files: 0 };
      return {
        key,
        label: STORAGE_GROUP_LABELS[key],
        bytes: entry.bytes,
        megabytes: toMegabytes(entry.bytes),
        files: entry.files,
      };
    });

    const totalBytes = groups.reduce((sum, group) => sum + group.bytes, 0);
    const totalFiles = groups.reduce((sum, group) => sum + group.files, 0);

    return {
      groups,
      totalBytes,
      totalMegabytes: toMegabytes(totalBytes),
      totalFiles,
    };
  });
}