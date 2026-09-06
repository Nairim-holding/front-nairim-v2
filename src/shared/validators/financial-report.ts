import { z } from 'zod';
import { isValidIsoDateString } from '@/shared/utils/date-utils';

/**
 * Validação dos Relatórios Financeiros — porte de `lib/validators/reports.ts`.
 *
 * ⚠️ Nome de arquivo deliberadamente SINGULAR (`financial-report.ts`) — já
 * existe `shared/validators/financial-reports.ts` de outro recurso
 * (agregações do Dashboard). Ver core/entities/financial-report.ts.
 *
 * ⚠️ Teto de intervalo de 5480 dias (~15 anos), DIFERENTE do teto de 365 dias
 * do dashboard puro — não reaproveitar `dashboardParamsSchema` aqui mesmo que
 * a validação-base seja parecida (o próprio backend original reaproveitava
 * `validateDashboardParams`, mas o efeito prático é um teto maior nos
 * relatórios, documentado no comentário do validator original).
 *
 * Camada: shared.
 * Origem: api-nairim-v2/src/lib/validators/reports.ts.
 */

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function isValidDateString(value: string): boolean {
  return DATE_RE.test(value) && isValidIsoDateString(value);
}

export const REPORT_GROUP_BY = ['description', 'day', 'category', 'subcategory', 'contact', 'center'] as const;
export const DFC_GROUP_BY = ['day', 'subcategory'] as const;
export const REPORT_REGIMES = ['caixa', 'competencia'] as const;
export const REPORT_STATUSES = ['PENDING', 'COMPLETED'] as const;
export const REPORT_TYPES = ['INCOME', 'EXPENSE'] as const;

export const reportParamsSchema = z
  .object({
    startDate: z.string().min(1, 'startDate é obrigatório').max(40).refine(isValidDateString, {
      message: 'startDate deve ser uma data válida no formato YYYY-MM-DD',
    }),
    endDate: z.string().min(1, 'endDate é obrigatório').max(40).refine(isValidDateString, {
      message: 'endDate deve ser uma data válida no formato YYYY-MM-DD',
    }),
    regime: z.enum(REPORT_REGIMES).optional(),
    status: z.enum(REPORT_STATUSES).optional(),
    type: z.enum(REPORT_TYPES).optional(),
  })
  .superRefine((data, ctx) => {
    const start = new Date(data.startDate);
    const end = new Date(data.endDate);

    if (start > end) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'startDate não pode ser maior que endDate', path: ['startDate'] });
    }

    const diffDays = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
    if (diffDays > 5480) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'O intervalo máximo permitido é de 15 anos', path: ['startDate'] });
    }
  });

export const groupBySchema = z.enum(REPORT_GROUP_BY, {
  message: `groupBy deve ser um dos valores: ${REPORT_GROUP_BY.join(', ')}`,
});

/** groupBy do Demonstrativo (DFC) — aceita apenas 'day' ou 'subcategory'; default 'day'. */
export const dfcGroupBySchema = z.enum(DFC_GROUP_BY).optional().default('day');
