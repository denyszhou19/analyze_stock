'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import {
  CheckCircle, AlertTriangle, XCircle, RefreshCw, ChevronDown, ChevronUp,
  Database, Clock, Loader2, Info
} from 'lucide-react';
import type {
  DataIntegritySnapshot,
  DataIntegritySummary,
} from '@/lib/stock-data-integrity';

/**
 * P1修复：状态机定义
 * - idle: 初始状态，等待操作
 * - checking: 正在检查数据完整性
 * - syncing: 正在同步数据
 * - verifying: 正在验证同步结果
 * - analyzing: 正在分析
 * - ready: 就绪，可以分析
 * - failed: 失败，需要处理
 */
type DataState = 'idle' | 'checking' | 'syncing' | 'verifying' | 'analyzing' | 'ready' | 'failed';

interface DataIntegrityAlertProps {
  code: string;
  onSync?: (frequencies: string[]) => Promise<void>;  // P1修复：改为异步
  onIntegrityCheck?: (canAnalyze: boolean, summary: DataIntegritySummary) => void;
  /** 外部控制的分析状态 */
  externalState?: 'analyzing' | 'ready';
  /** 页面首屏已拿到的数据快照，避免重复请求 */
  initialData?: DataIntegritySnapshot | null;
  /** 是否允许组件自行发起完整性检查 */
  autoRefresh?: boolean;
}

// 状态转换映射
const STATE_TRANSITIONS: Record<DataState, DataState[]> = {
  'idle': ['checking', 'syncing'],
  'checking': ['idle', 'syncing', 'ready', 'failed'],
  'syncing': ['verifying', 'failed'],
  'verifying': ['ready', 'syncing', 'failed'],
  'analyzing': ['ready', 'failed'],
  'ready': ['checking', 'analyzing', 'syncing'],
  'failed': ['checking', 'syncing', 'idle'],
};

// 状态文本映射
const STATE_TEXT: Record<DataState, string> = {
  'idle': '等待操作',
  'checking': '检查数据完整性',
  'syncing': '同步数据中',
  'verifying': '验证同步结果',
  'analyzing': '分析中',
  'ready': '数据就绪',
  'failed': '操作失败',
};

function getDataStateFromSummary(summary: DataIntegritySummary): DataState {
  if (summary.canAnalyze) {
    return 'ready';
  }

  if (summary.needsSyncLevels.length > 0) {
    return 'idle';
  }

  return 'failed';
}

