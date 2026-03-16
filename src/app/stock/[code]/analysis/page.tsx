'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  ArrowLeft, Loader2, TrendingUp, TrendingDown, AlertTriangle,
  CheckCircle, Activity, Target, BarChart2, Zap, Clock,
  ArrowUpRight, ArrowDownRight, Minus, AlertCircle, Sparkles,
  FileText, ChevronDown, ChevronUp, Download, Info, RefreshCw, Database
} from 'lucide-react';
import { Markdown } from '@/components/ui/markdown';
import { SmartLoading } from '@/components/ui/smart-loading';
import { SyncStatusAlert } from '@/components/stock/SyncStatusAlert';
import { DataSyncTime } from '@/components/stock/DataSyncTime';
import { DataIntegrityAlert } from '@/components/stock/DataIntegrityAlert';
import { domToJpeg } from 'modern-screenshot';
import jsPDF from 'jspdf';

interface MovingAverages {
  MA55: number | null;
  MA233: number | null;
  price_vs_ma55: 'above' | 'below' | null;
  price_vs_ma233: 'above' | 'below' | null;
  distance_ma55_pct: number | null;
  distance_ma233_pct: number | null;
  ma_status: string | null;
}

// 均线物理性质分析（新增）
interface MaPhysics {
  support_pressure: {
    ma55_role?: string;
    ma55_value?: number;
    distance_pct?: number;
    recent_touch?: boolean;
    touch_type?: string;
    status?: string;
    ma233_role?: string;
    ma233_value?: number;
    ma233_distance_pct?: number;
  } | null;
  traction: {
    deviation_ma55_pct?: number;
    is_over_deviation?: boolean;
    recent_break?: boolean;
    break_type?: string;
    pullback_expected?: boolean;
    traction_force?: string;
  } | null;
  resonance: {
    ma55_ma233_distance_pct?: number;
    is_converging?: boolean;
    convergence_strength?: string;
    resonance_zone?: [number, number] | null;
  } | null;
  identity: boolean;
  key_signals: string[];
  alerts: string[];
}

// 突破/跌破形态识别（新增）
interface BreakthroughPattern {
  pattern_type: string | null;
  pattern_name: string | null;
  direction: 'up' | 'down' | null;  // 方向：'up'为突破，'down'为跌破
  target_ma: string | null;
  is_valid: boolean | null;
  confidence: string | null;
  description: string;
  key_signals: string[];
  alerts: string[];
  t0_index?: number | null;         // T0 索引位置
  t0_date?: string | null;          // T0 日期
}

interface MacdData {
  DIF: number | null;
  DEA: number | null;
  MACD: number | null;
  status: string;
  description: string;
  top_divergence: boolean;
  bottom_divergence: boolean;
  divergence_note: string;
}

interface StructureData {
  structure_type: string;
  structure_stage: string;
  trend_direction: string;
  inflection_points: number;
  segment_count: number;
  description: string;
  structure_details?: {
    top_fractals: Array<{index: number; date: string; high: number}>;
    bottom_fractals: Array<{index: number; date: string; low: number}>;
    strokes: Array<{
      from_date: string;
      to_date: string;
      from_price: number;
      to_price: number;
      direction: string;
      length: number;
      from_type: string;
      to_type: string;
      is_current?: boolean;
    }>;
    judgment_criteria: string;
    prediction?: {
      current_stage: string;
      next_stage: string;
      prediction_alert: string;
      key_price_levels: Array<{
        price: number;
        type: string;
        note: string;
      }>;
      confidence: 'high' | 'medium' | 'low';
      action_hint: string;
    };
    peak_analysis?: {
      is_peak_structure: boolean;
      peak_type: 'mountain_peak' | 'valley_bottom' | null;
      peak_price: number | null;
      peak_index: number | null;
      left_structure: string | null;
      right_structure: string | null;
      left_components: Array<{type: string; strokes: unknown[]}>;
      right_components: Array<{type: string; strokes: unknown[]}>;
      description: string;
    };
    left_structure_warning?: {
      type: 'mountain_peak_left' | 'valley_bottom_left';
      title: string;
      left_structure: string;
      peak_price?: number;
      valley_price?: number;
      warning?: string;
      opportunity?: string;
      risk_description?: string;
      opportunity_description?: string;
      key_defense?: string;
      key_resistance?: string;
      action_hint: string;
    };
  };
}

interface KeyLevel {
  level: number;
  type: string;
  strength: string;
}

interface KeyLevels {
  support_levels: KeyLevel[];
  resistance_levels: KeyLevel[];
  ma55: number | null;
  ma233: number | null;
}

interface PeriodAnalysis {
  period: string;
  error?: string;
  analysis_date: string | null;
  latest_price: number;
  price_change_pct: number | null;
  volume: number | null;
  moving_averages: MovingAverages;
  ma_physics?: MaPhysics;           // 均线物理性质（新增）
  breakthrough?: BreakthroughPattern; // 突破形态识别（新增）
  macd: MacdData;
  structure: StructureData;
  key_levels: KeyLevels;
  key_alerts?: string[] | null;     // 重点提醒（新增）
}

// 单维度操作建议
interface DimensionOperationAdvice {
  major_level: string;           // 大级别标识
  major_level_name: string;      // 大级别名称（周线/日线/60分钟）
  major_status: string | null;   // 大级别MACD状态
  minor_level: string;           // 小级别标识
  minor_level_name: string;      // 小级别名称（日线/30分钟/15分钟）
  minor_structure: string | null; // 小级别结构类型
  minor_trend: string | null;    // 小级别趋势方向
  advice: {                      // 详细操作建议
    major_status: string;
    minor_structure: string | null;
    minor_trend: string | null;
    matched_structures: string[] | { 上涨结构: string[]; 下跌结构: string[] };
    operation_advice: string;
    structure_match: boolean;
    structure_direction: string;
    explanation: string;
  } | null;
}

// 多维度操作建议（三个维度）
interface MultiDimensionOperation {
  dimension1: DimensionOperationAdvice | null;  // 周线+日线
  dimension2: DimensionOperationAdvice | null;  // 日线+30分钟
  dimension3: DimensionOperationAdvice | null;  // 60分钟+15分钟
}

interface LevelNesting {
  dimension1: {
    weekly_status: string;
    weekly_structure: string;
    daily_status: string;
    daily_structure: string;
    daily_ma55_position: string;
    hour60_status: string;
    analysis: string;
  } | null;
  dimension2: {
    daily_status: string;
    daily_structure: string;
    hour30_status: string;
    hour15_structure: string;
    analysis: string;
  } | null;
  dimension3: {
    hour60_status: string;
    hour60_ma55_position: string;
    hour15_structure: string;
    analysis: string;
  } | null;
  summary: string;
}

interface AnalysisResult {
  stock_code: string;
  stock_name: string;
  analysis_time: string;
  analyzed_levels: string[];
  periods: Record<string, PeriodAnalysis>;
  level_nesting: LevelNesting;
  multi_dimension_operation: MultiDimensionOperation;  // 多维度操作建议
}

interface PrepareAnalysisData {
  ready: boolean;
  phase: string;
  summary?: {
    canAnalyze: boolean;
    overallText: string;
    analyzeWarning: string | null;
    needsSyncLevels?: string[];
    pendingCount?: number;
  };
  levels?: Array<{
    key: string;
    name: string;
    status: string;
  }>;
  syncResults?: Array<{
    frequency: string;
    success: boolean;
    message?: string;
  }> | null;
}

// 周期名称映射
const PERIOD_NAMES: Record<string, string> = {
  weekly: '周线',
  daily: '日线',
  hour60: '60分钟',
  hour30: '30分钟',
  hour15: '15分钟',
};

// 周期重要性排序
const PERIOD_ORDER = ['weekly', 'daily', 'hour60', 'hour30', 'hour15'];

// 判断是否为利好信号
const isBullishStatus = (status: string): boolean => {
  return ['极强', '强', '中偏强'].includes(status);
};

// 判断是否为利空信号
const isBearishStatus = (status: string): boolean => {
  return ['极弱', '弱', '中偏弱'].includes(status);
};

// MACD 状态样式（利好红色，利空绿色）
const getMacdStatusStyle = (status: string): string => {
  if (status === '极强') return 'bg-red-500 text-white font-bold shadow-lg shadow-red-200';
  if (status === '强') return 'bg-red-400 text-white font-semibold';
  if (status === '中偏强') return 'bg-red-100 text-red-700 border-2 border-red-300';
  if (status === '极弱') return 'bg-green-500 text-white font-bold shadow-lg shadow-green-200';
  if (status === '弱') return 'bg-green-400 text-white font-semibold';
  if (status === '中偏弱') return 'bg-green-100 text-green-700 border-2 border-green-300';
  return 'bg-gray-100 text-gray-700';
};

// 结构类型样式
const STRUCTURE_COLORS: Record<string, string> = {
  'A五段式': 'bg-amber-100 text-amber-800 border border-amber-300',
  'B双平台式': 'bg-purple-100 text-purple-800 border border-purple-300',
  'C单平台式': 'bg-blue-100 text-blue-800 border border-blue-300',
  'D三段式': 'bg-gray-100 text-gray-700 border border-gray-300',
  '复杂结构': 'bg-rose-100 text-rose-800 border border-rose-300',
  '山峰形态': 'bg-gradient-to-r from-red-100 to-green-100 text-gray-800 border border-gray-300',
  '山谷形态': 'bg-gradient-to-r from-green-100 to-red-100 text-gray-800 border border-gray-300',
};

// 趋势方向样式（利好红色，利空绿色）
const getTrendStyle = (trend: string): string => {
  if (trend === '上涨') return 'bg-red-100 text-red-700 font-semibold border-2 border-red-300';
  if (trend === '下跌') return 'bg-green-100 text-green-700 font-semibold border-2 border-green-300';
  return 'bg-gray-100 text-gray-600';
};

