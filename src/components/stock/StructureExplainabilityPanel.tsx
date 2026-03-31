'use client';

import { Info } from 'lucide-react';

import { Badge } from '../ui/badge';
import { Card, CardContent } from '../ui/card';
import { Separator } from '../ui/separator';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '../ui/tooltip';
import {
  StructureTopologySvg,
} from './StructureTopologySvg';
import { buildStructureExplainabilityViewModel } from '../../lib/structure-explainability-view-model';
import type {
  StructureData,
  StructurePeakAnalysis,
} from '../../lib/stock-structure-types';

interface ExecutionSummaryLike {
  phaseLabel: string | null;
  phaseReason: string | null;
  actionLabel: string | null;
  setupQuality: string | null;
  timeframeCapLabel: string | null;
  executionReason: string | null;
  archetypeLabel: string | null;
  archetypeReason: string | null;
}

interface StructureExplainabilityPanelProps {
  structure: Pick<
    StructureData,
    'structure_type' | 'trend_direction' | 'inflection_points' | 'description' | 'archetype' | 'structure_details'
  >;
  executionSummary: ExecutionSummaryLike;
  setupQualityLabel?: string | null;
  structureColors: Record<string, string>;
  getTrendStyle: (trend: string) => string;
}

interface SummaryBlockProps {
  label: string;
  value: string;
}

function SummaryBlock({ label, value }: SummaryBlockProps) {
  return (
    <div className="rounded-lg border border-border/60 bg-muted/20 p-3">
      <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="mt-2 text-sm font-medium text-foreground">{value}</div>
    </div>
  );
}

interface SupportSectionProps {
  code: string;
  title: string;
  children: React.ReactNode;
  className?: string;
}

function SupportSection({ code, title, children, className }: SupportSectionProps) {
  return (
    <Card className={className ?? 'border-border/60 shadow-none'}>
      <CardContent className="p-3 space-y-2">
        <div className="flex items-center justify-between gap-3">
          <div className="text-sm font-semibold text-foreground">{title}</div>
          <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            {code}
          </div>
        </div>
        {children}
      </CardContent>
    </Card>
  );
}

function getPeakAnalysisDisplay(peakAnalysis: StructurePeakAnalysis) {
  if (peakAnalysis.peak_type === 'mountain_peak') {
    return {
      badgeClassName: 'bg-red-100 text-red-700 border border-red-300',
      badgeLabel: '🏔️ 山峰形态',
      badgeSuffix: '🏔️',
    };
  }

  if (peakAnalysis.peak_type === 'valley_bottom') {
    return {
      badgeClassName: 'bg-green-100 text-green-700 border border-green-300',
      badgeLabel: '⛰️ 山谷形态',
      badgeSuffix: '⛰️',
    };
  }

  return {
    badgeClassName: 'bg-slate-100 text-slate-700 border border-slate-300',
    badgeLabel: '◌ 峰值形态待确认',
    badgeSuffix: '◌',
  };
}

