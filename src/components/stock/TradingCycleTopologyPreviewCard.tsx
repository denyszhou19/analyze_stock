import {
  StructureTopologySvg,
} from '@/components/stock/StructureTopologySvg';
import type {
  AnalysisPageTopologyPreviewSource,
  AnalysisPageTopologyPreviewViewModel,
} from '@/lib/trinity-analysis-page-view-model';
import { cn } from '@/lib/utils';

interface TradingCycleTopologyPreviewCardProps {
  preview: AnalysisPageTopologyPreviewViewModel | null | undefined;
  source: AnalysisPageTopologyPreviewSource;
}

export interface TradingCycleTooltipContentOptions {
  className: string;
  disableTextBalance: boolean;
  arrowClassName?: string;
}

export const DEFAULT_TOOLTIP_CONTENT_CLASSNAME =
  'max-w-md rounded-[1.25rem] border border-slate-200/80 bg-white/95 p-4 text-left text-sm leading-6 text-slate-900 shadow-[0_24px_64px_-28px_rgba(15,23,42,0.45)] backdrop-blur-sm';
export const TOPOLOGY_PREVIEW_TOOLTIP_CONTENT_CLASSNAME =
  'max-w-[min(88vw,56rem)] rounded-[1.25rem] border border-slate-200/80 bg-white/95 p-4 text-left text-sm leading-6 text-slate-900 shadow-[0_24px_64px_-28px_rgba(15,23,42,0.45)] backdrop-blur-sm [text-wrap:wrap]';
export const LIGHT_TOOLTIP_ARROW_CLASSNAME =
  'border-l border-t border-slate-200/80 bg-white fill-white';

export function getTradingCycleTooltipContentClassName(
  preview: AnalysisPageTopologyPreviewViewModel | null | undefined
) {
  return preview ? TOPOLOGY_PREVIEW_TOOLTIP_CONTENT_CLASSNAME : DEFAULT_TOOLTIP_CONTENT_CLASSNAME;
}

export function getTradingCycleTooltipContentOptions(
  preview: AnalysisPageTopologyPreviewViewModel | null | undefined
): TradingCycleTooltipContentOptions {
  return {
    className: getTradingCycleTooltipContentClassName(preview),
    disableTextBalance: Boolean(preview),
    arrowClassName: LIGHT_TOOLTIP_ARROW_CLASSNAME,
  };
}

function getPreviewTitle(source: AnalysisPageTopologyPreviewSource) {
  if (source === 'parent') {
    return '父级结构参考';
  }

  if (source === 'child') {
    return '子级结构参考';
  }

  return '结构参考';
}

function getPreviewModeLabel(mode: AnalysisPageTopologyPreviewViewModel['mode']) {
  if (mode === 'annotated') {
    return '图文已对齐';
  }
  if (mode === 'raw_lines') {
    return '先核对结构线';
  }
  return '结构图暂缺';
}

function getPreviewHint(
  source: AnalysisPageTopologyPreviewSource,
  mode: AnalysisPageTopologyPreviewViewModel['mode']
) {
  if (source === 'parent') {
    return mode === 'annotated'
      ? '先看父级框架，再核对当前约束是否真的放行。'
      : '先按父级结构线核对趋势框架，再等待更完整的结构说明。';
  }

  if (source === 'child') {
    return mode === 'annotated'
      ? '先看子级结构，再核对标签描述是否和当前阶段一致。'
      : '先按子级结构线核对形态，再等待更完整的结构说明。';
  }

  return mode === 'annotated'
    ? '先看结构图，再核对当前描述是否与结构阶段一致。'
    : '先按结构线核对形态，再等待更完整的结构说明。';
}

export function TradingCycleTopologyPreviewCard({
  preview,
  source,
}: TradingCycleTopologyPreviewCardProps) {
  if (!preview || !source) {
    return null;
  }

  const payload = preview.renderPayload ?? null;
  const explainability = preview.mode === 'annotated' ? preview.explainability ?? null : null;
  const shouldRenderGraph = preview.mode !== 'unavailable' && Boolean(payload);

  return (
    <div
      data-slot="trading-cycle-topology-preview-card"
      className="mt-3 rounded-2xl border border-slate-200/80 bg-slate-50/80 p-4"
    >
      <div
        data-slot="trading-cycle-topology-preview-header"
        className="flex flex-wrap items-start justify-between gap-3"
      >
        <div className="space-y-1">
          <div className="text-sm font-semibold text-slate-900">
            {getPreviewTitle(source)}
          </div>
          <div className="text-xs text-slate-500">{preview.levelLabel}</div>
        </div>
        <div className="inline-flex items-center rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-medium text-slate-600">
          {getPreviewModeLabel(preview.mode)}
        </div>
      </div>
      <p className="mt-3 text-xs leading-5 text-slate-600">
        {getPreviewHint(source, preview.mode)}
      </p>
      {shouldRenderGraph ? (
        <div
          data-slot="trading-cycle-topology-preview-graph"
          className="mt-4 overflow-hidden rounded-xl border border-slate-200/80 bg-white px-3 py-3"
        >
          <StructureTopologySvg
            payload={payload ?? undefined}
            explainability={explainability}
            className="h-40 w-full"
          />
        </div>
      ) : null}
      <div
        data-slot="trading-cycle-topology-summary"
        className="mt-4 grid gap-3"
      >
        {preview.summaryRows.map((row) => (
          <div
            key={`${preview.level}-${preview.mode}-${row.label}`}
            data-slot="trading-cycle-topology-summary-row"
            className="grid grid-cols-[5rem_minmax(0,1fr)] gap-x-3 text-sm leading-6"
          >
            <div
              data-slot="trading-cycle-topology-summary-label"
              className="text-slate-500"
            >
              {row.label}
            </div>
            <div
              data-slot="trading-cycle-topology-summary-value"
              className={cn('min-w-0 text-slate-900', '[overflow-wrap:anywhere]')}
            >
              {row.value}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
