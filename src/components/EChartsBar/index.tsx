/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import React, { useState, useRef, useEffect, useCallback, useMemo } from "react";
import * as echarts from "echarts";
import DataModal from "../DataModal";
import { MetricDataItem } from "@/types/types";
import { useTheme } from "@/contexts/ThemeContext";
import { getThemeTokens } from "@/util/getThemeTokens";

interface BarDataItem {
  name: string;
  value: number;
  data?: MetricDataItem[];
  itemStyle?: {
    color?: string;
  };
  [key: string]: any;
}

interface BarCardProps {
  data: BarDataItem[];
  label?: string;
  loading?: boolean;
  colors?: string[];
  detailColumns?: Array<{ key: string; label: string; format?: (value: any) => string }>;
}

export default function EChartsBar({
  data = [],
  label = "Comparativo",
  colors = [],
  detailColumns = []
}: BarCardProps) {
  const chartRef = useRef<HTMLDivElement>(null);
  const fullscreenChartRef = useRef<HTMLDivElement>(null);
  
  const chartInstance = useRef<echarts.ECharts | null>(null);
  const fullscreenInstance = useRef<echarts.ECharts | null>(null);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isFullscreenModalOpen, setIsFullscreenModalOpen] = useState(false);
  useTheme();
  const tokens = getThemeTokens();
  const palette = colors.length > 0 ? colors : tokens.chartSeries;
  
  const [modalData, setModalData] = useState<MetricDataItem[]>([]);
  const [modalTitle, setModalTitle] = useState("");

  const allDetailData = useMemo(() => {
    return data.reduce((acc, item) => {
      if (item.data && Array.isArray(item.data)) {
        return [...acc, ...item.data];
      }
      return acc;
    }, [] as MetricDataItem[]);
  }, [data]);

  const initChart = useCallback((container: HTMLDivElement, isLarge = false) => {
    const existingInstance = echarts.getInstanceByDom(container);
    if (existingInstance) existingInstance.dispose();

    const chart = echarts.init(container);
    const containerWidth = container.clientWidth || 300;
    const isMobile = containerWidth < 768;

    const option: any = {
      backgroundColor: 'transparent',
      tooltip: {
        trigger: 'axis',
        confine: true,
        axisPointer: { type: 'shadow' },
        formatter: (params: any) => {
          const item = params[0];
          return `
            <div style="padding: 8px; background: ${tokens.textPrimary}; border-radius: 6px; color: ${tokens.textInverse}; font-size: 12px;">
              <strong>${item.name}</strong><br/>
              Quantidade: <strong>${item.value}</strong>
            </div>
          `;
        }
      },
      grid: {
        top: isLarge ? 40 : 20,
        bottom: isLarge ? 40 : 20,
        left: isLarge ? 40 : 10,
        right: isLarge ? 40 : 10,
        containLabel: true
      },
      xAxis: {
        type: 'category',
        data: data.map(d => d.name),
        axisLabel: {
          color: tokens.textMuted,
          fontSize: isMobile ? 10 : 12,
          interval: 0,
          rotate: isLarge ? 0 : 45, 
          formatter: (value: string) => {
             if (!isLarge && value.length > 8) return value.slice(0, 8) + '...';
             return value;
          }
        },
        axisLine: { show: false },
        axisTick: { show: false }
      },
      yAxis: {
        type: 'value',
        axisLabel: { color: tokens.textMuted, fontSize: 11 },
        splitLine: { lineStyle: { type: 'dashed', color: tokens.borderSoft } }
      },
      series: [
        {
          name: label,
          type: 'bar',
          barMaxWidth: 40,
          itemStyle: {
            borderRadius: [4, 4, 0, 0],
            color: (params: any) => palette[params.dataIndex % palette.length]
          },
          data: data.map(d => d.value)
        }
      ]
    };

    chart.setOption(option);

    if (!isLarge) {
      chart.getZr().on('click', () => setIsFullscreenModalOpen(true));
      chart.getZr().on('mouseover', () => chart.getZr().setCursorStyle('pointer'));
    }

    return chart;
  }, [data, label, palette, tokens]);

  useEffect(() => {
    if (!chartRef.current) return;
    chartInstance.current = initChart(chartRef.current, false);
    const resizeObserver = new ResizeObserver(() => {
      if (chartInstance.current) chartInstance.current.resize();
      else if (chartRef.current) chartInstance.current = initChart(chartRef.current, false);
    });
    resizeObserver.observe(chartRef.current);
    window.addEventListener('resize', () => chartInstance.current?.resize());
    return () => {
        window.removeEventListener('resize', () => chartInstance.current?.resize());
        resizeObserver.disconnect();
        chartInstance.current?.dispose();
    };
  }, [initChart]);

  useEffect(() => {
    if (isFullscreenModalOpen && fullscreenChartRef.current) {
      setTimeout(() => {
        if (!fullscreenChartRef.current) return;
        fullscreenInstance.current = initChart(fullscreenChartRef.current, true);
        if (fullscreenInstance.current) {
          fullscreenInstance.current.on('click', (params: any) => {
            const itemData = data[params.dataIndex];
            if (itemData && itemData.data && itemData.data.length > 0) {
              setModalData(itemData.data);
              setModalTitle(`${label} - ${itemData.name}`);
              setIsFullscreenModalOpen(false);
              setTimeout(() => setIsModalOpen(true), 300);
            }
          });
        }
        const handleResize = () => fullscreenInstance.current?.resize();
        window.addEventListener('resize', handleResize);
        return () => {
            window.removeEventListener('resize', handleResize);
            fullscreenInstance.current?.dispose();
        };
      }, 100);
    }
  }, [isFullscreenModalOpen, initChart, label, data]);

  const handleOpenAllData = (e: React.MouseEvent) => {
    e.stopPropagation();
    setModalData(allDetailData);
    setModalTitle(`${label} - Geral`);
    setIsFullscreenModalOpen(false);
    setTimeout(() => setIsModalOpen(true), 300);
  };

  return (
    <>
      {/* Card Pequeno */}
      <div className="bg-surface rounded-xl p-4 border border-ui-border-soft shadow-sm hover:shadow-md transition-all duration-300 hover:border-brand group h-full flex flex-col relative">
        <div className="flex justify-between items-center mb-2">
          <h3 className="text-base font-semibold text-content text-start truncate pr-16">
            {label}
          </h3>
          
          <div className="flex gap-1">
            {/* BOTÃO VER DETALHES SOLICITADO */}
            {allDetailData.length > 0 && (
              <button
                onClick={handleOpenAllData}
                className="p-1.5 rounded-md text-content-muted hover:text-content-secondary hover:bg-surface-subtle transition-colors"
                title="Ver detalhes"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                  <polyline points="14,2 14,8 20,8"></polyline>
                  <line x1="16" y1="13" x2="8" y2="13"></line>
                  <line x1="16" y1="17" x2="8" y2="17"></line>
                  <polyline points="10,9 9,9 8,9"></polyline>
                </svg>
              </button>
            )}

            <button 
              onClick={() => setIsFullscreenModalOpen(true)} 
              className="p-1.5 rounded-md text-content-muted hover:text-content-secondary hover:bg-surface-subtle transition-colors" 
              title="Expandir gráfico"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3" />
              </svg>
            </button>
          </div>
        </div>

        <div className="relative flex-1 w-full min-h-[220px] cursor-pointer" onClick={() => setIsFullscreenModalOpen(true)}>
          <div ref={chartRef} className="w-full h-full absolute inset-0" />
        </div>
      </div>

      <DataModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={modalTitle} data={modalData} columns={detailColumns} />

      {isFullscreenModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-layer-overlay-strong p-2 sm:p-4" onClick={() => setIsFullscreenModalOpen(false)}>
          <div className="bg-surface rounded-xl w-full max-w-6xl h-[90vh] sm:h-[85vh] flex flex-col shadow-2xl mx-2 sm:mx-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center p-4 sm:p-6 border-b border-ui-border-soft gap-3 sm:gap-0">
              <div className="w-full sm:w-auto">
                <h2 className="text-xl sm:text-2xl font-bold text-content">{label}</h2>
                <p className="text-content-muted text-sm mt-1">Clique em uma barra para ver os detalhes específicos</p>
              </div>
              <div className="flex flex-wrap gap-2 w-full sm:w-auto justify-end">
                {allDetailData.length > 0 && (
                  <button onClick={handleOpenAllData} className="px-3 sm:px-4 py-2 bg-brand text-content-inverse rounded-lg hover:bg-brand-hover transition-colors flex items-center gap-2 text-sm font-medium w-full sm:w-auto justify-center">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20" /><path d="M9 10h6" /><path d="M9 14h6" /></svg>
                    Ver Todos os Dados
                  </button>
                )}
                <button onClick={() => setIsFullscreenModalOpen(false)} className="p-2 rounded-lg hover:bg-surface-subtle transition-colors text-content-muted hover:text-content-secondary" title="Fechar">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18" /><line x2="18" y2="18" x1="6" y1="6" /></svg>
                </button>
              </div>
            </div>
            <div className="flex-1 p-4 sm:p-6 md:p-8 relative bg-surface-subtle">
              <div ref={fullscreenChartRef} className="w-full h-full absolute inset-0" />
            </div>
          </div>
        </div>
      )}
    </>
  );
}
