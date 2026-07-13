'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import type { EChartsOption } from 'echarts';
import ChartCard from '@/components/dashboard/ChartCard';
import EchartsSurface from '@/components/dashboard/EchartsSurface';
import { authFetch } from '@/utils/authFetch';
import { formatCurrency } from '@/components/dashboard/MonthlyIncomeExpenseChart';
import { useTheme } from '@/contexts/ThemeContext';
import { getThemeTokens } from '@/utils';

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
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'shadow' },
      confine: true,
      formatter: (params: any) => {
        const item = Array.isArray(params) ? params[0] : params;
        return `${item.name}<br/>${formatCurrency(accounts[item.dataIndex]?.balance ?? 0)}`;
      },
    },
    grid: {
      top: 24,
      // Espaço extra embaixo para os nomes das contas inclinados (não truncados).
      bottom: isLarge ? 110 : 90,
      left: isLarge ? 72 : 56,
      right: 16,
      containLabel: true,
    },
    xAxis: {
      type: 'category',
      data: accounts.map((a) => a.name),
      axisLabel: {
        color: tokens.textMuted,
        fontSize: isLarge ? 13 : 11,
        rotate: 35,
        interval: 0,
        overflow: 'none',
      },
      axisLine: { lineStyle: { color: tokens.borderSoft } },
      axisTick: { show: false },
    },
    yAxis: {
      type: 'value',
      axisLabel: {
        color: tokens.textMuted,
        fontSize: 11,
        formatter: (v: number) => (Math.abs(v) >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v)),
      },
      splitLine: { lineStyle: { type: 'dashed', color: tokens.borderSoft } },
    },
    series: [
      {
        type: 'bar',
        data: accounts.map((a) => a.balance),
        barMaxWidth: 48,
        itemStyle: {
          borderRadius: [4, 4, 0, 0],
          color: (params: any) => (accounts[params.dataIndex]?.balance >= 0 ? tokens.success : tokens.error),
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
          <div className="text-center rounded-lg py-2 shrink-0 bg-surface-subtle">
            <div className={`font-bold ${isFullscreen ? 'text-3xl' : 'text-xl'} ${totalBalance >= 0 ? 'text-content' : 'text-state-error'}`}>
              {formatCurrency(totalBalance)}
            </div>
            <div className="text-xs text-content-muted mt-1">Saldo Total</div>
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
