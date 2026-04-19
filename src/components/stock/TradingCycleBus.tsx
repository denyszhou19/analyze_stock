import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { AnalysisPageTradingCombinationViewModel } from '@/lib/trinity-analysis-page-view-model';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Info } from 'lucide-react';
import { getDirectionMeta } from '@/lib/trinity-display-vocabulary';
import { cn } from '@/lib/utils';

interface TradingCycleBusProps {
  combinations: AnalysisPageTradingCombinationViewModel[];
}

const SIGNAL_TAG_TONE_CLASS_NAME = {
  bullish: 'border-rose-200 bg-rose-50 text-rose-700',
  bearish: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  warning: 'border-amber-200 bg-amber-50 text-amber-800',
  neutral: 'border-slate-200 bg-slate-50 text-slate-700',
} as const;

function InlineSignalTagList({
  tags,
}: {
  tags: AnalysisPageTradingCombinationViewModel[number]['signalTags'];
}) {
  if (!tags.length) {
    return null;
  }

  return (
    <div className="flex flex-wrap gap-1.5">
      {tags.map((tag) => {
        const badgeClassName = SIGNAL_TAG_TONE_CLASS_NAME[tag.tone];

        return (
          <Tooltip key={tag.key}>
            <TooltipTrigger asChild>
              <Badge
                variant="outline"
                className={cn('cursor-help whitespace-nowrap', badgeClassName)}
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

function InlineExplainableFact({
  fact,
}: {
  fact: AnalysisPageTradingCombinationViewModel[number]['parentConstraint'];
}) {
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

export function TradingCycleBus({ combinations }: TradingCycleBusProps) {
  if (!combinations.length) {
    return null;
  }

  return (
    <section className="space-y-3" aria-label="交易周期总线">
      <div className="space-y-1">
        <h2 className="text-base font-semibold text-foreground">交易周期总线</h2>
        <p className="text-sm text-muted-foreground">
          用三条交易组合综合判断当前最适合做中线、短线、超短线 / T，还是继续等待。
        </p>
      </div>

      <div className="grid gap-3 xl:grid-cols-3">
        {combinations.map((combination) => {
          const directionMeta = getDirectionMeta(combination.direction);

          return (
            <Card
              key={combination.key}
              className={cn('gap-4 py-4 shadow-none', directionMeta.cardClassName)}
            >
              <CardHeader className="space-y-2 px-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <CardTitle className="text-sm">{combination.label}</CardTitle>
                  <div className="flex flex-wrap gap-1.5">
                    <Badge variant="outline" className={directionMeta.badgeClassName}>
                      {combination.directionLabel}
                    </Badge>
                    <Badge variant="outline">状态：{combination.actionLabel}</Badge>
                  </div>
                </div>
              </CardHeader>

              <CardContent className="space-y-3 px-4 text-sm">
                <div className="space-y-2">
                  <p className="leading-6 text-foreground">{combination.summary}</p>
                  <p className="leading-6 text-muted-foreground">{combination.recommendation}</p>
                  <p className="text-xs text-muted-foreground">{combination.relationHint}</p>
                </div>

                <InlineSignalTagList tags={combination.signalTags} />

                <div className="grid gap-2 text-xs text-muted-foreground">
                  <InlineExplainableFact fact={combination.parentConstraint} />
                  <InlineExplainableFact fact={combination.triggerLevel} />
                  <InlineExplainableFact fact={combination.suitableAction} />
                  <InlineExplainableFact fact={combination.majorRisk} />
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </section>
  );
}
