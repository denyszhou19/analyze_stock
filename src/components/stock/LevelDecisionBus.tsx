import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { AnalysisPageBusDimension } from '@/lib/trinity-analysis-page-view-model';

interface LevelDecisionBusProps {
  dimensions: AnalysisPageBusDimension[];
}

export function LevelDecisionBus({ dimensions }: LevelDecisionBusProps) {
  if (!dimensions.length) {
    return null;
  }

  return (
    <section className="space-y-3" aria-label="级别决策总线">
      <div className="space-y-1">
        <h2 className="text-base font-semibold text-foreground">级别决策总线</h2>
        <p className="text-sm text-muted-foreground">按固定级别映射展示上级结论、执行摘要与补充说明。</p>
      </div>

      <div className="grid gap-3 xl:grid-cols-3">
        {dimensions.map((dimension) => (
          <Card key={dimension.title} className="gap-4 bg-muted/20 py-4 shadow-none">
            <CardHeader className="space-y-1 px-4">
              <CardTitle className="text-sm">{dimension.title}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 px-4 text-sm">
              <div className="rounded-lg border bg-background px-3 py-2 font-medium text-foreground">
                {dimension.primary}
              </div>
              <p className="leading-6 text-muted-foreground">{dimension.detail}</p>
            </CardContent>
          </Card>
        ))}
      </div>
    </section>
  );
}
