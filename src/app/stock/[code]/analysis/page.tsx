'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, BarChart2, Clock, Download, Loader2, RefreshCw } from 'lucide-react';
import jsPDF from 'jspdf';
import { domToJpeg } from 'modern-screenshot';

import { AnalysisPeriodDetails } from '@/components/stock/AnalysisPeriodDetails';
import type { AnalysisPeriodSection } from '@/components/stock/AnalysisPeriodDetails';
import { AnalysisSummaryPanel } from '@/components/stock/AnalysisSummaryPanel';
import { DataIntegrityAlert } from '@/components/stock/DataIntegrityAlert';
import { DataSyncTime } from '@/components/stock/DataSyncTime';
import { LevelDecisionBus } from '@/components/stock/LevelDecisionBus';
import { TrinityRuleChain } from '@/components/stock/TrinityRuleChain';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Markdown } from '@/components/ui/markdown';
import { SmartLoading } from '@/components/ui/smart-loading';
import type { AnalysisLoadingStage } from '@/lib/analysis-loading-stage';
import { parseAiReportContract } from '@/lib/ai-report-contract';
import type { DataIntegritySnapshot } from '@/lib/stock-data-integrity';
import type { AnalysisResultData, PeriodAnalysisData } from '@/lib/stock-structure-types';
import type { AnalysisPageAiState } from '@/lib/trinity-analysis-page-view-model';
import { buildAnalysisPageViewModel } from '@/lib/trinity-analysis-page-view-model';

interface PrepareAnalysisData {
  ready: boolean;
  phase: string;
  integrity?: DataIntegritySnapshot | null;
  summary?: {
    canAnalyze: boolean;
    overallText: string;
    analyzeWarning: string | null;
    needsSyncLevels?: string[];
  };
  levels?: DataIntegritySnapshot['levels'];
  bootstrap?: {
    analysisData: AnalysisResultData;
    stockInfo: {
      name?: string;
    };
  } | null;
}

const PERIOD_ORDER = ['weekly', 'daily', 'hour60', 'hour30', 'hour15'] as const;

const PERIOD_LABELS: Record<(typeof PERIOD_ORDER)[number], string> = {
  weekly: '周线',
  daily: '日线',
  hour60: '60分钟',
  hour30: '30分钟',
  hour15: '15分钟',
};

function createIntegrityFallback(code: string, warning: string | null): DataIntegritySnapshot {
  return {
    code,
    baostockLatestDate: null,
    currentTime: new Date().toISOString(),
    isWeekend: false,
    levels: [],
    summary: {
      overallStatus: warning ? 'warning' : 'ok',
      overallText: warning ? '数据待确认' : '数据完整',
      okCount: 0,
      staleCount: 0,
      missingCount: 0,
      errorCount: 0,
      pendingCount: 0,
      totalLevels: 0,
      needsSyncLevels: [],
      canAnalyze: !warning,
      analyzeWarning: warning,
    },
  };
}

function formatRangeLabel(period?: PeriodAnalysisData | null) {
  const validRange = period?.structure?.structure_details?.valid_range;
  const count = period?.structure?.structure_details?.pipeline_debug?.analysis_kline_count;
  const coverage =
    validRange?.start_date && validRange?.end_date
      ? `${validRange.start_date.slice(0, 10)} 至 ${validRange.end_date.slice(0, 10)}`
      : validRange?.end_date
        ? `至 ${validRange.end_date.slice(0, 10)}`
        : validRange?.start_date
          ? `自 ${validRange.start_date.slice(0, 10)}`
          : null;

  return [typeof count === 'number' ? `近 ${count} 根` : null, coverage].filter(Boolean).join(' · ') || null;
}

function buildPeriodSections(result: AnalysisResultData): AnalysisPeriodSection[] {
  return PERIOD_ORDER.flatMap((level) => {
    const period = result.periods[level];
    if (!period || period.error) {
      return [];
    }

    return [
      {
        key: level,
        label: PERIOD_LABELS[level],
        defaultOpen: level === 'daily',
        summary:
          period.structure?.interpretation?.focus_structure?.summary ||
          period.structure?.description ||
          period.trinity_decision?.conclusion.wait_reason ||
          null,
        rangeLabel: formatRangeLabel(period),
        topologyTitle: `${PERIOD_LABELS[level]}结构证据`,
        period,
      },
    ];
  });
}

