'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, BarChart2, Clock, Download, Loader2, RefreshCw } from 'lucide-react';
import jsPDF from 'jspdf';
import { domToJpeg } from 'modern-screenshot';

import { AnalysisPeriodDetails } from '@/components/stock/AnalysisPeriodDetails';
import type { AnalysisPeriodSection } from '@/components/stock/AnalysisPeriodDetails';
import { AiFollowupPanel } from '@/components/stock/AiFollowupPanel';
import { AnalysisSummaryPanel } from '@/components/stock/AnalysisSummaryPanel';
import { DataIntegrityAlert } from '@/components/stock/DataIntegrityAlert';
import { DataSyncTime } from '@/components/stock/DataSyncTime';
import { TradingCycleBus } from '@/components/stock/TradingCycleBus';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Markdown } from '@/components/ui/markdown';
import { SmartLoading } from '@/components/ui/smart-loading';
import type { AnalysisLoadingStage } from '@/lib/analysis-loading-stage';
import { parseAiReportContract } from '@/lib/ai-report-contract';
import { cn } from '@/lib/utils';
import {
  beginRequestRun,
  createRequestRunGuard,
  invalidateRequestRun,
  isCurrentRequestRun,
} from '@/lib/request-run-guard';
import type { DataIntegritySnapshot } from '@/lib/stock-data-integrity';
import type { AnalysisResultData, PeriodAnalysisData } from '@/lib/stock-structure-types';
import { normalizeVisibleDecisionText } from '@/lib/trinity-decision-labels';
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

interface AiFollowupTurn {
  id: string;
  question: string;
  markdown: string;
}

interface GenerateAiAnalysisResponse {
  success: boolean;
  error?: string;
  data?: {
    code: string;
    report: string;
    session?: {
      sessionId: string;
    } | null;
    snapshotKey?: string | null;
    generatedAt?: string;
  };
}

interface FollowupResponse {
  success: boolean;
  error?: string;
  data?: {
    markdown: string;
  };
}

interface AnalysisSectionNavItem {
  id: string;
  label: string;
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
  const [aiSession, setAiSession] = useState<{ sessionId: string; snapshotKey: string } | null>(null);
  const [aiFollowupDraft, setAiFollowupDraft] = useState('');
  const [aiFollowupLoading, setAiFollowupLoading] = useState(false);
  const [aiFollowupTurns, setAiFollowupTurns] = useState<AiFollowupTurn[]>([]);
  const [aiFollowupError, setAiFollowupError] = useState<string | null>(null);
  const [activeSectionId, setActiveSectionId] = useState<string>('analysis-summary');

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
  const aiSummaryRunGuardRef = useRef(createRequestRunGuard());
  const followupRunGuardRef = useRef(createRequestRunGuard());

  const resetAiFollowupState = useCallback(() => {
    invalidateRequestRun(aiSummaryRunGuardRef.current);
    invalidateRequestRun(followupRunGuardRef.current);
    setAiSession(null);
    setAiFollowupDraft('');
    setAiFollowupLoading(false);
    setAiFollowupTurns([]);
    setAiFollowupError(null);
  }, []);

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
      resetAiFollowupState();
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
    [applyLoadingStage, prepareAnalysis, resetAiFollowupState]
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

    resetAiFollowupState();
    const aiSummaryRunId = beginRequestRun(aiSummaryRunGuardRef.current);
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

      const data = (await response.json()) as GenerateAiAnalysisResponse;
      const aiPayload = data.data;

      if (!data.success) {
        throw new Error(data.error || '生成 AI 综合判断失败');
      }

      if (!aiPayload?.report) {
        throw new Error('AI 综合判断结果缺失');
      }

      const parsed = parseAiReportContract(aiPayload.report);

      if (!isCurrentRequestRun(aiSummaryRunGuardRef.current, aiSummaryRunId)) {
        return;
      }

