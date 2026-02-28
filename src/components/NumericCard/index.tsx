/* eslint-disable react-hooks/rules-of-hooks */
/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useState, useRef, useEffect, useMemo } from "react";
import CountUp from "react-countup";
import * as echarts from "echarts";
import DataModal from "../DataModal";

// Definição das colunas para o DataModal
export interface DetailColumn {
  key: string;
  label: string;
  format?: (value: any) => string | React.ReactNode;
  width?: string;
}

interface NumericCardProps {
  value: string | number;
  label: string;
  data?: { value: number }[];
  color?: string;
  variation?: any;
  positive?: boolean | string;
  loading?: boolean;
  detailData?: any[];
  detailColumns?: DetailColumn[];
}

// Funções auxiliares de formatação
const formatCurrencyBR = (value: number): string => {
  return `R$ ${value.toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })}`;
};

const formatStatus = (value: string): string => {
  const statusMap: Record<string, string> = {
    'AVAILABLE': 'Disponível',
    'RENTED': 'Alugado',
    'OCCUPIED': 'Ocupado',
    'SOLD': 'Vendido',
    'MAINTENANCE': 'Manutenção',
    'UNAVAILABLE': 'Indisponível',
  };
  return statusMap[value] || value;
};

const formatDate = (value: string): string => {
  try {
    return new Date(value).toLocaleDateString("pt-BR");
  } catch {
    return value;
  }
};

// Função para extrair valor numérico
const extractNumericValue = (value: string | number): number => {
  if (typeof value === 'number') return value;
  
  const cleaned = value
    .replace('R$', '')
    .replace(/\./g, '')
    .replace(',', '.')
    .replace(/\s+/g, '')
    .trim();
  
  const num = parseFloat(cleaned);
  return isNaN(num) ? 0 : num;
};

// Função para verificar se é valor monetário
const isMonetaryValue = (value: string | number): boolean => {
  if (typeof value === 'string') {
    return value.includes('R$') || value.includes('$');
  }
  return false;
};

