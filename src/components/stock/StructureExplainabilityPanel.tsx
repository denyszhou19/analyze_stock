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
import {
  buildStructureExplainabilityViewModel,
  normalizeStructureDisplayText,
} from '../../lib/structure-explainability-view-model';
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
  tone?: UiTone;
  emphasis?: 'default' | 'primary';
}

type UiTone =
  | 'bullish'
  | 'bearish'
  | 'neutral'
  | 'wait'
  | 'risk'
  | 'info'
  | 'progress'
  | 'start'
  | 'confirmed'
  | 'live'
  | 'next';

const TONE_STYLES: Record<
  UiTone,
  {
    panel: string;
    block: string;
    badge: string;
    note: string;
    label: string;
  }
> = {
  bullish: {
    panel: 'border-red-200 bg-red-50/90 text-red-950',
    block: 'border-red-200 bg-red-50/80',
    badge: 'border border-red-200 bg-red-50 text-red-700',
    note: 'text-red-700/80',
    label: 'text-red-700/80',
  },
  bearish: {
    panel: 'border-green-200 bg-green-50/90 text-green-950',
    block: 'border-green-200 bg-green-50/80',
    badge: 'border border-green-200 bg-green-50 text-green-700',
    note: 'text-green-700/80',
    label: 'text-green-700/80',
  },
  neutral: {
    panel: 'border-slate-200 bg-slate-50/90 text-slate-900',
    block: 'border-slate-200 bg-slate-50/80',
    badge: 'border border-slate-200 bg-slate-50 text-slate-700',
    note: 'text-slate-600',
    label: 'text-slate-600',
  },
  wait: {
    panel: 'border-amber-200 bg-amber-50/95 text-amber-950',
    block: 'border-amber-200 bg-amber-50/85',
    badge: 'border border-amber-200 bg-amber-50 text-amber-800',
    note: 'text-amber-800/80',
    label: 'text-amber-800/80',
  },
  risk: {
    panel: 'border-orange-200 bg-orange-50/95 text-orange-950',
    block: 'border-orange-200 bg-orange-50/85',
    badge: 'border border-orange-200 bg-orange-50 text-orange-800',
    note: 'text-orange-800/80',
    label: 'text-orange-800/80',
  },
  info: {
    panel: 'border-sky-200 bg-sky-50/95 text-sky-950',
    block: 'border-sky-200 bg-sky-50/85',
    badge: 'border border-sky-200 bg-sky-50 text-sky-700',
    note: 'text-sky-800/80',
    label: 'text-sky-800/80',
  },
  progress: {
    panel: 'border-blue-200 bg-blue-50/95 text-blue-950',
    block: 'border-blue-200 bg-blue-50/85',
    badge: 'border border-blue-200 bg-blue-50 text-blue-700',
    note: 'text-blue-800/80',
    label: 'text-blue-800/80',
  },
  start: {
    panel: 'border-amber-200 bg-amber-50/95 text-amber-950',
    block: 'border-amber-200 bg-amber-50/85',
    badge: 'border border-amber-200 bg-amber-50 text-amber-800',
    note: 'text-amber-800/80',
    label: 'text-amber-800/80',
  },
  confirmed: {
    panel: 'border-slate-300 bg-slate-100/90 text-slate-950',
    block: 'border-slate-300 bg-slate-100/90',
    badge: 'border border-slate-300 bg-slate-100 text-slate-700',
    note: 'text-slate-700/80',
    label: 'text-slate-700/80',
  },
  live: {
    panel: 'border-cyan-200 bg-cyan-50/95 text-cyan-950',
    block: 'border-cyan-200 bg-cyan-50/85',
    badge: 'border border-cyan-200 bg-cyan-50 text-cyan-700',
    note: 'text-cyan-800/80',
    label: 'text-cyan-800/80',
  },
  next: {
    panel: 'border-indigo-200 bg-indigo-50/95 text-indigo-950',
    block: 'border-indigo-200 bg-indigo-50/85',
    badge: 'border border-indigo-200 bg-indigo-50 text-indigo-700',
    note: 'text-indigo-800/80',
    label: 'text-indigo-800/80',
  },
};

function joinTextParts(parts: Array<string | null | undefined>) {
  return parts.filter(Boolean).join(' ');
}

function includesAny(source: string | null | undefined, candidates: string[]) {
  if (!source) {
    return false;
  }

  return candidates.some((candidate) => source.includes(candidate));
}

