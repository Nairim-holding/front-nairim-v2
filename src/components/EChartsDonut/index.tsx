/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import React, { useState, useRef, useEffect, useCallback, useMemo } from "react";
import * as echarts from "echarts";
import DataModal from "../DataModal";
import { MetricDataItem } from "@/types/types";
import { useTheme } from "@/contexts/ThemeContext";
import { getThemeTokens } from "@/util/getThemeTokens";

interface DonutDataItem {
  name: string;
  value: number;
  data?: MetricDataItem[];
  itemStyle?: {
    color?: string;
  };
  [key: string]: any;
}

interface DonutCardProps {
  data: DonutDataItem[];
  label?: string;
  loading?: boolean;
  colors?: string[];
  detailColumns?: Array<{ key: string; label: string; format?: (value: any) => string }>;
}

export default function EChartsDonut({
  data = [],
  label = "Distribuição",
  colors = [],
  detailColumns = []
}: DonutCardProps) {
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

  // Consolida todos os dados para o botão "Ver todos os dados"
  const allDetailData = useMemo(() => {
    return data.reduce((acc, item) => {
      if (item.data && Array.isArray(item.data)) {
        return [...acc, ...item.data];
      }
      return acc;
    }, [] as MetricDataItem[]);
  }, [data]);

  const initChart = useCallback((container: HTMLDivElement, isLarge = false) => {
    // Se já existir uma instância neste container, destrua antes de recriar
    const existingInstance = echarts.getInstanceByDom(container);
    if (existingInstance) {
      existingInstance.dispose();
    }

    const chart = echarts.init(container);
    
    // Obter dimensões atuais (fallback seguro)
    const containerWidth = container.clientWidth || 300;
    const isMobile = containerWidth < 768;

    // Prepara os dados injetando as cores
    const formattedData = data.map((item, index) => ({
      ...item,
      itemStyle: {
        color: item.itemStyle?.color || palette[index % palette.length]
      }
    }));

    const option: any = {
      backgroundColor: 'transparent',
      tooltip: {
        trigger: 'item',
        confine: true,
        formatter: (params: any) => {
          return `
            <div style="padding: 10px 14px; background: ${tokens.textPrimary}; border-radius: 10px; min-width: 180px; box-shadow: none;">
              <div style="font-weight: 700; color: ${tokens.textInverse}; margin-bottom: 6px; font-size: 14px; border-bottom: 1px solid ${tokens.borderSoft}; padding-bottom: 4px;">${params.name}</div>
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
                <span style="color: ${tokens.textMuted}; font-size: 12px;">Valor:</span>
                <span style="color: ${params.color}; font-weight: 700; font-size: 13px;">${params.value.toLocaleString('pt-BR')}</span>
              </div>
              <div style="display: flex; justify-content: space-between; align-items: center;">
                <span style="color: ${tokens.textMuted}; font-size: 12px;">Participação:</span>
                <span style="color: ${params.color}; font-weight: 700; font-size: 13px;">${params.percent}%</span>
              </div>
              ${!isLarge 
                ? '<div style="color: ' + tokens.textMuted + '; font-size: 10px; margin-top: 8px; text-align: center;">Clique para expandir</div>' 
                : '<div style="color: ' + tokens.textMuted + '; font-size: 10px; margin-top: 8px; text-align: center;">Clique na fatia para ver detalhes</div>'
              }
            </div>
          `;
        },
        backgroundColor: 'transparent',
        borderWidth: 0,
        extraCssText: 'box-shadow: none;'
      },
      legend: {
        show: true,
        type: 'scroll', // Permite rolar se houver muitos itens
        orient: 'horizontal', // Horizontal para ficar embaixo
        left: 'center',
        top: 'auto',
        bottom: '0', // Fixado no rodapé do container
        itemWidth: isLarge ? 14 : 10,
        itemHeight: isLarge ? 14 : 10,
        padding: [15, 0, 0, 0], // Espaço entre o gráfico e a legenda
        textStyle: {
          color: tokens.textSecondary,
          fontSize: isLarge ? 14 : 11,
          fontWeight: 500
        },
        formatter: (name: string) => {
          const item = data.find(d => d.name === name);
          // Em card pequeno, trunca nomes muito longos
          if (!isLarge && name.length > 15) return `${name.slice(0, 15)}...`;
          return isLarge ? `${name} (${item?.value})` : name;
        }
      },
      series: [
        {
          name: label,
          type: 'pie',
          // Ajustado radius e center para dar espaço à legenda embaixo
          radius: isLarge ? ['40%', '65%'] : ['45%', '70%'],
          center: ['50%', '42%'], // Movido para cima (42%) para não bater na legenda
          avoidLabelOverlap: true,
          itemStyle: {
            borderRadius: isLarge ? 8 : 4,
            borderColor: tokens.textInverse,
            borderWidth: 2
          },
          label: {
            show: isLarge, // Oculta labels externas no card pequeno
            position: 'outside',
            formatter: '{b}: {d}%',
            color: tokens.textSecondary,
            fontSize: isMobile ? 10 : 12
          },
          emphasis: {
            label: {
              show: true,
              fontSize: isLarge ? 18 : 14,
              fontWeight: 'bold'
            },
            itemStyle: {
              shadowBlur: 10,
              shadowOffsetX: 0,
              shadowColor: tokens.overlay
            }
          },
          data: formattedData
        }
      ]
    };

    chart.setOption(option);

    // Configuração de eventos para gráfico pequeno
    if (!isLarge) {
      chart.getZr().on('click', () => {
        setIsFullscreenModalOpen(true);
      });
      
      chart.getZr().on('mouseover', () => {
        chart.getZr().setCursorStyle('pointer');
      });
    }

    return chart;
  }, [data, label, palette, tokens]);

  // Efeito para o gráfico pequeno (inicial) com ResizeObserver
  useEffect(() => {
    if (!chartRef.current) return;
    
    // Inicializa o gráfico
    chartInstance.current = initChart(chartRef.current, false);

    // Usa ResizeObserver para garantir que o gráfico se ajuste se o container mudar de tamanho
    const resizeObserver = new ResizeObserver(() => {
      if (chartInstance.current) {
        chartInstance.current.resize();
      } else if (chartRef.current) {
        chartInstance.current = initChart(chartRef.current, false);
      }
    });

    resizeObserver.observe(chartRef.current);

    // Listener de resize da janela global também
    const handleWindowResize = () => {
      chartInstance.current?.resize();
    };
    window.addEventListener('resize', handleWindowResize);

    return () => {
      window.removeEventListener('resize', handleWindowResize);
      resizeObserver.disconnect();
      chartInstance.current?.dispose();
      chartInstance.current = null;
    };
  }, [initChart]);

  // Efeito para o gráfico em Fullscreen
  useEffect(() => {
    if (isFullscreenModalOpen && fullscreenChartRef.current) {
      // Timeout garante que o elemento do modal existe no DOM
      const timeoutId = setTimeout(() => {
        if (!fullscreenChartRef.current) return;
        
        fullscreenInstance.current = initChart(fullscreenChartRef.current, true);
        
        if (fullscreenInstance.current) {
          // Evento de clique na fatia
          fullscreenInstance.current.on('click', (params: any) => {
            if (params.componentType === 'series' && params.data && params.data.data && params.data.data.length > 0) {
              setModalData(params.data.data);
              setModalTitle(`${label} - ${params.name}`);
              setIsFullscreenModalOpen(false);
              setTimeout(() => setIsModalOpen(true), 300);
            }
          });
        }

        const handleResize = () => fullscreenInstance.current?.resize();
        window.addEventListener('resize', handleResize);
        
        // ResizeObserver também para o modal
        const resizeObserver = new ResizeObserver(() => {
           fullscreenInstance.current?.resize();
        });
        resizeObserver.observe(fullscreenChartRef.current);

        return () => {
          window.removeEventListener('resize', handleResize);
          resizeObserver.disconnect();
          fullscreenInstance.current?.dispose();
        };
      }, 100);

      return () => clearTimeout(timeoutId);
    }
  }, [isFullscreenModalOpen, initChart, label]);

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
      <div className="bg-surface rounded-xl p-4 border border-ui-border-soft shadow-sm hover:shadow-md transition-all duration-300 hover:border-brand group h-full flex flex-col">
        <div className="flex justify-between items-center mb-2">
          <h3 className="text-base font-semibold text-content text-start truncate">
            {label}
          </h3>
          
          <div className="flex gap-1">
            <button
              onClick={() => setIsFullscreenModalOpen(true)}
              className="p-1.5 rounded-md text-content-muted hover:text-content-secondary hover:bg-surface-subtle transition-colors"
              title="Expandir gráfico"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3" />
              </svg>
            </button>
            
            {allDetailData.length > 0 && (
              <button
                onClick={(e) => {
                  setModalData(allDetailData);
                  setModalTitle(`${label} - Geral`);
                  setIsModalOpen(true);
                  e.stopPropagation();
                }}
                className="p-1.5 rounded-md text-content-muted hover:text-content-secondary hover:bg-surface-subtle transition-colors"
                title="Ver todos os dados"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20" />
                  <path d="M9 10h6" />
                  <path d="M9 14h6" />
                </svg>
              </button>
            )}
          </div>
        </div>

        {/* Container do Gráfico: min-h garante que ele não colapse */}
        <div 
          className="relative flex-1 w-full min-h-[220px] cursor-pointer"
          onClick={() => setIsFullscreenModalOpen(true)}
          title="Clique para expandir"
        >
          <div ref={chartRef} className="w-full h-full absolute inset-0" />
        </div>
      </div>

      {/* Modal de Tabela de Dados */}
      <DataModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={modalTitle}
        data={modalData}
        columns={detailColumns.length > 0 ? detailColumns : [
          { key: "title", label: "Título" },
          { key: "type", label: "Tipo" },
          { key: "value", label: "Valor", format: (v: any) => v?.toLocaleString("pt-BR") }
        ]}
      />

      {/* Modal Fullscreen do Gráfico */}
      {isFullscreenModalOpen && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center bg-layer-overlay-strong p-2 sm:p-4"
          onClick={() => setIsFullscreenModalOpen(false)}
        >
          <div 
            className="bg-surface rounded-xl w-full max-w-6xl h-[90vh] sm:h-[85vh] flex flex-col shadow-2xl mx-2 sm:mx-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center p-4 sm:p-6 border-b border-ui-border-soft gap-3 sm:gap-0">
              <div className="w-full sm:w-auto">
                <h2 className="text-xl sm:text-2xl font-bold text-content">{label}</h2>
                <p className="text-content-muted text-sm mt-1">Clique em uma fatia para ver os detalhes específicos</p>
              </div>
              
              <div className="flex flex-wrap gap-2 w-full sm:w-auto justify-end">
                {allDetailData.length > 0 && (
                  <button
                    onClick={handleOpenAllData}
                    className="px-3 sm:px-4 py-2 bg-brand text-content-inverse rounded-lg hover:bg-brand-hover transition-colors flex items-center gap-2 text-sm font-medium w-full sm:w-auto justify-center"
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20" />
                      <path d="M9 10h6" />
                      <path d="M9 14h6" />
                    </svg>
                    Ver Todos os Dados
                  </button>
                )}
                
                <button
                  onClick={() => setIsFullscreenModalOpen(false)}
                  className="p-2 rounded-lg hover:bg-surface-subtle transition-colors text-content-muted hover:text-content-secondary"
                  title="Fechar"
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <line x1="18" y1="6" x2="6" y2="18" />
                    <line x2="18" y2="18" x1="6" y1="6" />
                  </svg>
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
