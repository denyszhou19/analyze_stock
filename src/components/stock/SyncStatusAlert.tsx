'use client';

import { useState, useEffect, useCallback } from 'react';
import { AlertCircle, RefreshCw, CheckCircle, Clock, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

// 三位一体分析实际使用的级别（不包含5分钟）
const REQUIRED_FREQUENCIES = ['w', 'd', '60', '30', '15'];

interface SyncStatusItem {
  code: string;
  frequency: string;
  lastSyncDate: string | null;
  lastSyncAt: string | null;
  recordCount: number;
  syncType: string;
  syncStatus: string;
  lastSyncError: string | null;
  retryCount: number;
}

interface SyncStatusSummary {
  total: number;
  failed: number;
  syncing: number;
  success: number;
  pending: number;
}

interface SyncStatusResponse {
  success: boolean;
  data: SyncStatusItem[];
  summary: SyncStatusSummary;
  hasErrors: boolean;
  errorCodes: string[];
}

interface SyncStatusAlertProps {
  /** 股票代码，用于过滤特定股票的同步状态 */
  code?: string;
  /** 是否显示详细信息 */
  showDetails?: boolean;
  /** 同步回调函数 */
  onSync?: () => void;
  /** 是否正在同步 */
  isSyncing?: boolean;
  /** 自定义类名 */
  className?: string;
}

/**
 * 同步状态提醒组件
 * 
 * 功能：
 * 1. 检测股票数据同步状态
 * 2. 显示同步错误提醒
 * 3. 提供重试按钮
 * 4. 显示同步进度
 */
export function SyncStatusAlert({
  code,
  showDetails = true,
  onSync,
  isSyncing = false,
  className,
}: SyncStatusAlertProps) {
  const [syncStatus, setSyncStatus] = useState<SyncStatusResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  // 获取同步状态
  const fetchSyncStatus = useCallback(async () => {
    try {
      const url = code
        ? `/api/stock/sync-status?code=${code}`
        : '/api/stock/sync-status';
      
      const response = await fetch(url);
      const data = await response.json();
      
      if (data.success) {
        setSyncStatus(data);
        // 如果有新的错误，重置 dismissed 状态
        if (data.hasErrors) {
          setDismissed(false);
        }
      }
    } catch (error) {
      console.error('Failed to fetch sync status:', error);
    }
  }, [code]);

  // 初始加载
  useEffect(() => {
    fetchSyncStatus();
    // 每 30 秒刷新一次状态
    const interval = setInterval(fetchSyncStatus, 30000);
    return () => clearInterval(interval);
  }, [fetchSyncStatus]);

  // 重试同步
  const handleRetry = async () => {
    if (isSyncing) return;
    
    setLoading(true);
    try {
      // 先重置失败状态
      await fetch('/api/stock/sync-status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code }),
      });
      
      // 触发同步
      if (onSync) {
        onSync();
      } else {
        // 如果没有提供同步回调，调用同步 API
        const syncUrl = code
          ? `/api/stock/sync?code=${code}`
          : '/api/stock/sync';
        
        await fetch(syncUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ code }),
        });
      }
      
      // 刷新状态
      await fetchSyncStatus();
    } catch (error) {
      console.error('Failed to retry sync:', error);
    } finally {
      setLoading(false);
    }
  };

  // 如果没有数据或已关闭，不显示
  if (!syncStatus || dismissed) {
    return null;
  }

  // 没有错误且没有正在同步，不显示
  if (!syncStatus.hasErrors && syncStatus.summary.syncing === 0) {
    return null;
  }

  // 筛选当前股票的错误（只显示三位一体分析使用的级别）
  const errorItems = code
    ? syncStatus.data.filter(
        item => item.code === code && 
                item.syncStatus === 'failed' &&
                REQUIRED_FREQUENCIES.includes(item.frequency)
      )
    : syncStatus.data.filter(
        item => item.syncStatus === 'failed' &&
                REQUIRED_FREQUENCIES.includes(item.frequency)
      );

  const syncingItems = code
    ? syncStatus.data.filter(
        item => item.code === code && 
                item.syncStatus === 'syncing' &&
                REQUIRED_FREQUENCIES.includes(item.frequency)
      )
    : syncStatus.data.filter(
        item => item.syncStatus === 'syncing' &&
                REQUIRED_FREQUENCIES.includes(item.frequency)
      );

  // 正在同步状态
  if (syncingItems.length > 0) {
    return (
      <Alert className={cn('border-blue-200 bg-blue-50 dark:border-blue-900 dark:bg-blue-950', className)}>
        <Clock className="h-4 w-4 text-blue-600 animate-spin" />
        <AlertTitle className="text-blue-800 dark:text-blue-200">
          正在同步数据...
        </AlertTitle>
        <AlertDescription className="text-blue-700 dark:text-blue-300">
          {showDetails && (
            <div className="mt-2 text-sm">
              {syncingItems.map(item => (
                <div key={`${item.code}-${item.frequency}`} className="flex items-center gap-2">
                  <span>{item.code}</span>
                  <Badge variant="outline" className="text-xs">{item.frequency}</Badge>
                </div>
              ))}
            </div>
          )}
        </AlertDescription>
      </Alert>
    );
  }

  // 错误状态
  if (errorItems.length > 0) {
    return (
      <Alert 
        variant="destructive" 
        className={cn('relative', className)}
      >
        <AlertCircle className="h-4 w-4" />
        <Button
          variant="ghost"
          size="sm"
          className="absolute right-2 top-2 h-6 w-6 p-0"
          onClick={() => setDismissed(true)}
        >
          <X className="h-4 w-4" />
        </Button>
        <AlertTitle className="flex items-center gap-2">
          数据同步失败
          <Badge variant="destructive" className="text-xs">
            {errorItems.length} 个错误
          </Badge>
        </AlertTitle>
        <AlertDescription>
          {showDetails && (
            <div className="mt-2 space-y-1">
              {errorItems.map(item => (
                <div 
                  key={`${item.code}-${item.frequency}`} 
                  className="text-sm flex items-start gap-2"
                >
                  <span className="font-medium">{item.code}</span>
                  <Badge variant="outline" className="text-xs">{item.frequency}</Badge>
                  <span className="text-muted-foreground text-xs">
                    {item.lastSyncError || '未知错误'}
                  </span>
                </div>
              ))}
            </div>
          )}
          <div className="mt-3 flex gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={handleRetry}
              disabled={loading || isSyncing}
            >
              {loading || isSyncing ? (
                <>
                  <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                  重试中...
                </>
              ) : (
                <>
                  <RefreshCw className="mr-2 h-4 w-4" />
                  重试同步
                </>
              )}
            </Button>
          </div>
        </AlertDescription>
      </Alert>
    );
  }

  return null;
}

