import type {
  AnalysisPageTopologyPreviewSource,
  AnalysisPageTopologyPreviewViewModel,
} from '@/lib/trinity-analysis-page-view-model';

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

  return (
    <div className="mt-2 rounded-md border border-border/60 bg-background/80 p-2">
      <div className="font-medium text-foreground">
        {getPreviewTitle(source)}
      </div>
      <div className="text-xs text-muted-foreground">{preview.levelLabel}</div>
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
