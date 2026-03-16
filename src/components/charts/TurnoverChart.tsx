'use client';

import ReactECharts from 'echarts-for-react';
import { useMemo } from 'react';

interface TurnoverData {
  date: string;
  turn: number | null;
}

interface TurnoverChartProps {
  data: TurnoverData[];
  height?: number;
}

export function TurnoverChart({ data, height = 200 }: TurnoverChartProps) {
  const option = useMemo(() => {
    if (!data || data.length === 0) {
      return {};
    }

    const dates = data.map(item => item.date);
    const turnover = data.map(item => item.turn || 0);

    return {
      animation: false,
      legend: {
        data: ['换手率'],
        bottom: 10,
      },
      tooltip: {
        trigger: 'axis',
        axisPointer: {
          type: 'shadow',
        },
        backgroundColor: 'rgba(0, 0, 0, 0.8)',
        borderColor: '#333',
        textStyle: {
          color: '#fff',
        },
        formatter: (params: any) => {
          if (!params || params.length === 0) return '';
          const item = params[0];
          return `
            <div style="padding: 8px;">
              <div style="font-weight: bold; margin-bottom: 4px;">${item.name}</div>
              <div>换手率: ${item.value?.toFixed(2)}%</div>
            </div>
          `;
        },
      },
      grid: {
        left: '10%',
        right: '8%',
        top: '5%',
        bottom: '20%',
      },
      xAxis: {
        type: 'category',
        data: dates,
        axisLine: { onZero: false },
        splitLine: { show: false },
        min: 'dataMin',
        max: 'dataMax',
      },
      yAxis: {
        type: 'value',
        name: '%',
        splitArea: {
          show: true,
        },
      },
      dataZoom: [
        {
          type: 'inside',
          start: 70,
          end: 100,
        },
        {
          show: true,
          type: 'slider',
          bottom: '5%',
          start: 70,
          end: 100,
        },
      ],
      series: [
        {
          name: '换手率',
          type: 'bar',
          data: turnover,
          itemStyle: {
            color: {
              type: 'linear',
              x: 0,
              y: 0,
              x2: 0,
              y2: 1,
              colorStops: [
                { offset: 0, color: '#9C27B0' },
                { offset: 1, color: '#CE93D8' },
              ],
            },
          },
        },
      ],
    };
  }, [data]);

  if (!data || data.length === 0) {
    return (
      <div className="flex items-center justify-center h-[200px] bg-muted/30 rounded-lg">
        <p className="text-muted-foreground">暂无换手率数据</p>
      </div>
    );
  }

  return (
    <ReactECharts
      option={option}
      style={{ height: `${height}px`, width: '100%' }}
      opts={{ renderer: 'canvas' }}
    />
  );
}
