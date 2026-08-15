/**
 * Entidades de dominio: uso de armazenamento, banco de dados e tempo de
 * permanência dos inquilinos (widgets infra do Dashboard).
 *
 * Porte fiel de api-nairim-v2/src/services/{StorageUsageService,
 * DatabaseUsageService}.ts + DashboardService.getTenantTenureDistribution.
 *
 * Camada: core.
 */

/** Grupo de anexos da empresa (Imóveis, Locações, Financeiro, Identidade Visual, Outros). */
export interface StorageUsageGroup {
  key: string;
  label: string;
  bytes: number;
  megabytes: number;
  files: number;
}

export interface StorageUsageResult {
  groups: StorageUsageGroup[];
  totalBytes: number;
  totalMegabytes: number;
  totalFiles: number;
}

/** Consumo de banco de uma empresa (usado/contratado). */
export interface CompanyDatabaseUsage {
  companyId: string;
  companyName: string;
  usedBytes: number;
  usedMb: number;
  quotaMb: number;
  percent: number;
  isCurrent: boolean;
}

export interface DatabaseUsageResult {
  current: CompanyDatabaseUsage | null;
  companies: CompanyDatabaseUsage[];
}

/** Faixas de tempo de permanência (limite inferior fechado, superior aberto). */
export type TenantTenureBucketKey =
  | 'UP_TO_1'
  | 'Y1_TO_2'
  | 'Y2_TO_3'
  | 'Y3_TO_4'
  | 'Y4_TO_5'
  | 'OVER_5';

export interface TenantTenureBucket {
  key: TenantTenureBucketKey;
  label: string;
  shortLabel: string;
  count: number;
}

/** Linha detalhada de uma locação (uma por contrato). */
export interface TenantTenureLease {
  id: string;
  tenantName: string;
  propertyTitle: string;
  contractNumber: string;
  startDate: string;
  endDate: string;
  situation: 'Cancelada' | 'Encerrada' | 'Em curso';
  years: number;
  bucketKey: TenantTenureBucketKey;
  bucketLabel: string;
}

export interface TenantTenureDistribution {
  buckets: TenantTenureBucket[];
  leases: TenantTenureLease[];
  total: number;
}