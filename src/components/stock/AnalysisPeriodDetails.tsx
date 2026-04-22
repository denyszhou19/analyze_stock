import { StructureExplainabilityPanel } from '@/components/stock/StructureExplainabilityPanel';
import { SignalTagList } from '@/components/stock/SignalTagList';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { buildExecutionSummary } from '@/lib/stock-execution-view-model';
import type { PeriodAnalysisData, StructureData } from '@/lib/stock-structure-types';
import { normalizeStructureDisplayText } from '@/lib/structure-explainability-view-model';
import {
  buildDecisionSignalTags,
  buildPeriodSignalTags,
  type TrinitySignalTag,
} from '@/lib/trinity-signal-tags';
import {
  directionFromBias,
  getDirectionMeta,
  getStructureTagMeta,
} from '@/lib/trinity-display-vocabulary';
import { cn } from '@/lib/utils';

export interface AnalysisPeriodSection {
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
  defaultLevelKey?: string | null;
}

const STRUCTURE_COLORS: Record<string, string> = {
  A五段式: 'bg-amber-100 text-amber-800 border border-amber-300',
  B双平台式: 'bg-purple-100 text-purple-800 border border-purple-300',
  C单平台式: 'bg-blue-100 text-blue-800 border border-blue-300',
  D三段式: 'bg-gray-100 text-gray-700 border border-gray-300',
  复杂结构: 'bg-rose-100 text-rose-800 border border-rose-300',
  山峰形态: 'bg-gradient-to-r from-red-100 to-green-100 text-gray-800 border border-gray-300',
  山谷形态: 'bg-gradient-to-r from-green-100 to-red-100 text-gray-800 border border-gray-300',
};

const PERIOD_LEVEL_LABELS: Record<string, string> = {
  weekly: '周线',
  daily: '日线',
  hour60: '60分钟',
  hour30: '30分钟',
  hour15: '15分钟',
};

function formatList(items?: Array<string | null | undefined> | null, fallback = '未提供') {
  const value = items?.filter(Boolean).join('、');
  return value || fallback;
}

function resolveSummary(section: AnalysisPeriodSection) {
  if (!section.period) {
    return '当前级别暂无周期数据。';
  }

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

  const evidence = [
    structure?.structure_type,
    interpretation?.focus_structure?.archetype_label,
    interpretation?.focus_structure?.display_reason,
    structure?.description,
    prediction?.prediction_alert,
  ]
    .filter(Boolean)
    .join('｜');

  return normalizeStructureDisplayText(evidence) || '当前周期暂无结构证据。';
}

function resolveSpacetimeStatus(section: AnalysisPeriodSection) {
  const interpretation = section.period?.structure?.interpretation;
  const macd = section.period?.macd;

  return (
    [
      interpretation?.spacetime_gate?.parent_status,
      macd?.status,
      interpretation?.spacetime_gate?.wait_reason,
      interpretation?.spacetime_gate?.required_confirmation,
      macd?.divergence_note,
    ]
      .filter(Boolean)
      .join('｜') || '当前周期暂无时空状态。'
  );
}

function resolveMovingAverageStatus(section: AnalysisPeriodSection) {
  const ma = section.period?.moving_averages;
  const physics = section.period?.ma_physics;
  const breakthrough = section.period?.breakthrough;

  return (
    [
      ma?.ma_status,
      physics?.support_pressure?.status,
      physics?.traction?.traction_force,
      breakthrough?.pattern_type,
      formatList(physics?.key_signals, ''),
    ]
      .filter(Boolean)
      .join('｜') || '当前周期暂无均线关系。'
  );
}

function resolvePeriodDecisionSource(section: AnalysisPeriodSection) {
  return section.period?.trinity_decision
    ? `来源：${section.label}三位一体判定`
    : '来源：结构解释链路回退';
}

type SignalTag = TrinitySignalTag;

