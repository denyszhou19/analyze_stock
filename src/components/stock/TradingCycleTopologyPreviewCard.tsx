import {
  StructureTopologySvg,
  type StructureExplainabilityData,
  type StructureRenderPayload,
} from '@/components/stock/StructureTopologySvg';
import type {
  AnalysisPageTopologyPreviewSource,
  AnalysisPageTopologyPreviewViewModel,
} from '@/lib/trinity-analysis-page-view-model';

type TopologyPreviewWithGraphData = AnalysisPageTopologyPreviewViewModel & {
  renderPayload?: StructureRenderPayload | null;
  payload?: StructureRenderPayload | null;
  explainability?: StructureExplainabilityData | null;
};

interface TradingCycleTopologyPreviewCardProps {
  preview: AnalysisPageTopologyPreviewViewModel | null | undefined;
  source: AnalysisPageTopologyPreviewSource;
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

  const graphPreview = preview as TopologyPreviewWithGraphData;
  const payload = graphPreview.renderPayload ?? graphPreview.payload ?? null;
  const explainability =
    preview.mode === 'annotated' ? graphPreview.explainability ?? null : null;
  const shouldRenderGraph = preview.mode !== 'unavailable' && Boolean(payload);

  return (
    <div className="mt-2 rounded-md border border-border/60 bg-background/80 p-2">
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
      <div className="mt-1.5 space-y-1">
        {preview.summaryRows.map((row) => (
          <p key={`${preview.level}-${preview.mode}-${row.label}`}>
            {row.label}：{row.value}
          </p>
        ))}
      </div>
    </div>
  );
}
