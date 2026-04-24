import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ExplainableFact } from '@/components/stock/ExplainableFact';
import { SignalTagList } from '@/components/stock/SignalTagList';
import type { AnalysisPageTradingCombinationViewModel } from '@/lib/trinity-analysis-page-view-model';
import { getDirectionMeta } from '@/lib/trinity-display-vocabulary';
import { cn } from '@/lib/utils';

interface TradingCycleBusProps {
  combinations: AnalysisPageTradingCombinationViewModel[];
}

const SIGNAL_LAYERS = [
  {
    key: 'action-state',
    title: '当前动作状态',
    className: 'border-slate-200 bg-slate-50/90',
    categories: ['执行', '级别'],
  },
  {
    key: 'judgment-basis',
    title: '判断依据',
    className: 'border-sky-200 bg-sky-50/80',
    categories: ['时空', '结构', '均线', '量能'],
  },
  {
    key: 'secondary-risk',
    title: '补充风险/次级信息',
    className: 'border-amber-200 bg-amber-50/80',
    categories: ['背离', '突破/跌破'],
  },
] as const;

function groupSignalTags(tags: AnalysisPageTradingCombinationViewModel['signalTags']) {
  const layerMap = new Map<string, typeof SIGNAL_LAYERS[number]>();
  SIGNAL_LAYERS.forEach((layer) => {
    layer.categories.forEach((category) => {
      layerMap.set(category, layer);
    });
  });

  return SIGNAL_LAYERS.map((layer) => ({
    ...layer,
    tags: tags.filter((tag) => {
      const mappedLayer = layerMap.get(tag.category);
      return mappedLayer?.key === layer.key;
    }),
  })).filter((layer) => layer.tags.length > 0);
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
          const groupedSignalLayers = groupSignalTags(combination.signalTags);

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
                  {groupedSignalLayers.map((layer) => (
                    <section
                      key={`${combination.key}-${layer.key}`}
                      data-signal-layer={layer.key}
                      className={cn('space-y-2 rounded-xl border px-3 py-2.5', layer.className)}
                    >
                      <div className="text-xs font-medium text-muted-foreground">{layer.title}</div>
                      <SignalTagList tags={layer.tags} />
                    </section>
                  ))}
                </div>

                <div className="grid gap-2 text-xs text-muted-foreground">
                  <ExplainableFact fact={combination.parentConstraint} />
                  <ExplainableFact fact={combination.triggerLevel} />
                  <ExplainableFact fact={combination.suitableAction} />
                  <ExplainableFact fact={combination.majorRisk} />
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </section>
  );
}