function resolveJudgmentLabel(decision?: PeriodAnalysisData['trinity_decision']): string {
  if (!decision) {
    return '严格等待';
  }

  const canTrade = decision.conclusion?.can_trade === true;
  const positionPermission = decision.trade_qualification?.position_permission;
  const breakthroughState = decision.moving_average?.breakthrough_state;

  if (canTrade && (positionPermission === 'full_signal' || positionPermission === 'half_position')) {
    return '确认执行';
  }

  if (
    positionPermission === 'light_probe' ||
    positionPermission === 't_trade_only' ||
    breakthroughState === 'breakout_pending' ||
    breakthroughState === 'breakdown_pending'
  ) {
    return '候选可试';
  }

  return '严格等待';
}

function resolveRelationLabel(
  levelNesting?: PeriodAnalysisData['trinity_decision']['level_nesting']
): string {
  if (!levelNesting) {
    return '父级未明，子级先看确认';
  }

  if (levelNesting.resonance === 'aligned') {
    return '父级支持，子级顺父级';
  }

  if (
    levelNesting.resonance === 'child_countertrend' ||
    levelNesting.resonance === 'conflict'
  ) {
    return '父级强冲突，子级逆父级';
  }

  return '父级未明，子级先看确认';
}

function buildExecutionPreview(decision?: PeriodAnalysisData['trinity_decision']) {
  return {
    probeEntry: decision?.execution?.triggers[0] ?? '继续等待触发',
    confirmEntry: decision?.execution?.confirmation[0] ?? '等待进一步确认',
    invalidation: decision?.execution?.invalidation[0] ?? '若条件失效则取消',
  };
}

function buildStructureSummaryTag(section: AnalysisPeriodSection): SignalTag | null {
  const structureType =
    section.period?.trinity_decision?.structure.type ?? section.period?.structure?.structure_type ?? null;
  if (!structureType) {
    return null;
  }

  const structureMeta = getStructureTagMeta(structureType);
  return {
    key: 'structure',
    category: '结构',
    result: structureMeta.label,
    label: `结构｜${structureMeta.label}`,
    tone: 'neutral',
    hover: {
      title: `结构｜${structureMeta.label}`,
      items: [
        { label: '信号含义', value: structureMeta.explanation },
        { label: '交易含义', value: structureMeta.tradeMeaning },
      ],
    },
  };
}

function enrichStructureSignalTag(
  section: AnalysisPeriodSection,
  tag: SignalTag
): SignalTag {
  if (tag.key !== 'structure') {
    return tag;
  }

  const structureMeta = getStructureTagMeta(
    section.period?.trinity_decision?.structure.type ?? section.period?.structure?.structure_type ?? null
  );

  return {
    ...tag,
    hover: {
      title: tag.hover.title,
      items: [
        { label: '信号含义', value: structureMeta.explanation },
        { label: '交易含义', value: structureMeta.tradeMeaning },
        ...tag.hover.items.filter(
          (item) => item.label !== '信号含义' && item.label !== '交易含义'
        ),
      ],
    },
  };
}

function buildPeriodSummarySignalTags(section: AnalysisPeriodSection) {
  const periodTags = buildPeriodSignalTags(section.period);
  const decisionTags = buildDecisionSignalTags(section.period?.trinity_decision);
  const fallbackStructureTag = buildStructureSummaryTag(section);
  const tagByKey = new Map<string, SignalTag>();

  for (const tag of [...periodTags, ...decisionTags]) {
    if (!tagByKey.has(tag.key)) {
      tagByKey.set(tag.key, tag);
    }
  }

  if (fallbackStructureTag && !tagByKey.has(fallbackStructureTag.key)) {
    tagByKey.set(fallbackStructureTag.key, fallbackStructureTag);
  }

  return Array.from(tagByKey.values()).map((tag) => enrichStructureSignalTag(section, tag));
}

function resolveLevelLabel(level?: string | null) {
  return level ? PERIOD_LEVEL_LABELS[level] ?? level : '未知级别';
}