// 均线状态样式（利好红色，利空绿色）
const getMaStatusStyle = (status: string | null): string => {
  if (!status) return 'bg-gray-100 text-gray-600';
  if (status.includes('多头') || status === '站上MA55' || status.includes('金叉')) {
    return 'bg-red-100 text-red-700 font-semibold';
  }
  if (status.includes('空头') || status === '跌破MA55' || status.includes('死叉')) {
    return 'bg-green-100 text-green-700 font-semibold';
  }
  return 'bg-gray-100 text-gray-600';
};

// 格式化成交量
const formatVolume = (volume: number | null): string => {
  if (!volume) return '-';
  if (volume >= 100000000) return `${(volume / 100000000).toFixed(2)}亿`;
  if (volume >= 10000) return `${(volume / 10000).toFixed(2)}万`;
  return volume.toString();
};

// 单维度操作建议展示组件
function DimensionAdviceCard({ dimension }: { dimension: DimensionOperationAdvice }) {
  if (!dimension || !dimension.advice) return null;
  
  return (
    <div className="space-y-3">
      {/* 第一步：大级别状态 */}
      <div className="flex flex-wrap items-center gap-2 p-2 bg-white/50 rounded-lg">
        <Badge variant="outline" className="text-xs bg-amber-100">第一步</Badge>
        <span className="text-sm font-medium">大级别（{dimension.major_level_name}）状态:</span>
        <Badge className={`text-sm ${getMacdStatusStyle(dimension.major_status || '')}`}>
          {dimension.major_status || '-'}
        </Badge>
      </div>

      {/* 第二步：期望小级别结构 */}
      {dimension.advice.matched_structures && (
        <div className="flex flex-col gap-2 p-2 bg-white/50 rounded-lg">
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-xs bg-blue-100">第二步</Badge>
            <span className="text-sm font-medium">期望小级别结构（根据大级别状态应关注的结构）:</span>
          </div>
          <div className="flex flex-col gap-1 ml-6">
            {Array.isArray(dimension.advice.matched_structures) ? (
              <div className="flex gap-1 flex-wrap">
                {dimension.advice.matched_structures.map((s, i) => (
                  <Badge key={i} variant="outline" className="text-sm border-blue-300 text-blue-700">
                    {s === 'A' ? 'A五段式' : s === 'B' ? 'B双平台式' : s === 'C' ? 'C单平台式' : s === 'D' ? 'D三段式' : s}
                  </Badge>
                ))}
              </div>
            ) : (
              <div className="flex flex-col gap-1">
                {dimension.advice.matched_structures.上涨结构?.length > 0 && dimension.advice.matched_structures.上涨结构[0] && (
                  <div className="flex items-center gap-1 flex-wrap">
                    <span className="text-xs text-red-600 font-medium">若上涨，期望结构:</span>
                    {dimension.advice.matched_structures.上涨结构.map((s, i) => (
                      <Badge key={i} variant="outline" className="text-sm border-red-300 text-red-700">
                        {s === 'A' ? 'A五段式' : s === 'B' ? 'B双平台式' : s === 'C' ? 'C单平台式' : s === 'D' ? 'D三段式' : s}
                      </Badge>
                    ))}
                  </div>
                )}
                {dimension.advice.matched_structures.下跌结构?.length > 0 && dimension.advice.matched_structures.下跌结构[0] && (
                  <div className="flex items-center gap-1 flex-wrap">
                    <span className="text-xs text-green-600 font-medium">若下跌，期望结构:</span>
                    {dimension.advice.matched_structures.下跌结构.map((s, i) => (
                      <Badge key={i} variant="outline" className="text-sm border-green-300 text-green-700">
                        {s === 'A' ? 'A五段式' : s === 'B' ? 'B双平台式' : s === 'C' ? 'C单平台式' : s === 'D' ? 'D三段式' : s}
                      </Badge>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* 第三步：实际小级别结构 */}
      {dimension.minor_structure && (
        <div className="flex flex-wrap items-center gap-2 p-2 bg-white/50 rounded-lg">
          <Badge variant="outline" className="text-xs bg-purple-100">第三步</Badge>
          <span className="text-sm font-medium">实际小级别（{dimension.minor_level_name}）结构:</span>
          <Badge variant="outline" className="text-sm border-purple-300 text-purple-700">
            {dimension.minor_structure}
          </Badge>
          {dimension.minor_trend && (
            <>
              <span className="text-sm font-medium ml-2">趋势:</span>
              <Badge variant="outline" className={`text-sm ${getTrendStyle(dimension.minor_trend)}`}>
                {dimension.minor_trend}
              </Badge>
            </>
          )}
          {/* 匹配结果 */}
          {dimension.advice.structure_match ? (
            <Badge className="bg-green-500 text-white text-xs ml-2">✓ 结构匹配</Badge>
          ) : (
            <Badge variant="outline" className="text-xs border-gray-300 text-gray-600 ml-2">✗ 结构不匹配</Badge>
          )}
        </div>
      )}

      {/* 第四步：操作要点 */}
      <div className="p-3 bg-white/70 rounded-lg border border-amber-200">
        <div className="flex items-center gap-2 mb-2">
          <Badge variant="outline" className="text-xs bg-green-100">第四步</Badge>
          <span className="text-xs font-semibold text-amber-700">操作要点</span>
        </div>
        <p className="text-sm text-foreground leading-relaxed whitespace-pre-line">
          {dimension.advice.operation_advice}
        </p>
      </div>

      {/* 详细解释 */}
      {dimension.advice.explanation && (
        <div className="p-3 bg-white/50 rounded-lg border border-amber-100">
          <div className="text-xs font-semibold text-muted-foreground mb-1">详细说明</div>
          <p className="text-sm text-muted-foreground leading-relaxed">
            {dimension.advice.explanation}
          </p>
        </div>
      )}
    </div>
  );
}

export default function StockAnalysisPage() {
  const params = useParams();
  const router = useRouter();
  const code = params.code as string;

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [stockName, setStockName] = useState<string>('');
  
  // 数据完整性状态
  const [dataIntegrityStatus, setDataIntegrityStatus] = useState<{
    canAnalyze: boolean;
    isChecking: boolean;
    isSyncing: boolean;
    summary: string;
    warning: string | null;
    needsSyncLevels: string[];
  }>({
    canAnalyze: false,
    isChecking: true,
    isSyncing: false,
    summary: '',
    warning: null,
    needsSyncLevels: [],
  });
  
  // AI 智能分析状态
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [aiReport, setAiReport] = useState<string | null>(null);
  const [aiError, setAiError] = useState<string | null>(null);
  const [showAiReport, setShowAiReport] = useState(false);
  
  // PDF 导出状态
  const [isExportingPdf, setIsExportingPdf] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);
  const activeRunIdRef = useRef(0);
  const autoLoadTriggeredRef = useRef(false);

  const applyPrepareState = useCallback((prepared: PrepareAnalysisData, runId?: number) => {
    if (typeof runId === 'number' && runId !== activeRunIdRef.current) {
      return;
    }

    const summary = prepared.summary;
    setDataIntegrityStatus({
      canAnalyze: !!prepared.ready,
      isChecking: false,
      isSyncing: false,
      summary: summary?.overallText || (prepared.ready ? '数据就绪，可以分析' : '数据准备未完成'),
      warning: prepared.ready ? null : (summary?.analyzeWarning || '数据不完整，请先同步数据后再分析'),
      needsSyncLevels: summary?.needsSyncLevels || [],
    });
  }, []);

  const prepareAnalysis = useCallback(async (
    options: { forceSync?: boolean; levels?: string[] } = {},
    runId?: number
  ) => {
    const { forceSync = false, levels = [] } = options;

    console.log('[分析流程] 步骤1: 准备分析数据...', { forceSync, levels });

    const prepareRes = await fetch('/api/stock/prepare-analysis', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        code,
        forceSync,
        levels,
      }),
    });

    const prepareResult = await prepareRes.json();
    if (!prepareResult.success) {
      throw new Error(prepareResult.error || '数据准备失败');
    }

    const prepared = prepareResult.data as PrepareAnalysisData;
    applyPrepareState(prepared, runId);

    if (!prepared.ready) {
      const failedSyncs = prepared.syncResults?.filter(item => !item.success) || [];
      if (failedSyncs.length > 0) {
        throw new Error(`数据同步失败: ${failedSyncs.map(item => item.frequency).join(', ')}`);
      }

      const pendingLevels = prepared.levels?.filter(level => level.status === 'pending').map(level => level.name) || [];
      if (pendingLevels.length > 0) {
        throw new Error(`数据仍在同步中: ${pendingLevels.join('、')}`);
      }

      throw new Error(prepared.summary?.analyzeWarning || '数据准备未完成');
    }

    return prepared;
  }, [applyPrepareState, code]);

  const loadAnalysis = useCallback(async (options: { forceSync?: boolean; levels?: string[] } = {}) => {
    const { forceSync = false, levels = [] } = options;
    const runId = activeRunIdRef.current + 1;
    activeRunIdRef.current = runId;

    setIsLoading(true);
    setError(null);
    setResult(null);
    setDataIntegrityStatus(prev => ({
      ...prev,
      isChecking: !forceSync,
      isSyncing: forceSync || levels.length > 0,
    }));

    try {
      await prepareAnalysis({ forceSync, levels }, runId);

      if (runId !== activeRunIdRef.current) {
        return;
      }

      // ============ 第二步：执行分析 ============
      console.log('[分析流程] 步骤2: 执行三位一体分析...');
      
      const [analysisRes, infoRes] = await Promise.all([
        fetch(`/api/stock/analysis?code=${code}`),
        fetch(`/api/stock/info?code=${code}`)
      ]);

      const analysisData = await analysisRes.json();
      const infoData = await infoRes.json();

      if (runId !== activeRunIdRef.current) {
        return;
      }

      if (infoData.success && infoData.data?.name) {
        setStockName(infoData.data.name);
      }

      if (!analysisData.success) {
        if (analysisData.code === 'DATA_INCOMPLETE') {
          console.error('[分析流程] 分析接口报告数据不完整:', analysisData.error);
          setDataIntegrityStatus(prev => ({
            ...prev,
            canAnalyze: false,
            warning: analysisData.error
          }));
        }
        setError(analysisData.error || '分析失败');
      } else {
        console.log('[分析流程] 分析完成，数据级别:', Object.keys(analysisData.data?.periods || {}));
        setResult(analysisData.data);
      }
    } catch (err) {
      if (runId !== activeRunIdRef.current) {
        return;
      }
      console.error('[分析流程] 异常:', err);
      setError(err instanceof Error ? err.message : '分析失败');
    } finally {
      if (runId !== activeRunIdRef.current) {
        return;
      }
      setIsLoading(false);
      setDataIntegrityStatus(prev => ({ ...prev, isChecking: false, isSyncing: false }));
    }
  }, [code, prepareAnalysis]);

  const handleManualSync = useCallback(async (frequencies?: string[]) => {
    await loadAnalysis({
      forceSync: true,
      levels: frequencies && frequencies.length > 0 ? frequencies : dataIntegrityStatus.needsSyncLevels,
    });
  }, [dataIntegrityStatus.needsSyncLevels, loadAnalysis]);

  useEffect(() => {
    autoLoadTriggeredRef.current = false;
    activeRunIdRef.current = 0;
  }, [code]);

  useEffect(() => {
    if (autoLoadTriggeredRef.current) {
      return;
    }

    autoLoadTriggeredRef.current = true;
    void loadAnalysis();
  }, [loadAnalysis]);

  // AI 智能分析
  const loadAiAnalysis = async () => {
    if (!result) return;
    
    setIsAiLoading(true);
    setAiError(null);
    setAiReport(null);
    
    try {
      const response = await fetch('/api/stock/ai-analysis', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code,
          analysisData: result
        })
      });
      
      const data = await response.json();
      
      if (!data.success) {
        setAiError(data.error || 'AI 分析失败');
      } else {
        setAiReport(data.data.report);
        setShowAiReport(true);
      }
    } catch (err) {
      setAiError(err instanceof Error ? err.message : 'AI 分析失败');
    } finally {
      setIsAiLoading(false);
    }
  };

  // PDF 导出功能
  const exportToPdf = async () => {
    if (!contentRef.current) return;
    
    setIsExportingPdf(true);
    
    try {
      // 确保所有内容都展开
      if (aiReport && !showAiReport) {
        setShowAiReport(true);
        // 等待渲染
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      
      // 使用 modern-screenshot 生成 JPEG
      // scale 2 提供高清输出，quality 0.92 保证清晰度
      const dataUrl = await domToJpeg(contentRef.current, {
        scale: 2,
        backgroundColor: '#ffffff',
        quality: 0.92,
      });
      
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4',
        compress: true,
      });
      
      // 创建图片来获取尺寸
      const img = new Image();
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = reject;
        img.src = dataUrl;
      });
      
      const imgWidth = 210; // A4 宽度 mm
      const pageHeight = 297; // A4 高度 mm
      const imgHeight = (img.height * imgWidth) / img.width;
      let heightLeft = imgHeight;
      let position = 0;
      
      // 添加第一页
      pdf.addImage(dataUrl, 'JPEG', 0, position, imgWidth, imgHeight, undefined, 'MEDIUM');
      heightLeft -= pageHeight;
      
      // 如果内容超过一页，添加更多页
      while (heightLeft > 0) {
        position = heightLeft - imgHeight;
        pdf.addPage();
        pdf.addImage(dataUrl, 'JPEG', 0, position, imgWidth, imgHeight, undefined, 'MEDIUM');
        heightLeft -= pageHeight;
      }
      
      // 生成文件名
      const stockLabel = stockName || code;
      const date = new Date().toISOString().split('T')[0];
      pdf.save(`${stockLabel}_三位一体分析_${date}.pdf`);
      
    } catch (err) {
      console.error('PDF export error:', err);
      alert('PDF 导出失败，请重试');
    } finally {
      setIsExportingPdf(false);
    }
  };

  // 获取日线数据
  const dailyData = result?.periods?.daily;

  // 渲染MACD详情
  const renderMacdDetails = (macd: MacdData) => {
    const isDifPositive = (macd.DIF ?? 0) > 0;
    const isDeaPositive = (macd.DEA ?? 0) > 0;
    const isMacdPositive = (macd.MACD ?? 0) > 0;
    
    return (
      <div className="grid grid-cols-3 gap-2 text-center">
        <div className={`p-2 rounded-lg ${isDifPositive ? 'bg-red-50' : 'bg-green-50'}`}>
          <div className="text-xs text-muted-foreground">DIF</div>
          <div className={`font-mono font-semibold ${isDifPositive ? 'text-red-600' : 'text-green-600'}`}>
            {macd.DIF?.toFixed(4) ?? '-'}
          </div>
        </div>
        <div className={`p-2 rounded-lg ${isDeaPositive ? 'bg-red-50' : 'bg-green-50'}`}>
          <div className="text-xs text-muted-foreground">DEA</div>
          <div className={`font-mono font-semibold ${isDeaPositive ? 'text-red-600' : 'text-green-600'}`}>
            {macd.DEA?.toFixed(4) ?? '-'}
          </div>
        </div>
        <div className={`p-2 rounded-lg ${isMacdPositive ? 'bg-red-50' : 'bg-green-50'}`}>
          <div className="text-xs text-muted-foreground">MACD</div>
          <div className={`font-mono font-semibold ${isMacdPositive ? 'text-red-600' : 'text-green-600'}`}>
            {macd.MACD?.toFixed(4) ?? '-'}
          </div>
        </div>
      </div>
    );
  };

  // 渲染均线详情
  const renderMaDetails = (ma: MovingAverages) => {
    return (
      <div className="space-y-2">
        {/* MA55 */}
        {ma.MA55 && (
          <div className={`flex items-center justify-between p-2 rounded-lg ${ma.price_vs_ma55 === 'above' ? 'bg-red-50' : 'bg-green-50'}`}>
            <div className="flex items-center gap-2">
              {ma.price_vs_ma55 === 'above' ? (
                <ArrowUpRight className="h-4 w-4 text-red-500" />
              ) : (
                <ArrowDownRight className="h-4 w-4 text-green-500" />
              )}
              <span className="font-medium">MA55</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="font-mono">{ma.MA55.toFixed(2)}</span>
              {ma.distance_ma55_pct !== null && (
                <span className={`text-sm font-semibold ${ma.distance_ma55_pct >= 0 ? 'text-red-600' : 'text-green-600'}`}>
                  ({ma.distance_ma55_pct >= 0 ? '+' : ''}{ma.distance_ma55_pct.toFixed(1)}%)
                </span>
              )}
            </div>
          </div>
        )}
        
        {/* MA233 */}
        {ma.MA233 && (
          <div className={`flex items-center justify-between p-2 rounded-lg ${ma.price_vs_ma233 === 'above' ? 'bg-red-50' : 'bg-green-50'}`}>
            <div className="flex items-center gap-2">
              {ma.price_vs_ma233 === 'above' ? (
                <ArrowUpRight className="h-4 w-4 text-red-500" />
              ) : (
                <ArrowDownRight className="h-4 w-4 text-green-500" />
              )}
              <span className="font-medium">MA233</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="font-mono">{ma.MA233.toFixed(2)}</span>
              {ma.distance_ma233_pct !== null && (
                <span className={`text-sm font-semibold ${ma.distance_ma233_pct >= 0 ? 'text-red-600' : 'text-green-600'}`}>
                  ({ma.distance_ma233_pct >= 0 ? '+' : ''}{ma.distance_ma233_pct.toFixed(1)}%)
                </span>
              )}
            </div>
          </div>
        )}
      </div>
    );
  };

  // 渲染背离信号
  const renderDivergenceSignals = (macd: MacdData) => {
    if (!macd.top_divergence && !macd.bottom_divergence) return null;
    
    return (
      <div className="flex flex-wrap gap-2 mt-2">
        {macd.top_divergence && (
          <Badge className="bg-green-500 text-white font-semibold animate-pulse">
            <AlertTriangle className="h-3 w-3 mr-1" />
            顶背离预警
          </Badge>
        )}
        {macd.bottom_divergence && (
          <Badge className="bg-red-500 text-white font-semibold animate-pulse">
            <CheckCircle className="h-3 w-3 mr-1" />
            底背离信号
          </Badge>
        )}
        {macd.divergence_note && (
          <span className="text-xs text-muted-foreground">{macd.divergence_note}</span>
        )}
      </div>
    );
  };

  return (
    <div className="container mx-auto p-3 sm:p-4 space-y-3 sm:space-y-4 max-w-5xl">
      {/* 头部 */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b pb-3 sm:pb-4 gap-3">
        <div className="flex items-center gap-3 sm:gap-4">
          <Button variant="ghost" size="icon" onClick={() => router.back()} className="h-9 w-9">
            <ArrowLeft className="h-4 w-4 sm:h-5 sm:w-5" />
          </Button>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold flex items-center gap-2">
              <Zap className="h-5 w-5 sm:h-6 sm:w-6 text-yellow-500" />
              三位一体技术分析
            </h1>
            <p className="text-xs sm:text-sm text-muted-foreground mt-1">
              {stockName ? (
                <>
                  <span className="font-semibold">{stockName}</span>
                  <span className="mx-1">·</span>
                  <span className="font-mono">{code}</span>
                </>
              ) : (
                <>
                  股票代码: <span className="font-mono font-medium">{code}</span>
                </>
              )}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 ml-12 sm:ml-0">
          <Button 
            variant="default" 
            size="sm" 
            onClick={loadAiAnalysis} 
            disabled={isLoading || isAiLoading || !result} 
            className="h-9 text-xs sm:text-sm bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600"
          >
            {isAiLoading ? (
              <Loader2 className="h-3.5 w-3.5 sm:h-4 sm:w-4 sm:mr-2 animate-spin" />
            ) : (
              <Sparkles className="h-3.5 w-3.5 sm:h-4 sm:w-4 sm:mr-2" />
            )}
            <span className="hidden sm:inline">AI 智能分析</span>
          </Button>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={exportToPdf} 
            disabled={isLoading || isExportingPdf || !result} 
            className="h-9 text-xs sm:text-sm"
          >
            {isExportingPdf ? (
              <Loader2 className="h-3.5 w-3.5 sm:h-4 sm:w-4 sm:mr-2 animate-spin" />
            ) : (
              <Download className="h-3.5 w-3.5 sm:h-4 sm:w-4 sm:mr-2" />
            )}
            <span className="hidden sm:inline">导出 PDF</span>
          </Button>
          <Button variant="outline" size="sm" onClick={() => router.push(`/stock/${code}`)} className="h-9 text-xs sm:text-sm">
            <BarChart2 className="h-3.5 w-3.5 sm:h-4 sm:w-4 sm:mr-2" />
            <span className="hidden sm:inline">查看K线图</span>
          </Button>
          <Button variant="outline" size="sm" onClick={() => loadAnalysis()} disabled={isLoading} className="h-9 text-xs sm:text-sm">
            {isLoading ? <Loader2 className="h-3.5 w-3.5 sm:h-4 sm:w-4 sm:mr-2 animate-spin" /> : <Activity className="h-3.5 w-3.5 sm:h-4 sm:w-4 sm:mr-2" />}
            <span className="hidden sm:inline">重新分析</span>
          </Button>
        </div>
      </div>

      {/* 同步状态提醒 */}
      <SyncStatusAlert 
        code={code} 
        onSync={() => handleManualSync()} 
        isSyncing={isLoading || dataIntegrityStatus.isSyncing}
      />

      {/* 数据完整性检查 */}
      <DataIntegrityAlert 
        code={code} 
        onSync={handleManualSync}
        externalState={isLoading ? 'analyzing' : (result && dataIntegrityStatus.canAnalyze ? 'ready' : undefined)}
        onIntegrityCheck={(canAnalyze, summary) => {
          setDataIntegrityStatus(prev => ({
            ...prev,
            canAnalyze,
            summary: summary.overallText,
            warning: summary.analyzeWarning,
            needsSyncLevels: summary.needsSyncLevels || [],
          }));
        }}
      />

      {/* 数据同步时间 */}
      <DataSyncTime code={code} />

      {/* 数据同步提示 */}
      {(dataIntegrityStatus.isChecking || dataIntegrityStatus.isSyncing) && (
        <div className="flex items-center gap-2 text-sm text-blue-600 dark:text-blue-400 px-4 py-2 bg-blue-50 dark:bg-blue-950/30 rounded-lg">
          <RefreshCw className="h-4 w-4 animate-spin" />
          <span>
            {dataIntegrityStatus.isChecking 
              ? '正在检查数据完整性...' 
              : '正在同步缺失数据，请稍候...'}
          </span>
        </div>
      )}

      {/* 数据警告提示 */}
      {dataIntegrityStatus.warning && !isLoading && !dataIntegrityStatus.isChecking && !dataIntegrityStatus.isSyncing && (
        <div className="flex items-center gap-2 text-sm text-yellow-600 dark:text-yellow-400 px-4 py-2 bg-yellow-50 dark:bg-yellow-950/30 rounded-lg">
          <AlertTriangle className="h-4 w-4" />
          <span>{dataIntegrityStatus.warning}</span>
        </div>
      )}

      {/* 数据未准备好提示 */}
      {!dataIntegrityStatus.canAnalyze && !isLoading && !dataIntegrityStatus.isChecking && !dataIntegrityStatus.isSyncing && (
        <Card className="border-2 border-yellow-200 bg-yellow-50/50">
          <CardContent className="pt-6">
            <div className="flex flex-col items-center gap-4 text-center">
              <AlertTriangle className="h-10 w-10 text-yellow-600" />
              <div>
                <h3 className="text-lg font-semibold text-yellow-800">数据不完整，无法分析</h3>
                <p className="text-sm text-yellow-600 mt-2">
                  请先同步缺失的数据，确保所有级别数据都是最新的
                </p>
              </div>
              <Button 
                onClick={() => handleManualSync()}
                className="bg-yellow-600 hover:bg-yellow-700 text-white"
              >
                <Database className="h-4 w-4 mr-2" />
                同步缺失数据
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Loading 状态 - 智能进度条 */}
      <SmartLoading
        isLoading={isLoading || dataIntegrityStatus.isChecking || dataIntegrityStatus.isSyncing}
        loadingText={
          dataIntegrityStatus.isChecking ? '正在检查数据完整性...' :
          dataIntegrityStatus.isSyncing ? '正在同步缺失数据，请稍候...' :
          '正在进行三位一体技术分析...'
        }
        slowLoadingText="正在分析周线、日线、60分钟、30分钟、15分钟多周期数据..."
      />

      {/* 错误状态 */}
      {error && !isLoading && !dataIntegrityStatus.isChecking && !dataIntegrityStatus.isSyncing && (
        <Card className="border-destructive">
          <CardContent className="pt-6">
            <div className="flex flex-col gap-4">
              <div className="flex items-center gap-2 text-destructive">
                <AlertTriangle className="h-5 w-5" />
                <span>分析失败: {error}</span>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => loadAnalysis()}>
                  <Activity className="h-4 w-4 mr-2" />
                  重新分析
                </Button>
                <Button variant="default" onClick={() => handleManualSync()}>
                  <RefreshCw className="h-4 w-4 mr-2" />
                  重新同步后分析
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* 分析结果 - 只有数据完整时才显示 */}
      {result && !isLoading && dataIntegrityStatus.canAnalyze && (
        <div ref={contentRef} className="space-y-4 bg-white p-4 rounded-lg">
          {/* 分析时间 */}
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Clock className="h-4 w-4" />
            <span className="text-xs sm:text-sm">分析时间: {result.analysis_time}</span>
          </div>

          {/* AI 智能分析报告 */}
          {(aiReport || isAiLoading || aiError) && (
            <Card className="border-2 border-purple-200 bg-gradient-to-br from-purple-50/50 to-pink-50/50">
              <CardHeader className="p-4 sm:p-6 pb-2 sm:pb-3">
                <CardTitle className="text-lg sm:text-xl flex items-center gap-2">
                  <Sparkles className="h-5 w-5 sm:h-6 sm:w-6 text-purple-500" />
                  AI 智能分析报告
                  {showAiReport && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setShowAiReport(!showAiReport)}
                      className="ml-auto h-8 w-8 p-0"
                    >
                      {showAiReport ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                    </Button>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4 sm:p-6 pt-0 sm:pt-0">
                {isAiLoading && (
                  <div className="flex flex-col items-center justify-center py-8">
                    <Loader2 className="h-10 w-10 animate-spin text-purple-500 mb-4" />
                    <p className="text-muted-foreground">AI 正在进行深度分析...</p>
                    <p className="text-sm text-muted-foreground mt-2">结合三位一体策略生成专业报告</p>
                  </div>
                )}
                {aiError && !isAiLoading && (
                  <div className="flex items-center gap-2 text-destructive p-4 bg-destructive/10 rounded-lg">
                    <AlertTriangle className="h-5 w-5" />
                    <span>AI 分析失败: {aiError}</span>
                    <Button variant="outline" size="sm" onClick={loadAiAnalysis} className="ml-auto">
                      重试
                    </Button>
                  </div>
                )}
                {aiReport && showAiReport && !isAiLoading && (
                  <Markdown content={aiReport} className="bg-background/50 p-4 rounded-lg border" />
                )}
              </CardContent>
            </Card>
          )}

          {/* 核心结论卡片 - 最醒目 */}
          {result.level_nesting && (
            <Card className="border-2 border-primary/20 bg-gradient-to-br from-background to-muted/30">
              <CardHeader className="p-4 sm:p-6 pb-2 sm:pb-3">
                <CardTitle className="text-lg sm:text-xl flex items-center gap-2">
                  <Target className="h-5 w-5 sm:h-6 sm:w-6 text-primary" />
                  核心结论
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4 sm:p-6 pt-0 sm:pt-0 space-y-4">
                {/* 总体判断 */}
                <div className="text-lg sm:text-xl font-bold text-center py-4 bg-muted/50 rounded-xl border-2">
                  {result.level_nesting.summary}
                </div>

                {/* 维度一：周线+日线+60分钟 */}
                {result.level_nesting.dimension1 && (
                  <div className="space-y-2 p-3 bg-background rounded-lg border">
                    <div className="font-semibold text-sm flex items-center gap-2">
                      <span className="px-2 py-0.5 bg-primary/10 rounded text-primary text-xs">维度一</span>
                      周线 → 日线 → 60分钟
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      <div className="text-center p-2 rounded-lg bg-muted/30">
                        <div className="text-xs text-muted-foreground mb-1">周线状态</div>
                        <Badge className={`text-sm ${getMacdStatusStyle(result.level_nesting.dimension1.weekly_status)}`}>
                          {result.level_nesting.dimension1.weekly_status}
                        </Badge>
                      </div>
                      <div className="text-center p-2 rounded-lg bg-muted/30">
                        <div className="text-xs text-muted-foreground mb-1">日线状态</div>
                        <Badge className={`text-sm ${getMacdStatusStyle(result.level_nesting.dimension1.daily_status)}`}>
                          {result.level_nesting.dimension1.daily_status}
                        </Badge>
                      </div>
                      <div className="text-center p-2 rounded-lg bg-muted/30">
                        <div className="text-xs text-muted-foreground mb-1">60分钟</div>
                        <Badge className={`text-sm ${getMacdStatusStyle(result.level_nesting.dimension1.hour60_status)}`}>
                          {result.level_nesting.dimension1.hour60_status}
                        </Badge>
                      </div>
                    </div>
                    <p className="text-sm text-muted-foreground leading-relaxed">{result.level_nesting.dimension1.analysis}</p>
                  </div>
                )}

                {/* 维度二：日线+30分钟+15分钟 */}
                {result.level_nesting.dimension2 && (
                  <div className="space-y-2 p-3 bg-background rounded-lg border">
                    <div className="font-semibold text-sm flex items-center gap-2">
                      <span className="px-2 py-0.5 bg-primary/10 rounded text-primary text-xs">维度二</span>
                      日线 → 30分钟 → 15分钟
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      <div className="text-center p-2 rounded-lg bg-muted/30">
                        <div className="text-xs text-muted-foreground mb-1">日线</div>
                        <Badge className={`text-sm ${getMacdStatusStyle(result.level_nesting.dimension2.daily_status)}`}>
                          {result.level_nesting.dimension2.daily_status}
                        </Badge>
                      </div>
                      <div className="text-center p-2 rounded-lg bg-muted/30">
                        <div className="text-xs text-muted-foreground mb-1">30分钟</div>
                        <Badge className={`text-sm ${getMacdStatusStyle(result.level_nesting.dimension2.hour30_status)}`}>
                          {result.level_nesting.dimension2.hour30_status}
                        </Badge>
                      </div>
                      <div className="text-center p-2 rounded-lg bg-muted/30">
                        <div className="text-xs text-muted-foreground mb-1">15分钟结构</div>
                        <Badge variant="outline" className="text-sm">
                          {result.level_nesting.dimension2.hour15_structure}
                        </Badge>
                      </div>
                    </div>
                    <p className="text-sm text-muted-foreground leading-relaxed">{result.level_nesting.dimension2.analysis}</p>
                  </div>
                )}

                {/* 维度三：60分钟+15分钟 */}
                {result.level_nesting.dimension3 && (
                  <div className="space-y-2 p-3 bg-background rounded-lg border">
                    <div className="font-semibold text-sm flex items-center gap-2">
                      <span className="px-2 py-0.5 bg-primary/10 rounded text-primary text-xs">维度三</span>
                      60分钟 → 15分钟（短线）
                    </div>
                    <p className="text-sm text-muted-foreground leading-relaxed">{result.level_nesting.dimension3.analysis}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* 多维度跨级别操作建议卡片 */}
          {result.multi_dimension_operation && (
            <Card className="border-2 border-amber-200 bg-gradient-to-br from-amber-50/50 to-orange-50/50">
              <CardHeader className="p-4 sm:p-6 pb-2 sm:pb-3">
                <CardTitle className="text-lg sm:text-xl flex items-center gap-2">
                  <Target className="h-5 w-5 sm:h-6 sm:w-6 text-amber-600" />
                  多维度跨级别操作建议
                </CardTitle>
                <p className="text-sm text-muted-foreground mt-1">
                  三维度分析：大级别状态 → 期望小级别结构 → 实际结构对比 → 操作建议
                </p>
              </CardHeader>
              <CardContent className="p-4 sm:p-6 pt-0 sm:pt-0 space-y-6">
                {/* 维度一：周线+日线（判断大级别趋势方向） */}
                {result.multi_dimension_operation.dimension1 && result.multi_dimension_operation.dimension1.advice && (
                  <div className="border border-blue-200 rounded-lg p-4 bg-blue-50/30">
                    <div className="flex items-center gap-2 mb-3">
                      <Badge className="bg-blue-600 text-white">维度一</Badge>
                      <span className="font-semibold text-blue-800">周线状态 + 日线结构</span>
                      <span className="text-xs text-muted-foreground">（判断大级别趋势方向）</span>
                    </div>
                    <DimensionAdviceCard dimension={result.multi_dimension_operation.dimension1} />
                  </div>
                )}

                {/* 维度二：日线+30分钟（寻找具体买卖点） */}
                {result.multi_dimension_operation.dimension2 && result.multi_dimension_operation.dimension2.advice && (
                  <div className="border border-green-200 rounded-lg p-4 bg-green-50/30">
                    <div className="flex items-center gap-2 mb-3">
                      <Badge className="bg-green-600 text-white">维度二</Badge>
                      <span className="font-semibold text-green-800">日线状态 + 30分钟结构</span>
                      <span className="text-xs text-muted-foreground">（寻找具体买卖点）</span>
                    </div>
                    <DimensionAdviceCard dimension={result.multi_dimension_operation.dimension2} />
                  </div>
                )}

                {/* 维度三：60分钟+15分钟（日内或短线操作） */}
                {result.multi_dimension_operation.dimension3 && result.multi_dimension_operation.dimension3.advice && (
                  <div className="border border-purple-200 rounded-lg p-4 bg-purple-50/30">
                    <div className="flex items-center gap-2 mb-3">
                      <Badge className="bg-purple-600 text-white">维度三</Badge>
                      <span className="font-semibold text-purple-800">60分钟状态 + 15分钟结构</span>
                      <span className="text-xs text-muted-foreground">（日内或短线操作）</span>
                    </div>
                    <DimensionAdviceCard dimension={result.multi_dimension_operation.dimension3} />
                  </div>
                )}

                {/* 如果没有任何维度的数据 */}
                {!result.multi_dimension_operation.dimension1 && 
                 !result.multi_dimension_operation.dimension2 && 
                 !result.multi_dimension_operation.dimension3 && (
                  <div className="text-center text-muted-foreground py-4">
                    暂无操作建议数据，请确保已分析足够的周期
                  </div>
                )}

                {/* 提示 */}
                <p className="text-xs text-muted-foreground">
                  * 以上建议基于时空要素和结构要素应用表，仅供参考，不构成投资建议。
                </p>
              </CardContent>
            </Card>
          )}

          {/* 各周期详细分析 */}
          <div className="grid gap-4 md:grid-cols-2">
            {PERIOD_ORDER.map((level) => {
              const periodData = result.periods[level];
              if (!periodData || periodData.error) return null;

              return (
                <Card key={level} className="overflow-hidden">
                  {/* 周期标题栏 - 根据状态变色 */}
                  <div className={`px-4 py-3 ${
                    isBullishStatus(periodData.macd.status) 
                      ? 'bg-red-50 border-b border-red-200' 
                      : isBearishStatus(periodData.macd.status)
                        ? 'bg-green-50 border-b border-green-200'
                        : 'bg-muted/50 border-b'
                  }`}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <span className="font-bold text-lg">{PERIOD_NAMES[level]}</span>
                        <Badge className={`text-base px-3 py-1 ${getMacdStatusStyle(periodData.macd.status)}`}>
                          {periodData.macd.status}
                        </Badge>
                      </div>
                      {periodData.price_change_pct !== null && (
                        <div className={`flex items-center gap-1 text-lg font-bold ${
                          periodData.price_change_pct >= 0 ? 'text-red-600' : 'text-green-600'
                        }`}>
                          {periodData.price_change_pct >= 0 ? (
                            <TrendingUp className="h-5 w-5" />
                          ) : (
                            <TrendingDown className="h-5 w-5" />
                          )}
                          {periodData.price_change_pct >= 0 ? '+' : ''}{periodData.price_change_pct.toFixed(2)}%
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-4 mt-2 text-sm">
                      <span>
                        最新价: <span className="font-bold font-mono">{periodData.latest_price}</span>
                      </span>
                      {periodData.volume && (
                        <span className="text-muted-foreground">
                          成交量: <span className="font-mono">{formatVolume(periodData.volume)}</span>
                        </span>
                      )}
                    </div>
                  </div>

                  <CardContent className="p-4 space-y-4">
                    {/* MACD 详情 */}
                    <div className="space-y-2">
                      <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">MACD 时空状态</div>
                      {renderMacdDetails(periodData.macd)}
                      <p className="text-sm text-muted-foreground">{periodData.macd.description}</p>
                      {renderDivergenceSignals(periodData.macd)}
                    </div>

                    <Separator />

                    {/* 均线状态 */}
                    <div className="space-y-2">
                      <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">均线系统</div>
                      {renderMaDetails(periodData.moving_averages)}
                      {periodData.moving_averages.ma_status && (
                        <div className="mt-2">
                          <Badge className={getMaStatusStyle(periodData.moving_averages.ma_status)}>
                            {periodData.moving_averages.ma_status}
                          </Badge>
                        </div>
                      )}
                    </div>

                    {/* 均线物理性质（新增）- 仅当有数据时展示 */}
                    {periodData.ma_physics && (
                      <>
                        <Separator />
                        <div className="space-y-2">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">均线物理性质</span>
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Info className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
                                </TooltipTrigger>
                                <TooltipContent side="right" className="max-w-md">
                                  <div className="space-y-2 text-xs">
                                    <div className="font-semibold text-foreground">均线四大物理性质</div>
                                    <div className="space-y-1">
                                      <div><span className="font-medium text-blue-400">支撑与压制</span>：均线的根本任务是维护趋势现状，任何未伴随结构破坏的触线，均应优先判定为支撑或压制有效</div>
                                      <div><span className="font-medium text-green-400">牵引性</span>：股价过度偏离时产生回归引力，首次突破/跌破必定伴随回抽确认</div>
                                      <div><span className="font-medium text-yellow-400">共振性</span>：不同级别均线在同一价格区间重合时，效力指数级放大</div>
                                      <div><span className="font-medium text-purple-400">同一性</span>：均线系统在不同标的、不同级别的有效性一致</div>
                                    </div>
                                  </div>
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          </div>
                          
                          {/* 支撑与压制 */}
                          {periodData.ma_physics.support_pressure && (
                            <div className="flex flex-wrap gap-2">
                              {periodData.ma_physics.support_pressure.ma55_role && (
                                <Badge variant="outline" className={
                                  periodData.ma_physics.support_pressure.ma55_role === '支撑' 
                                    ? 'border-red-300 text-red-600' 
                                    : 'border-green-300 text-green-600'
                                }>
                                  MA55{periodData.ma_physics.support_pressure.ma55_role}
                                  {periodData.ma_physics.support_pressure.recent_touch && (
                                    <span className="ml-1 text-xs">✓确认</span>
                                  )}
                                </Badge>
                              )}
                              {periodData.ma_physics.support_pressure.ma233_role && (
                                <Badge variant="outline" className={
                                  periodData.ma_physics.support_pressure.ma233_role === '支撑' 
                                    ? 'border-red-300 text-red-600' 
                                    : 'border-green-300 text-green-600'
                                }>
                                  MA233{periodData.ma_physics.support_pressure.ma233_role}
                                </Badge>
                              )}
                            </div>
                          )}
                          
                          {/* 牵引性 */}
                          {periodData.ma_physics.traction && periodData.ma_physics.traction.is_over_deviation && (
                            <div className="p-2 bg-yellow-50 border border-yellow-200 rounded-lg">
                              <div className="flex items-center gap-2 text-yellow-700 text-sm">
                                <AlertTriangle className="h-4 w-4" />
                                <span>偏离MA55达{periodData.ma_physics.traction.deviation_ma55_pct?.toFixed(1)}%，存在回归引力</span>
                              </div>
                            </div>
                          )}
                          
                          {/* 牵引性 - 突破回抽预期 */}
                          {periodData.ma_physics.traction?.recent_break && (
                            <div className="p-2 bg-blue-50 border border-blue-200 rounded-lg">
                              <div className="flex items-center gap-2 text-blue-700 text-sm">
                                <Activity className="h-4 w-4" />
                                <span>近期{periodData.ma_physics.traction.break_type}MA55，预期回抽确认</span>
                              </div>
                            </div>
                          )}
                          
                          {/* 共振性 */}
                          {periodData.ma_physics.resonance?.is_converging && (
                            <div className="p-2 bg-purple-50 border border-purple-200 rounded-lg">
                              <div className="flex items-center gap-2 text-purple-700 text-sm">
                                <Zap className="h-4 w-4" />
                                <span>均线粘合共振区，效力指数级放大</span>
                              </div>
                              {periodData.ma_physics.resonance.resonance_zone && (
                                <div className="text-xs text-purple-600 mt-1">
                                  共振区间: {periodData.ma_physics.resonance.resonance_zone[0]} - {periodData.ma_physics.resonance.resonance_zone[1]}
                                </div>
                              )}
                            </div>
                          )}
                          
                          {/* 重点提醒（alerts）- 仅显示额外的警告信息，不与上面的提示框重复 */}
                          {periodData.ma_physics.alerts && periodData.ma_physics.alerts.length > 0 && (
                            <div className="text-xs space-y-1">
                              {periodData.ma_physics.alerts.map((alert, idx) => (
                                <div key={idx} className="flex items-start gap-1 text-orange-700">
                                  <span className="text-orange-500 shrink-0">!</span>
                                  <span>{alert}</span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </>
                    )}

                    {/* 突破/跌破形态识别（新增）- 仅当有突破事件时展示 */}
                    {periodData.breakthrough && periodData.breakthrough.pattern_type && periodData.breakthrough.pattern_type !== '无突破' && (
                      <>
                        <Separator />
                        <div className="space-y-2">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                              {periodData.breakthrough.direction === 'down' ? '跌破形态' : '突破形态'}
                            </span>
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Info className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
                                </TooltipTrigger>
                                <TooltipContent side="right" className="max-w-lg">
                                  <div className="space-y-3 text-xs">
                                    <div className="font-semibold text-foreground">六种突破形态（向上穿越均线）</div>
                                    <div className="space-y-1.5">
                                      <div><span className="font-medium text-gray-400">假突破</span>：T+1到T+3内收盘价跌回MA下方，典型诱多</div>
                                      <div><span className="font-medium text-green-400">有效突破</span>：T0实体&gt;3%，凌厉单边排列，不跌破T0开盘价</div>
                                      <div><span className="font-medium text-yellow-400">慢速突破</span>：小实体碎阳碎阴，K线区间高度重叠&gt;60%</div>
                                      <div><span className="font-medium text-blue-400">回抽突破</span>：Cross→Extend→Pullback→Bounce，最确定</div>
                                      <div><span className="font-medium text-orange-400">反向突破</span>：先测试被拒，后以更大动能反向击穿，爆发力最强</div>
                                      <div><span className="font-medium text-slate-400">普通突破</span>：特征不显著的普通穿越，需进一步观察</div>
                                    </div>
                                    <div className="border-t border-border pt-2 mt-2">
                                      <div className="font-semibold text-foreground">六种跌破形态（向下穿越均线）</div>
                                    </div>
                                    <div className="space-y-1.5">
                                      <div><span className="font-medium text-gray-400">假跌破</span>：T+1到T+3内收盘价涨回MA上方，典型诱空</div>
                                      <div><span className="font-medium text-red-400">有效跌破</span>：T0实体&gt;3%，凌厉单边下跌，不涨破T0开盘价</div>
                                      <div><span className="font-medium text-yellow-400">慢速跌破</span>：小实体碎阳碎阴，K线区间高度重叠&gt;60%</div>
                                      <div><span className="font-medium text-blue-400">回抽跌破</span>：Cross→Extend→Pullback→Bounce，最确定</div>
                                      <div><span className="font-medium text-orange-400">反向跌破</span>：先测试被拒，后以更大动能反向击穿，杀伤力最强</div>
                                      <div><span className="font-medium text-slate-400">普通跌破</span>：特征不显著的普通穿越，需进一步观察</div>
                                    </div>
                                    <div className="border-t border-border pt-2 mt-2 text-muted-foreground">
                                      <div>T0 = 突破/跌破K线（穿越MA的那根K线）</div>
                                    </div>
                                  </div>
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          </div>
                          
                          {/* 突破/跌破形态类型 */}
                          <div className="flex flex-wrap gap-2">
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Badge className={
                                    periodData.breakthrough.is_valid === true 
                                      ? (periodData.breakthrough.direction === 'up' 
                                          ? 'bg-red-500 text-white cursor-help'      // 有效突破：红色（看涨）
                                          : 'bg-green-500 text-white cursor-help')   // 有效跌破：绿色（看跌）
                                      : periodData.breakthrough.is_valid === false 
                                        ? 'bg-gray-400 text-white cursor-help'      // 无效：灰色
                                        : 'bg-yellow-500 text-white cursor-help'    // 未知：黄色
                                  }>
                                    {periodData.breakthrough.pattern_name}
                                  </Badge>
                                </TooltipTrigger>
                                <TooltipContent side="bottom" className="max-w-sm bg-slate-800 border-slate-600 shadow-xl p-3">
                                  <div className="space-y-2 text-sm">
                                    <div className="font-semibold text-white">判断依据</div>
                                    {periodData.breakthrough.key_signals && periodData.breakthrough.key_signals.length > 0 ? (
                                      <div className="space-y-1">
                                        {periodData.breakthrough.key_signals.map((signal, idx) => (
                                          <div key={idx} className="text-slate-200">• {signal}</div>
                                        ))}
                                      </div>
                                    ) : (
                                      <div className="text-slate-300">• 已穿越均线但特征不显著</div>
                                    )}
                                    {periodData.breakthrough.t0_date && (
                                      <div className="text-slate-400 border-t border-slate-600 pt-2 mt-2 text-xs">
                                        T0日期: {periodData.breakthrough.t0_date.split(' ')[0]}
                                      </div>
                                    )}
                                  </div>
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                            {periodData.breakthrough.target_ma && (
                              <Badge variant="outline">
                                目标: {periodData.breakthrough.target_ma}
                              </Badge>
                            )}
                            {periodData.breakthrough.confidence && (
                              <Badge variant="outline" className={
                                periodData.breakthrough.confidence === '极高' 
                                  ? 'border-red-300 text-red-600' 
                                  : periodData.breakthrough.confidence === '高' 
                                    ? 'border-orange-300 text-orange-600'
                                    : 'border-gray-300 text-gray-600'
                              }>
                                置信度: {periodData.breakthrough.confidence}
                              </Badge>
                            )}
                          </div>
                          
                          {/* 突破描述 - 作为主要说明，不再重复显示alerts */}
                          {periodData.breakthrough.description && (
                            <p className="text-sm text-muted-foreground">{periodData.breakthrough.description}</p>
                          )}
                        </div>
                      </>
                    )}

                    {/* 重点提醒汇总（新增）- 仅当有提醒时展示 */}
                    {periodData.key_alerts && periodData.key_alerts.length > 0 && (
                      <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                        <div className="flex items-center gap-2 text-red-700 font-semibold text-sm mb-2">
                          <AlertCircle className="h-4 w-4" />
                          <span>重点提醒</span>
                        </div>
                        <div className="space-y-1">
                          {periodData.key_alerts.map((alert, idx) => (
                            <div key={idx} className="text-sm text-red-600">{alert}</div>
                          ))}
                        </div>
                      </div>
                    )}

                    <Separator />

                    {/* 结构分析 */}
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">结构拓扑</span>
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Info className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
                            </TooltipTrigger>
                            <TooltipContent side="right" className="max-w-md">
                              <div className="space-y-2 text-xs">
                                <div className="font-semibold text-foreground">缠论笔画法说明</div>
                                <div className="space-y-1">
                                  <div><span className="font-medium">顶分型</span>：中间K线的高点和低点都比两边高</div>
                                  <div><span className="font-medium">底分型</span>：中间K线的高点和低点都比两边低</div>
                                  <div><span className="font-medium">笔</span>：顶底分型相连，至少间隔3-5根K线</div>
                                </div>
                                <Separator className="my-2" />
                                <div className="font-semibold text-foreground">四种基本结构</div>
                                <div className="grid grid-cols-2 gap-1">
                                  <div><span className="text-blue-400">A五段式</span>：5笔6拐点，第三浪为主升/跌浪</div>
                                  <div><span className="text-green-400">B双平台式</span>：9笔10拐点，双平台整理</div>
                                  <div><span className="text-yellow-400">C单平台式</span>：5笔6拐点，单平台整理</div>
                                  <div><span className="text-purple-400">D三段式</span>：3笔4拐点，最小完整结构</div>
                                </div>
                              </div>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Badge className={STRUCTURE_COLORS[periodData.structure.structure_type] || ''}>
                                {periodData.structure.structure_type}
                                {periodData.structure.structure_details?.peak_analysis?.is_peak_structure && (
                                  <span className="ml-1">
                                    {periodData.structure.structure_details.peak_analysis.peak_type === 'mountain_peak' ? '🏔️' : '⛰️'}
                                  </span>
                                )}
                              </Badge>
                            </TooltipTrigger>
                            {periodData.structure.structure_details && (
                              <TooltipContent 
                                side="bottom" 
                                sideOffset={8}
                                className="max-w-4xl p-4 bg-slate-800 border-slate-600 shadow-xl"
                              >
                                <div className="flex gap-4 items-start">
                                  {/* 左侧：结构拓扑图和笔信息 */}
                                  <div className="flex-1 min-w-0 space-y-3">
                                    <div className="font-semibold text-white text-sm">结构拓扑图</div>
                                    
                                    {/* SVG 结构图形 */}
                                    {periodData.structure.structure_details.strokes.length > 0 && (
                                      <div className="bg-slate-900/80 p-3 rounded-lg border border-slate-600">
                                        <svg 
                                          viewBox="0 0 400 200" 
                                          className="w-full h-40"
                                          preserveAspectRatio="xMidYMid meet"
                                        >
                                          {(() => {
                                            const strokes = periodData.structure.structure_details!.strokes;
                                            if (strokes.length === 0) return null;
                                            
                                            // 计算价格范围
                                            const prices = strokes.flatMap(s => [s.from_price, s.to_price]);
                                            const minPrice = Math.min(...prices);
                                            const maxPrice = Math.max(...prices);
                                            const priceRange = maxPrice - minPrice || 1;
                                            const padding = 30;
                                            const svgHeight = 200;
                                            const dateLabelHeight = 20;
                                            const drawHeight = svgHeight - padding * 2 - dateLabelHeight;
                                            
                                            // 计算坐标点
                                            const points: Array<{x: number; y: number; price: number; date: string; type: string}> = [];
                                            const xStep = (400 - padding * 2) / (strokes.length);
                                            
                                            strokes.forEach((stroke, i) => {
                                              if (i === 0) {
                                                points.push({
                                                  x: padding,
                                                  y: padding + (1 - (stroke.from_price - minPrice) / priceRange) * drawHeight,
                                                  price: stroke.from_price,
                                                  date: stroke.from_date.split(' ')[0],
                                                  type: stroke.from_type
                                                });
                                              }
                                              points.push({
                                                x: padding + (i + 1) * xStep,
                                                y: padding + (1 - (stroke.to_price - minPrice) / priceRange) * drawHeight,
                                                price: stroke.to_price,
                                                date: stroke.to_date.split(' ')[0],
                                                type: stroke.to_type
                                              });
                                            });
                                            
                                            return (
                                              <>
                                                {/* 绘制连线 - 上涨红色，下跌绿色（中国股市习惯） */}
                                                {strokes.map((stroke, i) => {
                                                  const x1 = points[i].x;
                                                  const y1 = points[i].y;
                                                  const x2 = points[i + 1].x;
                                                  const y2 = points[i + 1].y;
                                                  const isUp = stroke.direction === '上涨';
                                                  const isCurrent = stroke.is_current;
                                                  return (
                                                    <line 
                                                      key={i}
                                                      x1={x1} y1={y1} x2={x2} y2={y2}
                                                      stroke={isUp ? '#ef4444' : '#22c55e'}
                                                      strokeWidth="2"
                                                      strokeDasharray={isCurrent ? "4,2" : undefined}
                                                    />
                                                  );
                                                })}
                                                
                                                {/* 绘制拐点 */}
                                                {points.map((point, i) => {
                                                  const isTop = point.type === 'top' || (point.type === 'current' && i > 0 && points[i-1].y > point.y);
                                                  const labelY = isTop ? point.y - 15 : point.y + 18;
                                                  
                                                  return (
                                                    <g key={i}>
                                                      {/* 价格标签背景 */}
                                                      <rect 
                                                        x={point.x - 18}
                                                        y={labelY - 8}
                                                        width="36"
                                                        height="14"
                                                        rx="2"
                                                        fill="rgba(0,0,0,0.7)"
                                                      />
                                                      {/* 价格标签文字 */}
                                                      <text 
                                                        x={point.x} 
                                                        y={labelY + 2}
                                                        textAnchor="middle"
                                                        fill="white"
                                                        fontSize="9"
                                                        fontWeight="500"
                                                      >
                                                        {point.price.toFixed(1)}
                                                      </text>
                                                      {/* 拐点圆点 */}
                                                      <circle 
                                                        cx={point.x} 
                                                        cy={point.y} 
                                                        r="5"
                                                        fill={point.type === 'top' ? '#ef4444' : (point.type === 'current' ? '#fbbf24' : '#22c55e')}
                                                        stroke="white"
                                                        strokeWidth="1.5"
                                                      />
                                                      {/* 日期标签（只显示首尾和当前点） */}
                                                      {(i === 0 || i === points.length - 1 || point.type === 'current') && (
                                                        <text 
                                                          x={point.x} 
                                                          y={svgHeight - 10}
                                                          textAnchor="middle"
                                                          fill="#94a3b8"
                                                          fontSize="8"
                                                        >
                                                          {point.date}
                                                        </text>
                                                      )}
                                                    </g>
                                                  );
                                                })}
                                              </>
                                            );
                                          })()}
                                        </svg>
                                      </div>
                                    )}
                                    
                                    {/* 笔信息列表 - 上涨红色，下跌绿色 */}
                                    <div className="space-y-1.5 max-h-28 overflow-y-auto pr-1">
                                      {periodData.structure.structure_details.strokes.slice(-6).map((stroke, idx) => (
                                        <div key={idx} className="flex items-center gap-2 text-[11px] py-0.5">
                                          <span className={`w-10 font-medium shrink-0 ${stroke.direction === '上涨' ? 'text-red-400' : 'text-green-400'}`}>
                                            {stroke.direction}
                                            {stroke.is_current && <span className="text-yellow-400 ml-0.5">(进行中)</span>}
                                          </span>
                                          <span className="text-slate-200 flex-1 font-mono">
                                            {stroke.from_price} → {stroke.to_price}
                                          </span>
                                          <span className="text-slate-400 text-[10px] shrink-0">
                                            {stroke.from_date.slice(0, 10)} ~ {stroke.to_date.slice(0, 10)}
                                          </span>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                  
                                  {/* 右侧：结构诊断结果 */}
                                  <div className="w-64 shrink-0 border-l border-slate-600 pl-4">
                                    <div className="font-semibold text-white text-sm mb-2">结构诊断</div>
                                    
                                    {/* 峰值分析 */}
                                    {periodData.structure.structure_details.peak_analysis?.is_peak_structure && (
                                      <div className={`mb-2 p-2 rounded-lg ${
                                        periodData.structure.structure_details.peak_analysis.peak_type === 'mountain_peak'
                                          ? 'bg-gradient-to-r from-red-100 to-green-100 border border-red-300'
                                          : 'bg-gradient-to-r from-green-100 to-red-100 border border-green-300'
                                      }`}>
                                        <div className="font-semibold text-slate-800 text-xs mb-1">
                                          {periodData.structure.structure_details.peak_analysis.peak_type === 'mountain_peak' ? '🏔️ 山峰形态' : '⛰️ 山谷形态'}
                                        </div>
                                        <div className="text-[10px] text-slate-600 leading-relaxed">
                                          峰值 {periodData.structure.structure_details.peak_analysis.peak_price?.toFixed(2)}
                                        </div>
                                        <div className="mt-1.5 flex items-center gap-2 text-[10px]">
                                          <span className="text-slate-500">左侧:</span>
                                          <span className="font-medium text-slate-700">
                                            {periodData.structure.structure_details.peak_analysis.left_structure}
                                          </span>
                                          <span className="text-slate-400">|</span>
                                          <span className="text-slate-500">右侧:</span>
                                          <span className="font-medium text-slate-700">
                                            {periodData.structure.structure_details.peak_analysis.right_structure}
                                          </span>
                                        </div>
                                      </div>
                                    )}
                                    
                                    {/* 左侧风险警示 */}
                                    {periodData.structure.structure_details.left_structure_warning && (
                                      <div className={`mb-2 p-2 rounded-lg border ${
                                        periodData.structure.structure_details.left_structure_warning.type === 'mountain_peak_left'
                                          ? 'bg-red-900/40 border-red-600'
                                          : 'bg-green-900/40 border-green-600'
                                      }`}>
                                        <div className={`font-semibold text-xs mb-1 ${
                                          periodData.structure.structure_details.left_structure_warning.type === 'mountain_peak_left'
                                            ? 'text-red-300'
                                            : 'text-green-300'
                                        }`}>
                                          {periodData.structure.structure_details.left_structure_warning.title}
                                        </div>
                                        
                                        {periodData.structure.structure_details.left_structure_warning.warning && (
                                          <div className="text-[10px] text-red-200 font-medium mb-1">
                                            {periodData.structure.structure_details.left_structure_warning.warning}
                                          </div>
                                        )}
                                        
                                        {periodData.structure.structure_details.left_structure_warning.opportunity && (
                                          <div className="text-[10px] text-green-200 font-medium mb-1">
                                            {periodData.structure.structure_details.left_structure_warning.opportunity}
                                          </div>
                                        )}
                                        
                                        <div className="text-[10px] text-slate-300 leading-relaxed">
                                          {periodData.structure.structure_details.left_structure_warning.risk_description || 
                                           periodData.structure.structure_details.left_structure_warning.opportunity_description}
                                        </div>
                                        
                                        <div className="mt-1.5 pt-1.5 border-t border-slate-600">
                                          <div className="text-[10px] text-yellow-300">
                                            {periodData.structure.structure_details.left_structure_warning.key_defense || 
                                             periodData.structure.structure_details.left_structure_warning.key_resistance}
                                          </div>
                                          <div className="text-[10px] text-orange-300 mt-0.5">
                                            💡 {periodData.structure.structure_details.left_structure_warning.action_hint}
                                          </div>
                                        </div>
                                      </div>
                                    )}
                                    
                                    <div className="bg-slate-900/50 p-2.5 rounded-lg border border-slate-600">
                                      <pre className="whitespace-pre-wrap text-slate-300 text-[11px] leading-relaxed">
                                        {periodData.structure.structure_details.judgment_criteria}
                                      </pre>
                                    </div>
                                  </div>
                                </div>
                              </TooltipContent>
                            )}
                          </Tooltip>
                        </TooltipProvider>
                        <Badge className={getTrendStyle(periodData.structure.trend_direction)}>
                          {periodData.structure.trend_direction}
                        </Badge>
                        {periodData.structure.inflection_points > 0 && (
                          <Badge variant="outline">
                            {periodData.structure.inflection_points}个拐点
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground">{periodData.structure.description}</p>
                      
                      {/* 预测性提醒 */}
                      {periodData.structure.structure_details?.prediction && (
                        <div className={`mt-3 p-3 rounded-lg border ${
                          periodData.structure.structure_details.prediction.confidence === 'high' 
                            ? 'bg-amber-50 border-amber-200 dark:bg-amber-950/20 dark:border-amber-800' 
                            : periodData.structure.structure_details.prediction.confidence === 'medium'
                            ? 'bg-blue-50 border-blue-200 dark:bg-blue-950/20 dark:border-blue-800'
                            : 'bg-slate-50 border-slate-200 dark:bg-slate-950/20 dark:border-slate-800'
                        }`}>
                          <div className="flex items-start gap-2">
                            <AlertCircle className={`h-4 w-4 mt-0.5 shrink-0 ${
                              periodData.structure.structure_details.prediction.confidence === 'high' 
                                ? 'text-amber-600' 
                                : periodData.structure.structure_details.prediction.confidence === 'medium'
                                ? 'text-blue-600'
                                : 'text-slate-500'
                            }`} />
                            <div className="flex-1 min-w-0">
                              <div className="text-sm font-medium text-foreground">
                                {periodData.structure.structure_details.prediction.prediction_alert}
                              </div>
                              <div className="mt-1 text-xs text-muted-foreground flex flex-wrap gap-x-4 gap-y-1">
                                <span>当前阶段: {periodData.structure.structure_details.prediction.current_stage}</span>
                                <span>下一阶段: {periodData.structure.structure_details.prediction.next_stage}</span>
                              </div>
                              {periodData.structure.structure_details.prediction.action_hint && (
                                <div className="mt-2 text-xs font-medium text-primary">
                                  💡 {periodData.structure.structure_details.prediction.action_hint}
                                </div>
                              )}
                              {periodData.structure.structure_details.prediction.key_price_levels.length > 0 && (
                                <div className="mt-2 flex flex-wrap gap-2">
                                  {periodData.structure.structure_details.prediction.key_price_levels.map((level, idx) => (
                                    <Badge key={idx} variant="outline" className="text-xs">
                                      {level.type}: {level.price} ({level.note})
                                    </Badge>
                                  ))}
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {/* 关键价位 */}
          {dailyData && (
            <Card>
              <CardHeader className="p-4 sm:p-6 pb-2 sm:pb-3">
                <CardTitle className="text-base sm:text-lg">关键支撑压力位</CardTitle>
              </CardHeader>
              <CardContent className="p-4 sm:p-6 pt-0 sm:pt-0">
                <div className="grid gap-4 sm:gap-6 md:grid-cols-2">
                  {/* 支撑位 - 利好 */}
                  <div>
                    <div className="text-base font-bold text-green-600 mb-3 flex items-center gap-2">
                      <CheckCircle className="h-5 w-5" />
                      支撑位（买点参考）
                    </div>
                    <div className="space-y-2">
                      {dailyData.key_levels.support_levels.map((level, idx) => (
                        <div key={idx} className="flex justify-between items-center text-sm p-3 bg-green-50 rounded-lg border border-green-200">
                          <span className="font-medium">{level.type}</span>
                          <span className="font-mono font-bold text-green-700">{level.level}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                  {/* 压力位 - 利空 */}
                  <div>
                    <div className="text-base font-bold text-red-600 mb-3 flex items-center gap-2">
                      <AlertTriangle className="h-5 w-5" />
                      压力位（卖点参考）
                    </div>
                    <div className="space-y-2">
                      {dailyData.key_levels.resistance_levels.map((level, idx) => (
                        <div key={idx} className="flex justify-between items-center text-sm p-3 bg-red-50 rounded-lg border border-red-200">
                          <span className="font-medium">{level.type}</span>
                          <span className="font-mono font-bold text-red-700">{level.level}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* 操作建议 - 重点突出 */}
          <Card className="border-2">
            <CardHeader className="p-4 sm:p-6 pb-2 sm:pb-3">
              <CardTitle className="text-lg sm:text-xl flex items-center gap-2">
                <Activity className="h-5 w-5 sm:h-6 sm:w-6 text-primary" />
                操作策略参考
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 sm:p-6 pt-0 sm:pt-0">
              <div className="space-y-3">
                {dailyData?.macd.status === '极强' && (
                  <div className="p-4 bg-red-50 rounded-xl border-2 border-red-200">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="px-3 py-1 bg-red-500 text-white rounded-full text-sm font-bold">极强状态</span>
                      <span className="text-red-600 font-semibold">强势持有，逢低加仓</span>
                    </div>
                    <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
                      <li>忽略顶部背离信号，可逢低加仓</li>
                      <li><span className="text-red-600 font-semibold">MA55作为重要防守线</span>，不破可持有</li>
                      <li>适合持有或加仓，注意控制仓位</li>
                    </ul>
                  </div>
                )}
                {dailyData?.macd.status === '强' && (
                  <div className="p-4 bg-red-50 rounded-xl border-2 border-red-200">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="px-3 py-1 bg-red-400 text-white rounded-full text-sm font-bold">强状态</span>
                      <span className="text-red-600 font-semibold">持有为主，注意卖点</span>
                    </div>
                    <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
                      <li>持有为主，注意高位死叉和背离信号</li>
                      <li>可参考<span className="text-red-600 font-semibold">小级别（60分钟/30分钟）</span>找卖点</li>
                      <li>若出现顶背离，考虑减仓锁定利润</li>
                    </ul>
                  </div>
                )}
                {dailyData?.macd.status === '中偏强' && (
                  <div className="p-4 bg-orange-50 rounded-xl border-2 border-orange-200">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="px-3 py-1 bg-orange-400 text-white rounded-full text-sm font-bold">中偏强状态</span>
                      <span className="text-orange-600 font-semibold">转强过程，可考虑建仓</span>
                    </div>
                    <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
                      <li>转强过程，可考虑建仓</li>
                      <li>关注<span className="text-red-600 font-semibold">DIF能否上穿零轴</span>确认趋势</li>
                      <li>可在MA55附近寻找买点</li>
                    </ul>
                  </div>
                )}
                {dailyData?.macd.status === '中偏弱' && (
                  <div className="p-4 bg-blue-50 rounded-xl border-2 border-blue-200">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="px-3 py-1 bg-blue-400 text-white rounded-full text-sm font-bold">中偏弱状态</span>
                      <span className="text-blue-600 font-semibold">转弱过程，谨慎持有</span>
                    </div>
                    <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
                      <li>转弱过程，谨慎持有</li>
                      <li><span className="text-green-600 font-semibold">注意防守MA55</span>，破位考虑减仓</li>
                      <li>观望为主，等待信号明确</li>
                    </ul>
                  </div>
                )}
                {dailyData?.macd.status === '弱' && (
                  <div className="p-4 bg-green-50 rounded-xl border-2 border-green-200">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="px-3 py-1 bg-green-400 text-white rounded-full text-sm font-bold">弱状态</span>
                      <span className="text-green-600 font-semibold">等待机会，小仓试探</span>
                    </div>
                    <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
                      <li>等待<span className="text-red-600 font-semibold">低位金叉</span>确认</li>
                      <li>若出现<span className="text-red-600 font-semibold">底背离</span>可考虑小仓位试探</li>
                      <li>不建议重仓，等待趋势明朗</li>
                    </ul>
                  </div>
                )}
                {dailyData?.macd.status === '极弱' && (
                  <div className="p-4 bg-green-50 rounded-xl border-2 border-green-200">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="px-3 py-1 bg-green-500 text-white rounded-full text-sm font-bold">极弱状态</span>
                      <span className="text-green-600 font-semibold">主跌段，建议观望</span>
                    </div>
                    <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
                      <li>主跌段，<span className="text-green-600 font-semibold">建议观望</span></li>
                      <li>等待小级别完成<span className="font-semibold">D结构</span>后再考虑介入</li>
                      <li>切勿盲目抄底，注意风险控制</li>
                    </ul>
                  </div>
                )}

                <Separator className="my-4" />

                {/* 交易纪律提醒 */}
                <div className="bg-muted/50 p-4 rounded-lg">
                  <div className="font-semibold text-sm mb-2">📋 交易纪律提醒</div>
                  <ul className="text-xs text-muted-foreground space-y-1.5">
                    <li>• <span className="text-red-600 font-medium">依据什么级别建仓，就依据什么级别止损</span></li>
                    <li>• 止盈要慢，止损要快</li>
                    <li>• 15分钟反弹最多补1/4仓位，30分钟反弹最多补1/3仓位</li>
                    <li>• 日线MA55作为重要防守线，破位坚决离场</li>
                  </ul>
                </div>

                <div className="text-muted-foreground text-xs text-center pt-2">
                  ⚠️ 以上分析仅供参考，不构成投资建议。投资有风险，入市需谨慎。
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
