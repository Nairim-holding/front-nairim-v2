/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import * as echarts from "echarts";
import DataModal from "../DataModal";
import { MetricDataItem } from "@/types/types";
import { useTheme } from "@/contexts/ThemeContext";
import { getThemeTokens } from "@/utils";

interface GaugeCardProps {
  value: number;
  max?: number;
  label?: string;
  color?: string;
  loading?: boolean;
  detailData?: MetricDataItem[];
  detailColumns?: Array<{ key: string; label: string; format?: (value: any) => string }>;
  /** Quando informado, a barra do título vira a alça de arrastar (mesmo padrão do ChartCard). */
  dragHandleClassName?: string;
}

export default function EChartsGauge({
  value,
  max = 100,
  label = "",
  color,
  detailData = [],
  detailColumns = [],
  dragHandleClassName,
}: GaugeCardProps) {
  const chartRef = useRef<HTMLDivElement>(null);
  const gaugeChartRef = useRef<HTMLDivElement>(null);
  const gaugeChartInstance = useRef<echarts.ECharts | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isFullscreenModalOpen, setIsFullscreenModalOpen] = useState(false);
  const chartInstance = useRef<echarts.ECharts | null>(null);
  useTheme();
  const tokens = getThemeTokens();

  const percentage = Math.min(Math.max(value / max, 0), 1) * 100;
  const gaugeColor = color || tokens.brandPrimary;

  const buildOption = useCallback((container: HTMLDivElement, isLarge = false): echarts.EChartsOption => {
    // Calcular dimensões responsivas baseadas no tamanho do container
    const containerWidth = container.clientWidth;
    const containerHeight = container.clientHeight;
    const isMobile = containerWidth < 768;

    // Geometria em pixels (não porcentagem): o gauge é um semicírculo (180°→0°,
    // só a metade de cima é desenhada), mas raio/centro em "%" do ECharts usam
    // min(largura, altura) do container como base — num card mais largo que
    // alto (o caso comum aqui), isso faz o raio ficar maior que a altura
    // disponível e o topo do arco fica cortado para fora do card. Calculando
    // o raio e o centro em pixels a partir das dimensões reais, o arco sempre
    // cabe: limitado pela metade da largura (não estoura os lados) e pela
    // altura menos o espaço reservado para o rótulo do percentual (não estoura
    // em cima nem embaixo).
    // No card compacto (mesma altura dos widgets numéricos vizinhos) o rótulo
    // de percentual fica ancorado bem no centro do semicírculo (offsetCenter
    // '0%', em cima da própria linha do diâmetro) — não embaixo do arco — por
    // isso só precisa de um respiro pequeno, não os ~110px reservados na
    // versão em tela cheia (onde o rótulo tem espaço próprio abaixo do arco).
    const detailSpace = isLarge ? (isMobile ? 90 : 110) : 14;
    const topPadding = isLarge ? 10 : 4;
    const sidePadding = isLarge ? 20 : 4;
    const maxRadiusByWidth = containerWidth / 2 - sidePadding;
    const maxRadiusByHeight = containerHeight - topPadding - detailSpace;
    // Teto no card compacto: sem ele o raio acompanha o container, e num widget
    // largo (w6 h8, a par dos gráficos de rosca) o arco vira um semicírculo
    // gigante — com a espessura em radius*0.32, a faixa sozinha passa de 100px.
    // Em tela cheia não há teto: ali o gauge é o conteúdo principal.
    const maxCompactRadius = 140;
    const radius = Math.max(
      24,
      Math.min(maxRadiusByWidth, maxRadiusByHeight, isLarge ? Infinity : maxCompactRadius)
    );
    const centerX = containerWidth / 2;
    // Com o raio no teto sobra altura no card; centraliza o conjunto
    // (semicírculo + rótulo) em vez de deixá-lo grudado no topo.
    const usedHeight = topPadding + radius + detailSpace;
    const verticalSlack = Math.max(0, (containerHeight - usedHeight) / 2);
    const centerY = topPadding + radius + verticalSlack;

    return {
      backgroundColor: 'transparent',
      tooltip: {
        trigger: 'item',
        formatter: `<div style="padding: 8px 12px; background: ${tokens.textPrimary}; border-radius: 8px; border-left: 4px solid ${gaugeColor}; min-width: 180px;">
          <div style="font-weight: 600; color: ${tokens.textInverse}; margin-bottom: 6px; font-size: 14px;">${label}</div>
          <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
            <span style="color: ${tokens.textSecondary}; font-size: 13px;">Percentual:</span>
            <span style="color: ${gaugeColor}; font-weight: 600; font-size: 13px;">${percentage.toFixed(1)}%</span>
          </div>
          <div style="display: flex; justify-content: space-between;">
            <span style="color: ${tokens.textSecondary}; font-size: 13px;">Valor:</span>
            <span style="color: ${gaugeColor}; font-weight: 600; font-size: 13px;">${value.toFixed(2)}/${max}</span>
          </div>
          <div style="color: ${tokens.textMuted}; font-size: 12px; margin-top: 6px; padding-top: 6px; border-top: 1px solid ${tokens.borderSoft};">
            Clique no percentual para ver detalhes
          </div>
        </div>`,
        backgroundColor: 'transparent',
        borderWidth: 0,
        extraCssText: 'box-shadow: none;',
        textStyle: {
          color: tokens.textInverse
        }
      },
      series: [
        {
          type: 'gauge',
          radius,
          center: [centerX, centerY],
          startAngle: 180,
          endAngle: 0,
          min: 0,
          max: max,
          splitNumber: isLarge ? 10 : 0,
          axisLine: {
            lineStyle: {
              width: isLarge ? (isMobile ? 20 : 25) : Math.max(10, Math.round(radius * 0.32)),
              color: [
                [percentage / 100, gaugeColor],
                [1, tokens.borderSoft]
              ],
              shadowColor: tokens.overlay,
              shadowBlur: 4
            }
          },
          progress: {
            show: true,
            width: isLarge ? (isMobile ? 20 : 25) : Math.max(10, Math.round(radius * 0.32)),
            itemStyle: {
              color: gaugeColor,
              shadowColor: gaugeColor,
              shadowBlur: 6
            }
          },
          pointer: {
            show: isLarge,
            length: isLarge ? (isMobile ? '70%' : '75%') : '65%',
            width: isLarge ? (isMobile ? 4 : 5) : 4,
            itemStyle: {
              color: tokens.textPrimary,
              shadowColor: tokens.overlay,
              shadowBlur: 2
            }
          },
          axisTick: {
            show: isLarge,
            distance: isLarge ? (isMobile ? -30 : -35) : -35,
            length: isLarge ? (isMobile ? 5 : 6) : 6,
            splitNumber: isLarge ? (isMobile ? 5 : 10) : 10,
            lineStyle: {
              color: tokens.textMuted,
              width: 1
            }
          },
          splitLine: {
            show: isLarge,
            distance: isLarge ? (isMobile ? -35 : -40) : -40,
            length: isLarge ? (isMobile ? 8 : 10) : 10,
            lineStyle: {
              color: tokens.textMuted,
              width: 2
            }
          },
          axisLabel: {
            show: isLarge,
            distance: isLarge ? (isMobile ? -25 : -28) : -28,
            color: tokens.textMuted,
            fontSize: isLarge ? (isMobile ? 10 : 12) : 12,
            formatter: (val: number) => `${val}`
          },
          anchor: {
            show: isLarge,
            size: 5,
            itemStyle: {
              borderWidth: 2,
              borderColor: gaugeColor
            }
          },
          title: {
            show: false
          },
          detail: {
            show: true,
            valueAnimation: true,
            formatter: '{value}%',
            color: gaugeColor,
            fontSize: isLarge ? (isMobile ? 22 : 28) : 11,
            fontWeight: 'bold',
            offsetCenter: [0, isLarge ? (isMobile ? '10%' : '5%') : '0%'],
            backgroundColor: isLarge ? 'transparent' : tokens.bgSurface,
            borderColor: isLarge ? 'transparent' : gaugeColor,
            borderWidth: isLarge ? 0 : 1,
            borderRadius: isLarge ? 0 : 6,
            padding: isLarge ? 0 : [1, 3],
            shadowColor: isLarge ? 'transparent' : tokens.overlay,
            shadowBlur: isLarge ? 0 : 6,
            // Adicionando estilo de cursor pointer para indicar que é clicável
            ...(!isLarge && {
              extraCssText: 'cursor: pointer;'
            })
          },
          data: [
            {
              value: percentage
            }
          ]
        }
      ]
    };
  }, [value, max, label, gaugeColor, percentage, tokens]);

  const initChart = useCallback((container: HTMLDivElement, isLarge = false) => {
    const chart = echarts.init(container);
    chart.setOption(buildOption(container, isLarge));

    // Adicionar evento de clique no detalhe (porcentagem) apenas para gráfico pequeno
    if (!isLarge) {
      chart.on('click', (params: any) => {
        if (params.componentType === 'series' && params.seriesType === 'gauge') {
          if (params.dataIndex === 0 && detailData && detailData.length > 0) {
            setIsModalOpen(true);
          }
        }
      });

      // Mudar cursor quando passar sobre a porcentagem
      chart.getZr().on('mouseover', (params: any) => {
        if (params.target && params.target.style) {
          const style = params.target.style;
          if (style.text === `${percentage.toFixed(1)}%`) {
            chart.getZr().setCursorStyle('pointer');
          }
        }
      });

      chart.getZr().on('mouseout', () => {
        chart.getZr().setCursorStyle('default');
      });
    }

    return chart;
  }, [buildOption, percentage, detailData]);

  useEffect(() => {
    if (!chartRef.current) return;
    const chart = initChart(chartRef.current);
    chartInstance.current = chart;

    // Raio/centro são calculados em pixels a partir do tamanho real do
    // container (ver buildOption) — diferente de valores em "%", eles não se
    // reajustam sozinhos num chart.resize() simples, então todo resize recalcula
    // a geometria e reaplica via setOption antes de redimensionar o canvas.
    const recalcAndResize = () => {
      if (!chartRef.current) return;
      chart.setOption(buildOption(chartRef.current, false));
      chart.resize();
    };

    window.addEventListener('resize', recalcAndResize);

    // ResizeObserver além do listener de window: dentro do grid arrastável,
    // a célula pode mudar de tamanho sem que a janela do navegador redimensione
    // (redimensionar o widget, reflow do grid, layout ainda não estabilizado no
    // primeiro paint) — sem isso o gauge fica com o tamanho errado/cortado.
    const resizeObserver = new ResizeObserver(recalcAndResize);
    resizeObserver.observe(chartRef.current);

    return () => {
      window.removeEventListener('resize', recalcAndResize);
      resizeObserver.disconnect();
      chart.dispose();
      chartInstance.current = null;
    };
  }, [initChart, buildOption]);

  useEffect(() => {
    if (isFullscreenModalOpen && gaugeChartRef.current) {
      gaugeChartInstance.current = initChart(gaugeChartRef.current, true);

      gaugeChartInstance.current.on('click', (params: any) => {
        if (params.componentType === 'series' && params.seriesType === 'gauge') {
          if (params.dataIndex === 0 && detailData && detailData.length > 0) {
            setIsFullscreenModalOpen(false);
            setTimeout(() => setIsModalOpen(true), 300);
          }
        }
      });

      const handleResizeModal = () => {
        if (gaugeChartInstance.current && gaugeChartRef.current) {
          gaugeChartInstance.current.setOption(buildOption(gaugeChartRef.current, true));
          gaugeChartInstance.current.resize();
        }
      };
      window.addEventListener('resize', handleResizeModal);

      // Igual ao gráfico compacto: o modal abre via portal/animação e o container
      // só assume seu tamanho final depois do primeiro paint — sem observar isso,
      // o gauge calcula raio/centro em cima de dimensões momentâneas (0 ou o
      // tamanho anterior da transição), resultando no gauge minúsculo e
      // deslocado. O ResizeObserver recalcula assim que o layout se estabiliza.
      const resizeObserver = new ResizeObserver(handleResizeModal);
      resizeObserver.observe(gaugeChartRef.current);

      return () => {
        window.removeEventListener('resize', handleResizeModal);
        resizeObserver.disconnect();
        if (gaugeChartInstance.current) {
          gaugeChartInstance.current.dispose();
        }
      };
    }
  }, [isFullscreenModalOpen, initChart, buildOption, detailData]);

  const handleChartClick = (e: React.MouseEvent) => {
    if (!detailData || detailData.length === 0) return;
    
    const rect = chartRef.current?.getBoundingClientRect();
    if (!rect) return;
    
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const centerX = rect.width / 2;
    const centerY = rect.height / 2 * 0.6; // Ajustado para onde está o texto
    const distance = Math.sqrt(Math.pow(x - centerX, 2) + Math.pow(y - centerY, 2));
    
    if (distance < 50) {
      setIsModalOpen(true);
      return;
    }
    
    setIsFullscreenModalOpen(true);
  };

  return (
    <>
      {/* Card do Gauge — mesmas classes de moldura do NumericCard (rounded-lg,
          shadow-chart, border-ui-border-strong) para os dois seguirem o mesmo
          padrão visual entre os widgets legados do portfólio. */}
      <div className="p-4 bg-surface rounded-lg shadow-chart border border-ui-border-strong group hover:shadow-lg transition-all duration-300 h-full flex flex-col">
        <div className={`flex justify-between items-center mb-2 shrink-0 ${dragHandleClassName ? `${dragHandleClassName} cursor-move` : ''}`}>
          <h3 className="text-lg text-content-secondary text-start truncate">
            {label}
          </h3>

          <div className="flex gap-1" onMouseDown={(e) => e.stopPropagation()}>
            <button
              onClick={() => setIsFullscreenModalOpen(true)}
              className="p-1.5 rounded-md text-content-muted hover:text-content-secondary hover:bg-surface-subtle transition-colors"
              title="Expandir gráfico"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3" />
              </svg>
            </button>

            {detailColumns && detailColumns.length > 0 && (
              <button
                onClick={() => setIsModalOpen(true)}
                className="p-1.5 rounded-md text-content-muted hover:text-content-secondary hover:bg-surface-subtle transition-colors"
                title="Ver dados detalhados"
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

        {/* Container do gráfico: preenche o espaço restante do card (em vez de
            altura fixa), para acompanhar o tamanho real da célula do grid. */}
        <div
          className="relative flex-1 min-h-0 cursor-pointer hover:opacity-90 transition-opacity flex items-center justify-center"
          onClick={handleChartClick}
          title="Clique para expandir o gráfico | Clique no percentual para ver detalhes"
        >
          <div ref={chartRef} className="w-full h-full" />
        </div>
      </div>

      {/* Modal de Detalhes */}
      <DataModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={`Detalhes - ${label}`}
        data={detailData}
        columns={detailColumns}
      />

      {/* Modal Fullscreen do Gauge - Responsivo. Via portal para document.body:
          este card vive dentro do grid arrastável (react-grid-layout), que
          posiciona os widgets com CSS transform — um transform em um ancestral
          vira o "containing block" de qualquer descendente position:fixed, então
          sem portal esse modal ficava preso/ancorado ao canto do card em vez de
          cobrir a tela inteira (mesmo padrão já usado no ChartCard e no DataModal). */}
      {isFullscreenModalOpen && typeof document !== 'undefined' && createPortal(
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-layer-overlay-strong p-2 sm:p-4"
          onClick={() => setIsFullscreenModalOpen(false)}
        >
          <div
            className="bg-surface rounded-xl w-full max-w-6xl h-[90vh] sm:h-[85vh] flex flex-col shadow-2xl mx-2 sm:mx-4 overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center p-4 sm:p-6 border-b border-ui-border-soft gap-3 sm:gap-0">
              <div className="w-full sm:w-auto">
                <h2 className="text-xl sm:text-2xl font-bold text-content">{label}</h2>
              </div>
              
              <div className="flex flex-wrap gap-2 w-full sm:w-auto justify-end">
                {detailData && detailData.length > 0 && (
                  <button
                    onClick={() => {
                      setIsFullscreenModalOpen(false);
                      setTimeout(() => setIsModalOpen(true), 300);
                    }}
                    className="px-3 sm:px-4 py-2 bg-brand text-content-inverse rounded-lg hover:bg-brand-hover transition-colors flex items-center gap-2 text-sm font-medium w-full sm:w-auto justify-center"
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20" />
                      <path d="M9 10h6" />
                      <path d="M9 14h6" />
                    </svg>
                    Ver Dados
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

            {/* min-h-0: por padrão um item flex não encolhe abaixo do tamanho do
                conteúdo (min-height:auto) — sem isso, o container do gráfico
                cresce para caber o próprio canvas do ECharts, que por sua vez é
                redimensionado para caber o container, num loop que estourava a
                altura do card muito além dos 85vh (o gauge "vazava" para fora do
                modal). min-h-0 força o container a respeitar o espaço restante
                do flex column em vez do inverso. */}
            <div className="flex-1 min-h-0 p-4 sm:p-6 md:p-8">
              <div ref={gaugeChartRef} className="w-full h-full" />
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  );
}