function resolvePeriodDirection(section: AnalysisPeriodSection) {
  return directionFromBias(section.period?.trinity_decision?.conclusion.bias ?? null);
}

function resolvePeriodTriggers(section: AnalysisPeriodSection) {
  const decision = section.period?.trinity_decision;
  if (decision?.execution.triggers?.length) {
    return decision.execution.triggers;
  }

  const executionTriggers = section.period?.structure?.execution?.trigger;
  if (executionTriggers?.length) {
    return executionTriggers;
  }

  return [
    section.period?.structure?.interpretation?.spacetime_gate?.required_confirmation ?? null,
  ].filter((item): item is string => Boolean(item));
}

function resolvePeriodRisks(section: AnalysisPeriodSection) {
  const decision = section.period?.trinity_decision;
  if (decision?.execution.risk_flags?.length) {
    return decision.execution.risk_flags;
  }

  const invalidation = section.period?.structure?.execution?.invalidation;
  if (invalidation?.length) {
    return invalidation;
  }

  return section.period?.structure?.execution?.risk_flags ?? [];
}

function resolvePeriodGuardrail(section: AnalysisPeriodSection) {
  return (
    section.period?.trinity_decision?.execution.position_sizing.reason ??
    section.period?.structure?.execution?.wait_reason ??
    '暂无明确风控约束'
  );
}

function resolveResonanceEvidence(section: AnalysisPeriodSection) {
  const nesting = section.period?.trinity_decision?.level_nesting;
  if (!nesting?.parent_level || !nesting.child_level) {
    return '级别共振：暂无父子级别共振数据。';
  }

  return [
    `共振对象：${resolveLevelLabel(nesting.parent_level)} → ${resolveLevelLabel(nesting.child_level)}`,
    `成立依据：${nesting.permission.reason}`,
    `仍需确认：${section.period?.trinity_decision?.conclusion.wait_reason ?? '等待触发级别确认'}`,
  ].join('｜');
}

function resolveBackgroundEvidence(section: AnalysisPeriodSection) {
  const nesting = section.period?.trinity_decision?.level_nesting;
  const gate = section.period?.structure?.interpretation?.spacetime_gate;
  const parentLabel = resolveLevelLabel(nesting?.parent_level);
  const currentLabel = resolveLevelLabel(nesting?.child_level ?? section.key);

  return [
    `上一级：${parentLabel}`,
    `当前级别：${currentLabel}`,
    `背景来源：${gate?.parent_status ?? '上一级时空状态 + 结构方向'}`,
    `交易含义：${gate?.wait_reason ?? nesting?.permission.reason ?? '等待当前级别确认'}`,
  ].join('｜');
}

function buildExplainabilityStructure(period?: PeriodAnalysisData | null) {
  const structure = period?.structure;
  if (!structure) {
    return null;
  }

  return {
    structure_type: structure.structure_type || '未识别结构',
    inflection_points: typeof structure.inflection_points === 'number' ? structure.inflection_points : 0,
    description: structure.description || '当前周期暂无结构说明。',
    interpretation: structure.interpretation,
    archetype: structure.archetype,
    structure_details: structure.structure_details as StructureData['structure_details'],
  };
}

function LabelList({
  fallback,
  items,
}: {
  fallback: string;
  items: Array<string | null | undefined>;
}) {
  const visibleItems = items.filter((item): item is string => Boolean(item));
  if (!visibleItems.length) {
    return <p className="text-sm text-muted-foreground">{fallback}</p>;
  }

  return (
    <div className="flex flex-wrap gap-2">
      {visibleItems.map((item) => (
        <Badge key={item} variant="secondary" className="whitespace-normal text-left">
          {item}
        </Badge>
      ))}
    </div>
  );
}

