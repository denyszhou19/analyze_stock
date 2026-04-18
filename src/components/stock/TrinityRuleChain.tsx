import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';

type RuleStatus = 'passed' | 'failed' | 'warning' | 'info';

interface RuleChainItem {
  title: string;
  status: RuleStatus;
  detail: string;
}

interface TrinityRuleChainProps {
  items: RuleChainItem[];
}

const STATUS_META: Record<
  RuleStatus,
  {
    label: string;
    badgeClassName: string;
    cardClassName: string;
  }
> = {
  passed: {
    label: '通过',
    badgeClassName: 'border-emerald-200 bg-emerald-50 text-emerald-700',
    cardClassName: 'border-emerald-200/70 bg-emerald-50/40',
  },
  failed: {
    label: '失败',
    badgeClassName: 'border-red-200 bg-red-50 text-red-700',
    cardClassName: 'border-red-200/80 bg-red-50/50',
  },
  warning: {
    label: '警示',
    badgeClassName: 'border-amber-200 bg-amber-50 text-amber-800',
    cardClassName: 'border-amber-200/80 bg-amber-50/50',
  },
  info: {
    label: '提示',
    badgeClassName: 'border-sky-200 bg-sky-50 text-sky-700',
    cardClassName: 'border-sky-200/80 bg-sky-50/50',
  },
};

export function TrinityRuleChain({ items }: TrinityRuleChainProps) {
  if (!items.length) {
    return null;
  }

  return (
    <section className="space-y-3" aria-label="三位一体规则链">
      <div className="space-y-1">
        <h2 className="text-base font-semibold text-foreground">三位一体规则链</h2>
        <p className="text-sm text-muted-foreground">六段规则逐项展示当前状态，失败与警示会被明确保留。</p>
      </div>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {items.map((item) => {
          const meta = STATUS_META[item.status];

          return (
            <Card
              key={`${item.title}-${item.status}`}
              className={cn('gap-3 py-4 shadow-none', meta.cardClassName)}
            >
              <CardHeader className="flex flex-row items-start justify-between gap-3 px-4">
                <CardTitle className="text-sm leading-6">{item.title}</CardTitle>
                <Badge variant="outline" className={meta.badgeClassName}>
                  {meta.label}
                </Badge>
              </CardHeader>
              <CardContent className="px-4 text-sm leading-6 text-muted-foreground">
                {item.detail}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </section>
  );
}
