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
    'structure_type' | 'inflection_points' | 'description' | 'interpretation' | 'archetype' | 'structure_details'
  >;
  executionSummary: ExecutionSummaryLike;
  setupQualityLabel?: string | null;
  structureColors: Record<string, string>;
}

interface SummaryBlockProps {
  label: string;
  value: string;
  note?: string | null;
}

function SummaryBlock({ label, value, note }: SummaryBlockProps) {
  return (
    <div className="min-w-0 rounded-lg border border-border/60 bg-muted/20 p-3">
      <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="mt-2 break-words text-sm font-medium leading-6 text-foreground">{value}</div>
      {note && <div className="mt-1 break-words text-xs leading-5 text-muted-foreground">{note}</div>}
    </div>
  );
}

interface SupportSectionProps {
  title: string;
  children: React.ReactNode;
  className?: string;
}

function SupportSection({ title, children, className }: SupportSectionProps) {
  return (
    <Card className={className ?? 'border-border/60 shadow-none'}>
      <CardContent className="p-3 space-y-2">
        <div className="text-sm font-semibold text-foreground">{title}</div>
        {children}
      </CardContent>
    </Card>
  );
}

function getPeakAnalysisDisplay(peakAnalysis: StructurePeakAnalysis) {
  if (peakAnalysis.peak_type === 'mountain_peak') {
    return {
      badgeClassName: 'bg-red-100 text-red-700 border border-red-300',
      badgeLabel: '山峰形态',
      badgeSuffix: null,
    };
  }

  if (peakAnalysis.peak_type === 'valley_bottom') {
    return {
      badgeClassName: 'bg-green-100 text-green-700 border border-green-300',
      badgeLabel: '山谷形态',
      badgeSuffix: null,
    };
  }

  return {
    badgeClassName: 'bg-slate-100 text-slate-700 border border-slate-300',
    badgeLabel: '峰值形态待确认',
    badgeSuffix: null,
  };
}

function normalizeLiveText(value?: string | null): string | null {
  if (!value) {
    return null;
  }

  return value.replaceAll('→live', '→进行中').replaceAll(' live ', ' 进行中 ');
}

