import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { TrinityDecision } from '@/lib/stock-structure-types';
import { buildTrinityDecisionViewModel } from '@/lib/trinity-decision-view-model';

export function TrinityDecisionPanel({ decision }: { decision?: TrinityDecision | null }) {
  if (!decision) {
    return null;
  }

  const vm = buildTrinityDecisionViewModel(decision);

  return (
    <Card className="gap-3 bg-muted/30 py-4 shadow-none">
      <CardHeader className="px-4">
        <CardTitle className="text-sm">{vm.title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 px-4 text-sm">
        <div className="flex flex-wrap gap-2">
          <Badge>{vm.levelLabel}</Badge>
          <Badge variant="secondary">{vm.actionLabel}</Badge>
          <Badge variant="outline">{decision.structure.type}</Badge>
        </div>

        <div className="grid gap-2 md:grid-cols-2">
          <div>结构：{vm.structureLabel}</div>
          <div>时空：{vm.spacetimeLabel}</div>
          <div>均线：{vm.maLabel}</div>
          <div>量能：{vm.volumeLabel}</div>
          <div>级别权限：{vm.gateReason ?? '未提供'}</div>
          <div>宏观原点：{vm.backgroundOriginLabel ?? '未提供'}</div>
          <div>聚焦起点：{vm.focusOriginLabel ?? '未提供'}</div>
          <div>执行起点：{vm.executionOriginLabel ?? '未提供'}</div>
          <div>等待原因：{vm.waitReason ?? '无'}</div>
        </div>

        {(vm.triggerLabels.length > 0 || vm.invalidationLabels.length > 0) && (
          <div className="grid gap-2 border-t pt-3 md:grid-cols-2">
            {vm.triggerLabels.length > 0 && (
              <div className="space-y-1">
                <div className="text-xs font-medium text-muted-foreground">触发条件</div>
                {vm.triggerLabels.map((label) => (
                  <div key={label} className="rounded-md bg-background px-2 py-1 text-xs">
                    {label}
                  </div>
                ))}
              </div>
            )}
            {vm.invalidationLabels.length > 0 && (
              <div className="space-y-1">
                <div className="text-xs font-medium text-muted-foreground">失效条件</div>
                {vm.invalidationLabels.map((label) => (
                  <div key={label} className="rounded-md bg-background px-2 py-1 text-xs">
                    {label}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