export default function StockAnalysisPage() {
  const params = useParams();
  const router = useRouter();
  const code = params.code as string;

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<AnalysisResultData | null>(null);
  const [stockName, setStockName] = useState('');
  const [loadingStage, setLoadingStage] = useState<AnalysisLoadingStage>('checking');
  const [integritySnapshot, setIntegritySnapshot] = useState<DataIntegritySnapshot | null>(null);
  const [isExportingPdf, setIsExportingPdf] = useState(false);
  const [aiMarkdown, setAiMarkdown] = useState<string | null>(null);
  const [aiState, setAiState] = useState<AnalysisPageAiState>({ status: 'idle' });

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

  const contentRef = useRef<HTMLDivElement>(null);
  const activeRunIdRef = useRef(0);
  const autoLoadTriggeredRef = useRef(false);

  const applyPrepareState = useCallback((prepared: PrepareAnalysisData, runId?: number) => {
    if (typeof runId === 'number' && runId !== activeRunIdRef.current) {
      return;
    }

    if (prepared.integrity) {
      setIntegritySnapshot(prepared.integrity);
    }

    setDataIntegrityStatus({
      canAnalyze: !!prepared.ready,
      isChecking: false,
      isSyncing: false,
      summary: prepared.summary?.overallText || (prepared.ready ? '数据就绪，可以分析' : '数据准备未完成'),
      warning: prepared.ready ? null : (prepared.summary?.analyzeWarning || '数据不完整，请先同步后再分析'),
      needsSyncLevels: prepared.summary?.needsSyncLevels || [],
    });

    if (prepared.bootstrap?.stockInfo?.name) {
      setStockName(prepared.bootstrap.stockInfo.name);
    }

    if (prepared.bootstrap?.analysisData) {
      setResult(prepared.bootstrap.analysisData);
    }
  }, []);

  const applyLoadingStage = useCallback((stage: AnalysisLoadingStage) => {
    setLoadingStage(stage);
    setDataIntegrityStatus((prev) => ({
      ...prev,
      isChecking: stage === 'checking',
      isSyncing: stage === 'syncing',
    }));
  }, []);

  const prepareAnalysis = useCallback(
    async (options: { forceSync?: boolean; levels?: string[] } = {}, runId?: number) => {
      const { forceSync = false, levels = [] } = options;

      const prepareRes = await fetch('/api/stock/prepare-analysis', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'text/event-stream',
        },
        body: JSON.stringify({
          code,
          forceSync,
          levels,
          stream: true,
        }),
      });

      if (!prepareRes.ok || !prepareRes.headers.get('content-type')?.includes('text/event-stream')) {
        const prepareResult = await prepareRes.json();
        if (!prepareResult.success) {
          if (prepareResult.data) {
            applyPrepareState(prepareResult.data as PrepareAnalysisData, runId);
          }
          throw new Error(prepareResult.error || '数据准备失败');
        }

        const prepared = prepareResult.data as PrepareAnalysisData;
        applyPrepareState(prepared, runId);
        return prepared;
      }

      const reader = prepareRes.body?.getReader();
      if (!reader) {
        throw new Error('无法读取分析准备响应流');
      }

      const decoder = new TextDecoder();
      let buffer = '';
      let preparedResult: PrepareAnalysisData | null = null;

      while (true) {
        const { done, value } = await reader.read();
        if (done) {
          break;
        }

        buffer += decoder.decode(value, { stream: true });
        const events = buffer.split('\n\n');
        buffer = events.pop() || '';

        for (const event of events) {
          if (!event.trim() || !event.startsWith('data: ')) {
            continue;
          }

          const payload = JSON.parse(event.substring(6));
          if (runId !== undefined && runId !== activeRunIdRef.current) {
            return null as never;
          }

          switch (payload.type) {
            case 'stage':
              applyLoadingStage(payload.stage as AnalysisLoadingStage);
              break;
            case 'result':
              preparedResult = payload.data as PrepareAnalysisData;
              applyPrepareState(preparedResult, runId);
              break;
            case 'error':
              if (payload.data) {
                applyPrepareState(payload.data as PrepareAnalysisData, runId);
              }
              throw new Error(payload.error || '数据准备失败');
            default:
              break;
          }
        }
      }

      if (!preparedResult) {
        throw new Error('数据准备流程中断，未返回最终结果');
      }

      return preparedResult;
    },
    [applyLoadingStage, applyPrepareState, code]
  );

  const loadAnalysis = useCallback(
    async (options: { forceSync?: boolean; levels?: string[] } = {}) => {
      const { forceSync = false, levels = [] } = options;
      const runId = activeRunIdRef.current + 1;
      activeRunIdRef.current = runId;

      setIsLoading(true);
      setError(null);
      setResult(null);
      setAiMarkdown(null);
      setAiState({ status: 'idle' });
      applyLoadingStage(forceSync || levels.length > 0 ? 'syncing' : 'checking');
      setDataIntegrityStatus((prev) => ({
        ...prev,
        isChecking: !forceSync,
        isSyncing: forceSync || levels.length > 0,
      }));

      try {
        const prepared = await prepareAnalysis({ forceSync, levels }, runId);

        if (runId !== activeRunIdRef.current) {
          return;
        }

        if (!prepared.ready) {
          const pendingLevels =
            prepared.levels?.filter((level) => level.status === 'pending').map((level) => level.name) || [];
          if (pendingLevels.length > 0) {
            throw new Error(`数据仍在同步中：${pendingLevels.join('、')}`);
          }

          throw new Error(prepared.summary?.analyzeWarning || '数据准备未完成');
        }

        if (!prepared.bootstrap?.analysisData) {
          throw new Error('分析结果缺失，请重试');
        }
      } catch (currentError) {
        if (runId !== activeRunIdRef.current) {
          return;
        }
        setError(currentError instanceof Error ? currentError.message : '分析失败');
      } finally {
        if (runId !== activeRunIdRef.current) {
          return;
        }
        setIsLoading(false);
        setDataIntegrityStatus((prev) => ({ ...prev, isChecking: false, isSyncing: false }));
      }
    },
    [applyLoadingStage, prepareAnalysis]
  );

  const handleManualSync = useCallback(
    async (frequencies?: string[]) => {
      await loadAnalysis({
        forceSync: true,
        levels: frequencies && frequencies.length > 0 ? frequencies : dataIntegrityStatus.needsSyncLevels,
      });
    },
    [dataIntegrityStatus.needsSyncLevels, loadAnalysis]
  );

  const handleGenerateAiSummary = useCallback(async () => {
    if (!result) {
      return;
    }

    setAiMarkdown(null);
    setAiState({ status: 'loading', label: '生成中' });

    try {
      const response = await fetch('/api/stock/ai-analysis', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code,
          analysisData: result,
        }),
      });

      const data = await response.json();
      if (!data.success) {
        throw new Error(data.error || '生成 AI 综合判断失败');
      }

      const parsed = parseAiReportContract(data.data.report);
      setAiMarkdown(parsed.markdown);
      setAiState({
        status: 'ready',
        summary: parsed.summary,
      });
    } catch (currentError) {
      setAiState({
        status: 'error',
        message: currentError instanceof Error ? currentError.message : '生成 AI 综合判断失败',
      });
    }
  }, [code, result]);

  const exportToPdf = useCallback(async () => {
    if (!contentRef.current) {
      return;
    }

    setIsExportingPdf(true);
    try {
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

      const image = new Image();
      await new Promise<void>((resolve, reject) => {
        image.onload = () => resolve();
        image.onerror = reject;
        image.src = dataUrl;
      });

      const imgWidth = 210;
      const pageHeight = 297;
      const imgHeight = (image.height * imgWidth) / image.width;
      let heightLeft = imgHeight;
      let position = 0;

      pdf.addImage(dataUrl, 'JPEG', 0, position, imgWidth, imgHeight, undefined, 'MEDIUM');
      heightLeft -= pageHeight;

      while (heightLeft > 0) {
        position = heightLeft - imgHeight;
        pdf.addPage();
        pdf.addImage(dataUrl, 'JPEG', 0, position, imgWidth, imgHeight, undefined, 'MEDIUM');
        heightLeft -= pageHeight;
      }

      const stockLabel = stockName || result?.stock_name || code;
      const date = new Date().toISOString().split('T')[0];
      pdf.save(`${stockLabel}_三位一体分析_${date}.pdf`);
    } catch {
      setError('PDF 导出失败，请重试');
    } finally {
      setIsExportingPdf(false);
    }
  }, [code, result?.stock_name, stockName]);

  useEffect(() => {
    autoLoadTriggeredRef.current = false;
    activeRunIdRef.current = 0;
    setIntegritySnapshot(null);
    setLoadingStage('checking');
  }, [code]);

  useEffect(() => {
    if (autoLoadTriggeredRef.current) {
      return;
    }

    autoLoadTriggeredRef.current = true;
    void loadAnalysis();
  }, [loadAnalysis]);

  const integrityForPage = useMemo(
    () => integritySnapshot ?? createIntegrityFallback(code, dataIntegrityStatus.warning),
    [code, dataIntegrityStatus.warning, integritySnapshot]
  );

  const pageViewModel = useMemo(() => {
    if (!result) {
      return null;
    }

    try {
      return buildAnalysisPageViewModel({
        result,
        integrity: integrityForPage,
        aiState,
      });
    } catch {
      return null;
    }
  }, [aiState, integrityForPage, result]);

  const periodSections = useMemo(() => (result ? buildPeriodSections(result) : []), [result]);

  return (
    <div className="container mx-auto max-w-6xl space-y-4 p-4">
      <div className="flex flex-col gap-3 border-b pb-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => router.back()} className="h-9 w-9">
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold">三位一体技术分析</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {stockName || result?.stock_name ? (
                <>
                  <span className="font-semibold">{stockName || result?.stock_name}</span>
                  <span className="mx-1">·</span>
                  <span className="font-mono">{code}</span>
                </>
              ) : (
                <>股票代码：<span className="font-mono">{code}</span></>
              )}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={exportToPdf}
            disabled={isLoading || isExportingPdf || !result}
          >
            {isExportingPdf ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
            导出 PDF
          </Button>
          <Button variant="outline" size="sm" onClick={() => router.push(`/stock/${code}`)}>
            <BarChart2 className="mr-2 h-4 w-4" />
            查看K线图
          </Button>
          <Button variant="outline" size="sm" onClick={() => loadAnalysis()} disabled={isLoading}>
            {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
            重新分析
          </Button>
        </div>
      </div>

      <DataIntegrityAlert
        code={code}
        onSync={handleManualSync}
        initialData={integritySnapshot}
        autoRefresh={false}
        externalState={
          isLoading && (loadingStage === 'requesting-analysis' || loadingStage === 'finalizing')
            ? 'analyzing'
            : result && dataIntegrityStatus.canAnalyze
              ? 'ready'
              : undefined
        }
        onIntegrityCheck={(canAnalyze, summary) => {
          setDataIntegrityStatus((prev) => ({
            ...prev,
            canAnalyze,
            summary: summary.overallText,
            warning: summary.analyzeWarning,
            needsSyncLevels: summary.needsSyncLevels || [],
          }));
        }}
      />

      <DataSyncTime code={code} initialData={integritySnapshot} autoFetch={false} />

      <SmartLoading
        isLoading={isLoading || dataIntegrityStatus.isChecking || dataIntegrityStatus.isSyncing}
        stage={
          dataIntegrityStatus.isSyncing ? 'syncing' : dataIntegrityStatus.isChecking ? 'checking' : loadingStage
        }
        slowThreshold={1200}
        loadingText="正在准备分析..."
        slowLoadingText="正在整理多周期分析数据，请稍候..."
      />

      {dataIntegrityStatus.warning && !isLoading && !dataIntegrityStatus.isChecking && !dataIntegrityStatus.isSyncing ? (
        <Card className="border-yellow-200 bg-yellow-50/60">
          <CardContent className="pt-6 text-sm text-yellow-800">{dataIntegrityStatus.warning}</CardContent>
        </Card>
      ) : null}

      {error && !isLoading && !dataIntegrityStatus.isChecking && !dataIntegrityStatus.isSyncing ? (
        <Card className="border-destructive">
          <CardContent className="flex flex-col gap-4 pt-6">
            <div className="text-sm text-destructive">分析失败：{error}</div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => loadAnalysis()}>
                重新分析
              </Button>
              <Button onClick={() => handleManualSync()}>重新同步后分析</Button>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {result && !isLoading && dataIntegrityStatus.canAnalyze && pageViewModel ? (
        <div ref={contentRef} className="space-y-4 rounded-xl bg-background">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Clock className="h-4 w-4" />
            <span>分析时间：{result.analysis_time || '未知'}</span>
          </div>

          <AnalysisSummaryPanel
            viewModel={pageViewModel.summary}
            onGenerate={handleGenerateAiSummary}
            canGenerate={Boolean(result) && !isLoading}
          />

          <LevelDecisionBus dimensions={pageViewModel.bus.dimensions} />

          {aiMarkdown && aiState.status === 'ready' ? (
            <Card className="border-border/70 bg-card/95 shadow-sm">
              <CardHeader>
                <CardTitle className="text-base">AI 正文</CardTitle>
              </CardHeader>
              <CardContent>
                <Markdown content={aiMarkdown} className="rounded-lg border bg-background/70 p-4" />
              </CardContent>
            </Card>
          ) : null}

          <TrinityRuleChain items={pageViewModel.ruleChain.items} />

          <AnalysisPeriodDetails sections={periodSections} />
        </div>
      ) : null}
    </div>
  );
}