export function StructureExplainabilityPanel({
  structure,
  executionSummary,
  setupQualityLabel,
  structureColors,
}: StructureExplainabilityPanelProps) {
  const viewModel = buildStructureExplainabilityViewModel(structure);
  const details = structure.structure_details;
  const prediction = details?.prediction ?? null;
  const peakAnalysis = details?.peak_analysis ?? null;
  const warning = details?.left_structure_warning ?? null;
  const payload = details?.render_payload;
  const explainability = details?.explainability ?? null;
  const visibleStart = viewModel.topology.startLabel ?? '待确认';
  const visibleStartMeta = viewModel.topology.startMetaLabel;
  const visibleBackground = viewModel.interpretation.backgroundLabel ?? '待确认';
  const visibleCurrent =
    normalizeLiveText(viewModel.topology.currentSegmentLabel) ??
    normalizeLiveText(viewModel.interpretation.currentLegLabel) ??
    viewModel.topology.currentLabel ??
    prediction?.current_stage ??
    '待确认';
  const visibleNext =
    viewModel.topology.nextSegmentLabel ??
    viewModel.interpretation.nextConfirmationLabel ??
    prediction?.next_stage ??
    '待确认';
  const visibleStateTitle =
    viewModel.interpretation.executionStateLabel ?? executionSummary.phaseLabel ?? '等待确认';
  const isDowngraded = viewModel.interpretation.explainabilityStatus === 'downgraded';
  const standardQualification = viewModel.interpretation.standardQualification;
  const qualificationLabelMap: Record<string, string> = {
    standard: '标准',
    extended: '延伸',
    complex: '复杂',
    unfinished: '未完成',
  };
  const topologyReason =
    viewModel.interpretation.displayReason ??
    viewModel.topology.displayReason ??
    viewModel.topology.fallbackText ??
    prediction?.prediction_alert ??
    structure.description;
  const visibleStateReason =
    (isDowngraded ? viewModel.interpretation.downgradeReason : null) ??
    viewModel.interpretation.waitReason ??
    executionSummary.executionReason ??
    topologyReason;
  const visibleRequiredConfirmation =
    viewModel.interpretation.requiredConfirmation ??
    executionSummary.phaseReason ??
    '等待新的结构确认';
  const archetypeContext =
    (isDowngraded ? viewModel.interpretation.downgradeReason : null) ??
    executionSummary.archetypeReason ??
    viewModel.archetype.reason ??
    structure.description;
  const visibleArchetypeLabel = isDowngraded
    ? '复杂结构'
    : viewModel.interpretation.archetypeLabel ??
      executionSummary.archetypeLabel ??
      viewModel.archetype.primaryLabel;
  const visibleMaturity = viewModel.interpretation.maturityLabel;
  const scenarioPaths = structure.interpretation?.scenario_paths ?? [];
  const peakAnalysisDisplay = peakAnalysis ? getPeakAnalysisDisplay(peakAnalysis) : null;
  const predictionTone =
    prediction?.confidence === 'high'
      ? 'bg-amber-50 border-amber-200 dark:bg-amber-950/20 dark:border-amber-800'
      : prediction?.confidence === 'medium'
        ? 'bg-blue-50 border-blue-200 dark:bg-blue-950/20 dark:border-blue-800'
        : 'bg-slate-50 border-slate-200 dark:bg-slate-950/20 dark:border-slate-800';

  return (
    <div className="space-y-3">
      <div className="space-y-3">
        <Card className="border-border/60 shadow-none">
          <CardContent className="p-4 space-y-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
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
                <Badge
                  className={
                    structureColors[visibleArchetypeLabel || ''] ||
                    'border border-border bg-muted text-muted-foreground'
                  }
                >
                  当前结构 {visibleArchetypeLabel || structure.structure_type}
                </Badge>
                {standardQualification && (
                  <Badge variant="outline">
                    资格 {qualificationLabelMap[standardQualification] ?? standardQualification}
                  </Badge>
                )}
                {visibleMaturity && <Badge variant="outline">成熟度 {visibleMaturity}</Badge>}
                <Badge variant="outline">当前执行段 {visibleCurrent}</Badge>
                <Badge className="border border-sky-200 bg-sky-100 text-sky-700">
                  背景 {visibleBackground}
                </Badge>
                {structure.inflection_points > 0 && (
                  <Badge variant="outline">{structure.inflection_points}个拐点</Badge>
                )}
              </div>
            </div>

            <p className="text-sm text-muted-foreground">{topologyReason}</p>

            {payload?.point_count ? (
              <div className="rounded-xl border border-border/60 bg-slate-900/95 p-3">
                <StructureTopologySvg
                  payload={payload}
                  explainability={explainability}
                  className="h-56 w-full"
                />
              </div>
            ) : (
              <div className="rounded-lg border border-dashed border-border/60 bg-muted/20 p-4 text-sm text-muted-foreground">
                暂无可视化拓扑，等待结构几何数据。
              </div>
            )}

            <div className="grid gap-3 sm:grid-cols-2">
              <SummaryBlock
                label="当前结构"
                value={visibleArchetypeLabel || structure.structure_type}
                note={topologyReason}
              />
              <SummaryBlock label="当前执行段" value={visibleCurrent} note={visibleStateTitle} />
              <SummaryBlock label="下一确认" value={visibleNext} note={visibleRequiredConfirmation} />
              <SummaryBlock label="结构起点" value={visibleStart} note={visibleStartMeta} />
            </div>
          </CardContent>
        </Card>

        <div className="grid gap-3 xl:grid-cols-2">
          <Card className="border-border/60 shadow-none">
            <CardContent className="p-4 space-y-3">
              <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                当前状态
              </div>
              <div className="text-base font-semibold text-foreground">{visibleStateTitle}</div>
              <p className="text-sm text-muted-foreground">{visibleStateReason}</p>
              <div className="rounded-lg border border-border/60 bg-muted/20 p-3 text-sm text-muted-foreground">
                等什么做：{visibleRequiredConfirmation}
              </div>
            </CardContent>
          </Card>

          <Card className="border-border/60 shadow-none">
            <CardContent className="p-4 space-y-3">
              <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                执行参考
              </div>
              <div className="flex flex-wrap gap-2">
                {executionSummary.phaseLabel && <Badge variant="outline">{executionSummary.phaseLabel}</Badge>}
                {executionSummary.actionLabel && <Badge variant="outline">{executionSummary.actionLabel}</Badge>}
                {setupQualityLabel && <Badge variant="outline">形态质量 {setupQualityLabel}</Badge>}
                {executionSummary.timeframeCapLabel && (
                  <Badge variant="outline">{executionSummary.timeframeCapLabel}</Badge>
                )}
              </div>
              <p className="text-sm text-muted-foreground">
                {executionSummary.phaseReason || archetypeContext}
              </p>
              {isDowngraded && viewModel.interpretation.downgradeReason ? (
                <div className="rounded-lg border border-border/60 bg-muted/20 p-3 text-sm text-muted-foreground">
                  {viewModel.interpretation.downgradeReason}
                </div>
              ) : null}
              {!isDowngraded && viewModel.archetype.alternativeLabels.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {viewModel.archetype.alternativeLabels.map((label) => (
                    <Badge key={label} variant="outline">
                      备选 {label}
                    </Badge>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {scenarioPaths.length > 0 && (
        <SupportSection title="改判路径">
          <div className="space-y-2">
            {scenarioPaths.map((path, index) => (
              <div
                key={path.code ?? `${path.label ?? 'scenario'}-${index}`}
                className="rounded-lg border border-border/60 bg-muted/20 p-3"
              >
                <div className="text-sm font-semibold text-foreground">{path.label || '路径待确认'}</div>
                {path.trigger && (
                  <div className="mt-1 text-xs text-muted-foreground">触发条件: {path.trigger}</div>
                )}
                {path.effect && (
                  <div className="mt-1 text-xs text-muted-foreground">改判结果: {path.effect}</div>
                )}
              </div>
            ))}
          </div>
        </SupportSection>
      )}

      {prediction && (
        <SupportSection title="预测提示" className={predictionTone}>
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
        <SupportSection title="峰值分析">
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
          title="左侧结构提醒"
          className={
            warning.type === 'mountain_peak_left'
              ? 'border-red-200 bg-red-50/80 shadow-none'
              : 'border-green-200 bg-green-50/80 shadow-none'
          }
        >
          <div className="space-y-2 text-sm">
            <div
              className={
                warning.type === 'mountain_peak_left'
                  ? 'font-semibold text-red-700'
                  : 'font-semibold text-green-700'
              }
            >
              {warning.title}
            </div>
            {warning.warning && <div className="text-red-600">{warning.warning}</div>}
            {warning.opportunity && <div className="text-green-600">{warning.opportunity}</div>}
            <div className="text-muted-foreground">
              {warning.risk_description || warning.opportunity_description || '等待更多结构确认。'}
            </div>
            <div className="text-xs text-amber-700">
              {warning.key_defense || warning.key_resistance || '暂无关键防守位'}
            </div>
            <div className="text-xs font-medium text-amber-700">提示：{warning.action_hint}</div>
          </div>
        </SupportSection>
      )}

      {details?.judgment_criteria && (
        <SupportSection title="判定标准">
          <pre className="whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground">
            {details.judgment_criteria}
          </pre>
        </SupportSection>
      )}
    </div>
  );
}
