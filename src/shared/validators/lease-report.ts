import { z } from 'zod';

/**
 * Validação dos parâmetros do Relatório de Locações.
 * Camada: shared.
 */

const referenceMonthSchema = z.object({
  year: z.coerce.number().int().min(1900).max(2200),
  month: z.coerce.number().int().min(1).max(12),
});

export const leaseReportParamsSchema = z.object({
  // Teto de 36 meses: cada mês selecionado é uma query, e o quadro trimestral
  // ainda completa os meses que faltam do trimestre. Sem limite, uma seleção
  // acidental de "todos os anos" viraria centenas de round-trips.
  months: z.array(referenceMonthSchema).min(1, 'Selecione ao menos um mês de referência').max(36, 'Selecione no máximo 36 meses'),
});

export type LeaseReportParamsInput = z.input<typeof leaseReportParamsSchema>;
