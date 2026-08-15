/**
 * Entidades de dominio: Planejamento (Planning + PlanningMonth) e o agregado
 * do Dashboard de Planejamento (GET /planning/dashboard).
 *
 * Fidelidade ao backend (PlanningService):
 *  - `upsert` cria ou atualiza pelo par (category_id, subcategory_id) e grava
 *    sempre os 12 PlanningMonth para VARIABLE (zeros inclusos); FIXED não tem
 *    valores mensais (usa `default_amount`).
 *  - A unicidade da combinação é garantida em código (não há @@unique no
 *    schema) — a base de produção tem duplicados legados.
 *  - `min_recommended`/`max_recommended` são derivados do histórico real de
 *    transações daquela categoria/subcategoria.
 *  - O dashboard devolve o shape consumido por `PlanningTable` (DashboardItem/
 *    CategoryDashboard) + saldos mensais e acumulados.
 *
 * Camada: core. Origem: api-nairim-v2/src/services/PlanningService.ts.
 */

export type PlanningType = 'FIXED' | 'VARIABLE';

/** Valor planejado de um mês (PlanningMonth). */
export interface PlanningMonthlyValue {
  month: number;
  amount: number;
}

/** Registro de Planejamento com valores mensais anexados. */
export interface Planning {
  id: string;
  company_id: string;
  category_id: string;
  subcategory_id: string | null;
  type: PlanningType;
  default_amount: number | null;
  min_recommended: number | null;
  max_recommended: number | null;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
  deleted_at: Date | null;
  monthly_values: PlanningMonthlyValue[];
  /** Registro em memória pode carregar campos extras do Prisma. */
  [key: string]: unknown;
}

/** Entrada de criação/atualização (POST /planning). */
export interface UpsertPlanningData {
  category_id: string;
  subcategory_id?: string | null;
  type: PlanningType;
  default_amount?: number | null;
  monthly_values?: PlanningMonthlyValue[];
}

/** Filtros do botão Filtro aplicados às transações agregadas (sem `status`). */
export interface PlanningDashboardFilters {
  [field: string]: string[];
}

export interface MonthlyData {
  month: number;
  year: number;
  realized_amount: number;
}

export interface MonthlyPlanned {
  month: number;
  amount: number;
}

/** Item do dashboard (subcategoria ou categoria sem subcategorias). */
export interface PlanningDashboardItem {
  id: string;
  name: string;
  planning_type?: PlanningType;
  planned_amount: number;
  realized_amount: number;
  percentage: number;
  min: number | null;
  med: number;
  max: number | null;
  min_recommended: number | null;
  max_recommended: number | null;
  monthly_data: MonthlyData[];
  monthly_values: MonthlyPlanned[];
  planning_id?: string;
}

/** Categoria do dashboard com suas subcategorias. */
export interface PlanningCategoryDashboard extends PlanningDashboardItem {
  type: 'INCOME' | 'EXPENSE';
  subcategories: PlanningDashboardItem[];
}

/** Resposta do GET /planning/dashboard. */
export interface PlanningDashboardResponse {
  start_date: string;
  end_date: string;
  balances: {
    monthly: MonthlyData[];
    accumulated: MonthlyData[];
  };
  incomes: PlanningCategoryDashboard[];
  expenses: PlanningCategoryDashboard[];
}
