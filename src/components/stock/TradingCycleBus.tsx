import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ExplainableFact } from '@/components/stock/ExplainableFact';
import { SignalTagList } from '@/components/stock/SignalTagList';
import {
  getTradingCycleTooltipContentOptions,
  TradingCycleTopologyPreviewCard,
} from '@/components/stock/TradingCycleTopologyPreviewCard';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import type {
  AnalysisPageTopologyPreviewSource,
  AnalysisPageTradingCombinationViewModel,
} from '@/lib/trinity-analysis-page-view-model';
import { getDirectionMeta } from '@/lib/trinity-display-vocabulary';
import { cn } from '@/lib/utils';
import { Info } from 'lucide-react';

interface TradingCycleBusProps {
  combinations: AnalysisPageTradingCombinationViewModel[];
}

const ACTION_STATE_CATEGORIES = new Set(['执行', '级别']);
const JUDGMENT_BASIS_CATEGORIES = new Set([
  '时空',
  '结构',
  '均线',
  '量能',
  '背离',
  '突破/跌破',
]);

function filterSignalTags(
  tags: AnalysisPageTradingCombinationViewModel['signalTags'],
  categories: Set<string>
) {
  return tags.filter((tag) => categories.has(tag.category));
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
          const resolveTopologyPreview = (
            source: AnalysisPageTopologyPreviewSource
          ) => {
            if (source === 'parent') {
              return combination.parentTopologyPreview ?? null;
            }

            if (source === 'child') {
              return combination.childTopologyPreview ?? null;
            }

            return null;
          };
          const actionStateTags = combination.actionStateTags?.length
            ? combination.actionStateTags
            : filterSignalTags(combination.signalTags, ACTION_STATE_CATEGORIES);
          const judgmentBasisTags = combination.judgmentBasisTags?.length
            ? combination.judgmentBasisTags
            : filterSignalTags(combination.signalTags, JUDGMENT_BASIS_CATEGORIES);
          const parentConstraintTags = combination.parentConstraintTags?.length
            ? combination.parentConstraintTags
            : combination.parentSignalTags ?? [];
          const parentConstraintPreview = resolveTopologyPreview(
            combination.parentConstraint.topologyPreviewSource ?? null
          );
          const parentConstraintTooltipContentOptions =
            getTradingCycleTooltipContentOptions(parentConstraintPreview);

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
                    <Badge variant="secondary">{combination.judgmentLabel}</Badge>
                  </div>
                </div>
              </CardHeader>

              <CardContent className="space-y-3 px-4 text-sm">
                <div className="space-y-2">
                  <p className="font-medium text-foreground">
                    父子关系：{combination.relationLabel}
                  </p>
                  <p className="leading-6 text-foreground">{combination.summary}</p>
                  <p className="leading-6 text-muted-foreground">{combination.recommendation}</p>
                  <p className="text-xs text-muted-foreground">{combination.relationHint}</p>
                </div>

                <div className="space-y-2">
                  {actionStateTags.length > 0 ? (
                    <section
                      data-signal-layer="action-state"
                      className="space-y-2 rounded-xl border border-slate-200 bg-slate-50/90 px-3 py-2.5"
                    >
                      <div className="text-xs font-medium text-muted-foreground">当前动作状态</div>
                      <SignalTagList
                        tags={actionStateTags}
                        resolveTopologyPreview={resolveTopologyPreview}
                      />
                    </section>
                  ) : null}

                  {judgmentBasisTags.length > 0 ? (
                    <section
                      data-signal-layer="judgment-basis"
                      className="space-y-2 rounded-xl border border-sky-200 bg-sky-50/80 px-3 py-2.5"
                    >
                      <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                        <span>子级综合判断依据</span>
                        <Tooltip>
                          <TooltipTrigger
                            asChild
                            aria-label="子级综合判断依据说明"
                            className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-muted-foreground"
                          >
                            <span>
                              <Info className="h-3.5 w-3.5 cursor-help text-muted-foreground" />
                            </span>
                          </TooltipTrigger>
                          <TooltipContent side="top" className="max-w-sm text-sm leading-6">
                            <div className="space-y-1">
                              <div className="font-medium">子级综合判断依据说明</div>
                              <p>
                                这组标签默认取子级主执行层标签，用来解释为什么当前这张组合卡会给出现在的综合判断。
                              </p>
                              <p>
                                当前这张卡默认取 {combination.triggerLevelLabel}
                                这一层作为主执行层；父级信息会收敛在“父级约束”里。
                              </p>
                            </div>
                          </TooltipContent>
                        </Tooltip>
                      </div>
                      <SignalTagList
                        tags={judgmentBasisTags}
                        resolveTopologyPreview={resolveTopologyPreview}
                      />
                    </section>
                  ) : null}

                </div>

                <div className="grid gap-2 text-xs text-muted-foreground">
                  <div data-signal-layer="parent-constraint" className="rounded-lg border bg-background/70 p-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="space-y-1">
                        <div className="font-medium text-foreground">
                          {combination.parentConstraint.label}
                        </div>
                        <div>{combination.parentConstraint.value}</div>
                      </div>
                      <Tooltip>
                        <TooltipTrigger
                          asChild
                          aria-label={combination.parentConstraint.hoverTitle}
                          className="mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-muted-foreground"
                        >
                          <span>
                            <Info className="h-3.5 w-3.5 cursor-help text-muted-foreground" />
                          </span>
                        </TooltipTrigger>
                        <TooltipContent
                          side="top"
                          className={parentConstraintTooltipContentOptions.className}
                          disableTextBalance={
                            parentConstraintTooltipContentOptions.disableTextBalance
                          }
                        >
                          <div className="space-y-1">
                            <div className="font-medium">{combination.parentConstraint.hoverTitle}</div>
                            {combination.parentConstraint.hoverItems.map((item) => (
                              <p key={`${combination.key}-parent-constraint-${item.label}`}>
                                {item.label}：{item.value}
                              </p>
                            ))}
                            <TradingCycleTopologyPreviewCard
                              preview={parentConstraintPreview}
                              source={combination.parentConstraint.topologyPreviewSource ?? null}
                            />
                          </div>
                        </TooltipContent>
                      </Tooltip>
                    </div>
                    {parentConstraintTags.length > 0 ? (
                      <div className="mt-2">
                        <SignalTagList
                          tags={parentConstraintTags}
                          resolveTopologyPreview={resolveTopologyPreview}
                        />
                      </div>
                    ) : null}
                  </div>
                  <ExplainableFact
                    fact={combination.triggerLevel}
                    resolveTopologyPreview={resolveTopologyPreview}
                  />
                  <ExplainableFact
                    fact={combination.suitableAction}
                    resolveTopologyPreview={resolveTopologyPreview}
                  />
                  <ExplainableFact
                    fact={combination.majorRisk}
                    resolveTopologyPreview={resolveTopologyPreview}
                  />
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </section>
  );
}
