import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import type { PeriodAnalysisData } from '@/lib/stock-structure-types';

interface AnalysisPeriodSection {
  key: string;
  label: string;
  defaultOpen?: boolean;
  summary?: string | null;
  rangeLabel?: string | null;
  topologyTitle?: string | null;
  period?: PeriodAnalysisData | null;
}

interface AnalysisPeriodDetailsProps {
  sections: AnalysisPeriodSection[];
}

const ACTION_LABELS: Record<string, string> = {
  buy: '买入',
  add: '加仓',
  hold: '持有',
  wait: '等待',
  reduce: '减仓',
  sell: '卖出',
  t_trade: '做 T',
  avoid: '规避',
};

function formatList(items?: Array<string | null | undefined> | null, fallback = '未提供') {
  const value = items?.filter(Boolean).join('、');
  return value || fallback;
}

function formatActionLabel(action?: string | null) {
  if (!action) {
    return null;
  }

  return ACTION_LABELS[action] ?? action;
}

function resolveSummary(section: AnalysisPeriodSection) {
  return (
    section.summary ||
    section.period?.structure?.description ||
    section.period?.structure?.execution?.wait_reason ||
    section.period?.trinity_decision?.conclusion.wait_reason ||
    '当前周期暂无补充摘要。'
  );
}

function resolveTopologyTitle(section: AnalysisPeriodSection) {
  return section.topologyTitle || `${section.label}拓扑结构图`;
}

function resolveStructureEvidence(section: AnalysisPeriodSection) {
  const structure = section.period?.structure;
  const interpretation = structure?.interpretation;
  const prediction = structure?.structure_details?.prediction;

  return [
    structure?.structure_type,
    interpretation?.focus_structure?.archetype_label,
    interpretation?.focus_structure?.display_reason,
    structure?.description,
    prediction?.prediction_alert,
  ]
    .filter(Boolean)
    .join('｜') || '当前周期暂无结构证据。';
}

function resolveSpacetimeStatus(section: AnalysisPeriodSection) {
  const interpretation = section.period?.structure?.interpretation;
  const macd = section.period?.macd;

  return [
    interpretation?.spacetime_gate?.parent_status,
    macd?.status,
    interpretation?.spacetime_gate?.wait_reason,
    interpretation?.spacetime_gate?.required_confirmation,
    macd?.divergence_note,
  ]
    .filter(Boolean)
    .join('｜') || '当前周期暂无时空状态。';
}

function resolveMovingAverageStatus(section: AnalysisPeriodSection) {
  const ma = section.period?.moving_averages;
  const physics = section.period?.ma_physics;
  const breakthrough = section.period?.breakthrough;

  return [
    ma?.ma_status,
    physics?.support_pressure?.status,
    physics?.traction?.traction_force,
    breakthrough?.pattern_type,
    formatList(physics?.key_signals, ''),
  ]
    .filter(Boolean)
    .join('｜') || '当前周期暂无均线关系。';
}

function resolveTradeAction(section: AnalysisPeriodSection) {
  const structure = section.period?.structure;
  const execution = structure?.execution;
  const decision = section.period?.trinity_decision;

  return [
    structure?.execution_phase?.label,
    decision?.conclusion.action_label,
    !decision?.conclusion.action_label ? formatActionLabel(execution?.action) : null,
    execution?.wait_reason,
    execution?.rationale,
    formatList(execution?.trigger, ''),
  ]
    .filter(Boolean)
    .join('｜') || '当前周期暂无交易动作结论。';
}

export function AnalysisPeriodDetails({ sections }: AnalysisPeriodDetailsProps) {
  if (!sections.length) {
    return null;
  }

  const defaultValue =
    sections.find((section) => section.key === 'daily' || section.label === '日线')?.key ??
    sections.find((section) => section.defaultOpen)?.key ??
    sections[0]?.key;

  return (
    <section className="space-y-3" aria-label="周期详情">
      <div className="space-y-1">
        <h2 className="text-base font-semibold text-foreground">周期详情</h2>
        <p className="text-sm text-muted-foreground">用于承载周期摘要、结构证据与复盘排错信息。</p>
      </div>

      <Accordion type="single" defaultValue={defaultValue} className="rounded-xl border px-4">
        {sections.map((section) => (
          <AccordionItem key={section.key} value={section.key}>
            <AccordionTrigger className="gap-4 py-4 hover:no-underline">
              <div className="space-y-1 text-left">
                <div className="flex flex-wrap items-center gap-2 text-sm font-semibold text-foreground">
                  <span>{section.label}</span>
                  {section.key === defaultValue && (
                    <Badge variant="outline" className="text-[11px]">
                      默认展开
                    </Badge>
                  )}
                </div>
                <div className="text-xs text-muted-foreground">
                  {[section.rangeLabel, resolveSummary(section)].filter(Boolean).join(' · ')}
                </div>
              </div>
            </AccordionTrigger>
            <AccordionContent className="space-y-4 pb-5">
              <Card className="gap-3 bg-muted/20 py-4 shadow-none">
                <CardContent className="space-y-4 px-4 text-sm">
                  <div className="space-y-1">
                    <div className="font-medium text-foreground">周期摘要</div>
                    <p className="leading-6 text-muted-foreground">{resolveSummary(section)}</p>
                  </div>

                  <div className="space-y-2 rounded-lg border bg-background p-3">
                    <div className="font-medium text-foreground">结构证据</div>
                    <div className="rounded-md border border-dashed bg-muted/30 px-3 py-3 text-sm text-muted-foreground">
                      <div className="font-medium text-foreground">{resolveTopologyTitle(section)}</div>
                      <div className="mt-1">{resolveStructureEvidence(section)}</div>
                    </div>
                  </div>

                  <div className="grid gap-3 lg:grid-cols-3">
                    <div className="rounded-lg border bg-background p-3">
                      <div className="font-medium text-foreground">时空状态</div>
                      <div className="mt-2 leading-6 text-muted-foreground">
                        {resolveSpacetimeStatus(section)}
                      </div>
                    </div>
                    <div className="rounded-lg border bg-background p-3">
                      <div className="font-medium text-foreground">均线关系</div>
                      <div className="mt-2 leading-6 text-muted-foreground">
                        {resolveMovingAverageStatus(section)}
                      </div>
                    </div>
                    <div className="rounded-lg border bg-background p-3">
                      <div className="font-medium text-foreground">交易动作</div>
                      <div className="mt-2 leading-6 text-muted-foreground">
                        {resolveTradeAction(section)}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    </section>
  );
}