/**
 * 简洁版同步状态指示器
 * 用于页面顶部状态栏
 */
export function SyncStatusIndicator({
  code,
  onSync,
  isSyncing,
  className,
}: Omit<SyncStatusAlertProps, 'showDetails'>) {
  const [syncStatus, setSyncStatus] = useState<SyncStatusResponse | null>(null);

  // 获取同步状态
  const fetchSyncStatus = useCallback(async () => {
    try {
      const url = code
        ? `/api/stock/sync-status?code=${code}`
        : '/api/stock/sync-status';
      
      const response = await fetch(url);
      const data = await response.json();
      
      if (data.success) {
        setSyncStatus(data);
      }
    } catch (error) {
      console.error('Failed to fetch sync status:', error);
    }
  }, [code]);

  useEffect(() => {
    fetchSyncStatus();
    const interval = setInterval(fetchSyncStatus, 30000);
    return () => clearInterval(interval);
  }, [fetchSyncStatus]);

  if (!syncStatus) {
    return null;
  }

  // 正在同步
  if (syncStatus.summary.syncing > 0) {
    return (
      <div className={cn('flex items-center gap-2 text-sm text-blue-600', className)}>
        <RefreshCw className="h-4 w-4 animate-spin" />
        <span>同步中...</span>
      </div>
    );
  }

  // 有错误
  if (syncStatus.hasErrors) {
    return (
      <Button
        variant="ghost"
        size="sm"
        className={cn('text-destructive hover:text-destructive', className)}
        onClick={onSync}
        disabled={isSyncing}
      >
        <AlertCircle className="mr-2 h-4 w-4" />
        同步失败，点击重试
      </Button>
    );
  }

  // 一切正常
  if (syncStatus.summary.success > 0) {
    return (
      <div className={cn('flex items-center gap-2 text-sm text-green-600', className)}>
        <CheckCircle className="h-4 w-4" />
        <span>数据已同步</span>
      </div>
    );
  }

  return null;
}

export default SyncStatusAlert;