export function StructureExplainabilityPanel({
  structure,
  executionSummary,
  setupQualityLabel,
  structureColors,
  getTrendStyle,
}: StructureExplainabilityPanelProps) {
  const viewModel = buildStructureExplainabilityViewModel(structure);
  const details = structure.structure_details;
  const prediction = details?.prediction ?? null;
  const peakAnalysis = details?.peak_analysis ?? null;
  const warning = details?.left_structure_warning ?? null;
  const payload = details?.render_payload;
  const explainability = details?.explainability ?? null;
  const visibleStart = viewModel.topology.startLabel ?? '待确认';
  const visibleCurrent =
    viewModel.topology.currentSegmentLabel ??
    viewModel.topology.currentLabel ??
    prediction?.current_stage ??
    '待确认';
  const visibleNext =
    viewModel.topology.nextSegmentLabel ?? prediction?.next_stage ?? '待确认';
  const topologyReason =
    viewModel.topology.displayReason ??
    viewModel.topology.fallbackText ??
    structure.description;
  const archetypeContext =
    executionSummary.archetypeReason ?? viewModel.archetype.reason ?? structure.description;
  const peakAnalysisDisplay = peakAnalysis ? getPeakAnalysisDisplay(peakAnalysis) : null;
  const predictionTone =
    prediction?.confidence === 'high'
      ? 'bg-amber-50 border-amber-200 dark:bg-amber-950/20 dark:border-amber-800'
      : prediction?.confidence === 'medium'
        ? 'bg-blue-50 border-blue-200 dark:bg-blue-950/20 dark:border-blue-800'
        : 'bg-slate-50 border-slate-200 dark:bg-slate-950/20 dark:border-slate-800';

  return (
    <div className="space-y-3">
      <div className="grid gap-3 md:grid-cols-3">
        <Card className="border-border/60 shadow-none">
          <CardContent className="p-3 space-y-2">
            <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              当前阶段
            </div>
            <div className="flex flex-wrap gap-2">
              <Badge className="border border-sky-200 bg-sky-100 text-sky-700">
                {executionSummary.phaseLabel || '暂无阶段'}
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground">
              {executionSummary.phaseReason || '等待更多结构与执行信号确认当前阶段。'}
            </p>
          </CardContent>
        </Card>

        <Card className="border-border/60 shadow-none">
          <CardContent className="p-3 space-y-2">
            <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              执行建议
            </div>
            <div className="flex flex-wrap gap-2">
              <Badge className="border border-emerald-200 bg-emerald-100 text-emerald-700">
                {executionSummary.actionLabel || '等待'}
              </Badge>
              {setupQualityLabel && <Badge variant="outline">形态质量 {setupQualityLabel}</Badge>}
              {executionSummary.timeframeCapLabel && (
                <Badge variant="outline">{executionSummary.timeframeCapLabel}</Badge>
              )}
            </div>
            <p className="text-sm text-muted-foreground">
              {executionSummary.executionReason || '当前周期暂无额外执行说明。'}
            </p>
          </CardContent>
        </Card>

        <Card className="border-border/60 shadow-none">
          <CardContent className="p-3 space-y-2">
            <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              结构原型
            </div>
            <div className="flex flex-wrap gap-2">
              <Badge
                className={
                  structureColors[executionSummary.archetypeLabel || ''] ||
                  'border border-border bg-muted text-muted-foreground'
                }
              >
                {executionSummary.archetypeLabel || '暂无原型'}
              </Badge>
              {viewModel.archetype.alternativeLabels.map((label) => (
                <Badge key={label} variant="outline">
                  备选 {label}
                </Badge>
              ))}
            </div>
            <p className="text-sm text-muted-foreground">{archetypeContext}</p>
          </CardContent>
        </Card>
      </div>

      <Separator />

      <Card className="border-border/60 shadow-none">
        <CardContent className="p-4 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                结构拓扑
              </span>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Info className="h-3.5 w-3.5 cursor-help text-muted-foreground" />
                  </TooltipTrigger>
                  <TooltipContent side="right" className="max-w-md">
                    <div className="space-y-2 text-xs">
                      <div className="font-semibold text-foreground">缠论笔画法说明</div>
                      <div className="space-y-1">
                        <div>
                          <span className="font-medium">顶分型</span>：中间K线的高点和低点都比两边高
                        </div>
                        <div>
                          <span className="font-medium">底分型</span>：中间K线的高点和低点都比两边低
                        </div>
                        <div>
                          <span className="font-medium">笔</span>：顶底分型相连，至少间隔3-5根K线
                        </div>
                      </div>
                      <Separator className="my-2" />
                      <div className="font-semibold text-foreground">四种基本结构</div>
                      <div className="grid grid-cols-2 gap-1">
                        <div>
                          <span className="text-blue-400">A五段式</span>：5笔6拐点，第三浪为主升/跌浪
                        </div>
                        <div>
                          <span className="text-green-400">B双平台式</span>：9笔10拐点，双平台整理
                        </div>
                        <div>
                          <span className="text-yellow-400">C单平台式</span>：5笔6拐点，单平台整理
                        </div>
                        <div>
                          <span className="text-purple-400">D三段式</span>：3笔4拐点，最小完整结构
                        </div>
                      </div>
                    </div>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>

            <div className="flex flex-wrap gap-2">
              <Badge className={structureColors[structure.structure_type] || ''}>
                {structure.structure_type}
                {peakAnalysis?.is_peak_structure && peakAnalysisDisplay && (
                  <span className="ml-1">
                    {peakAnalysisDisplay.badgeSuffix}
                  </span>
                )}
              </Badge>
              <Badge className={getTrendStyle(structure.trend_direction)}>
                {structure.trend_direction}
              </Badge>
              {structure.inflection_points > 0 && (
                <Badge variant="outline">{structure.inflection_points}个拐点</Badge>
              )}
            </div>
          </div>

          <p className="text-sm text-muted-foreground">{structure.description}</p>

          {payload?.point_count ? (
            <div className="rounded-xl border border-border/60 bg-slate-900/95 p-3">
              <StructureTopologySvg
                payload={payload}
                explainability={explainability}
                className="h-48 w-full"
              />
            </div>
          ) : (
            <div className="rounded-lg border border-dashed border-border/60 bg-muted/20 p-4 text-sm text-muted-foreground">
              暂无可视化拓扑，等待结构几何数据。
            </div>
          )}

          <div className="grid gap-3 md:grid-cols-3">
            <SummaryBlock label="结构起点" value={visibleStart} />
            <SummaryBlock label="当前段" value={visibleCurrent} />
            <SummaryBlock label="下一段预期" value={visibleNext} />
          </div>

          <div className="rounded-lg border border-border/60 bg-muted/20 p-3">
            <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              结构判读说明
            </div>
            <p className="mt-2 text-sm text-muted-foreground">{topologyReason}</p>
          </div>
        </CardContent>
      </Card>

      {prediction && (
        <SupportSection code="prediction" title="预测提示" className={predictionTone}>
          <div className="space-y-2">
            <div className="text-sm font-medium text-foreground">{prediction.prediction_alert}</div>
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
              <span>当前阶段: {prediction.current_stage}</span>
              <span>下一阶段: {prediction.next_stage}</span>
            </div>
            {prediction.action_hint && (
              <div className="text-xs font-medium text-primary">💡 {prediction.action_hint}</div>
            )}
            {prediction.key_price_levels.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {prediction.key_price_levels.map((level, index) => (
                  <Badge key={`${level.type}-${level.price}-${index}`} variant="outline" className="text-xs">
                    {level.type}: {level.price} ({level.note})
                  </Badge>
                ))}
              </div>
            )}
          </div>
        </SupportSection>
      )}

      {peakAnalysis?.is_peak_structure && (
        <SupportSection code="peak_analysis" title="峰值分析">
          <div className="space-y-2 text-sm text-muted-foreground">
            <div className="flex flex-wrap items-center gap-2">
              <Badge className={peakAnalysisDisplay?.badgeClassName}>
                {peakAnalysisDisplay?.badgeLabel}
              </Badge>
              {peakAnalysis.peak_price !== null && (
                <Badge variant="outline">峰值 {peakAnalysis.peak_price.toFixed(2)}</Badge>
              )}
            </div>
            <div>{peakAnalysis.description}</div>
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs">
              {peakAnalysis.left_structure && <span>左侧: {peakAnalysis.left_structure}</span>}
              {peakAnalysis.right_structure && <span>右侧: {peakAnalysis.right_structure}</span>}
            </div>
          </div>
        </SupportSection>
      )}

      {warning && (
        <SupportSection
          code="left_structure_warning"
          title="左侧结构提醒"
          className={
            warning.type === 'mountain_peak_left'
              ? 'border-red-600 bg-red-900/40 shadow-none'
              : 'border-green-600 bg-green-900/40 shadow-none'
          }
        >
          <div className="space-y-2 text-sm">
            <div
              className={
                warning.type === 'mountain_peak_left'
                  ? 'font-semibold text-red-300'
                  : 'font-semibold text-green-300'
              }
            >
              {warning.title}
            </div>
            {warning.warning && <div className="text-red-200">{warning.warning}</div>}
            {warning.opportunity && <div className="text-green-200">{warning.opportunity}</div>}
            <div className="text-slate-200">
              {warning.risk_description || warning.opportunity_description || '等待更多结构确认。'}
            </div>
            <div className="text-xs text-yellow-200">
              {warning.key_defense || warning.key_resistance || '暂无关键防守位'}
            </div>
            <div className="text-xs font-medium text-orange-200">💡 {warning.action_hint}</div>
          </div>
        </SupportSection>
      )}

      {details?.judgment_criteria && (
        <SupportSection code="judgment_criteria" title="判定标准">
          <pre className="whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground">
            {details.judgment_criteria}
          </pre>
        </SupportSection>
      )}
    </div>
  );
}