function PeriodDecisionCard({ section }: { section: AnalysisPeriodSection }) {
  const direction = resolvePeriodDirection(section);
  const directionMeta = getDirectionMeta(direction);
  const judgmentLabel = resolveJudgmentLabel(section.period?.trinity_decision);
  const relationLabel = resolveRelationLabel(section.period?.trinity_decision?.level_nesting);
  const signalTags = buildPeriodSummarySignalTags(section);
  const executionPreview = buildExecutionPreview(section.period?.trinity_decision);
  const hasSignalTags = signalTags.length > 0;

  return (
    <section className={cn('rounded-xl border p-4 shadow-none', directionMeta.cardClassName)}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <h3 className="text-sm font-semibold text-foreground">该级别综合判断</h3>
          <p className="text-xs text-muted-foreground">{resolvePeriodDecisionSource(section)}</p>
          <p className="text-sm leading-6 text-muted-foreground">{resolveSummary(section)}</p>
        </div>
      </div>

      <div className="mt-4 space-y-3 rounded-lg border bg-background/70 p-3">
        <div className="grid gap-3 lg:grid-cols-2">
          <div className="rounded-lg border bg-background p-3">
            <div className="text-xs font-medium text-muted-foreground">当前综合判断</div>
            <Badge variant="outline" className="mt-2">
              {judgmentLabel}
            </Badge>
          </div>
          <div className="rounded-lg border bg-background p-3">
            <div className="text-xs font-medium text-muted-foreground">父子关系</div>
            <p className="mt-2 text-sm leading-6 text-foreground">{relationLabel}</p>
          </div>
        </div>
        <div className="space-y-2">
          <div className="text-xs font-medium text-muted-foreground">全部混排标签</div>
          {hasSignalTags ? (
            <SignalTagList tags={signalTags} />
          ) : (
            <p className="text-sm text-muted-foreground">暂无可用标签。</p>
          )}
        </div>
        <div className="grid gap-3 lg:grid-cols-3">
          <div className="space-y-2 rounded-lg border bg-background p-3">
            <div className="text-xs font-medium text-muted-foreground">时空摘要</div>
            <p className="text-sm leading-6 text-foreground">{resolveSpacetimeStatus(section)}</p>
          </div>
          <div className="space-y-2 rounded-lg border bg-background p-3">
            <div className="text-xs font-medium text-muted-foreground">结构摘要</div>
            <p className="text-sm leading-6 text-foreground">{resolveStructureEvidence(section)}</p>
          </div>
          <div className="space-y-2 rounded-lg border bg-background p-3">
            <div className="text-xs font-medium text-muted-foreground">执行摘要</div>
            <div className="space-y-1 text-sm leading-6 text-foreground">
              <p>
                <span className="font-medium">先手点：</span>
                {executionPreview.probeEntry}
              </p>
              <p>
                <span className="font-medium">确认点：</span>
                {executionPreview.confirmEntry}
              </p>
              <p>
                <span className="font-medium">失效点：</span>
                {executionPreview.invalidation}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-4 grid gap-3 lg:grid-cols-3">
        <div className="space-y-2 rounded-lg border bg-background/70 p-3">
          <div className="text-xs font-medium text-muted-foreground">触发条件</div>
          <LabelList fallback="暂无明确触发条件" items={resolvePeriodTriggers(section)} />
        </div>
        <div className="space-y-2 rounded-lg border bg-background/70 p-3">
          <div className="text-xs font-medium text-muted-foreground">风险条件</div>
          <LabelList fallback="暂无明确风险条件" items={resolvePeriodRisks(section)} />
        </div>
        <div className="space-y-2 rounded-lg border bg-background/70 p-3">
          <div className="text-xs font-medium text-muted-foreground">风控约束</div>
          <p className="text-sm leading-6 text-foreground">{resolvePeriodGuardrail(section)}</p>
        </div>
      </div>
    </section>
  );
}