function resolveDirectionTone(...parts: Array<string | null | undefined>): UiTone {
  const content = joinTextParts(parts);

  if (includesAny(content, ['下跌', '向下', '跌破', '压制', '偏空', '卖', '减仓', '空头', '走弱', '回落'])) {
    return 'bearish';
  }

  if (includesAny(content, ['上涨', '向上', '突破', '支撑', '偏多', '买', '加仓', '多头', '走强', '回升', '上行'])) {
    return 'bullish';
  }

  if (includesAny(content, ['下行'])) {
    return 'bearish';
  }

  if (includesAny(content, ['盘整', '震荡', '横盘', '双向', '中性'])) {
    return 'neutral';
  }

  if (includesAny(content, ['等待', '待确认', '暂不操作', '观望'])) {
    return 'wait';
  }

  return 'info';
}

function resolveExecutionTone(...parts: Array<string | null | undefined>): UiTone {
  const content = joinTextParts(parts);

  if (includesAny(content, ['规避', '失效', '风险', '警惕', '衰竭', '背离', '复杂结构'])) {
    return 'risk';
  }

  if (includesAny(content, ['等待', '待确认', '暂不操作', '观望'])) {
    return 'wait';
  }

  return resolveDirectionTone(content);
}

function resolveMaturityTone(value?: string | null): UiTone {
  if (!value) {
    return 'info';
  }

  if (value.includes('已失效') || value.includes('复杂')) {
    return 'risk';
  }

  if (value.includes('开展中')) {
    return 'progress';
  }

  if (value.includes('候选')) {
    return 'neutral';
  }

  if (value.includes('已确认') || value.includes('已完成')) {
    return 'info';
  }

  return 'info';
}

function getToneStyle(tone: UiTone) {
  return TONE_STYLES[tone];
}

function SummaryBlock({
  label,
  value,
  note,
  tone = 'neutral',
  emphasis = 'default',
}: SummaryBlockProps) {
  const style = getToneStyle(tone);
  return (
    <div
      data-tone={tone}
      data-emphasis={emphasis}
      className={`rounded-xl border p-3 ${style.block} ${emphasis === 'primary' ? 'shadow-sm' : ''}`}
    >
      <div className={`text-[11px] font-semibold uppercase tracking-[0.18em] ${style.label}`}>{label}</div>
      <div className="mt-2 text-sm font-semibold text-foreground">{value}</div>
      {note && <div className={`mt-1 text-xs leading-5 ${style.note}`}>{note}</div>}
    </div>
  );
}

interface SupportSectionProps {
  title: string;
  children: React.ReactNode;
  className?: string;
  tone?: UiTone;
}

