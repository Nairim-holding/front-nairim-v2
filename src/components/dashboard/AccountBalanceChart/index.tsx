'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import type { EChartsOption } from 'echarts';
import ChartCard from '@/components/dashboard/ChartCard';
import EchartsSurface from '@/components/dashboard/EchartsSurface';
import { authFetch } from '@/utils/authFetch';
import { formatCurrency } from '@/components/dashboard/MonthlyIncomeExpenseChart';
import { useTheme } from '@/contexts/ThemeContext';
import { getThemeTokens } from '@/utils';
import { buildCustomTooltipHTML, getCustomEchartsTooltipConfig } from '@/utils/echartsTooltip';

const API_URL = process.env.NEXT_PUBLIC_URL_API ?? '';

interface AccountBalance {
  institutionId: string;
  name: string;
  balance: number;
}

export default function AccountBalanceChart() {
  useTheme();
  const tokens = getThemeTokens();
  const [accounts, setAccounts] = useState<AccountBalance[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);

    (async () => {
      try {
        const response = await authFetch(`${API_URL}/financial-institution/balance-summary`);
        if (response.ok) {
          const result = await response.json();
          if (!cancelled && Array.isArray(result.data)) {
            setAccounts(result.data);
          }
        }
      } catch (error) {
        console.error('[AccountBalanceChart] Erro ao carregar saldo por conta:', error);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const totalBalance = useMemo(() => accounts.reduce((sum, a) => sum + a.balance, 0), [accounts]);

  const detailData = useMemo(
    () => [
      ...accounts.map((a) => ({ account: a.name, value: a.balance })),
      { account: 'Total', value: totalBalance },
    ],
    [accounts, totalBalance]
  );

  const detailColumns = useMemo(
    () => [
      { key: 'account', label: 'Conta' },
      { key: 'value', label: 'Valor', format: (v: number) => formatCurrency(v) },
    ],
    []
  );

  const buildOption = useCallback((isLarge: boolean): EChartsOption => ({
    backgroundColor: 'transparent',
    tooltip: getCustomEchartsTooltipConfig((params: any) => {
      const item = Array.isArray(params) ? params[0] : params;
      const account = accounts[item.dataIndex];
      const name = account?.name || item.name || '';
      const val = account?.balance ?? Number(item.value ?? 0);
      return buildCustomTooltipHTML(name, [
        { label: 'Saldo Atual', value: val, color: item.color },
      ]);
    }),
    grid: {
      top: 36,
      bottom: isLarge ? 80 : 60,
      left: 16,
      right: 16,
      containLabel: true,
    },
    xAxis: {
      type: 'category',
      data: accounts.map((a) => a.name),
      axisLabel: {
        color: tokens.textMuted,
        fontSize: isLarge ? 12 : 11,
        rotate: accounts.length > 5 ? 25 : 0,
        interval: 0,
      },
      axisLine: { lineStyle: { color: tokens.borderSoft } },
      axisTick: { show: false },
    },
    yAxis: {
      type: 'value',
      show: false,
    },
    series: [
      {
        type: 'bar',
        data: accounts.map((a) => a.balance),
        barMaxWidth: 44,
        label: {
          show: true,
          position: 'top',
          formatter: (p: any) => formatCurrency(Number(p.value)),
          fontSize: isLarge ? 12 : 10,
          fontWeight: 'bold',
          color: tokens.textSecondary,
        },
        itemStyle: {
          borderRadius: [6, 6, 0, 0],
          color: (params: any) => tokens.chartSeries[params.dataIndex % tokens.chartSeries.length],
        },
      },
    ],
  }), [accounts, tokens]);

  return (
    <ChartCard
      title="Saldo por Conta"
      subtitle="Saldo corrente de todas as contas ativas"
      detailData={detailData}
      detailColumns={detailColumns}
    >
      {({ isFullscreen }) => (
        <div className="w-full h-full flex flex-col p-3 gap-2">
          <div className="text-center rounded-xl py-3 px-4 shrink-0 bg-surface-subtle border border-ui-border-soft shadow-2xs">
            <div className={`font-extrabold tracking-tight ${isFullscreen ? 'text-3xl' : 'text-2xl'} ${totalBalance >= 0 ? 'text-content' : 'text-state-error'}`}>
              {formatCurrency(totalBalance)}
            </div>
            <div className="text-xs font-semibold text-content-muted mt-0.5">Saldo Total</div>
          </div>
          {!isLoading && accounts.length === 0 ? (
            <div className="flex-1 flex items-center justify-center text-content-muted text-sm">
              Nenhuma conta ativa encontrada.
            </div>
          ) : (
            <div className="flex-1 relative min-h-0">
              <EchartsSurface isFullscreen={isFullscreen} isLoading={isLoading} buildOption={buildOption} />
            </div>
          )}
        </div>
      )}
    </ChartCard>
  );
}
