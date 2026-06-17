export type CategoryType = 'INCOME' | 'EXPENSE';
export type PlanType = 'FIXED' | 'VARIABLE';

export interface MonthlyData {
  month: number;
  year: number;
  realized_amount: number;
}

export interface MonthlyValue {
  month: number;
  amount: number;
}

export interface MonthlyPlanned {
  month: number;
  amount: number;
}

export interface DashboardItem {
  id: string;
  name: string;
  planning_type?: 'FIXED' | 'VARIABLE';
  planned_amount: number;
  realized_amount: number;
  percentage: number;
  min: number | null;
  med: number;
  max: number | null;
  min_recommended: number | null;
  max_recommended: number | null;
  monthly_values: MonthlyPlanned[];
  monthly_data: MonthlyData[];
  planning_id?: string;
}

export interface CategoryDashboard extends DashboardItem {
  type: CategoryType;
  subcategories: DashboardItem[];
}

export interface DashboardResponse {
  start_date: string;
  end_date: string;
  balances: {
    monthly: MonthlyData[];
    accumulated: MonthlyData[];
  };
  incomes: CategoryDashboard[];
  expenses: CategoryDashboard[];
}

export interface DateRange {
  start: string;
  end: string;
}

export interface PlanningPayloadFixed {
  category_id: string;
  subcategory_id?: string;
  year: number;
  type: 'FIXED';
  default_amount: number;
}

export interface PlanningPayloadVariable {
  category_id: string;
  subcategory_id?: string;
  year: number;
  type: 'VARIABLE';
  monthly_values: MonthlyValue[];
}

export type PlanningPayload = PlanningPayloadFixed | PlanningPayloadVariable;
