'use client';

import { useState, useEffect, useCallback } from 'react';
import { Clock, RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { DataIntegritySnapshot } from '@/lib/stock-data-integrity';

/**
 * 单个周期的同步状态
 */
interface SyncStatusItem {
  code: string;
  frequency: string;
  lastSyncDate: string | null;
  lastSyncAt: string | null;
  recordCount: number;
  syncStatus: string;
}

interface DataSyncTimeProps {
  /** 股票代码 */
  code: string;
  /** 当前级别/周期（可选，用于K线页面只显示当前级别） */
  currentFrequency?: string;
  /** 自定义类名 */
  className?: string;
  /** 已有的数据完整性快照，可避免重复拉取 sync-status */
  initialData?: DataIntegritySnapshot | null;
  /** 是否允许组件自行请求 sync-status */
  autoFetch?: boolean;
}

// 周期名称映射
const FREQUENCY_NAMES: Record<string, string> = {
  'w': '周线',
  'd': '日线',
  '60': '60分钟',
  '30': '30分钟',
  '15': '15分钟',
  '5': '5分钟',
};

/**
 * 数据同步时间展示组件
 * 
 * 显示当前个股最新的数据截止时间
 */
export function DataSyncTime({
  code,
  currentFrequency,
  className,
  initialData = null,
  autoFetch = true,
}: DataSyncTimeProps) {
  const [statusList, setStatusList] = useState<SyncStatusItem[]>([]);
  const [loading, setLoading] = useState(autoFetch && !initialData);
  const [error, setError] = useState<string | null>(null);

  const applyIntegritySnapshot = useCallback((snapshot: DataIntegritySnapshot) => {
    setStatusList(snapshot.levels.map(level => ({
      code: snapshot.code,
      frequency: level.key,
      lastSyncDate: level.lastDate,
      lastSyncAt: null,
      recordCount: level.recordCount,
      syncStatus: level.status,
    })));
    setError(null);
    setLoading(false);
  }, []);

  // 获取同步状态
  const fetchSyncStatus = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await fetch(`/api/stock/sync-status?code=${code}`);
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      
      const data = await response.json();
      
      if (data.success && data.data && Array.isArray(data.data)) {
        setStatusList(data.data);
      } else {
        setStatusList([]);
      }
    } catch (err) {
      console.error('[DataSyncTime] Failed to fetch:', err);
      setError(err instanceof Error ? err.message : '获取失败');
      setStatusList([]);
    } finally {
      setLoading(false);
    }
  }, [code]);

  useEffect(() => {
    if (initialData) {
      applyIntegritySnapshot(initialData);
      return;
    }

    if (code && autoFetch) {
      void fetchSyncStatus();
      return;
    }

    setLoading(false);
  }, [applyIntegritySnapshot, autoFetch, code, fetchSyncStatus, initialData]);

  // 加载中状态
  if (loading) {
    return (
      <div className={cn('flex items-center gap-1.5 text-xs text-muted-foreground', className)}>
        <RefreshCw className="h-3 w-3 animate-spin" />
        <span>获取数据同步状态...</span>
      </div>
    );
  }

  // 错误状态
  if (error) {
    return (
      <div className={cn('flex items-center gap-1.5 text-xs text-muted-foreground', className)}>
        <Clock className="h-3 w-3" />
        <span>同步状态获取失败</span>
      </div>
    );
  }

  // 没有数据
  if (statusList.length === 0) {
    return (
      <div className={cn('flex items-center gap-1.5 text-xs text-muted-foreground', className)}>
        <Clock className="h-3 w-3" />
        <span>暂无同步记录</span>
      </div>
    );
  }

  // 如果指定了当前级别，只显示该级别的数据
  if (currentFrequency) {
    const status = statusList.find(s => s.frequency === currentFrequency);
    const freqName = FREQUENCY_NAMES[currentFrequency] || currentFrequency;
    
    // 周线特殊处理：baostock 不会返回本周数据
    if (currentFrequency === 'w') {
      if (status?.lastSyncDate) {
        // 显示上周的数据日期
        return (
          <div className={cn('flex items-center gap-1.5 text-xs text-muted-foreground', className)}>
            <Clock className="h-3 w-3" />
            <span>周线数据截止日期：</span>
            <span className="font-medium text-foreground">{formatDate(status.lastSyncDate)}</span>
          </div>
        );
      }
      return (
        <div className={cn('flex items-center gap-1.5 text-xs text-muted-foreground', className)}>
          <Clock className="h-3 w-3" />
          <span>周线暂无数据</span>
        </div>
      );
    }
    
    // 日线及更小级别
    if (status?.lastSyncDate) {
      return (
        <div className={cn('flex items-center gap-1.5 text-xs text-muted-foreground', className)}>
          <Clock className="h-3 w-3" />
          <span>{freqName}数据截止日期：</span>
          <span className="font-medium text-foreground">{formatDate(status.lastSyncDate)}</span>
        </div>
      );
    }
    
    // 没找到当前级别的数据，尝试显示任意一个有效的级别
    const validFrequencies = ['d', '60', '30', '15', '5'];
    const anyStatus = statusList.find(s => validFrequencies.includes(s.frequency) && s.lastSyncDate);
    if (anyStatus) {
      const anyFreqName = FREQUENCY_NAMES[anyStatus.frequency] || anyStatus.frequency;
      return (
        <div className={cn('flex items-center gap-1.5 text-xs text-muted-foreground', className)}>
          <Clock className="h-3 w-3" />
          <span>{anyFreqName}数据截止日期：</span>
          <span className="font-medium text-foreground">{formatDate(anyStatus.lastSyncDate)}</span>
        </div>
      );
    }
    
    return (
      <div className={cn('flex items-center gap-1.5 text-xs text-muted-foreground', className)}>
        <Clock className="h-3 w-3" />
        <span>{freqName}暂无数据</span>
      </div>
    );
  }

  // 找出最新的数据日期（从日线及更小级别中取最新的，忽略周线）
  // 周线：baostock 不会返回最新的周线数据（本周未结束），所以忽略
  const validFrequencies = ['d', '60', '30', '15', '5']; // 日线及更小级别
  
  let latestStatus: SyncStatusItem | null = null;
  for (const item of statusList) {
    // 只考虑日线及更小级别
    if (!validFrequencies.includes(item.frequency)) continue;
    
    if (item.lastSyncDate) {
      if (!latestStatus || item.lastSyncDate > latestStatus.lastSyncDate!) {
        latestStatus = item;
      }
    }
  }

  if (!latestStatus?.lastSyncDate) {
    return (
      <div className={cn('flex items-center gap-1.5 text-xs text-muted-foreground', className)}>
        <Clock className="h-3 w-3" />
        <span>暂无数据记录</span>
      </div>
    );
  }

  return (
    <div className={cn('flex items-center gap-1.5 text-xs text-muted-foreground', className)}>
      <Clock className="h-3 w-3" />
      <span>最新数据截止日期：</span>
      <span className="font-medium text-foreground">{formatDate(latestStatus.lastSyncDate)}</span>
    </div>
  );
}

// 格式化日期显示 - 统一使用 YYYY-MM-DD 格式
function formatDate(dateStr: string | null): string {
  if (!dateStr) return '';
  
  // 解析 YYYY-MM-DD 格式，直接返回原格式
  const parts = dateStr.split('-');
  if (parts.length === 3) {
    // 确保月份和日期是两位数
    const year = parts[0];
    const month = parts[1].padStart(2, '0');
    const day = parts[2].padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
  
  return dateStr;
}
