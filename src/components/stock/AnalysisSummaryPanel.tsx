import { Info } from 'lucide-react';

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
import { SignalTagList } from '@/components/stock/SignalTagList';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

import type {
  AnalysisPageGlobalStrategyViewModel,
  AnalysisPageSummaryViewModel,
} from '@/lib/trinity-analysis-page-view-model';
import { getDirectionMeta } from '@/lib/trinity-display-vocabulary';

export interface AnalysisSummaryPanelProps {
  viewModel: AnalysisPageSummaryViewModel;
  globalStrategy: AnalysisPageGlobalStrategyViewModel;
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
  title,
  sourceLabel,
  hardGates,
}: {
  title: string;
  sourceLabel: string;
  hardGates: AnalysisPageSummaryViewModel['hardGates'];
}) {
  return (
    <section className="space-y-3">
      <div className="space-y-1">
        <h3 className="text-sm font-medium">{title}</h3>
        <p className="text-xs leading-5 text-muted-foreground">{sourceLabel}</p>
      </div>
      <div className="grid gap-2 md:grid-cols-2">
        {hardGates.map((gate) => (
          <TooltipProvider key={`${gate.label}-${gate.value}`}>
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="cursor-help rounded-lg border bg-background/70 p-3">
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <span>{gate.label}</span>
                    <Info className="h-3.5 w-3.5" />
                  </div>
                  <div className="mt-1 text-sm font-medium">{gate.value}</div>
                </div>
              </TooltipTrigger>
              <TooltipContent side="top" className="max-w-sm text-sm leading-6">
                <div className="space-y-1">
                  <div className="font-medium">{gate.description.title}</div>
                  <p>{gate.description.meaning}</p>
                  <p>{gate.description.tradeImpact}</p>
                  <p className="text-xs text-muted-foreground">
                    数据来源：{gate.description.source}
                  </p>
                </div>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        ))}
      </div>
    </section>
  );
}

function ScopeBlock({
  globalStrategy,
}: {
  globalStrategy: AnalysisPageGlobalStrategyViewModel;
}) {
  const directionMeta = getDirectionMeta(globalStrategy.direction);

  return (
    <section className={`rounded-xl border p-4 ${directionMeta.cardClassName}`}>
      <div className="text-xs font-medium text-muted-foreground">页面级综合结论</div>
      <div className="mt-2 flex flex-wrap gap-2">
        <Badge variant="outline" className={directionMeta.badgeClassName}>
          方向：{globalStrategy.directionLabel}
        </Badge>
        <Badge variant="outline">状态：{globalStrategy.actionLabel}</Badge>
        <Badge variant="outline">
          当前优先组合：{globalStrategy.primaryCombinationLabel}
        </Badge>
        <Badge variant="outline">
          主约束级别：{globalStrategy.primaryConstraintLevelLabel}
        </Badge>
        <Badge variant="outline">触发级别：{globalStrategy.triggerLevelLabel}</Badge>
      </div>
      <p className="mt-3 text-sm leading-6 text-muted-foreground">
        {globalStrategy.scopeLabel}
      </p>
    </section>
  );
}

export function AnalysisSummaryPanel({
  viewModel,
  globalStrategy,
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
              先看页面级综合结论，再核对触发条件、风险条件与主策略硬门控。
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
          <div className="space-y-2 rounded-lg border border-destructive/25 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            <p>AI 综合判断生成失败，当前展示后端确定性结论。</p>
            {viewModel.errorMessage ? (
              <p className="break-words text-xs leading-6 text-destructive/90">
                真实错误：{viewModel.errorMessage}
              </p>
            ) : null}
          </div>
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
            <Badge variant="secondary">{viewModel.judgmentLabel}</Badge>
            <Badge variant="outline">{viewModel.relationLabel}</Badge>
            <Badge variant="outline">后端最终动作：{viewModel.primaryActionLabel}</Badge>
            <span className="text-sm text-muted-foreground">
              {viewModel.primaryReason}
            </span>
          </div>
          <div className="mt-4 grid gap-3 text-sm leading-6">
            <div className="space-y-1">
              <div className="text-xs text-muted-foreground">时空怎么看</div>
              <p className="text-muted-foreground">{viewModel.spacetimeSummary}</p>
            </div>
            <div className="space-y-1">
              <div className="text-xs text-muted-foreground">结构怎么看</div>
              <p className="text-muted-foreground">{viewModel.structureSummary}</p>
            </div>
            <div className="space-y-1">
              <div className="text-xs text-muted-foreground">现在怎么做</div>
              <p className="text-muted-foreground">{viewModel.executionSummary}</p>
            </div>
          </div>
          {viewModel.signalTags.length ? (
            <div className="mt-4 space-y-2">
              <div className="text-xs text-muted-foreground">关键信号标签</div>
              <SignalTagList tags={viewModel.signalTags} />
            </div>
          ) : null}
        </section>

        <ScopeBlock globalStrategy={globalStrategy} />

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
        <HardGates
          title={viewModel.hardGateTitle}
          sourceLabel={viewModel.hardGateSourceLabel}
          hardGates={viewModel.hardGates}
        />
      </CardContent>
    </Card>
  );
}
