import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import type { AnalysisPageSignalTagViewModel } from '@/lib/trinity-analysis-page-view-model';
import { getSignalTagToneMeta } from '@/lib/trinity-display-vocabulary';
import { cn } from '@/lib/utils';

interface SignalTagListProps {
  tags: AnalysisPageSignalTagViewModel[];
}

export function SignalTagList({ tags }: SignalTagListProps) {
  if (!tags.length) {
    return null;
  }

  return (
    <div className="flex flex-wrap gap-1.5">
      {tags.map((tag) => {
        const toneMeta = getSignalTagToneMeta(tag.tone);

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
            <TooltipContent side="top" className="max-w-sm text-sm leading-6">
              <div className="space-y-1">
                <div className="font-medium">{tag.hover.title}</div>
                {tag.hover.items.map((item) => (
                  <p key={`${tag.key}-${item.label}`}>
                    {item.label}：{item.value}
                  </p>
                ))}
              </div>
            </TooltipContent>
          </Tooltip>
        );
      })}
    </div>
  );
}
