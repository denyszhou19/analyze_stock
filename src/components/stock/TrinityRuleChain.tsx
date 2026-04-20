import { Info } from 'lucide-react';
import { SignalTagList } from '@/components/stock/SignalTagList';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { getDirectionMeta } from '@/lib/trinity-display-vocabulary';
import { cn } from '@/lib/utils';
import type { AnalysisPageRuleChainItem } from '@/lib/trinity-analysis-page-view-model';

interface TrinityRuleChainProps {
  sourceLabel?: string;
  items: AnalysisPageRuleChainItem[];
}

const RULE_HINTS: Record<string, { title: string; body: string[] }> = {
  结构资格: {
    title: '结构资格释义',
    body: [
      '标准结构：标准 A / B / C / D，可按标准节点或边界解释。',
      '延伸可观察：结构还可跟踪，但标准编号停止，先看起点、当前段和边界。',
      '超限降级 / 未完成 / 不合格：说明结构解释力不足，需要等待更多确认。',
    ],
  },
  'MACD 时空': {
    title: 'MACD 时空释义',
    body: [
      '用于判断当前级别的时空状态是否与预期结构匹配。',
      '若时空与结构不匹配，通常先等待当前执行段完成，再决定是否交易。',
    ],
  },
  '55 / 233 线关系': {
    title: '55 / 233 线关系释义',
    body: [
      '关注 MA55 / MA233 的支撑、压制、突破、跌破与回踩确认。',
      '均线关系不顺时，动作会被降级为等待或轻仓试探。',
    ],
  },
  量能确认: {
    title: '量能确认释义',
    body: [
      '缩量、放量、过热和回踩量能会影响突破 / 跌破是否有效。',
      '量能不足时，通常只保留观察，不直接升级动作。',
    ],
  },
  级别权限: {
    title: '级别权限释义',
    body: [
      '看父级与当前级别是否共振一致。',
      '若出现子级逆势、级别冲突或父级不明，会限制加仓、做 T 或开仓权限。',
    ],
  },
  执行计划: {
    title: '执行计划释义',
    body: [
      '节点执行：标准买卖点清晰，可按节点触发。',
      '边界执行：围绕平台边界等待突破或跌破。',
      '回抽确认执行：突破 / 跌破后等待回抽确认再动。',
      '趋势持有：趋势延续阶段，以持有和跟踪为主。',
      'T 交易：仅做差价，不扩大方向性仓位。',
      '等待触发：已有预案，但触发条件尚未满足。',
    ],
  },
};

export function TrinityRuleChain({ sourceLabel, items }: TrinityRuleChainProps) {
  if (!items.length) {
    return null;
  }

  const description = sourceLabel
    ? `${sourceLabel}${sourceLabel.endsWith('。') ? '' : '。'}每张卡展示方向、可执行度、判定依据和当前原因。`
    : '每张卡展示方向、可执行度、判定依据和当前原因。';

  return (
    <section className="space-y-3" aria-label="三位一体规则链">
      <div className="space-y-1">
        <h2 className="text-base font-semibold text-foreground">三位一体规则链</h2>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {items.map((item) => {
          const directionMeta = getDirectionMeta(item.direction);

          return (
            <Card
              key={`${item.title}-${item.status}`}
              className={cn('gap-3 py-4 shadow-none', directionMeta.cardClassName)}
            >
              <CardHeader className="flex flex-row items-start justify-between gap-3 px-4">
                <div className="flex items-center gap-1.5">
                  <CardTitle className="text-sm leading-6">{item.title}</CardTitle>
                  {RULE_HINTS[item.title] ? (
                    <Tooltip>
                      <TooltipTrigger
                        asChild
                        aria-label={`${item.title}释义`}
                        className="inline-flex h-5 w-5 items-center justify-center rounded-full text-muted-foreground"
                      >
                        <span>
                          <Info className="h-3.5 w-3.5 cursor-help text-muted-foreground" />
                        </span>
                      </TooltipTrigger>
                      <TooltipContent side="top" className="max-w-sm text-sm leading-6">
                        <div className="space-y-1">
                          <div className="font-medium">{RULE_HINTS[item.title].title}</div>
                          {RULE_HINTS[item.title].body.map((line) => (
                            <p key={`${item.title}-${line}`}>{line}</p>
                          ))}
                        </div>
                      </TooltipContent>
                    </Tooltip>
                  ) : null}
                </div>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Badge
                      variant="outline"
                      className={cn('cursor-help', directionMeta.badgeClassName)}
                    >
                      <span className="mr-1">{item.displayStatusIcon}</span>
                      {item.displayStatusLabel}
                    </Badge>
                  </TooltipTrigger>
                  <TooltipContent side="top" className="max-w-sm text-sm leading-6">
                    <div className="space-y-1">
                      <div className="font-medium">{item.detailHover.title}</div>
                      <p>状态标签：{item.displayStatusLabel}</p>
                      <p>交易含义：{item.statusExplanation.tradeMeaning}</p>
                      <p>规则状态：{item.statusExplanation.ruleState}</p>
                      <p>当前方向：{item.statusExplanation.directionLabel}</p>
                      {item.detailHover.items.map((detailItem) => (
                        <p key={`${item.title}-${detailItem.label}`}>
                          {detailItem.label}：{detailItem.value}
                        </p>
                      ))}
                    </div>
                  </TooltipContent>
                </Tooltip>
              </CardHeader>
              <CardContent className="space-y-2 px-4 text-sm leading-6 text-muted-foreground">
                <p className="text-foreground">{item.summary}</p>
                <p>{item.recommendation}</p>
                <SignalTagList tags={item.signalTags} />
                <p className="text-xs text-foreground/75">
                  判定依据：{item.statusExplanation.reason}
                </p>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </section>
  );
}
