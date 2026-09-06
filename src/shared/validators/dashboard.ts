import { z } from 'zod';
import { isValidIsoDateString } from '@/shared/utils/date-utils';

/**
 * Schemas Zod das métricas do Dashboard (Módulo 11).
 * Substituem o `validateDashboardParams` do backend
 * (api-nairim-v2/src/lib/validators/dashboard.ts), usado em
 * `GET /dashboard/financial|portfolio|clients|map|all`:
 *  - startDate/endDate obrigatórios;
 *  - formato `YYYY-MM-DD` com data válida;
 *  - startDate não pode ser maior que endDate;
 *  - intervalo máximo de 5480 dias (~15 anos).
 *
 * ⚠️ Teto corrigido de 365→5480 dias na migração do Módulo 13 (ver
 * MIGRATION_STATUS.md): o backend já tinha ampliado esse limite (seleção de
 * múltiplos anos + "Limpar período") depois que o Dashboard foi portado, e a
 * mudança nunca foi resincronizada aqui — bug de regressão silencioso,
 * corrigido de brinde ao investigar o teto de `/financial-reports`.
 *
 * Erros em português mantidos idênticos ao backend.
 */

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function isValidDateString(value: string): boolean {
  return DATE_RE.test(value) && isValidIsoDateString(value);
}

export const dashboardParamsSchema = z
  .object({
    startDate: z
      .string()
      .min(1, 'startDate é obrigatório')
      .max(40)
      .refine(isValidDateString, {
        message: 'startDate deve ser uma data válida no formato YYYY-MM-DD',
      }),
    endDate: z
      .string()
      .min(1, 'endDate é obrigatório')
      .max(40)
      .refine(isValidDateString, {
        message: 'endDate deve ser uma data válida no formato YYYY-MM-DD',
      }),
  })
  .passthrough()
  .superRefine((data, ctx) => {
    const start = new Date(data.startDate);
    const end = new Date(data.endDate);

    if (start > end) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'startDate não pode ser maior que endDate',
        path: ['startDate'],
      });
    }

    const diffDays = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
    if (diffDays > 5480) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'O intervalo máximo permitido é de 15 anos',
        path: ['startDate'],
      });
    }
  });
