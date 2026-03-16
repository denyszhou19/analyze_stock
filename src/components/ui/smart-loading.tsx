'use client';

import { useState, useEffect, useRef } from 'react';
import { Loader2 } from 'lucide-react';
import { Progress } from './progress';

interface SmartLoadingProps {
  isLoading: boolean;
  slowThreshold?: number; // 超过多少毫秒显示进度条，默认 3000ms
  loadingText?: string;
  slowLoadingText?: string;
}

// 加载阶段提示语
const LOADING_STAGES = [
  { time: 0, text: '正在连接数据源...', progress: 10 },
  { time: 2000, text: '获取股票历史数据...', progress: 30 },
  { time: 5000, text: '处理 K 线数据...', progress: 50 },
  { time: 8000, text: '计算技术指标...', progress: 70 },
  { time: 12000, text: '渲染图表数据...', progress: 90 },
  { time: 15000, text: '即将完成...', progress: 95 },
];

/**
 * 智能加载组件
 * - 加载时间 < 3秒：显示简单的 loading spinner
 * - 加载时间 >= 3秒：显示进度条 + 阶段提示
 */
export function SmartLoading({
  isLoading,
  slowThreshold = 3000,
  loadingText = '加载中...',
  slowLoadingText = '正在从远程获取数据...',
}: SmartLoadingProps) {
  const [isSlowLoading, setIsSlowLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [stageText, setStageText] = useState(slowLoadingText);
  const startTimeRef = useRef<number>(0);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const progressTimerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (isLoading) {
      startTimeRef.current = Date.now();
      
      // 3秒后切换到进度条模式
      timerRef.current = setTimeout(() => {
        setIsSlowLoading(true);
      }, slowThreshold);

      // 进度动画
      progressTimerRef.current = setInterval(() => {
        const elapsed = Date.now() - startTimeRef.current;
        
        // 根据时间更新阶段
        let currentStage = LOADING_STAGES[0];
        for (let i = LOADING_STAGES.length - 1; i >= 0; i--) {
          if (elapsed >= LOADING_STAGES[i].time) {
            currentStage = LOADING_STAGES[i];
            break;
          }
        }
        
        setStageText(currentStage.text);
        
        // 进度条：基于时间的渐进式增长，但不达到 100%
        // 使用对数曲线让进度看起来更自然
        const baseProgress = currentStage.progress;
        const timeProgress = Math.min(10, elapsed / 1000); // 每秒增加一些
        const targetProgress = Math.min(98, baseProgress + timeProgress);
        
        setProgress(prev => {
          // 进度只增不减
          return Math.max(prev, targetProgress);
        });
      }, 200);
    } else {
      // 清理定时器
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      if (progressTimerRef.current) {
        clearInterval(progressTimerRef.current);
        progressTimerRef.current = null;
      }
      
      // 重置状态
      setIsSlowLoading(false);
      setProgress(0);
      setStageText(slowLoadingText);
    }

    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
      if (progressTimerRef.current) {
        clearInterval(progressTimerRef.current);
      }
    };
  }, [isLoading, slowThreshold, slowLoadingText]);

  if (!isLoading) return null;

  // 快速加载：简单 spinner
  if (!isSlowLoading) {
    return (
      <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-10 w-10 animate-spin text-primary" />
          <p className="text-sm sm:text-base text-muted-foreground">{loadingText}</p>
        </div>
      </div>
    );
  }

  // 慢速加载：进度条 + 阶段提示
  return (
    <div className="fixed inset-0 bg-background/95 backdrop-blur-md z-50 flex items-center justify-center">
      <div className="w-[90%] max-w-md flex flex-col items-center gap-6 p-6 bg-card rounded-2xl shadow-2xl border">
        {/* 动画图标 */}
        <div className="relative">
          <div className="h-16 w-16 rounded-full border-4 border-muted" />
          <div 
            className="absolute inset-0 h-16 w-16 rounded-full border-4 border-primary border-t-transparent animate-spin"
            style={{ animationDuration: '1s' }}
          />
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-lg font-bold text-primary">{Math.round(progress)}%</span>
          </div>
        </div>

        {/* 进度条 */}
        <div className="w-full space-y-2">
          <Progress value={progress} className="h-2" />
          <p className="text-sm text-muted-foreground text-center animate-pulse">
            {stageText}
          </p>
        </div>

        {/* 提示文字 */}
        <div className="text-xs text-muted-foreground text-center space-y-1">
          <p>首次加载需要从远程获取历史数据</p>
          <p>请耐心等待，数据将自动缓存</p>
        </div>
      </div>
    </div>
  );
}

/**
 * 迷你版智能加载（用于卡片/区域级别）
 */
export function SmartLoadingMini({
  isLoading,
  slowThreshold = 3000,
  loadingText = '加载中...',
}: Omit<SmartLoadingProps, 'slowLoadingText'>) {
  const [isSlowLoading, setIsSlowLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const progressTimerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (isLoading) {
      // 3秒后切换到进度条模式
      timerRef.current = setTimeout(() => {
        setIsSlowLoading(true);
      }, slowThreshold);

      // 进度动画
      progressTimerRef.current = setInterval(() => {
        setProgress(prev => {
          if (prev >= 95) return prev;
          return prev + Math.random() * 5;
        });
      }, 300);
    } else {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      if (progressTimerRef.current) {
        clearInterval(progressTimerRef.current);
        progressTimerRef.current = null;
      }
      setIsSlowLoading(false);
      setProgress(0);
    }

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      if (progressTimerRef.current) clearInterval(progressTimerRef.current);
    };
  }, [isLoading, slowThreshold]);

  if (!isLoading) return null;

  if (!isSlowLoading) {
    return (
      <div className="absolute inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center rounded-lg z-10">
        <div className="flex items-center gap-2">
          <Loader2 className="h-5 w-5 animate-spin text-primary" />
          <span className="text-sm text-muted-foreground">{loadingText}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="absolute inset-0 bg-background/95 backdrop-blur-sm flex flex-col items-center justify-center gap-3 rounded-lg z-10">
      <Progress value={progress} className="w-3/4 h-1.5" />
      <p className="text-xs text-muted-foreground">正在获取数据 {Math.round(progress)}%</p>
    </div>
  );
}

export default SmartLoading;
