import type {
  TenantTenureBucket,
  TenantTenureBucketKey,
} from '@/core/entities/dashboard-usage';

/**
 * Helpers puros do gráfico de "Tempo de Locação".
 * Porte fiel de api-nairim-v2/src/services/DashboardService.ts
 * (`tenureInYears`, `TENURE_BUCKETS`, `classifyTenureBucket`, `toUtcMidnight`).
 * Camada: core — sem dependência de Prisma/HTTP, testável isoladamente.
 */

/**
 * Tempo de permanência em anos, por ANIVERSÁRIO DE CALENDÁRIO (não por divisão
 * de dias). Dividir por 365,25 fazia contratos de 12 meses idênticos caírem em
 * faixas diferentes conforme o ano fosse bissexto. Aqui, um contrato de
 * 15/03/2025 a 15/03/2026 vale exatamente 1,0 ano, com ou sem 29 de fevereiro.
 *
 * A parte fracionária é a proporção do ano-aniversário corrente já decorrida.
 * Retorna negativo quando o fim é anterior ao início (dado inconsistente).
 */
export function tenureInYears(start: Date, end: Date): number {
  if (end.getTime() < start.getTime()) return -1;

  const anniversaryOf = (yearsToAdd: number) =>
    new Date(Date.UTC(start.getUTCFullYear() + yearsToAdd, start.getUTCMonth(), start.getUTCDate()));

  let fullYears = end.getUTCFullYear() - start.getUTCFullYear();
  if (anniversaryOf(fullYears).getTime() > end.getTime()) fullYears -= 1;

  const last = anniversaryOf(fullYears);
  const next = anniversaryOf(fullYears + 1);
  const span = next.getTime() - last.getTime();

  return fullYears + (span > 0 ? (end.getTime() - last.getTime()) / span : 0);
}

/** Faixas de permanência: limite inferior FECHADO, superior ABERTO. */
export const TENURE_BUCKETS: {
  key: TenantTenureBucketKey;
  label: string;
  shortLabel: string;
  min: number;
  max: number;
}[] = [
  { key: 'UP_TO_1', label: 'Até 1 ano',            shortLabel: 'Até 1',   min: 0, max: 1 },
  { key: 'Y1_TO_2', label: 'De 1 ano até 2 anos',  shortLabel: '1 a 2',   min: 1, max: 2 },
  { key: 'Y2_TO_3', label: 'De 2 anos até 3 anos', shortLabel: '2 a 3',   min: 2, max: 3 },
  { key: 'Y3_TO_4', label: 'De 3 anos até 4 anos', shortLabel: '3 a 4',   min: 3, max: 4 },
  { key: 'Y4_TO_5', label: 'De 4 anos até 5 anos', shortLabel: '4 a 5',   min: 4, max: 5 },
  { key: 'OVER_5',  label: 'Acima de 5 anos',      shortLabel: 'Acima 5', min: 5, max: Infinity },
];

/** Classifica um tempo (em anos) em uma das 6 faixas; `undefined` para tempo negativo. */
export function classifyTenureBucket(
  years: number,
): { key: TenantTenureBucketKey; label: string; shortLabel: string } | undefined {
  const bucket = TENURE_BUCKETS.find((b) => years >= b.min && years < b.max);
  return bucket
    ? { key: bucket.key, label: bucket.label, shortLabel: bucket.shortLabel }
    : undefined;
}

/** Zera a hora em UTC: compara @db.Date com "hoje" sem erro de 1 dia por fuso. */
export function toUtcMidnight(d: Date): Date {
  const date = new Date(d);
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

export function toIsoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function emptyTenureBuckets(): TenantTenureBucket[] {
  return TENURE_BUCKETS.map((b) => ({
    key: b.key,
    label: b.label,
    shortLabel: b.shortLabel,
    count: 0,
  }));
}