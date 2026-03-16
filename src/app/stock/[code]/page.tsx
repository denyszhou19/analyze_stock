'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { ArrowLeft, Download, RefreshCw, Loader2, Clock } from 'lucide-react';
import { KlineChart } from '@/components/charts/KlineChart';
import { SmartLoading, SmartLoadingMini } from '@/components/ui/smart-loading';
import { SyncStatusAlert } from '@/components/stock/SyncStatusAlert';
import { DataSyncTime } from '@/components/stock/DataSyncTime';
import * as XLSX from 'xlsx';

interface KlineItem {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  amount: number;
  turn: number;
  pctChg: number;
  ma5: number | null;
  ma20: number | null;
  ma55: number | null;
  ma233: number | null;
  macd: number | null;
  macd_signal: number | null;
  macd_hist: number | null;
  boll_upper: number | null;
  boll_middle: number | null;
  boll_lower: number | null;
}

// 全局缓存：key = `${code}_${frequency}`
const globalCache = new Map<string, { data: KlineItem[]; timestamp: number }>();

const FREQUENCY_OPTIONS = [
  { value: '5min', label: '5分钟' },
  { value: '15min', label: '15分钟' },
  { value: '30min', label: '30分钟' },
  { value: '60min', label: '60分钟' },
  { value: '120min', label: '120分钟' },
  { value: 'd', label: '日线' },
  { value: 'w', label: '周线' },
  { value: 'm', label: '月线' },
];

// 缓存有效期：5分钟
const CACHE_TTL = 5 * 60 * 1000;

