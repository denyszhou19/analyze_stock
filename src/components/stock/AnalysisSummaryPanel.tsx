import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';

import type { AnalysisPageSummaryViewModel } from '@/lib/trinity-analysis-page-view-model';

export interface AnalysisSummaryPanelProps {
  viewModel: AnalysisPageSummaryViewModel;
  onGenerate: () => void;
  canGenerate: boolean;
}

function renderLabels(title: string, labels: string[]) {
  return (
    <section className="space-y-2">
      <h3 className="text-sm font-medium text-muted-foreground">{title}</h3>
      {labels.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {labels.map((label) => (
            <Badge key={label} variant="secondary" className="whitespace-normal">
              {label}
            </Badge>
          ))}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">暂无明确条件</p>
      )}
    </section>
  );
}

function HardGates({
  hardGates,
}: {
  hardGates: AnalysisPageSummaryViewModel['hardGates'];
}) {
  return (
    <section className="space-y-3">
      <h3 className="text-sm font-medium">后端硬门控</h3>
      <div className="grid gap-2 md:grid-cols-2">
        {hardGates.map((gate) => (
          <div
            key={`${gate.label}-${gate.value}`}
            className="rounded-lg border bg-background/70 p-3"
          >
            <div className="text-xs text-muted-foreground">{gate.label}</div>
            <div className="mt-1 text-sm font-medium">{gate.value}</div>
          </div>
        ))}
      </div>
    </section>
  );
}

export function AnalysisSummaryPanel({
  viewModel,
  onGenerate,
  canGenerate,
}: AnalysisSummaryPanelProps) {
  const isLoading = viewModel.mode === 'loading';
  const isIdle = viewModel.mode === 'idle';
  const isReady = viewModel.mode === 'ready';
  const isError = viewModel.mode === 'error';
  const title = isIdle ? 'AI 综合判断尚未生成' : 'AI 综合判断';
  const actionLabel = isLoading ? 'AI 综合判断生成中' : isError ? '重试生成 AI 综合判断' : '生成 AI 综合判断';

  return (
    <Card className="border-border/70 bg-card/95 shadow-sm">
      <CardHeader className="gap-3">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-1">
            <CardTitle className="text-lg">{title}</CardTitle>
            <CardDescription>
              先看综合结论，再核对触发条件、风险条件与后端硬门控。
            </CardDescription>
          </div>
          <CardAction>
            <Button
              type="button"
              variant={isReady ? 'outline' : 'default'}
              onClick={onGenerate}
              disabled={!canGenerate || isLoading}
            >
              {actionLabel}
            </Button>
          </CardAction>
        </div>
        {isLoading ? (
          <p className="rounded-lg border border-amber-500/25 bg-amber-50 px-3 py-2 text-sm text-amber-700">
            AI 正在生成综合判断，请稍候。
          </p>
        ) : null}
        {isError ? (
          <p className="rounded-lg border border-destructive/25 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            AI 综合判断生成失败，当前展示后端确定性结论。
          </p>
        ) : null}
      </CardHeader>
      <CardContent className="space-y-5">
        <section className="rounded-xl border bg-background/70 p-4">
          <div className="text-xs text-muted-foreground">
            {isReady ? 'AI 结论' : '后端当前结论'}
          </div>
          <h2 className="mt-2 text-xl font-semibold leading-snug">
            {viewModel.headline}
          </h2>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Badge variant="outline">后端最终动作：{viewModel.primaryActionLabel}</Badge>
            <span className="text-sm text-muted-foreground">
              {viewModel.primaryReason}
            </span>
          </div>
        </section>

        <div className="grid gap-4 lg:grid-cols-2">
          {renderLabels('触发条件', viewModel.triggerLabels)}
          {renderLabels('风险条件', viewModel.riskLabels)}
        </div>

        <section className="space-y-2">
          <h3 className="text-sm font-medium text-muted-foreground">风控约束</h3>
          <p className="rounded-lg border bg-background/70 p-3 text-sm">
            {viewModel.guardrail}
          </p>
        </section>

        <Separator />
        <HardGates hardGates={viewModel.hardGates} />
      </CardContent>
    </Card>
  );
}
