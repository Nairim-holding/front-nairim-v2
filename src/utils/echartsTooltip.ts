import type { EChartsOption } from 'echarts';
import { formatCurrency } from '@/components/dashboard/MonthlyIncomeExpenseChart';

export interface TooltipItem {
  label: string;
  value: number | string;
  color?: string;
  formattedValue?: string;
}

/**
 * Cria a string HTML do tooltip padronizado para o Dashboard (1.C)
 * - Cabeçalho com fundo destacado (cinza/lavanda) e texto em negrito centralizado
 * - Corpo branco com borda sutil, sombra e cantos arredondados
 * - Lista de séries com indicador circular de cor + rótulo + valor formatado
 */
export function buildCustomTooltipHTML(
  headerText: string,
  items: TooltipItem[]
): string {
  const itemsHTML = items
    .map((item) => {
      const valStr =
        item.formattedValue ??
        (typeof item.value === 'number' ? formatCurrency(item.value) : String(item.value));

      const dotColor = item.color ?? '#3b82f6';

      return `
        <div style="display: flex; align-items: center; justify-content: space-between; gap: 16px; margin-top: 6px; font-size: 12px; line-height: 1.4;">
          <div style="display: flex; align-items: center; gap: 6px;">
            <span style="display: inline-block; width: 8px; height: 8px; border-radius: 50%; background-color: ${dotColor};"></span>
            <span style="color: #475569; font-weight: 500;">${item.label}</span>
          </div>
          <span style="color: #0f172a; font-weight: 700; font-family: system-ui, -apple-system, sans-serif;">${valStr}</span>
        </div>
      `;
    })
    .join('');

  return `
    <div style="background-color: #ffffff; border-radius: 10px; box-shadow: 0 10px 15px -3px rgba(0,0,0,0.1), 0 4px 6px -4px rgba(0,0,0,0.05); border: 1px solid #e2e8f0; overflow: hidden; min-width: 170px; padding: 0;">
      <div style="background-color: #f1f5f9; padding: 6px 12px; text-align: center; font-weight: 700; font-size: 12px; color: #1e293b; border-bottom: 1px solid #e2e8f0;">
        ${headerText}
      </div>
      <div style="padding: 8px 12px;">
        ${itemsHTML}
      </div>
    </div>
  `;
}

/**
 * Configuração padrão de tooltip e axisPointer do ECharts alinhada ao DNA visual (1.C)
 */
export const getCustomEchartsTooltipConfig = (
  formatterFn: (params: any) => string
): NonNullable<EChartsOption['tooltip']> => ({
  trigger: 'axis',
  backgroundColor: 'transparent',
  borderWidth: 0,
  padding: 0,
  extraCssText: 'box-shadow: none; pointer-events: none;',
  axisPointer: {
    type: 'line',
    lineStyle: {
      color: '#94a3b8',
      width: 1.5,
      type: 'dashed',
    },
    label: {
      show: true,
      backgroundColor: '#1e293b',
      color: '#ffffff',
      fontWeight: 'bold',
      fontSize: 11,
      borderRadius: 4,
      padding: [4, 8, 4, 8],
    },
  },
  formatter: formatterFn as any,
});
