import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type {
  AnalysisPageExplainableField,
  AnalysisPageTradingCombinationViewModel,
} from '@/lib/trinity-analysis-page-view-model';
import { getDirectionMeta } from '@/lib/trinity-display-vocabulary';
import { cn } from '@/lib/utils';

interface TradingCycleBusProps {
  combinations: AnalysisPageTradingCombinationViewModel[];
}

function renderExplainableField(field: AnalysisPageExplainableField) {
  return (
    <span title={field.hoverTitle}>
      {field.value}
    </span>
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
                <p className="leading-6 text-muted-foreground">{combination.explanation}</p>

                <div className="grid gap-2 text-xs text-muted-foreground">
                  <div className="rounded-lg border bg-background/70 p-2">
                    <span className="font-medium text-foreground">父级约束：</span>
                    {renderExplainableField(combination.parentConstraint)}
                  </div>
                  <div className="rounded-lg border bg-background/70 p-2">
                    <span className="font-medium text-foreground">触发级别：</span>
                    {renderExplainableField(combination.triggerLevel)}
                  </div>
                  <div className="rounded-lg border bg-background/70 p-2">
                    <span className="font-medium text-foreground">适合动作：</span>
                    {renderExplainableField(combination.suitableAction)}
                  </div>
                  <div className="rounded-lg border bg-background/70 p-2">
                    <span className="font-medium text-foreground">主要风险：</span>
                    {renderExplainableField(combination.majorRisk)}
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </section>
  );
}
