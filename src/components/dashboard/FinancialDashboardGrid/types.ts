/** Período compartilhado por todos os widgets "reais" do grid financeiro, vindo do filtro único da aba (FinancialDashboardHeader). */
export interface FinancialWidgetProps {
  year: number;
  startDate: string;
  endDate: string;
}
