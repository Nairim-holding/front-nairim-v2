'use server';

import { type ActionResult, runAction } from '@/shared/actions/action-result';
import type {
  DemonstrativoResult,
  ExtratoResult,
  GroupedReportResult,
  IncomeExpenseResult,
} from '@/core/entities/financial-report';
import {
  getGroupedReportData,
  getExtratoReportData,
  getIncomeExpenseReportData,
  getDemonstrativoReportData,
} from '@/server/queries/financial-report';

/**
 * Server Actions dos Relatórios Financeiros. Substituem os endpoints de
 * `/financial-reports`. Guarda: `withPermission('financial-reports', 'view')`.
 * Camada: server. Origem: ReportController.ts.
 *
 * Só leituras — os 4 relatórios são gerados sob demanda, sem persistência
 * própria; a exportação (PDF/Excel/impressão) roda 100% no front.
 *
 * ⚠️ Nome de arquivo deliberadamente SINGULAR — já existe
 * `server/actions/financial-transaction.ts` com leituras de agregação de
 * outro recurso (Dashboard). Ver core/entities/financial-report.ts.
 */

export async function getGroupedReportAction(raw: Record<string, unknown>): Promise<ActionResult<GroupedReportResult>> {
  return runAction(() => getGroupedReportData(raw));
}

export async function getExtratoReportAction(raw: Record<string, unknown>): Promise<ActionResult<ExtratoResult>> {
  return runAction(() => getExtratoReportData(raw));
}

export async function getIncomeExpenseReportAction(raw: Record<string, unknown>): Promise<ActionResult<IncomeExpenseResult>> {
  return runAction(() => getIncomeExpenseReportData(raw));
}

export async function getDemonstrativoReportAction(raw: Record<string, unknown>): Promise<ActionResult<DemonstrativoResult>> {
  return runAction(() => getDemonstrativoReportData(raw));
}
