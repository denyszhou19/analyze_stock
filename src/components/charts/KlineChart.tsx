'use client';

import ReactECharts from 'echarts-for-react';
import { useMemo, useEffect, useState } from 'react';

interface KlineData {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  amount: number;
  turn?: number | null;
  pctChg?: number | null;
  ma5?: number | null;
  ma20?: number | null;
  ma55?: number | null;
  ma233?: number | null;
  macd?: number | null;
  macd_signal?: number | null;
  macd_hist?: number | null;
  boll_upper?: number | null;
  boll_middle?: number | null;
  boll_lower?: number | null;
}

interface KlineChartProps {
  data: KlineData[];
  showMA?: boolean;
  height?: number;
}

export function KlineChart({ data, showMA = true, height = 700 }: KlineChartProps) {
  // 响应式高度
  const [chartHeight, setChartHeight] = useState(height);
  
  useEffect(() => {
    const updateHeight = () => {
      const width = window.innerWidth;
      if (width < 640) {
        // 移动端
        setChartHeight(Math.min(500, height * 0.7));
      } else if (width < 768) {
        // 平板
        setChartHeight(Math.min(600, height * 0.85));
      } else {
        setChartHeight(height);
      }
    };
    
    updateHeight();
    window.addEventListener('resize', updateHeight);
    return () => window.removeEventListener('resize', updateHeight);
  }, [height]);

  const option = useMemo(() => {
    if (!data || data.length === 0) {
      return {};
    }

    // 分离数据
    const dates = data.map(item => item.date);
    const ohlc = data.map(item => [item.open, item.close, item.low, item.high]);
    const volumes = data.map(item => item.volume);
    
    // 均线数据
    const ma5 = data.map(item => item.ma5);
    const ma20 = data.map(item => item.ma20);
    const ma55 = data.map(item => item.ma55);
    const ma233 = data.map(item => item.ma233);
    
    // MACD 数据
    const macd = data.map(item => item.macd);
    const macdSignal = data.map(item => item.macd_signal);
    const macdHist = data.map(item => item.macd_hist);
    
    // 布林带数据
    const bollUpper = data.map(item => item.boll_upper);
    const bollMiddle = data.map(item => item.boll_middle);
    const bollLower = data.map(item => item.boll_lower);
    const closePrice = data.map(item => item.close);

    // X 轴标签间隔计算
    const getAxisLabelInterval = () => {
      const total = dates.length;
      if (total <= 10) return 0;
      if (total <= 30) return 4;
      if (total <= 60) return 9;
      return Math.ceil(total / 8) - 1;
    };

    // 日期格式化
    const formatDate = (value: string) => {
      if (value.includes(' ')) {
        const parts = value.split(' ');
        const datePart = parts[0].substring(5);
        const timePart = parts[1].substring(0, 5);
        return `${datePart}\n${timePart}`;
      }
      return value.substring(5);
    };

    return {
      animation: false,
      legend: {
        data: [
          'K线',
          ...(showMA ? ['MA5', 'MA20', 'MA55', 'MA233'] : []),
          '成交量',
          'MACD', 'Signal', 'Histogram',
          '收盘价', '上轨', '中轨', '下轨',
        ],
        top: 5,
        left: 'center',
        textStyle: { fontSize: 11 },
        itemWidth: 15,
        itemHeight: 10,
      },
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'cross' },
        backgroundColor: 'rgba(0, 0, 0, 0.85)',
        borderColor: '#333',
        textStyle: { color: '#fff', fontSize: 12 },
        formatter: function (params: any) {
          const dataIndex = params[0].dataIndex;
          const item = data[dataIndex];
          const change = item.open ? ((item.close - item.open) / item.open * 100).toFixed(2) : '0.00';
          const changeColor = item.close >= item.open ? '#ef5350' : '#26a69a';
          
          let tooltip = `
            <div style="padding: 8px; min-width: 180px;">
              <div style="font-weight: bold; margin-bottom: 8px; border-bottom: 1px solid #444; padding-bottom: 4px;">${item.date}</div>
              <div style="display: flex; justify-content: space-between; margin: 2px 0;">
                <span>开盘:</span>
                <span style="color: ${changeColor}">${item.open.toFixed(2)}</span>
              </div>
              <div style="display: flex; justify-content: space-between; margin: 2px 0;">
                <span>收盘:</span>
                <span style="color: ${changeColor}">${item.close.toFixed(2)}</span>
              </div>
              <div style="display: flex; justify-content: space-between; margin: 2px 0;">
                <span>最高:</span>
                <span style="color: #ef5350">${item.high.toFixed(2)}</span>
              </div>
              <div style="display: flex; justify-content: space-between; margin: 2px 0;">
                <span>最低:</span>
                <span style="color: #26a69a">${item.low.toFixed(2)}</span>
              </div>
              <div style="display: flex; justify-content: space-between; margin: 2px 0;">
                <span>涨跌:</span>
                <span style="color: ${changeColor}">${change}%</span>
              </div>
              <div style="display: flex; justify-content: space-between; margin: 2px 0;">
                <span>成交量:</span>
                <span>${(item.volume / 10000).toFixed(2)}万</span>
              </div>
              <div style="display: flex; justify-content: space-between; margin: 2px 0;">
                <span>成交额:</span>
                <span>${(item.amount / 100000000).toFixed(2)}亿</span>
              </div>`;
          
          if (item.turn !== null && item.turn !== undefined) {
            tooltip += `
              <div style="display: flex; justify-content: space-between; margin: 2px 0;">
                <span>换手率:</span>
                <span>${item.turn.toFixed(2)}%</span>
              </div>`;
          }
          
          // MACD 信息
          if (item.macd !== null && item.macd !== undefined) {
            tooltip += `
              <div style="border-top: 1px solid #444; margin-top: 6px; padding-top: 6px;">
                <div style="display: flex; justify-content: space-between; margin: 2px 0;">
                  <span>MACD:</span>
                  <span style="color: #2196F3">${item.macd.toFixed(4)}</span>
                </div>
                <div style="display: flex; justify-content: space-between; margin: 2px 0;">
                  <span>Signal:</span>
                  <span style="color: #FF9800">${(item.macd_signal || 0).toFixed(4)}</span>
                </div>
              </div>`;
          }
          
          // 布林带信息
          if (item.boll_upper !== null && item.boll_upper !== undefined) {
            tooltip += `
              <div style="border-top: 1px solid #444; margin-top: 6px; padding-top: 6px;">
                <div style="display: flex; justify-content: space-between; margin: 2px 0;">
                  <span>布林上轨:</span>
                  <span style="color: #ef5350">${item.boll_upper.toFixed(2)}</span>
                </div>
                <div style="display: flex; justify-content: space-between; margin: 2px 0;">
                  <span>布林中轨:</span>
                  <span style="color: #FFA726">${(item.boll_middle || 0).toFixed(2)}</span>
                </div>
                <div style="display: flex; justify-content: space-between; margin: 2px 0;">
                  <span>布林下轨:</span>
                  <span style="color: #26a69a">${(item.boll_lower || 0).toFixed(2)}</span>
                </div>
              </div>`;
          }
          
          tooltip += `</div>`;
          return tooltip;
        },
      },
      axisPointer: {
        link: [{ xAxisIndex: 'all' }],
      },
      // 四个区域：K线(35%)、成交量(15%)、MACD(20%)、布林带(20%)
      grid: [
        {
          left: '8%',
          right: '3%',
          top: '12%',
          height: '28%',
        },
        {
          left: '8%',
          right: '3%',
          top: '44%',
          height: '12%',
        },
        {
          left: '8%',
          right: '3%',
          top: '60%',
          height: '14%',
        },
        {
          left: '8%',
          right: '3%',
          top: '78%',
          height: '14%',
        },
      ],
      xAxis: [
        // K线 X 轴（不显示标签）
        {
          type: 'category',
          data: dates,
          boundaryGap: false,
          axisLine: { onZero: false },
          splitLine: { show: false },
          axisLabel: { show: false },
          axisTick: { show: false },
          min: 'dataMin',
          max: 'dataMax',
        },
        // 成交量 X 轴（不显示标签）
        {
          type: 'category',
          gridIndex: 1,
          data: dates,
          boundaryGap: false,
          axisLine: { onZero: false },
          splitLine: { show: false },
          axisLabel: { show: false },
          axisTick: { show: false },
          min: 'dataMin',
          max: 'dataMax',
        },
        // MACD X 轴（不显示标签）
        {
          type: 'category',
          gridIndex: 2,
          data: dates,
          boundaryGap: false,
          axisLine: { onZero: false },
          splitLine: { show: false },
          axisLabel: { show: false },
          axisTick: { show: false },
          min: 'dataMin',
          max: 'dataMax',
        },
        // 布林带 X 轴（显示标签）
        {
          type: 'category',
          gridIndex: 3,
          data: dates,
          boundaryGap: false,
          axisLine: { onZero: false },
          splitLine: { show: false },
          axisLabel: {
            fontSize: 10,
            interval: getAxisLabelInterval(),
            rotate: 0,
            formatter: formatDate,
          },
          axisTick: { show: false },
          min: 'dataMin',
          max: 'dataMax',
        },
      ],
      yAxis: [
        // K线 Y 轴
        {
          scale: true,
          splitArea: { show: false },
          splitLine: { lineStyle: { type: 'dashed', color: '#e0e0e0' } },
        },
        // 成交量 Y 轴
        {
          scale: true,
          gridIndex: 1,
          splitNumber: 2,
          axisLabel: {
            formatter: (value: number) => (value / 10000).toFixed(0) + '万',
            fontSize: 10,
          },
          splitLine: { show: false },
        },
        // MACD Y 轴
        {
          scale: true,
          gridIndex: 2,
          splitNumber: 2,
          axisLabel: { fontSize: 10 },
          splitLine: { lineStyle: { type: 'dashed', color: '#e0e0e0' } },
        },
        // 布林带 Y 轴
        {
          scale: true,
          gridIndex: 3,
          splitNumber: 2,
          axisLabel: { fontSize: 10 },
          splitLine: { lineStyle: { type: 'dashed', color: '#e0e0e0' } },
        },
      ],
      dataZoom: [
        {
          type: 'inside',
          xAxisIndex: [0, 1, 2, 3],
          start: 70,
          end: 100,
        },
        {
          show: true,
          xAxisIndex: [0, 1, 2, 3],
          type: 'slider',
          bottom: 20,
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
        // ========== K线区域 ==========
        {
          name: 'K线',
          type: 'candlestick',
          data: ohlc,
          itemStyle: {
            color: '#ef5350',
            color0: '#26a69a',
            borderColor: '#ef5350',
            borderColor0: '#26a69a',
          },
        },
        ...(showMA ? [
          {
            name: 'MA5',
            type: 'line' as const,
            data: ma5,
            smooth: true,
            lineStyle: { width: 1 },
            symbol: 'none',
            itemStyle: { color: '#1E88E5' },
          },
          {
            name: 'MA20',
            type: 'line' as const,
            data: ma20,
            smooth: true,
            lineStyle: { width: 1 },
            symbol: 'none',
            itemStyle: { color: '#FFA726' },
          },
          {
            name: 'MA55',
            type: 'line' as const,
            data: ma55,
            smooth: true,
            lineStyle: { width: 1 },
            symbol: 'none',
            itemStyle: { color: '#AB47BC' },
          },
          {
            name: 'MA233',
            type: 'line' as const,
            data: ma233,
            smooth: true,
            lineStyle: { width: 1 },
            symbol: 'none',
            itemStyle: { color: '#78909C' },
          },
        ] : []),
        // ========== 成交量区域 ==========
        {
          name: '成交量',
          type: 'bar',
          xAxisIndex: 1,
          yAxisIndex: 1,
          data: volumes,
          itemStyle: {
            color: (params: any) => {
              const dataIndex = params.dataIndex;
              const item = data[dataIndex];
              return item.close >= item.open ? '#ef5350' : '#26a69a';
            },
          },
        },
        // ========== MACD 区域 ==========
        {
          name: 'MACD',
          type: 'line',
          xAxisIndex: 2,
          yAxisIndex: 2,
          data: macd,
          smooth: true,
          lineStyle: { width: 1 },
          symbol: 'none',
          itemStyle: { color: '#2196F3' },
        },
        {
          name: 'Signal',
          type: 'line',
          xAxisIndex: 2,
          yAxisIndex: 2,
          data: macdSignal,
          smooth: true,
          lineStyle: { width: 1 },
          symbol: 'none',
          itemStyle: { color: '#FF9800' },
        },
        {
          name: 'Histogram',
          type: 'bar',
          xAxisIndex: 2,
          yAxisIndex: 2,
          data: macdHist,
          itemStyle: {
            color: (params: any) => {
              const value = params.value;
              if (value === null || value === undefined) return '#666';
              return value >= 0 ? '#ef5350' : '#26a69a';
            },
          },
        },
        // ========== 布林带区域 ==========
        {
          name: '收盘价',
          type: 'line',
          xAxisIndex: 3,
          yAxisIndex: 3,
          data: closePrice,
          smooth: true,
          lineStyle: { width: 2 },
          symbol: 'none',
          itemStyle: { color: '#1E88E5' },
        },
        {
          name: '上轨',
          type: 'line',
          xAxisIndex: 3,
          yAxisIndex: 3,
          data: bollUpper,
          smooth: true,
          lineStyle: { width: 1, type: 'dashed' },
          symbol: 'none',
          itemStyle: { color: '#ef5350' },
        },
        {
          name: '中轨',
          type: 'line',
          xAxisIndex: 3,
          yAxisIndex: 3,
          data: bollMiddle,
          smooth: true,
          lineStyle: { width: 1 },
          symbol: 'none',
          itemStyle: { color: '#FFA726' },
        },
        {
          name: '下轨',
          type: 'line',
          xAxisIndex: 3,
          yAxisIndex: 3,
          data: bollLower,
          smooth: true,
          lineStyle: { width: 1, type: 'dashed' },
          symbol: 'none',
          itemStyle: { color: '#26a69a' },
          areaStyle: {
            color: {
              type: 'linear',
              x: 0, y: 0, x2: 0, y2: 1,
              colorStops: [
                { offset: 0, color: 'rgba(38, 166, 154, 0.15)' },
                { offset: 1, color: 'rgba(38, 166, 154, 0.05)' },
              ],
            },
          },
        },
      ],
    };
  }, [data, showMA]);

  if (!data || data.length === 0) {
    return (
      <div className="flex items-center justify-center h-[300px] sm:h-[500px] md:h-[700px] bg-muted/30 rounded-lg">
        <p className="text-sm text-muted-foreground">暂无数据</p>
      </div>
    );
  }

  return (
    <ReactECharts
      option={option}
      style={{ height: `${chartHeight}px`, width: '100%' }}
      opts={{ renderer: 'canvas' }}
    />
  );
}