function PeriodRuleSummary({ section }: { section: AnalysisPeriodSection }) {
  return (
    <section className="space-y-3 rounded-xl border bg-background/70 p-4 shadow-none">
      <h3 className="text-sm font-semibold text-foreground">规则摘要</h3>
      <div className="grid gap-3 lg:grid-cols-2">
        <div className="rounded-lg border bg-background p-3">
          <div className="text-xs text-muted-foreground">结构</div>
          <p className="mt-1 text-sm leading-6 text-foreground">{resolveStructureEvidence(section)}</p>
        </div>
        <div className="rounded-lg border bg-background p-3">
          <div className="text-xs text-muted-foreground">时空</div>
          <p className="mt-1 text-sm leading-6 text-foreground">{resolveSpacetimeStatus(section)}</p>
        </div>
        <div className="rounded-lg border bg-background p-3">
          <div className="text-xs text-muted-foreground">均线 / 量能</div>
          <p className="mt-1 text-sm leading-6 text-foreground">{resolveMovingAverageStatus(section)}</p>
        </div>
        <div className="rounded-lg border bg-background p-3">
          <div className="text-xs text-muted-foreground">级别共振</div>
          <p className="mt-1 text-sm leading-6 text-foreground">{resolveResonanceEvidence(section)}</p>
        </div>
        <div className="rounded-lg border bg-background p-3 lg:col-span-2">
          <div className="text-xs text-muted-foreground">大背景</div>
          <p className="mt-1 text-sm leading-6 text-foreground">{resolveBackgroundEvidence(section)}</p>
        </div>
      </div>
    </section>
  );
}

export function AnalysisPeriodDetails({
  sections,
  defaultLevelKey,
}: AnalysisPeriodDetailsProps) {
  if (!sections.length) {
    return null;
  }

  const defaultValue =
    sections.find((section) => section.key === defaultLevelKey)?.key ??
    sections.find((section) => section.defaultOpen)?.key ??
    sections.find((section) => section.key === 'daily' || section.label === '日线')?.key ??
    sections[0]?.key;

  return (
    <section className="space-y-3" aria-label="周期详情">
      <div className="space-y-1">
        <h2 className="text-base font-semibold text-foreground">周期详情</h2>
        <p className="text-sm text-muted-foreground">
          按级别切换查看该级别自己的简明决策、规则摘要和证据。
        </p>
      </div>

      <Tabs defaultValue={defaultValue} className="space-y-4">
        <TabsList className="h-auto flex-wrap justify-start gap-2 rounded-xl bg-muted/50 p-1">
          {sections.map((section) => (
            <TabsTrigger key={section.key} value={section.key} className="rounded-lg px-3">
              {section.label}
            </TabsTrigger>
          ))}
        </TabsList>

        {sections.map((section) => {
          const explainabilityStructure = buildExplainabilityStructure(section.period);

          return (
            <TabsContent key={section.key} value={section.key} className="space-y-4">
              <PeriodDecisionCard section={section} />
              <PeriodRuleSummary section={section} />

              <section className="space-y-3 rounded-xl border bg-muted/20 p-4">
                <div className="space-y-1">
                  <h3 className="text-sm font-semibold text-foreground">证据区</h3>
                  <p className="text-xs text-muted-foreground">
                    {[section.rangeLabel, resolveSummary(section)].filter(Boolean).join(' · ')}
                  </p>
                </div>

                <div className="rounded-md border border-dashed bg-background/70 px-3 py-3 text-sm text-muted-foreground">
                  <div className="font-medium text-foreground">{resolveTopologyTitle(section)}</div>
                  <div className="mt-1 leading-6">{resolveStructureEvidence(section)}</div>
                </div>

                {explainabilityStructure ? (
                  <div className="space-y-2">
                    <div className="text-sm font-medium text-foreground">结构说明</div>
                    <StructureExplainabilityPanel
                      structure={explainabilityStructure}
                      executionSummary={buildExecutionSummary(section.period)}
                      structureColors={STRUCTURE_COLORS}
                    />
                  </div>
                ) : null}
              </section>
            </TabsContent>
          );
        })}
      </Tabs>
    </section>
  );
}
