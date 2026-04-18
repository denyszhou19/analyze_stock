import { Badge } from '@/components/ui/badge';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import type { AnalysisPageStatusBarViewModel } from '@/lib/trinity-analysis-page-view-model';
import { cn } from '@/lib/utils';

export type AnalysisStatusBarProps = AnalysisPageStatusBarViewModel;

const aiStatusToneClassName: Record<AnalysisPageStatusBarViewModel['aiStatus']['tone'], string> = {
  muted: 'border-muted-foreground/20 bg-muted text-muted-foreground',
  loading: 'border-amber-500/25 bg-amber-50 text-amber-700',
  success: 'border-emerald-500/25 bg-emerald-50 text-emerald-700',
  danger: 'border-destructive/25 bg-destructive/10 text-destructive',
};

export function AnalysisStatusBar({
  stockLabel,
  analysisTimeLabel,
  integrityStatus,
  aiStatus,
  dataRanges,
}: AnalysisStatusBarProps) {
  return (
    <Card className="border-border/70 bg-card/95 shadow-sm">
      <CardHeader className="gap-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-1">
            <CardTitle className="text-base">分析状态</CardTitle>
            <CardDescription>数据同步与 AI 综合判断生成状态</CardDescription>
          </div>
          <div className="flex flex-wrap gap-2">
            <Badge variant="outline" className="bg-background">
              数据同步：{integrityStatus.label}
            </Badge>
            <Badge
              variant="outline"
              className={cn('border px-2.5', aiStatusToneClassName[aiStatus.tone])}
            >
              AI 综合判断：{aiStatus.label}
            </Badge>
          </div>
        </div>
        <div className="space-y-1 text-sm text-muted-foreground">
          <p>标的：{stockLabel}</p>
          <p>分析时间：{analysisTimeLabel}</p>
          {integrityStatus.detail ? <p>{integrityStatus.detail}</p> : null}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <Separator />
        <section className="space-y-3" aria-label="本次判定使用的数据范围">
          <h3 className="text-sm font-medium">本次判定使用的数据范围</h3>
          <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
            {dataRanges.map((range) => (
              <div
                key={`${range.level}-${range.label}`}
                className="rounded-lg border bg-background/70 p-3"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium">{range.label}</span>
                  <Badge variant="secondary">{range.countLabel}</Badge>
                </div>
                <p className="mt-2 text-sm text-muted-foreground">
                  {range.coverageLabel}
                </p>
              </div>
            ))}
          </div>
        </section>
      </CardContent>
    </Card>
  );
}