export default function NumericCard({ 
  value, 
  label, 
  data, 
  color = "#16a34a", 
  variation, 
  positive, 
  loading = false,
  detailData,
  detailColumns 
}: NumericCardProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const chartRef = useRef<HTMLDivElement>(null);
  
  // Processa o valor para determinar o tipo e formato
  const valueInfo = useMemo(() => {
    if (isMonetaryValue(value)) {
      const numericValue = extractNumericValue(value);
      return {
        numericValue,
        isMonetary: true,
        isNumeric: true,
      };
    }
    
    const numericValue = typeof value === 'string' ? parseFloat(value.replace(',', '.')) : value;
    const isNumeric = !isNaN(numericValue) && typeof numericValue === 'number';
    
    return {
      numericValue: isNumeric ? numericValue : 0,
      isMonetary: false,
      isNumeric,
    };
  }, [value]);

  // Skeleton loading state
  if (loading) {
    return (
      <div className="p-4 bg-surface rounded-lg shadow-chart border border-ui-border-strong flex flex-col justify-start items-start relative animate-pulse flex-grow min-w-[300px]">
        <div className="text-sm w-full">
          <div className="h-5 bg-surface-subtle rounded w-2/5 mb-2"></div>
        </div>
        <div className="h-7 bg-surface-subtle rounded w-1/2 mb-2"></div>
        
        {/* Skeleton for variation indicator */}
        <div className="absolute bg-surface-subtle rounded-xl px-1 shadow-chart w-[70px] h-[25px] flex items-center justify-center gap-2 left-[70%] top-[50px] animate-pulse">
          <div className="h-3 bg-surface-muted rounded w-8"></div>
          <div className="h-3 w-3 bg-surface-muted rounded"></div>
        </div>
        
        {/* Skeleton for chart */}
        {data && (
          <div className="mt-2 h-12 w-full bg-surface-subtle rounded"></div>
        )}
      </div>
    );
  }

  // ECharts para o gráfico de linha
  useEffect(() => {
    if (!chartRef.current || !data || data.length === 0) return;

    const chart = echarts.init(chartRef.current);
    
    const option: echarts.EChartsOption = {
      grid: {
        top: 0,
        right: 0,
        bottom: 0,
        left: 0
      },
      xAxis: {
        type: 'category',
        show: false,
        data: data.map((_, i) => i)
      },
      yAxis: {
        type: 'value',
        show: false
      },
      series: [{
        data: data.map(item => item.value),
        type: 'line',
        smooth: true,
        symbol: 'none',
        lineStyle: {
          color: color,
          width: 2
        },
        areaStyle: {
          color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
            { offset: 0, color: `${color}40` },
            { offset: 1, color: `${color}00` }
          ])
        }
      }]
    };

    chart.setOption(option);

    const handleResize = () => chart.resize();
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      chart.dispose();
    };
  }, [data, color]);

  // Renderiza o valor principal
  const renderMainValue = () => {
    if (valueInfo.isMonetary) {
      return (
        <CountUp
          start={0}
          end={valueInfo.numericValue}
          duration={2.5}
          separator="."
          decimal=","
          decimals={2}
          prefix="R$ "
          suffix=""
        />
      );
    } else if (valueInfo.isNumeric) {
      const isInteger = Number.isInteger(valueInfo.numericValue);
      return (
        <CountUp
          end={valueInfo.numericValue}
          duration={2}
          separator="."
          decimal=","
          decimals={isInteger ? 0 : 2}
        />
      );
    } else {
      return value;
    }
  };

  return (
    <div className="p-4 bg-surface rounded-lg shadow-chart border border-ui-border-strong flex flex-col justify-start items-start relative group hover:shadow-lg transition-all duration-300 flex-grow min-w-[300px]">
      
      {/* Ícone de detalhes - aparece apenas se houver detailData */}
      {detailData && detailData.length > 0 && (
        <button
          onClick={() => setIsModalOpen(true)}
          className="absolute top-3 right-3 p-2 rounded-full bg-surface-subtle hover:bg-surface-subtle transition z-10"
          title="Ver detalhes"
        >
          <svg 
            width="16" 
            height="16" 
            viewBox="0 0 24 24" 
            fill="none" 
            stroke="currentColor" 
            strokeWidth="2"
          >
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <polyline points="14,2 14,8 20,8" />
            <line x1="16" y1="13" x2="8" y2="13" />
            <line x1="16" y1="17" x2="8" y2="17" />
            <polyline points="10,9 9,9 8,9" />
          </svg>
        </button>
      )}
      
      <div className="text-sm w-full">
        <h3 className="text-lg text-content-secondary mb-2 text-start">
          {label}
        </h3>
      </div>
      
      {/* Variation Indicator */}
      {variation !== undefined && (
        <div className="absolute bg-surface-muted rounded-xl px-1 shadow-chart w-[70px] h-[25px] flex items-center justify-center gap-2 left-[70%] top-[50px]">
          <p className="text-content-muted font-roboto">{Math.round(Number(variation)) + '%'}</p>
          {positive == true ? (
            <svg width="12" height="9" viewBox="0 0 12 9" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M0.583668 8.7344H11.0837C11.19 8.73406 11.2942 8.70474 11.3851 8.64959C11.4759 8.59444 11.5501 8.51555 11.5994 8.42141C11.6488 8.32726 11.6716 8.22144 11.6653 8.11531C11.659 8.00919 11.6239 7.9068 11.5638 7.81915L6.31375 0.235812C6.09617 -0.0786042 5.57233 -0.0786042 5.35417 0.235812L0.104168 7.81915C0.0433992 7.90661 0.00776293 8.00906 0.00113104 8.11536C-0.00550085 8.22166 0.0171253 8.32774 0.0665511 8.42208C0.115977 8.51643 0.190312 8.59542 0.28148 8.65048C0.372649 8.70554 0.477163 8.73456 0.583668 8.7344Z" fill="#00C30D"/>
            </svg>
          ) : positive == false ? (
            <svg width="12" height="9" viewBox="0 0 12 9" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M0.583668 -2.00272e-05H11.0837C11.19 0.000312805 11.2942 0.0296335 11.3851 0.0847836C11.4759 0.139935 11.5501 0.218826 11.5994 0.312968C11.6488 0.407111 11.6716 0.512939 11.6653 0.619061C11.659 0.725183 11.6239 0.82758 11.5638 0.91523L6.31375 8.49856C6.09617 8.81298 5.57233 8.81298 5.35417 8.49856L0.104168 0.91523C0.0433992 0.827763 0.00776293 0.725314 0.00113104 0.619016C-0.00550085 0.512717 0.0171253 0.406634 0.0665511 0.312292C0.115977 0.21795 0.190312 0.138957 0.28148 0.0838957C0.372649 0.0288353 0.477163 -0.000187874 0.583668 -2.00272e-05Z" fill="#B70000"/>
            </svg>
          ) : positive == 'equal' && (
            <svg width="18" height="2" viewBox="0 0 18 2" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path fillRule="evenodd" clipRule="evenodd" d="M0 1C0 0.734784 0.105357 0.48043 0.292893 0.292893C0.48043 0.105357 0.734784 0 1 0H17C17.2652 0 17.5196 0.105357 17.7071 0.292893C17.8946 0.48043 18 0.734784 18 1C18 1.26522 17.8946 1.51957 17.7071 1.70711C17.5196 1.89464 17.2652 2 17 2H1C0.734784 2 0.48043 1.89464 0.292893 1.70711C0.105357 1.51957 0 1.26522 0 1Z" fill="#525252"/>
            </svg>
          )}
        </div>
      )}
      
      {/* Main Value */}
      <div className="text-2xl font-bold text-content">
        {renderMainValue()}
      </div>
      
      {/* Chart */}
      {data && data.length > 0 && (
        <div className="mt-2 h-12 w-full">
          <div ref={chartRef} style={{ width: '100%', height: '100%' }} />
        </div>
      )}

      <DataModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={label}
        data={detailData || []}
        columns={detailColumns}
      />
    </div>
  );
}