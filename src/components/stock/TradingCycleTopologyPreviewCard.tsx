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
      className="mt-2 rounded-2xl border border-slate-200/80 bg-slate-50/80 p-3.5"
    >
      <div
        data-slot="trading-cycle-topology-preview-header"
        className="flex items-start justify-between gap-3"
      >
        <div className="flex min-w-0 items-center gap-2">
          <div className="shrink-0 text-sm font-semibold text-slate-900">
            {getPreviewTitle(source)}
          </div>
          <div className="truncate text-[11px] text-slate-500">{preview.levelLabel}</div>
        </div>
        <div className="inline-flex shrink-0 items-center rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[11px] font-medium text-slate-600">
          {getPreviewModeLabel(preview.mode)}
        </div>
      </div>
      {shouldRenderGraph ? (
        <div
          data-slot="trading-cycle-topology-preview-graph"
          className="mt-3 overflow-hidden rounded-xl border border-slate-200/80 bg-white px-3 py-3"
        >
          <StructureTopologySvg
            payload={payload ?? undefined}
            explainability={explainability}
            className="h-44 w-full"
          />
        </div>
      ) : null}
      <div
        data-slot="trading-cycle-topology-summary"
        className="mt-3 grid gap-2.5"
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
