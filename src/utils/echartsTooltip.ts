import type { EChartsOption, TooltipComponentFormatterCallbackParams } from 'echarts';
import { getThemeTokens } from '@/utils/getThemeTokens';

type TooltipPoint = Exclude<TooltipComponentFormatterCallbackParams, unknown[]> & { axisValueLabel?: string };

export interface TooltipItem {
  label: string;
  value: number | string;
  color?: string;
  formattedValue?: string;
  emphasized?: boolean;
}

export const escapeTooltipText = (value: string): string => value.replace(/[&<>"']/g, character => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
})[character]!);

const safeColor = (value: string, fallback: string) => /^(#[0-9a-f]{3,8}|rgba?\([\d.,%\s]+\))$/i.test(value) ? value : fallback;

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
  const tokens = getThemeTokens();
  const surface = safeColor(tokens.bgSurface, '#ffffff');
  const header = safeColor(tokens.bgSubtle, '#f1f5f9');
  const border = safeColor(tokens.borderSoft, '#e2e8f0');
  const text = safeColor(tokens.textPrimary, '#0f172a');
  const muted = safeColor(tokens.textSecondary, '#475569');
  const itemsHTML = items
    .map((item) => {
      const valStr =
        item.formattedValue ??
        (typeof item.value === 'number' ? item.value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : String(item.value));

      const dotColor = safeColor(item.color ?? '#3b82f6', '#3b82f6');

      return `
        <div style="display: flex; align-items: center; justify-content: space-between; gap: 16px; ${item.emphasized ? `background-color: ${header}; border-top: 1px solid ${border}; margin: 8px -12px -8px; padding: 6px 12px;` : 'margin-top: 6px;'} font-size: 12px; line-height: 1.4;">
          <div style="display: flex; align-items: center; gap: 6px;">
            <span style="display: inline-block; width: 8px; height: 8px; border-radius: 50%; background-color: ${dotColor};"></span>
            <span style="color: ${muted}; font-weight: 500;">${escapeTooltipText(item.label)}</span>
          </div>
          <span style="color: ${text}; font-weight: 700; font-family: system-ui, -apple-system, sans-serif;">${escapeTooltipText(valStr)}</span>
        </div>
      `;
    })
    .join('');

  return `
    <div style="background-color: ${surface}; border-radius: 10px; box-shadow: 0 10px 15px -3px rgba(0,0,0,0.1), 0 4px 6px -4px rgba(0,0,0,0.05); border: 1px solid ${border}; overflow: hidden; min-width: 170px; padding: 0;">
      <div style="background-color: ${header}; padding: 6px 12px; text-align: center; font-weight: 700; font-size: 12px; color: ${text}; border-bottom: 1px solid ${border};">
        ${escapeTooltipText(headerText)}
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
  formatterFn: (params: TooltipPoint | TooltipPoint[]) => string
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
  formatter: formatterFn,
});
