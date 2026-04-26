import { Badge } from '@/components/ui/badge';
import {
  getTradingCycleTooltipContentOptions,
  TradingCycleTopologyPreviewCard,
} from '@/components/stock/TradingCycleTopologyPreviewCard';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import type {
  AnalysisPageSignalTagViewModel,
  AnalysisPageTopologyPreviewSource,
  AnalysisPageTopologyPreviewViewModel,
} from '@/lib/trinity-analysis-page-view-model';
import { getSignalTagToneMeta } from '@/lib/trinity-display-vocabulary';
import { cn } from '@/lib/utils';

interface SignalTagListProps {
  tags: AnalysisPageSignalTagViewModel[];
  resolveTopologyPreview?: (
    source: AnalysisPageTopologyPreviewSource
  ) => AnalysisPageTopologyPreviewViewModel | null | undefined;
}

export function SignalTagList({ tags, resolveTopologyPreview }: SignalTagListProps) {
  if (!tags.length) {
    return null;
  }

  return (
    <div className="flex flex-wrap gap-1.5">
      {tags.map((tag) => {
        const toneMeta = getSignalTagToneMeta(tag.tone);
        const shouldRenderTopologyPreview =
          tag.category === '结构' && Boolean(tag.topologyPreviewSource);
        const topologyPreview = shouldRenderTopologyPreview && tag.topologyPreviewSource
          ? resolveTopologyPreview?.(tag.topologyPreviewSource) ?? null
          : null;
        const tooltipContentOptions = getTradingCycleTooltipContentOptions(topologyPreview);
        const tooltipSide = shouldRenderTopologyPreview
          ? tag.topologyPreviewSource === 'parent'
            ? 'left'
            : 'right'
          : 'top';

        return (
          <Tooltip key={`${tag.key}-${tag.label}`}>
            <TooltipTrigger asChild>
              <Badge
                variant="outline"
                className={cn(
                  'h-auto max-w-full cursor-help whitespace-normal break-words py-1 text-left leading-5',
                  toneMeta.badgeClassName
                )}
              >
                {tag.label}
              </Badge>
            </TooltipTrigger>
            <TooltipContent
              side={tooltipSide}
              className={tooltipContentOptions.className}
              disableTextBalance={tooltipContentOptions.disableTextBalance}
              arrowClassName={tooltipContentOptions.arrowClassName}
            >
              <div className="space-y-3">
                <div className="text-sm font-semibold text-slate-900">{tag.hover.title}</div>
                {tag.hover.items.map((item) => (
                  <p key={`${tag.key}-${item.label}`} className="text-slate-700">
                    {item.label}：{item.value}
                  </p>
                ))}
                {shouldRenderTopologyPreview ? (
                  <TradingCycleTopologyPreviewCard
                    preview={topologyPreview}
                    source={tag.topologyPreviewSource ?? null}
                  />
                ) : null}
              </div>
            </TooltipContent>
          </Tooltip>
        );
      })}
    </div>
  );
}
