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
}

export const DEFAULT_TOOLTIP_CONTENT_CLASSNAME = 'max-w-sm text-sm leading-6';
export const TOPOLOGY_PREVIEW_TOOLTIP_CONTENT_CLASSNAME =
  'max-w-[min(86vw,52rem)] p-0 text-left text-sm leading-6 [text-wrap:wrap]';

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
  };
}

function getPreviewTitle(source: AnalysisPageTopologyPreviewSource) {
  if (source === 'parent') {
    return '父级拓扑摘要';
  }

  if (source === 'child') {
    return '子级拓扑摘要';
  }

  return '拓扑摘要';
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
    <div className="mt-2 rounded-md border border-border/60 bg-background/80 p-3">
      <div className="font-medium text-foreground">
        {getPreviewTitle(source)}
      </div>
      <div className="text-xs text-muted-foreground">{preview.levelLabel}</div>
      {shouldRenderGraph ? (
        <div className="mt-2 rounded-sm border border-border/50 bg-slate-950/95 p-1">
          <StructureTopologySvg
            payload={payload ?? undefined}
            explainability={explainability}
            className="h-36 w-full"
          />
        </div>
      ) : null}
      <div
        data-slot="trading-cycle-topology-summary"
        className="mt-2 grid gap-2"
      >
        {preview.summaryRows.map((row) => (
          <div
            key={`${preview.level}-${preview.mode}-${row.label}`}
            data-slot="trading-cycle-topology-summary-row"
            className="grid grid-cols-[5.5rem_minmax(0,1fr)] gap-x-2 text-sm leading-6"
          >
            <div
              data-slot="trading-cycle-topology-summary-label"
              className="text-muted-foreground"
            >
              {row.label}
            </div>
            <div
              data-slot="trading-cycle-topology-summary-value"
              className={cn('min-w-0 text-foreground', '[overflow-wrap:anywhere]')}
            >
              {row.value}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
