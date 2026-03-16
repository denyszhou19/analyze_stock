'use client';

import ReactECharts from 'echarts-for-react';
import { useMemo } from 'react';

interface MacdData {
  date: string;
  macd: number | null;
  macd_signal: number | null;
  macd_hist: number | null;
}

interface MacdChartProps {
  data: MacdData[];
  height?: number;
}

export function MacdChart({ data, height = 220 }: MacdChartProps) {
  const option = useMemo(() => {
    if (!data || data.length === 0) {
      return {};
    }

    const dates = data.map(item => item.date);
    const macd = data.map(item => item.macd);
    const signal = data.map(item => item.macd_signal);
    const hist = data.map(item => item.macd_hist);

    return {
      animation: false,
      legend: {
        data: ['MACD', 'Signal', 'Histogram'],
        top: 5,
        left: 'center',
        textStyle: { fontSize: 11 },
        itemWidth: 15,
        itemHeight: 10,
      },
      tooltip: {
        trigger: 'axis',
        axisPointer: {
          type: 'cross',
        },
        backgroundColor: 'rgba(0, 0, 0, 0.8)',
        borderColor: '#333',
        textStyle: { color: '#fff', fontSize: 11 },
      },
      grid: {
        left: '8%',
        right: '3%',
        top: '18%',
        bottom: '22%',
      },
      xAxis: {
        type: 'category',
        data: dates,
        boundaryGap: false,
        axisLine: { onZero: false },
        splitLine: { show: false },
        axisLabel: {
          fontSize: 10,
          interval: (index: number) => {
            const total = dates.length;
            if (total <= 10) return true;
            if (total <= 30) return index % 5 === 0;
            if (total <= 60) return index % 10 === 0;
            return index % Math.ceil(total / 8) === 0;
          },
          rotate: 0,
          formatter: (value: string) => {
            if (value.includes(' ')) {
              const parts = value.split(' ');
              const datePart = parts[0].substring(5);
              const timePart = parts[1].substring(0, 5);
              return `${datePart}\n${timePart}`;
            }
            return value.substring(5);
          },
        },
        min: 'dataMin',
        max: 'dataMax',
      },
      yAxis: {
        scale: true,
        splitLine: { lineStyle: { type: 'dashed', color: '#e0e0e0' } },
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
          bottom: 10,
          height: 20,
          start: 70,
          end: 100,
          borderColor: '#ccc',
          fillerColor: 'rgba(144, 164, 174, 0.2)',
          handleStyle: { color: '#90A4AE' },
          textStyle: { fontSize: 10 },
        },
      ],
      series: [
        {
          name: 'MACD',
          type: 'line',
          data: macd,
          smooth: true,
          lineStyle: { width: 1 },
          symbol: 'none',
          itemStyle: { color: '#2196F3' },
        },
        {
          name: 'Signal',
          type: 'line',
          data: signal,
          smooth: true,
          lineStyle: { width: 1 },
          symbol: 'none',
          itemStyle: { color: '#FF9800' },
        },
        {
          name: 'Histogram',
          type: 'bar',
          data: hist,
          itemStyle: {
            color: (params: any) => {
              const value = params.value;
              if (value === null || value === undefined) return '#666';
              return value >= 0 ? '#ef5350' : '#26a69a';
            },
          },
        },
      ],
    };
  }, [data]);

  if (!data || data.length === 0) {
    return (
      <div className="flex items-center justify-center h-[220px] bg-muted/30 rounded-lg">
        <p className="text-muted-foreground">暂无 MACD 数据</p>
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
