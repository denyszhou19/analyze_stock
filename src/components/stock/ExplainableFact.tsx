import { Info } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import type { AnalysisPageExplainableField } from '@/lib/trinity-analysis-page-view-model';

interface ExplainableFactProps {
  fact: AnalysisPageExplainableField;
}

export function ExplainableFact({ fact }: ExplainableFactProps) {
  return (
    <div className="rounded-lg border bg-background/70 p-2">
      <div className="flex items-start justify-between gap-2">
        <div className="space-y-1">
          <div className="font-medium text-foreground">{fact.label}</div>
          <div>{fact.value}</div>
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
          <TooltipContent side="top" className="max-w-sm text-sm leading-6">
            <div className="space-y-1">
              <div className="font-medium">{fact.hoverTitle}</div>
              {fact.hoverItems.map((item) => (
                <p key={`${fact.label}-${item.label}`}>
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