export default function StockDetailPage() {
  const params = useParams();
  const router = useRouter();
  const code = params.code as string;

  // 各级别的数据缓存
  const [dataCache, setDataCache] = useState<Map<string, KlineItem[]>>(new Map());
  // 当前显示的数据
  const [klineData, setKlineData] = useState<KlineItem[]>([]);
  // 当前选中的级别
  const [frequency, setFrequency] = useState('d');
  // 页面初始加载状态
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  // 级别切换加载状态
  const [isLevelLoading, setIsLevelLoading] = useState(false);
  // 同步状态
  const [isSyncing, setIsSyncing] = useState(false);
  // 股票信息
  const [stockInfo, setStockInfo] = useState<{ name?: string; lastSyncAt?: string; lastDataDate?: string }>({});
  // 记录正在加载的级别
  const loadingRef = useRef<Set<string>>(new Set());

  // 从缓存获取数据
  const getFromCache = useCallback((freq: string): KlineItem[] | null => {
    const key = `${code}_${freq}`;
    
    // 先检查本地缓存
    const localData = dataCache.get(key);
    if (localData) return localData;
    
    // 再检查全局缓存
    const cached = globalCache.get(key);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      // 同步到本地缓存
      setDataCache(prev => new Map(prev).set(key, cached.data));
      return cached.data;
    }
    
    return null;
  }, [code, dataCache]);

  // 保存数据到缓存
  const saveToCache = useCallback((freq: string, data: KlineItem[]) => {
    const key = `${code}_${freq}`;
    
    // 保存到本地缓存
    setDataCache(prev => new Map(prev).set(key, data));
    
    // 保存到全局缓存
    globalCache.set(key, { data, timestamp: Date.now() });
  }, [code]);

  // 加载股票数据
  // 注意：此函数不再自行管理 isInitialLoading，由调用方（init / handleFrequencyChange）统一控制
  const loadStockData = useCallback(async (freq: string, forceRefresh = false) => {
    // 防止重复请求
    const loadingKey = `${code}_${freq}`;
    if (loadingRef.current.has(loadingKey)) return;

    // 检查缓存（forceRefresh 时跳过）
    if (!forceRefresh) {
      const cached = getFromCache(freq);
      if (cached && cached.length > 0) {
        setKlineData(cached);
        return;
      }
    }

    loadingRef.current.add(loadingKey);
    // 非初始化时切换周期，显示局部加载状态
    setIsLevelLoading(true);

    try {
      const response = await fetch(`/api/stock/data?code=${code}&frequency=${freq}&source=api`);
      const result = await response.json();

      if (result.success) {
        const data = result.data.kline || [];
        setKlineData(data);
        saveToCache(freq, data);
      } else {
        console.error('Failed to load data:', result.error);
      }
    } catch (err) {
      console.error('Load data error:', err);
    } finally {
      loadingRef.current.delete(loadingKey);
      setIsLevelLoading(false);
    }
  }, [code, getFromCache, saveToCache]);

  // 加载股票信息
  const loadStockInfo = useCallback(async () => {
    try {
      const response = await fetch(`/api/stock/info?code=${code}`);
      const result = await response.json();
      if (result.success) {
        setStockInfo(result.data || {});
      }
    } catch (err) {
      console.error('Load stock info error:', err);
    }
  }, [code]);

  // 同步股票数据
  const syncStockData = async () => {
    setIsSyncing(true);
    try {
      const response = await fetch('/api/stock/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code, days: 365 }),
      });
      const result = await response.json();

      if (result.success) {
        // 更新同步时间
        setStockInfo(prev => ({ ...prev, lastSyncAt: new Date().toISOString() }));
        // 清除当前级别的缓存并重新加载
        const key = `${code}_${frequency}`;
        globalCache.delete(key);
        setDataCache(prev => {
          const newMap = new Map(prev);
          newMap.delete(key);
          return newMap;
        });
        await loadStockData(frequency, true);
      } else {
        alert(`同步失败: ${result.error}`);
      }
    } catch (err) {
      console.error('Sync error:', err);
      alert('同步失败');
    } finally {
      setIsSyncing(false);
    }
  };

  // 导出 Excel
  const exportToExcel = () => {
    if (klineData.length === 0) {
      alert('暂无数据可导出');
      return;
    }

    const exportData = klineData.map(item => ({
      '日期': item.date,
      '开盘价': item.open,
      '最高价': item.high,
      '最低价': item.low,
      '收盘价': item.close,
      '成交量': item.volume,
      '成交额': item.amount,
      '换手率(%)': item.turn,
      '涨跌幅(%)': item.pctChg,
      'MA5': item.ma5,
      'MA20': item.ma20,
      'MA55': item.ma55,
      'MA233': item.ma233,
      'MACD': item.macd,
      'MACD信号线': item.macd_signal,
      'MACD柱': item.macd_hist,
      '布林上轨': item.boll_upper,
      '布林中轨': item.boll_middle,
      '布林下轨': item.boll_lower,
    }));

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'K线数据');
    XLSX.writeFile(wb, `${code}_kline_${frequency}_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  // 检查数据新鲜度并自动同步
  const checkAndSyncData = useCallback(async () => {
    try {
      // 调用检查同步API，自动检查并同步所有级别的过期数据
      const response = await fetch('/api/stock/check-sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          code, 
          frequencies: ['w', 'd', '60', '30', '15'],
          autoSync: true 
        }),
      });
      
      const result = await response.json();
      
      if (result.success && result.data.needsSync) {
        console.log('[Auto Sync] 已同步过期数据:', result.data.syncResults);
        // 清除所有缓存，强制重新加载
        globalCache.clear();
        setDataCache(new Map());
      }
      
      return result;
    } catch (err) {
      console.error('[Auto Sync] 检查同步失败:', err);
      return null;
    }
  }, [code]);

  // 初始加载：由此统一管理 isInitialLoading，避免子函数多处修改状态造成闪烁
  useEffect(() => {
    const init = async () => {
      setIsInitialLoading(true);
      try {
        // 1. 先检查数据新鲜度并同步（会阻塞直到同步完成或超时）
        await checkAndSyncData();
        // 2. 并行加载当前级别数据和股票信息
        await Promise.all([
          loadStockData(frequency),
          loadStockInfo(),
        ]);
      } finally {
        // 无论成功或失败，都关闭初始 loading
        setIsInitialLoading(false);
      }
    };

    init();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // 级别切换：先清空旧数据展示（防止图表闪现上一级别数据），再加载新数据
  const handleFrequencyChange = useCallback((newFreq: string) => {
    if (newFreq === frequency) return;
    setFrequency(newFreq);

    const cached = getFromCache(newFreq);
    if (cached && cached.length > 0) {
      // 缓存命中，直接更新，无需 loading
      setKlineData(cached);
    } else {
      // 缓存未命中：先清空当前数据，再发请求（避免旧数据残留）
      setKlineData([]);
      loadStockData(newFreq);
    }
  }, [frequency, getFromCache, loadStockData]);

  // 获取最新价格信息
  const latestData = klineData[klineData.length - 1];

  // 格式化同步时间
  const formatSyncTime = (isoString?: string) => {
    if (!isoString) return '暂无';
    const date = new Date(isoString);
    return date.toLocaleString('zh-CN', {
      timeZone: 'Asia/Shanghai',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // 检查某个级别是否已缓存
  const isCached = (freq: string): boolean => {
    const key = `${code}_${freq}`;
    return dataCache.has(key) || globalCache.has(key);
  };

  return (
    <div className="container mx-auto p-3 sm:p-4 space-y-3 sm:space-y-4">
      {/* 页面初始加载智能 Loading */}
      <SmartLoading
        isLoading={isInitialLoading}
        loadingText="加载股票数据中..."
        slowLoadingText="正在从远程获取股票历史数据..."
      />

      {/* 头部：股票代码、名称、同步时间 */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b pb-3 sm:pb-4 gap-3">
        <div className="flex items-center gap-3 sm:gap-4">
          <Button variant="ghost" size="icon" onClick={() => router.back()} className="h-9 w-9">
            <ArrowLeft className="h-4 w-4 sm:h-5 sm:w-5" />
          </Button>
          <div>
            <div className="flex items-center gap-2 sm:gap-3">
              <h1 className="text-xl sm:text-2xl font-bold">{code}</h1>
              {stockInfo?.name && (
                <span className="text-base sm:text-lg text-muted-foreground">{stockInfo.name}</span>
              )}
            </div>
            {/* 数据同步时间 */}
            <DataSyncTime 
              code={code} 
              currentFrequency={frequency}
              className="mt-0.5"
            />
          </div>
        </div>
        <div className="flex items-center gap-2 ml-12 sm:ml-0">
          <Button variant="outline" size="sm" onClick={syncStockData} disabled={isSyncing} className="h-9 text-xs sm:text-sm">
            {isSyncing ? (
              <Loader2 className="h-3.5 w-3.5 sm:h-4 sm:w-4 sm:mr-2 animate-spin" />
            ) : (
              <RefreshCw className="h-3.5 w-3.5 sm:h-4 sm:w-4 sm:mr-2" />
            )}
            <span className="hidden sm:inline">同步数据</span>
          </Button>
          <Button variant="outline" size="sm" onClick={exportToExcel} disabled={klineData.length === 0} className="h-9 text-xs sm:text-sm">
            <Download className="h-3.5 w-3.5 sm:h-4 sm:w-4 sm:mr-2" />
            <span className="hidden sm:inline">导出 Excel</span>
          </Button>
        </div>
      </div>

      {/* 同步状态提醒 */}
      <SyncStatusAlert 
        code={code} 
        onSync={syncStockData} 
        isSyncing={isSyncing}
      />

      {/* 最新价格信息 */}
      {latestData && !isLevelLoading && (
        <div className="grid grid-cols-3 sm:grid-cols-3 md:grid-cols-6 gap-3 sm:gap-4 py-2 sm:py-3">
          <div>
            <p className="text-xs text-muted-foreground">最新价</p>
            <p className={`text-base sm:text-xl font-bold ${latestData.close >= latestData.open ? 'text-red-500' : 'text-green-500'}`}>
              {latestData.close.toFixed(2)}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">涨跌幅</p>
            <p className={`text-base sm:text-xl font-bold ${latestData.pctChg >= 0 ? 'text-red-500' : 'text-green-500'}`}>
              {latestData.pctChg >= 0 ? '+' : ''}{latestData.pctChg?.toFixed(2)}%
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">开盘价</p>
            <p className="text-sm sm:text-lg">{latestData.open.toFixed(2)}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">最高价</p>
            <p className="text-sm sm:text-lg text-red-500">{latestData.high.toFixed(2)}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">最低价</p>
            <p className="text-sm sm:text-lg text-green-500">{latestData.low.toFixed(2)}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">成交量</p>
            <p className="text-sm sm:text-lg">{(latestData.volume / 10000).toFixed(2)}万</p>
          </div>
        </div>
      )}

      {/* K线级别选择 - 平铺在图表上方 */}
      <div className="flex flex-wrap items-center gap-1 sm:gap-1.5 border-b pb-2 sm:pb-3">
        {FREQUENCY_OPTIONS.map(opt => (
          <Button
            key={opt.value}
            variant={frequency === opt.value ? 'default' : 'ghost'}
            size="sm"
            onClick={() => handleFrequencyChange(opt.value)}
            className="text-xs sm:text-sm h-8 px-2 sm:px-3 relative"
          >
            {opt.label}
            {/* 已缓存标识 */}
            {isCached(opt.value) && opt.value !== frequency && (
              <span className="absolute -top-0.5 -right-0.5 sm:-top-1 sm:-right-1 w-1.5 h-1.5 sm:w-2 sm:h-2 bg-green-500 rounded-full" />
            )}
            {/* 当前级别加载中 */}
            {isLevelLoading && opt.value === frequency && (
              <Loader2 className="h-3 w-3 ml-1 animate-spin" />
            )}
          </Button>
        ))}
      </div>

      {/* 级别切换 Loading */}
      {isLevelLoading ? (
        <SmartLoadingMini isLoading={true} loadingText={`加载 ${FREQUENCY_OPTIONS.find(f => f.value === frequency)?.label} 数据...`} />
      ) : (
        /* 整合图表区域：K线、成交量、MACD、布林带共享时间轴 */
        <Card>
          <CardContent className="p-3 sm:p-4 pt-3 sm:pt-4">
            <div className="text-xs sm:text-sm font-medium mb-2 text-muted-foreground">
              综合分析图 · {FREQUENCY_OPTIONS.find(f => f.value === frequency)?.label}
            </div>
            <KlineChart data={klineData} height={500} />
          </CardContent>
        </Card>
      )}

      {/* 数据表格 */}
      {klineData.length > 0 && !isLevelLoading && (
        <Card>
          <CardContent className="p-3 sm:p-4 pt-3 sm:pt-4">
            <div className="text-xs sm:text-sm font-medium mb-3 text-muted-foreground">历史数据（最近20条）</div>
            <div className="overflow-x-auto -mx-3 sm:mx-0">
              <table className="w-full text-xs sm:text-sm min-w-[600px]">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2 px-2">日期</th>
                    <th className="text-right py-2 px-2">开盘</th>
                    <th className="text-right py-2 px-2">最高</th>
                    <th className="text-right py-2 px-2">最低</th>
                    <th className="text-right py-2 px-2">收盘</th>
                    <th className="text-right py-2 px-2">涨跌幅</th>
                    <th className="text-right py-2 px-2">成交量</th>
                    <th className="text-right py-2 px-2">换手率</th>
                  </tr>
                </thead>
                <tbody>
                  {klineData.slice(-20).reverse().map((item, idx) => (
                    <tr key={idx} className="border-b hover:bg-muted/50">
                      <td className="py-2 px-2">{item.date}</td>
                      <td className="text-right py-2 px-2">{item.open.toFixed(2)}</td>
                      <td className="text-right py-2 px-2 text-red-500">{item.high.toFixed(2)}</td>
                      <td className="text-right py-2 px-2 text-green-500">{item.low.toFixed(2)}</td>
                      <td className="text-right py-2 px-2">{item.close.toFixed(2)}</td>
                      <td className={`text-right py-2 px-2 ${item.pctChg >= 0 ? 'text-red-500' : 'text-green-500'}`}>
                        {item.pctChg >= 0 ? '+' : ''}{item.pctChg?.toFixed(2)}%
                      </td>
                      <td className="text-right py-2 px-2">{(item.volume / 10000).toFixed(2)}万</td>
                      <td className="text-right py-2 px-2">{item.turn?.toFixed(2) || '-'}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