export function DataIntegrityAlert({
  code,
  onSync,
  onIntegrityCheck,
  externalState,
  initialData = null,
  autoRefresh = true,
}: DataIntegrityAlertProps) {
  const [data, setData] = useState<DataIntegritySnapshot | null>(initialData);
  const [dataState, setDataState] = useState<DataState>('checking');
  const [expanded, setExpanded] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  
  const onIntegrityCheckRef = useRef(onIntegrityCheck);
  onIntegrityCheckRef.current = onIntegrityCheck;

  const applyIntegrityData = useCallback((nextData: DataIntegritySnapshot) => {
    setData(nextData);
    setDataState(getDataStateFromSummary(nextData.summary));

    if (nextData.summary.canAnalyze || nextData.summary.needsSyncLevels.length > 0) {
      setErrorMessage(null);
    } else {
      setErrorMessage('数据不完整，无法分析');
    }

    onIntegrityCheckRef.current?.(nextData.summary.canAnalyze, nextData.summary);
  }, []);

  // P1修复：状态转换函数（带验证）
  const transitionTo = useCallback((newState: DataState) => {
    setDataState(current => {
      if (STATE_TRANSITIONS[current].includes(newState)) {
        console.log(`[DataIntegrityAlert] 状态转换: ${current} -> ${newState}`);
        return newState;
      }
      console.warn(`[DataIntegrityAlert] 非法状态转换: ${current} -> ${newState}`);
      return current;
    });
  }, []);

  // 检查数据完整性
  const checkIntegrity = useCallback(async () => {
    if (!code) return;
    
    transitionTo('checking');
    setErrorMessage(null);
    
    try {
      const res = await fetch(`/api/stock/data-integrity?code=${code}`);
      const result = await res.json();
      if (result.success) {
        applyIntegrityData(result.data);
      } else {
        transitionTo('failed');
        setErrorMessage(result.error || '检查失败');
      }
    } catch (err) {
      console.error('[DataIntegrityAlert] Check failed:', err);
      transitionTo('failed');
      setErrorMessage(err instanceof Error ? err.message : '检查失败');
    }
  }, [applyIntegrityData, code, transitionTo]);

  // P1修复：同步并验证
  const handleSyncAndVerify = useCallback(async () => {
    if (!onSync || !data || data.summary.needsSyncLevels.length === 0) return;
    
    transitionTo('syncing');
    setErrorMessage(null);
    
    try {
      await onSync(data.summary.needsSyncLevels);
      
      // 同步完成后，进入验证状态
      transitionTo('verifying');
      
      // 重新检查数据完整性
      const res = await fetch(`/api/stock/data-integrity?code=${code}`);
      const result = await res.json();
      
      if (result.success) {
        applyIntegrityData(result.data);
      } else {
        transitionTo('failed');
        setErrorMessage(result.error || '验证失败');
      }
    } catch (err) {
      console.error('[DataIntegrityAlert] Sync failed:', err);
      transitionTo('failed');
      setErrorMessage(err instanceof Error ? err.message : '同步失败');
    }
  }, [applyIntegrityData, code, data, onSync, transitionTo]);

  // 首屏直接接入 prepare-analysis 返回的快照，避免重复请求
  useEffect(() => {
    if (initialData) {
      applyIntegrityData(initialData);
      return;
    }

    if (autoRefresh) {
      void checkIntegrity();
    }
  }, [applyIntegrityData, autoRefresh, checkIntegrity, initialData]);

  // P1修复：响应外部状态
  useEffect(() => {
    if (externalState === 'analyzing') {
      transitionTo('analyzing');
    } else if (externalState === 'ready' && dataState === 'analyzing') {
      transitionTo('ready');
    }
  }, [externalState, dataState, transitionTo]);

  // P1修复：提供刷新方法给外部使用
  useEffect(() => {
    // 暴露刷新方法到 window（用于外部调用）
    (window as any).__refreshDataIntegrity = checkIntegrity;
    return () => {
      delete (window as any).__refreshDataIntegrity;
    };
  }, [checkIntegrity]);

  const isLoading = dataState === 'checking' || dataState === 'verifying';
  const isSyncing = dataState === 'syncing';
  const isAnalyzing = dataState === 'analyzing';
  const isReady = dataState === 'ready';
  const isFailed = dataState === 'failed';

  if (isLoading && !data) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground px-4 py-2 bg-muted/30 rounded-lg">
        <RefreshCw className="h-4 w-4 animate-spin" />
        <span>{STATE_TEXT[dataState]}...</span>
      </div>
    );
  }

  if (!data) {
    return null;
  }

  const { summary, levels, baostockLatestDate, currentTime } = data;

  const statusColors = {
    ok: 'bg-green-100 text-green-800 border-green-200 dark:bg-green-900/30 dark:text-green-300 dark:border-green-800',
    stale: 'bg-yellow-100 text-yellow-800 border-yellow-200 dark:bg-yellow-900/30 dark:text-yellow-300 dark:border-yellow-800',
    missing: 'bg-red-100 text-red-800 border-red-200 dark:bg-red-900/30 dark:text-red-300 dark:border-red-800',
    error: 'bg-red-100 text-red-800 border-red-200 dark:bg-red-900/30 dark:text-red-300 dark:border-red-800',
    pending: 'bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-800',
  };

  const statusIcons = {
    ok: <CheckCircle className="h-3.5 w-3.5" />,
    stale: <AlertTriangle className="h-3.5 w-3.5" />,
    missing: <XCircle className="h-3.5 w-3.5" />,
    error: <XCircle className="h-3.5 w-3.5" />,
    pending: <Loader2 className="h-3.5 w-3.5 animate-spin" />,
  };

  // P1修复：根据状态机状态决定样式
  const getOverallStyles = () => {
    if (isFailed) {
      return 'bg-red-50 border-red-200 dark:bg-red-950/30 dark:border-red-800';
    }
    if (isSyncing) {
      return 'bg-blue-50 border-blue-200 dark:bg-blue-950/30 dark:border-blue-800';
    }
    if (isLoading) {
      return 'bg-blue-50 border-blue-200 dark:bg-blue-950/30 dark:border-blue-800';
    }
    if (isReady) {
      return 'bg-green-50 border-green-200 dark:bg-green-950/30 dark:border-green-800';
    }
    return {
      ok: 'bg-green-50 border-green-200 dark:bg-green-950/30 dark:border-green-800',
      warning: 'bg-yellow-50 border-yellow-200 dark:bg-yellow-950/30 dark:border-yellow-800',
      error: 'bg-red-50 border-red-200 dark:bg-red-950/30 dark:border-red-800',
      syncing: 'bg-blue-50 border-blue-200 dark:bg-blue-950/30 dark:border-blue-800',
    }[summary.overallStatus];
  };

  const getOverallIcon = () => {
    if (isFailed) {
      return <XCircle className="h-5 w-5 text-red-600" />;
    }
    if (isSyncing) {
      return <Loader2 className="h-5 w-5 text-blue-600 animate-spin" />;
    }
    if (isLoading) {
      return <RefreshCw className="h-5 w-5 text-blue-600 animate-spin" />;
    }
    if (isReady) {
      return <CheckCircle className="h-5 w-5 text-green-600" />;
    }
    return {
      ok: <CheckCircle className="h-5 w-5 text-green-600" />,
      warning: <AlertTriangle className="h-5 w-5 text-yellow-600" />,
      error: <XCircle className="h-5 w-5 text-red-600" />,
      syncing: <Loader2 className="h-5 w-5 text-blue-600 animate-spin" />,
    }[summary.overallStatus];
  };

  const getCompletenessColor = (completeness: number) => {
    if (completeness >= 80) return 'text-green-600';
    if (completeness >= 50) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getCompletenessBgColor = (completeness: number) => {
    if (completeness >= 80) return 'bg-green-600';
    if (completeness >= 50) return 'bg-yellow-600';
    return 'bg-red-600';
  };

  return (
    <div className={`rounded-lg border ${getOverallStyles()} overflow-hidden`}>
      {/* 头部概览 */}
      <div className="flex items-center justify-between px-4 py-3">
        <div className="flex items-center gap-3">
          {getOverallIcon()}
          <div>
            <div className="font-medium text-sm">数据完整性检查</div>
            <div className="text-xs text-muted-foreground">
              {isFailed && errorMessage
                ? errorMessage
                : (isLoading || isSyncing || isAnalyzing ? STATE_TEXT[dataState] : summary.overallText)}
              {!isFailed && baostockLatestDate && (
                <span className="ml-2 opacity-70">
                  (数据源最新: {baostockLatestDate})
                </span>
              )}
            </div>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          {/* 级别状态快捷指示 */}
          <div className="flex items-center gap-1">
            {levels.map(level => (
              <Badge 
                key={level.key}
                variant="outline"
                className={`text-[10px] px-1.5 py-0 ${statusColors[level.status]}`}
                title={`${level.name}: ${level.statusText}`}
              >
                {level.icon} {level.name}
              </Badge>
            ))}
          </div>
          
          {/* P1修复：同步按钮 - 根据状态机显示不同按钮 */}
          {onSync && (
            <>
              {summary.needsSyncLevels.length > 0 && !isSyncing && !isReady && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleSyncAndVerify}
                  data-sync-missing
                  disabled={isLoading || isAnalyzing}
                  className="text-xs h-7"
                >
                  {isLoading ? (
                    <>
                      <RefreshCw className="h-3 w-3 mr-1 animate-spin" />
                      验证中
                    </>
                  ) : (
                    <>
                      <RefreshCw className="h-3 w-3 mr-1" />
                      同步缺失数据
                    </>
                  )}
                </Button>
              )}
              
              {/* 就绪状态显示刷新按钮 */}
              {isReady && (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={checkIntegrity}
                  disabled={isLoading}
                  className="text-xs h-7"
                >
                  <RefreshCw className={`h-3 w-3 mr-1 ${isLoading ? 'animate-spin' : ''}`} />
                  刷新
                </Button>
              )}
            </>
          )}
          
          {/* 失败状态显示重试按钮 */}
          {isFailed && (
            <Button
              size="sm"
              variant="outline"
              onClick={checkIntegrity}
              className="text-xs h-7"
            >
              <RefreshCw className="h-3 w-3 mr-1" />
              重试
            </Button>
          )}
          
          {/* 展开/收起按钮 */}
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setExpanded(!expanded)}
            className="h-7 w-7 p-0"
          >
            {expanded ? (
              <ChevronUp className="h-4 w-4" />
            ) : (
              <ChevronDown className="h-4 w-4" />
            )}
          </Button>
        </div>
      </div>

      {/* 展开详情 */}
      {expanded && (
        <div className="px-4 pb-3 pt-0 border-t border-current/10">
          {/* 数据源信息 */}
          <div className="flex items-center gap-4 mb-3 text-xs text-muted-foreground">
            {baostockLatestDate && (
              <div className="flex items-center gap-1">
                <Info className="h-3 w-3" />
                <span>数据源最新日期: <strong>{baostockLatestDate}</strong></span>
              </div>
            )}
            <div className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              <span>当前日期: <strong>{currentTime}</strong></span>
            </div>
            {/* P1修复：显示当前状态 */}
            <div className="flex items-center gap-1">
              <Database className="h-3 w-3" />
              <span>状态: <strong>{STATE_TEXT[dataState]}</strong></span>
            </div>
          </div>
          
          {/* 各级别详情 */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
            {levels.map(level => (
              <div
                key={level.key}
                className={`rounded-md p-3 ${statusColors[level.status]} border`}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-1.5">
                    {statusIcons[level.status]}
                    <span className="font-medium text-xs">{level.icon} {level.name}</span>
                  </div>
                  <span className="text-[10px] opacity-70">{level.statusText}</span>
                </div>
                
                {/* 数据条目对比 */}
                <div className="mb-2">
                  <div className="flex items-center justify-between text-[10px] mb-1">
                    <span className="opacity-70">数据条目</span>
                    <span className="font-medium">
                      {level.recordCount}
                      <span className="opacity-50 font-normal"> / {level.expectedDescription}</span>
                    </span>
                  </div>
                  {/* 以 minRecords(233) 为满分，满足分析要求即为绿色满格 */}
                  <Progress
                    value={Math.min(100, Math.round((level.recordCount / level.minRecords) * 100))}
                    className="h-1.5"
                    style={{
                      ['--progress-background' as string]: level.recordCount >= level.minRecords ? '#16a34a' : level.recordCount >= level.minRecords * 0.5 ? '#ca8a04' : '#dc2626'
                    }}
                  />
                  <div className="text-[10px] mt-1 opacity-60">
                    {level.recordCount >= level.minRecords
                      ? `✓ 已满足 MA233 分析要求`
                      : `还需 ${level.minRecords - level.recordCount} 条满足 MA233`}
                  </div>
                </div>
                
                {/* 最新日期 */}
                <div className="flex items-center gap-1 text-[10px] opacity-60 mb-1">
                  <Clock className="h-3 w-3" />
                  <span>{level.lastDate || '无数据'}</span>
                </div>
                
                {/* 问题说明 */}
                {level.issues.length > 0 && (
                  <div className="mt-1 text-[10px] opacity-70 space-y-0.5">
                    {level.issues.map((issue, idx) => (
                      <div key={idx}>• {issue}</div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
          
          {/* 图例说明 */}
          <div className="flex items-center gap-4 mt-3 text-[10px] text-muted-foreground">
            <div className="flex items-center gap-1">
              <CheckCircle className="h-3 w-3 text-green-600" />
              <span>正常 ({summary.okCount})</span>
            </div>
            <div className="flex items-center gap-1">
              <AlertTriangle className="h-3 w-3 text-yellow-600" />
              <span>过期 ({summary.staleCount})</span>
            </div>
            <div className="flex items-center gap-1">
              <XCircle className="h-3 w-3 text-red-600" />
              <span>缺失/错误 ({summary.missingCount + summary.errorCount})</span>
            </div>
          </div>
          
          {/* 分析说明 */}
          <div className="mt-3 pt-2 border-t border-current/10 text-[10px] text-muted-foreground">
            <p>💡 所有级别数据都必须最新才能开始分析</p>
          </div>
        </div>
      )}
    </div>
  );
}
