import { Info } from 'lucide-react';
import {
  getTradingCycleTooltipContentOptions,
} from '@/components/stock/TradingCycleTopologyPreviewCard';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import type {
  AnalysisPageExplainableField,
  AnalysisPageTopologyPreviewSource,
  AnalysisPageTopologyPreviewViewModel,
} from '@/lib/trinity-analysis-page-view-model';

interface ExplainableFactProps {
  fact: AnalysisPageExplainableField;
  resolveTopologyPreview?: (
    source: AnalysisPageTopologyPreviewSource
  ) => AnalysisPageTopologyPreviewViewModel | null | undefined;
}

export function ExplainableFact({ fact, resolveTopologyPreview }: ExplainableFactProps) {
  const tooltipContentOptions = getTradingCycleTooltipContentOptions(null);
  void resolveTopologyPreview;

  return (
    <div className="rounded-xl border border-slate-200/80 bg-white/85 p-3">
      <div className="flex items-start justify-between gap-2">
        <div className="space-y-1">
          <div className="font-medium text-foreground">{fact.label}</div>
          <div className="leading-6 text-slate-700">{fact.value}</div>
        </div>
        <Tooltip>
          <TooltipTrigger
            asChild
            aria-label={fact.hoverTitle}
            className="mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-muted-foreground"
          >
            <span>
              <Info className="h-3.5 w-3.5 cursor-help text-muted-foreground" />
            </span>
          </TooltipTrigger>
          <TooltipContent
            side="top"
            className={tooltipContentOptions.className}
            disableTextBalance={tooltipContentOptions.disableTextBalance}
            arrowClassName={tooltipContentOptions.arrowClassName}
          >
            <div className="space-y-3">
              <div className="text-sm font-semibold text-slate-900">{fact.hoverTitle}</div>
              {fact.hoverItems.map((item) => (
                <p key={`${fact.label}-${item.label}`} className="text-slate-700">
                  {item.label}：{item.value}
                </p>
              ))}
            </div>
          </TooltipContent>
        </Tooltip>
      </div>
    </div>
  );
}
