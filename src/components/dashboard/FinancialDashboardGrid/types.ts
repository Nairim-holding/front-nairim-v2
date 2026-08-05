/** Período compartilhado por todos os widgets "reais" do grid financeiro, vindo do filtro único da aba (FinancialDashboardHeader). */
export interface FinancialWidgetProps {
  /** Ano mais recente selecionado — para gráficos que só fazem sentido com um único ano (linha do tempo de 12 meses). */
  year: number;
  /** Todos os anos selecionados (Tarefa 5.2/9) — para gráficos que agrupam por ano. */
  years: number[];
  startDate: string;
  endDate: string;
  /** Filtros do botão Filtro (Tarefa 5.1) — mesmos campos da tela de Lançamentos. */
  filters?: Record<string, unknown>;
}
