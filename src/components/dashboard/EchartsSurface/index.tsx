'use client';

import { useEffect, useRef } from 'react';
import * as echarts from 'echarts';

interface EchartsSurfaceProps {
  isFullscreen: boolean;
  isLoading?: boolean;
  buildOption: (isLarge: boolean) => echarts.EChartsOption;
}

/**
 * Ciclo de vida comum a todo gráfico echarts usado dentro de um ChartCard:
 * init/dispose por montagem, resize via ResizeObserver + window resize.
 * Cada instância (normal vs. tela cheia) tem seu próprio container e chart.
 */
export default function EchartsSurface({ isFullscreen, isLoading, buildOption }: EchartsSurfaceProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const instanceRef = useRef<echarts.ECharts | null>(null);

  useEffect(() => {
    if (!containerRef.current || isLoading) return;

    const existing = echarts.getInstanceByDom(containerRef.current);
    if (existing) existing.dispose();

    const chart = echarts.init(containerRef.current);
    chart.setOption(buildOption(isFullscreen));
    instanceRef.current = chart;

    const resizeObserver = new ResizeObserver(() => instanceRef.current?.resize());
    resizeObserver.observe(containerRef.current);
    const handleWindowResize = () => instanceRef.current?.resize();
    window.addEventListener('resize', handleWindowResize);

    return () => {
      window.removeEventListener('resize', handleWindowResize);
      resizeObserver.disconnect();
      instanceRef.current?.dispose();
      instanceRef.current = null;
    };
  }, [buildOption, isFullscreen, isLoading]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full text-content-muted text-sm">
        Carregando...
      </div>
    );
  }

  return <div ref={containerRef} className="w-full h-full absolute inset-0" />;
}