function SupportSection({ title, children, className, tone = 'neutral' }: SupportSectionProps) {
  const style = getToneStyle(tone);
  return (
    <Card
      data-tone={tone}
      className={`${style.panel} shadow-none ${className ?? ''}`.trim()}
    >
      <CardContent className="p-3 space-y-2">
        <div className={`text-sm font-semibold ${style.label}`}>{title}</div>
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

  return normalizeStructureDisplayText(
    value.replaceAll('→live', '→进行中').replaceAll(' live ', ' 进行中 ')
  );
}

function isInternalPointId(pointId?: string | null) {
  return Boolean(pointId && /^p\d+$/i.test(pointId));
}

function formatVisibleTopologyPoint(
  point:
    | {
        point_id?: string;
        price_label?: string;
      }
    | undefined,
  mode: 'labeled' | 'price_only'
) {
  if (!point) {
    return null;
  }

  if (mode === 'labeled' && point.point_id && !isInternalPointId(point.point_id) && point.price_label) {
    return `${point.point_id} @ ${point.price_label}`;
  }

  return point.price_label ?? point.point_id ?? null;
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
  const predictionAlert = normalizeStructureDisplayText(prediction?.prediction_alert);
  const predictionCurrentStage = normalizeStructureDisplayText(prediction?.current_stage);
  const predictionNextStage = normalizeStructureDisplayText(prediction?.next_stage);
  const predictionActionHint = normalizeStructureDisplayText(prediction?.action_hint);
  const payloadPoints = payload?.points ?? [];
  const lastConfirmedPointId =
    structure.interpretation?.current_leg?.from_point_id ?? explainability?.current_point_id ?? null;
  const lastConfirmedPoint = payloadPoints.find((point) => point.point_id === lastConfirmedPointId);
  const livePoint = payloadPoints.find((point) => point.is_current);
  const visibleStart = viewModel.topology.startLabel ?? '待确认';
  const visibleStartMeta = viewModel.topology.startMetaLabel;
  const visibleBackground = viewModel.interpretation.backgroundLabel ?? '待确认';
  const visibleCurrent =
    normalizeLiveText(viewModel.topology.currentSegmentLabel) ??
    normalizeLiveText(viewModel.interpretation.currentLegLabel) ??
    normalizeStructureDisplayText(viewModel.topology.currentLabel) ??
    predictionCurrentStage ??
    '待确认';
  const visibleNext =
    normalizeStructureDisplayText(viewModel.topology.nextSegmentLabel) ??
    normalizeStructureDisplayText(viewModel.interpretation.nextConfirmationLabel) ??
    predictionNextStage ??
    '待确认';
  const visibleLastConfirmed =
    formatVisibleTopologyPoint(lastConfirmedPoint, 'labeled') ??
    viewModel.topology.lastConfirmedLabel ??
    normalizeStructureDisplayText(viewModel.topology.currentLabel) ??
    '待确认';
  const visibleLivePoint =
    formatVisibleTopologyPoint(livePoint, 'price_only') ??
    (viewModel.topology.liveLabel === 'live'
      ? '进行中'
      : viewModel.topology.liveLabel ?? '待确认');
  const visibleStateTitle =
    viewModel.interpretation.executionStateLabel ?? executionSummary.phaseLabel ?? '等待确认';
  const isDowngraded = viewModel.interpretation.explainabilityStatus === 'downgraded';
  const standardQualification = viewModel.interpretation.standardQualification;
  const topologyReason = normalizeStructureDisplayText(
    viewModel.interpretation.displayReason ??
    viewModel.topology.displayReason ??
    viewModel.topology.fallbackText ??
    predictionAlert ??
    structure.description
  );
  const visibleStateReason = normalizeStructureDisplayText(
    (isDowngraded ? viewModel.interpretation.downgradeReason : null) ??
    viewModel.interpretation.waitReason ??
    executionSummary.executionReason ??
    topologyReason
  ) ?? '等待结构确认';
  const visibleRequiredConfirmation =
    normalizeStructureDisplayText(
      viewModel.interpretation.requiredConfirmation ?? executionSummary.phaseReason
    ) ?? '等待新的结构确认';
  const archetypeContext = normalizeStructureDisplayText(
    (isDowngraded ? viewModel.interpretation.downgradeReason : null) ??
    executionSummary.archetypeReason ?? viewModel.archetype.reason ?? structure.description
  );
  const visibleArchetypeLabel =
    isDowngraded
      ? '复杂结构'
      : viewModel.interpretation.archetypeLabel ?? executionSummary.archetypeLabel ?? viewModel.archetype.primaryLabel;
  const visibleMaturity = viewModel.interpretation.maturityLabel;
  const scenarioPaths = structure.interpretation?.scenario_paths ?? [];
  const peakAnalysisDisplay = peakAnalysis ? getPeakAnalysisDisplay(peakAnalysis) : null;
  const stateTone = resolveExecutionTone(visibleStateTitle, visibleStateReason);
  const currentTone = resolveExecutionTone(visibleCurrent, topologyReason);
  const backgroundTone = resolveDirectionTone(visibleBackground);
  const archetypeTone =
    includesAny(visibleArchetypeLabel, ['复杂', '等待'])
      ? 'risk'
      : structureColors[visibleArchetypeLabel || '']
        ? 'progress'
        : 'info';
  const maturityTone = resolveMaturityTone(visibleMaturity);
  const actionTone = resolveExecutionTone(executionSummary.actionLabel, executionSummary.executionReason);
  const phaseTone = resolveExecutionTone(executionSummary.phaseLabel, executionSummary.phaseReason);
  const qualityTone = setupQualityLabel === '规避' ? 'risk' : 'info';
  const capTone = executionSummary.timeframeCapLabel ? 'info' : 'neutral';
  const predictionTone: UiTone =
    prediction?.confidence === 'high'
      ? 'wait'
      : prediction?.confidence === 'medium'
        ? 'progress'
        : 'neutral';
  const qualificationNote =
    !isDowngraded && standardQualification === 'extended'
      ? '当前按延伸结构解释，保留原始原型供参考。'
      : !isDowngraded && standardQualification === 'unfinished'
        ? '当前结构仍未完成，后续确认后可能收敛为标准原型。'
        : null;
  const archetypeNote = isDowngraded
    ? viewModel.interpretation.downgradeReason ?? archetypeContext
    : qualificationNote ??
      (viewModel.archetype.alternativeLabels.length > 0
        ? `备选：${viewModel.archetype.alternativeLabels.join(' / ')}`
        : archetypeContext);
  const maturityNote =
    predictionCurrentStage
      ? `当前定位：${predictionCurrentStage}`
      : normalizeStructureDisplayText(executionSummary.phaseReason);
  const constraintNote = executionSummary.timeframeCapLabel
    ? `生效前提：${visibleRequiredConfirmation}`
    : '当前未给出明确补仓上限。';

  return (
    <div className="space-y-3">
      <Card className="border-border/60 shadow-none">
        <CardContent className="p-4 space-y-4">
          <SummaryBlock
            label="当前状态"
            value={visibleStateTitle}
            note={`${visibleStateReason} 等什么做：${visibleRequiredConfirmation}`}
            tone={stateTone}
            emphasis="primary"
          />

          <div className="grid gap-3 lg:grid-cols-2">
            <SummaryBlock
              label="当前段"
              value={visibleCurrent}
              note={topologyReason}
              tone={currentTone}
            />
            <SummaryBlock
              label="下一确认"
              value={visibleNext}
              note={visibleRequiredConfirmation}
              tone="next"
            />
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <SummaryBlock
              label="大背景"
              value={visibleBackground}
              note="上一级时空状态给出的方向背景。"
              tone={backgroundTone}
            />
            <SummaryBlock
              label="结构原型"
              value={visibleArchetypeLabel || structure.structure_type}
              note={archetypeNote}
              tone={archetypeTone}
            />
            {visibleMaturity && (
              <SummaryBlock
                label="结构阶段"
                value={visibleMaturity}
                note={maturityNote}
                tone={maturityTone}
              />
            )}
          </div>

          <div className="space-y-3">
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

              {structure.inflection_points > 0 && (
                <Badge className={getToneStyle('confirmed').badge}>
                  {structure.inflection_points} 个拐点
                </Badge>
              )}
            </div>

            <p className="text-sm leading-6 text-muted-foreground">{topologyReason}</p>

            {payload?.point_count ? (
              <div className="rounded-xl border border-border/60 bg-slate-900/95 p-3">
                <StructureTopologySvg
                  payload={payload}
                  explainability={explainability}
                  className="h-44 w-full"
                />
              </div>
            ) : (
              <div className="rounded-lg border border-dashed border-border/60 bg-muted/20 p-4 text-sm text-muted-foreground">
                暂无可视化拓扑，等待结构几何数据。
              </div>
            )}
          </div>

          <SupportSection title="坐标锚点" tone="info">
            <div className="grid gap-3 sm:grid-cols-2">
              <SummaryBlock label="聚焦起点" value={visibleStart} note={visibleStartMeta} tone="start" />
              <SummaryBlock label="最后确认点" value={visibleLastConfirmed} tone="confirmed" />
              <SummaryBlock label="进行中点" value={visibleLivePoint} note="最新价格仍在这条进行中尾段上。" tone="live" />
              <SummaryBlock label="下一确认" value={visibleNext} note={visibleRequiredConfirmation} tone="next" />
            </div>
          </SupportSection>

          <div className="grid gap-3 lg:grid-cols-2">
            <SupportSection title="执行动作" tone={actionTone}>
              <div className="grid gap-3 sm:grid-cols-2">
                {executionSummary.actionLabel && (
                  <SummaryBlock
                    label="动作指令"
                    value={executionSummary.actionLabel}
                    note={normalizeStructureDisplayText(executionSummary.executionReason)}
                    tone={actionTone}
                  />
                )}
                {executionSummary.phaseLabel && (
                  <SummaryBlock
                    label="执行阶段"
                    value={executionSummary.phaseLabel}
                    note={normalizeStructureDisplayText(executionSummary.phaseReason)}
                    tone={phaseTone}
                  />
                )}
                {setupQualityLabel && (
                  <SummaryBlock
                    label="形态质量"
                    value={setupQualityLabel}
                    note="质量越高，越值得等待确认后执行。"
                    tone={qualityTone}
                  />
                )}
              </div>
            </SupportSection>

            <SupportSection title="仓位约束" tone={capTone}>
              <SummaryBlock
                label="补仓上限"
                value={executionSummary.timeframeCapLabel ?? '未给出'}
                note={constraintNote}
                tone={capTone}
              />
            </SupportSection>
          </div>
        </CardContent>
      </Card>

      {scenarioPaths.length > 0 && (
        <SupportSection title="改判路径" tone="progress">
          <div className="space-y-2">
            {scenarioPaths.map((path, index) => (
              <div
                key={path.code ?? `${path.label ?? 'scenario'}-${index}`}
                className={`rounded-lg border p-3 ${
                  resolveDirectionTone(path.label, path.effect) === 'bearish'
                    ? getToneStyle('bearish').block
                    : resolveDirectionTone(path.label, path.effect) === 'bullish'
                      ? getToneStyle('bullish').block
                      : getToneStyle('neutral').block
                }`}
              >
                <div className="text-sm font-semibold text-foreground">{path.label || '路径待确认'}</div>
                {path.trigger && (
                  <div className="mt-1 text-xs text-muted-foreground">
                    触发条件：{normalizeStructureDisplayText(path.trigger)}
                  </div>
                )}
                {path.effect && (
                  <div className="mt-1 text-xs text-muted-foreground">
                    改判结果：{normalizeStructureDisplayText(path.effect)}
                  </div>
                )}
              </div>
            ))}
          </div>
        </SupportSection>
      )}

      {prediction && (
        <SupportSection title="预测提示" tone={predictionTone}>
          <div className="space-y-2">
            <div className="text-sm font-medium text-foreground">{predictionAlert}</div>
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
              <span>当前阶段：{predictionCurrentStage ?? '待确认'}</span>
              <span>下一阶段：{predictionNextStage ?? '待确认'}</span>
            </div>
            {predictionActionHint && (
              <div className="text-xs font-medium text-primary">💡 {predictionActionHint}</div>
            )}
            {prediction.key_price_levels.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {prediction.key_price_levels.map((level, index) => (
                  <Badge key={`${level.type}-${level.price}-${index}`} variant="outline" className="text-xs">
                    {normalizeStructureDisplayText(level.type)}：{level.price} ({normalizeStructureDisplayText(level.note)})
                  </Badge>
                ))}
              </div>
            )}
          </div>
        </SupportSection>
      )}

      {peakAnalysis?.is_peak_structure && (
        <SupportSection
          title="峰值分析"
          tone={peakAnalysis?.peak_type === 'mountain_peak' ? 'bullish' : peakAnalysis?.peak_type === 'valley_bottom' ? 'bearish' : 'neutral'}
        >
          <div className="space-y-2 text-sm text-muted-foreground">
            <div className="flex flex-wrap items-center gap-2">
              <Badge className={peakAnalysisDisplay?.badgeClassName}>
                {peakAnalysisDisplay?.badgeLabel}
              </Badge>
              {peakAnalysis.peak_price !== null && (
                <Badge variant="outline">峰值 {peakAnalysis.peak_price.toFixed(2)}</Badge>
              )}
            </div>
            <div>{normalizeStructureDisplayText(peakAnalysis.description)}</div>
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs">
              {peakAnalysis.left_structure && (
                <span>左侧：{normalizeStructureDisplayText(peakAnalysis.left_structure)}</span>
              )}
              {peakAnalysis.right_structure && (
                <span>右侧：{normalizeStructureDisplayText(peakAnalysis.right_structure)}</span>
              )}
            </div>
          </div>
        </SupportSection>
      )}

      {warning && (
        <SupportSection
          title="左侧结构提醒"
          tone={warning.type === 'mountain_peak_left' ? 'bullish' : 'bearish'}
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
            {warning.warning && (
              <div className="text-red-600">{normalizeStructureDisplayText(warning.warning)}</div>
            )}
            {warning.opportunity && (
              <div className="text-green-600">{normalizeStructureDisplayText(warning.opportunity)}</div>
            )}
            <div className="text-muted-foreground">
              {normalizeStructureDisplayText(
                warning.risk_description || warning.opportunity_description || '等待更多结构确认。'
              )}
            </div>
            <div className="text-xs text-amber-700">
              {warning.key_defense || warning.key_resistance || '暂无关键防守位'}
            </div>
            <div className="text-xs font-medium text-amber-700">
              提示：{normalizeStructureDisplayText(warning.action_hint)}
            </div>
          </div>
        </SupportSection>
      )}

      {details?.judgment_criteria && (
        <SupportSection title="判定标准" tone="info">
          <pre className="whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground">
            {normalizeStructureDisplayText(details.judgment_criteria)}
          </pre>
        </SupportSection>
      )}
    </div>
  );
}
