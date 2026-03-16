'use client';

import ReactECharts from 'echarts-for-react';
import { useMemo } from 'react';

interface BollData {
  date: string;
  close: number;
  boll_upper: number | null;
  boll_middle: number | null;
  boll_lower: number | null;
}

interface BollChartProps {
  data: BollData[];
  height?: number;
}

export function BollChart({ data, height = 250 }: BollChartProps) {
  const option = useMemo(() => {
    if (!data || data.length === 0) {
      return {};
    }

    const dates = data.map(item => item.date);
    const close = data.map(item => item.close);
    const upper = data.map(item => item.boll_upper);
    const middle = data.map(item => item.boll_middle);
    const lower = data.map(item => item.boll_lower);

    return {
      animation: false,
      legend: {
        data: ['收盘价', '上轨', '中轨', '下轨'],
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
          name: '收盘价',
          type: 'line',
          data: close,
          smooth: true,
          lineStyle: { width: 2 },
          symbol: 'none',
          itemStyle: { color: '#1E88E5' },
        },
        {
          name: '上轨',
          type: 'line',
          data: upper,
          smooth: true,
          lineStyle: { width: 1, type: 'dashed' },
          symbol: 'none',
          itemStyle: { color: '#ef5350' },
        },
        {
          name: '中轨',
          type: 'line',
          data: middle,
          smooth: true,
          lineStyle: { width: 1 },
          symbol: 'none',
          itemStyle: { color: '#FFA726' },
        },
        {
          name: '下轨',
          type: 'line',
          data: lower,
          smooth: true,
          lineStyle: { width: 1, type: 'dashed' },
          symbol: 'none',
          itemStyle: { color: '#26a69a' },
          areaStyle: {
            color: {
              type: 'linear',
              x: 0,
              y: 0,
              x2: 0,
              y2: 1,
              colorStops: [
                { offset: 0, color: 'rgba(38, 166, 154, 0.1)' },
                { offset: 1, color: 'rgba(38, 166, 154, 0.05)' },
              ],
            },
          },
        },
      ],
    };
  }, [data]);

  if (!data || data.length === 0) {
    return (
      <div className="flex items-center justify-center h-[250px] bg-muted/30 rounded-lg">
        <p className="text-muted-foreground">暂无布林带数据</p>
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