      if (isCurrentRequestRun(aiSummaryRunGuardRef.current, aiSummaryRunId)) {
        setAiMarkdown(parsed.markdown);
        setAiState({
          status: 'ready',
          summary: parsed.summary,
        });
        if (aiPayload.session?.sessionId && aiPayload.snapshotKey) {
          setAiSession({
            sessionId: aiPayload.session.sessionId,
            snapshotKey: aiPayload.snapshotKey,
          });
        }
      }
    } catch (currentError) {
      if (!isCurrentRequestRun(aiSummaryRunGuardRef.current, aiSummaryRunId)) {
        return;
      }

      setAiState({
        status: 'error',
        message: currentError instanceof Error ? currentError.message : '生成 AI 综合判断失败',
      });
      resetAiFollowupState();
    }
  }, [code, resetAiFollowupState, result]);

  const handleSubmitAiFollowup = useCallback(async () => {
    const question = aiFollowupDraft.trim();

    if (!aiSession || !question || aiFollowupLoading) {
      return;
    }

    const followupRunId = beginRequestRun(followupRunGuardRef.current);
    setAiFollowupLoading(true);
    setAiFollowupError(null);

    try {
      const response = await fetch('/api/stock/ai-analysis/follow-up', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: aiSession.sessionId,
          snapshotKey: aiSession.snapshotKey,
          question,
        }),
      });

      const data = (await response.json()) as FollowupResponse;
      const followupPayload = data.data;

      if (!data.success || !followupPayload?.markdown) {
        throw new Error(data.error || 'AI 追问失败');
      }

      if (!isCurrentRequestRun(followupRunGuardRef.current, followupRunId)) {
        return;
      }

      setAiFollowupTurns((prev) => [
        ...prev,
        {
          id: `${Date.now()}-${prev.length}`,
          question,
          markdown: normalizeVisibleDecisionText(followupPayload.markdown),
        },
      ]);
      setAiFollowupDraft('');
    } catch (currentError) {
      if (!isCurrentRequestRun(followupRunGuardRef.current, followupRunId)) {
        return;
      }
      setAiFollowupError(currentError instanceof Error ? currentError.message : 'AI 追问失败');
    } finally {
      if (isCurrentRequestRun(followupRunGuardRef.current, followupRunId)) {
        setAiFollowupLoading(false);
      }
    }
  }, [aiFollowupDraft, aiFollowupLoading, aiSession]);

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
    setAiMarkdown(null);
    setAiState({ status: 'idle' });
    resetAiFollowupState();
  }, [code, resetAiFollowupState]);

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
  const sectionNavItems = useMemo<AnalysisSectionNavItem[]>(() => {
    const items: AnalysisSectionNavItem[] = [
      { id: 'analysis-summary', label: '结论总览' },
      { id: 'analysis-bus', label: '交易总线' },
      { id: 'analysis-periods', label: '周期详情' },
    ];

    if (aiMarkdown && aiState.status === 'ready') {
      items.push({ id: 'analysis-report', label: 'AI 分析' });
    }

    if (aiState.status === 'ready' && aiSession) {
      items.push({ id: 'analysis-followup', label: 'AI 追问' });
    }

    return items;
  }, [aiMarkdown, aiSession, aiState.status]);

  useEffect(() => {
    if (!sectionNavItems.length) {
      return;
    }

    setActiveSectionId((current) =>
      sectionNavItems.some((item) => item.id === current) ? current : sectionNavItems[0]?.id ?? 'analysis-summary'
    );
  }, [sectionNavItems]);

  useEffect(() => {
    if (typeof window === 'undefined' || !sectionNavItems.length) {
      return;
    }

    const sectionElements = sectionNavItems
      .map((item) => document.getElementById(item.id))
      .filter((element): element is HTMLElement => Boolean(element));

    if (!sectionElements.length) {
      return;
    }

    const activeEntries = new Map<string, IntersectionObserverEntry>();

    const updateActiveSection = () => {
      const visibleEntries = sectionElements
        .map((element) => {
          const entry = activeEntries.get(element.id);
          return {
            id: element.id,
            top: Math.abs(element.getBoundingClientRect().top - 120),
            ratio: entry?.intersectionRatio ?? 0,
            visible: Boolean(entry?.isIntersecting),
          };
        })
        .filter((entry) => entry.visible);

      if (visibleEntries.length > 0) {
        visibleEntries.sort((left, right) => {
          if (right.ratio !== left.ratio) {
            return right.ratio - left.ratio;
          }
          return left.top - right.top;
        });
        setActiveSectionId(visibleEntries[0]?.id ?? sectionNavItems[0]?.id ?? 'analysis-summary');
        return;
      }

      const fallback = [...sectionElements]
        .map((element) => ({
          id: element.id,
          top: element.getBoundingClientRect().top,
        }))
        .filter((entry) => entry.top <= 140)
        .sort((left, right) => right.top - left.top)[0];

      if (fallback?.id) {
        setActiveSectionId(fallback.id);
      }
    };

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            activeEntries.set(entry.target.id, entry);
          } else {
            activeEntries.delete(entry.target.id);
          }
        });
        updateActiveSection();
      },
      {
        rootMargin: '-96px 0px -52% 0px',
        threshold: [0.16, 0.35, 0.6],
      }
    );

    sectionElements.forEach((element) => observer.observe(element));
    updateActiveSection();

    return () => observer.disconnect();
  }, [sectionNavItems]);

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

          <nav
            aria-label="分析页导航"
            className="sticky top-3 z-20 overflow-x-auto rounded-2xl border border-border/70 bg-card/95 p-1.5 shadow-sm backdrop-blur supports-[backdrop-filter]:bg-card/88"
          >
            <div className="inline-flex min-w-full items-center gap-1.5 rounded-xl bg-muted/72 p-1">
              {sectionNavItems.map((item) => (
                <a
                  key={item.id}
                  href={`#${item.id}`}
                  aria-current={item.id === activeSectionId ? 'page' : undefined}
                  data-active={item.id === activeSectionId ? 'true' : 'false'}
                  onClick={() => setActiveSectionId(item.id)}
                  className={cn(
                    'shrink-0 whitespace-nowrap rounded-xl px-4 py-2 text-sm font-medium transition-all duration-200',
                    item.id === activeSectionId
                      ? 'bg-background text-foreground shadow-sm ring-1 ring-border/70'
                      : 'text-muted-foreground hover:bg-background/70 hover:text-foreground'
                  )}
                >
                  {item.label}
                </a>
              ))}
            </div>
          </nav>

          <section id="analysis-summary" className="scroll-mt-24">
            <AnalysisSummaryPanel
              viewModel={pageViewModel.summary}
              globalStrategy={pageViewModel.globalStrategy}
              onGenerate={handleGenerateAiSummary}
              canGenerate={Boolean(result) && !isLoading}
            />
          </section>

          <section id="analysis-bus" className="scroll-mt-24">
            <TradingCycleBus combinations={pageViewModel.tradingCombinations} />
          </section>

          <section id="analysis-periods" className="scroll-mt-24">
            <AnalysisPeriodDetails
              sections={periodSections}
              defaultLevelKey={pageViewModel.globalStrategy.primaryConstraintLevel}
            />
          </section>

          {aiMarkdown && aiState.status === 'ready' ? (
            <Card id="analysis-report" className="scroll-mt-24 border-border/70 bg-card/95 shadow-sm">
              <CardHeader>
                <CardTitle className="text-base">AI 正文</CardTitle>
              </CardHeader>
              <CardContent>
                <Markdown content={aiMarkdown} className="rounded-lg border bg-background/70 p-4" />
              </CardContent>
            </Card>
          ) : null}

          {aiState.status === 'ready' && aiSession ? (
            <section id="analysis-followup" className="scroll-mt-24">
              <AiFollowupPanel
                draft={aiFollowupDraft}
                turns={aiFollowupTurns}
                isLoading={aiFollowupLoading}
                errorMessage={aiFollowupError}
                onDraftChange={setAiFollowupDraft}
                onSubmit={handleSubmitAiFollowup}
                renderMarkdown={(content) => (
                  <Markdown content={content} className="space-y-3 text-sm" />
                )}
              />
            </section>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
