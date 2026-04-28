import { StructureExplainabilityPanel } from '@/components/stock/StructureExplainabilityPanel';
import { SignalTagList } from '@/components/stock/SignalTagList';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { buildExecutionSummary } from '@/lib/stock-execution-view-model';
import type { PeriodAnalysisData, StructureData, TrinityDecision } from '@/lib/stock-structure-types';
import { normalizeStructureDisplayText } from '@/lib/structure-explainability-view-model';
import { resolveJudgmentLabel } from '@/lib/trinity-judgment-display';
import { buildPeriodSummarySignalTags, type TrinitySignalTag } from '@/lib/trinity-signal-tags';
import {
  directionFromBias,
  getDirectionMeta,
  getStructureTagMeta,
  normalizeTradingDisplayText,
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

const LEVEL_LABELS: Record<TrinityDecision['level'], string> = {
  weekly: '周线',
  daily: '日线',
  hour60: '60分钟',
  hour30: '30分钟',
  hour15: '15分钟',
};

function resolveLevelLabel(level?: string | null) {
  if (!level) {
    return null;
  }

  return LEVEL_LABELS[level as TrinityDecision['level']] ?? level;
}

function resolveTopologyTitle(section: AnalysisPeriodSection) {
  return section.topologyTitle || `${section.label}拓扑结构图`;
}

function resolveStructureEvidence(section: AnalysisPeriodSection) {
  const candidateStructure = section.period?.trinity_decision?.candidate_structure;
  if (candidateStructure?.candidate_label) {
    return (
      normalizeStructureDisplayText(
        [
          normalizeTradingDisplayText(candidateStructure.current_leg),
          normalizeTradingDisplayText(candidateStructure.reason),
          normalizeTradingDisplayText(candidateStructure.upgrade_condition),
        ]
          .filter(Boolean)
          .join('｜')
      ) || '当前周期暂无结构证据。'
    );
  }

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

function resolveEvidenceCaption(section: AnalysisPeriodSection) {
  return normalizeTradingDisplayText(section.rangeLabel) || '核对该级别结构拓扑和说明依据。';
}

function resolvePeriodDecisionSource(section: AnalysisPeriodSection) {
  return section.period?.trinity_decision
    ? `来源：${section.label}三位一体判定`
    : '来源：结构解释链路回退';
}

function resolveScopedRelationLabel(section: AnalysisPeriodSection) {
  const decision = section.period?.trinity_decision;
  if (!decision?.level_nesting) {
    return `父级未明：${section.label}先看确认`;
  }

  const childLabel = section.label;
  const parentLabel = resolveLevelLabel(decision.level_nesting.parent_level) ?? '父级';
  const resonance = decision.level_nesting.resonance;

  if (resonance === 'aligned') {
    return `${parentLabel}支持：${childLabel}可顺势跟踪`;
  }

  if (resonance === 'boundary_probe') {
    return `${parentLabel}约束：${childLabel}只允许边界试探`;
  }

  if (resonance === 'structure_mismatch') {
    return `${parentLabel}约束：${childLabel}结构先重配`;
  }

  if (resonance === 'blocked') {
    return `${parentLabel}未放行：${childLabel}当前先等待`;
  }

  if (resonance === 'child_countertrend' || resonance === 'conflict') {
    return `${parentLabel}强冲突：${childLabel}当前逆父级`;
  }

  return `${parentLabel}未明：${childLabel}先看确认`;
}

type SignalTag = TrinitySignalTag;

function enrichStructureSignalTag(
  section: AnalysisPeriodSection,
  tag: SignalTag
): SignalTag {
  if (tag.key !== 'structure') {
    return tag;
  }

  const structureMeta = getStructureTagMeta(
    section.period?.trinity_decision?.structure.standard_candidate ??
      section.period?.trinity_decision?.structure.type ??
      section.period?.structure?.structure_type ??
      null
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

function resolvePeriodDirection(section: AnalysisPeriodSection) {
  return directionFromBias(section.period?.trinity_decision?.conclusion.bias ?? null);
}

function buildExplainabilityStructure(period?: PeriodAnalysisData | null) {
  const structure = period?.structure;
  const hasExplainabilityPayload = Boolean(
    structure?.interpretation ||
      structure?.archetype ||
      structure?.structure_details?.explainability ||
      structure?.structure_details?.prediction ||
      structure?.structure_details?.peak_analysis ||
      structure?.structure_details?.left_structure_warning ||
      structure?.structure_details?.judgment_criteria
  );

  if (!structure || !hasExplainabilityPayload) {
    return null;
  }

  return {
    structure_type: structure.structure_type || '未识别结构',
    trend_direction: structure.trend_direction || '震荡',
    inflection_points: typeof structure.inflection_points === 'number' ? structure.inflection_points : 0,
    description: structure.description || '当前周期暂无结构说明。',
    interpretation: structure.interpretation,
    archetype: structure.archetype,
    structure_details: structure.structure_details as StructureData['structure_details'],
  };
}

function PeriodDecisionCard({ section }: { section: AnalysisPeriodSection }) {
  const direction = resolvePeriodDirection(section);
  const directionMeta = getDirectionMeta(direction);
  const decision = section.period?.trinity_decision ?? undefined;
  const judgmentLabel = resolveJudgmentLabel(decision);
  const relationLabel = resolveScopedRelationLabel(section);
  const structureTags = buildPeriodSummarySignalTags(section.period)
    .filter((tag) => tag.key === 'structure')
    .map((tag) => enrichStructureSignalTag(section, tag));

  return (
    <section className={cn('rounded-xl border p-4 shadow-none', directionMeta.cardClassName)}>
      <div className="space-y-1">
        <h3 className="text-sm font-semibold text-foreground">该级别概览</h3>
        <p className="text-xs text-muted-foreground">{resolvePeriodDecisionSource(section)}</p>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <div className="rounded-lg border bg-background/80 p-3">
          <div className="text-xs font-medium text-muted-foreground">最终判定</div>
          <Badge variant="outline" className="mt-2">
            {judgmentLabel}
          </Badge>
        </div>
        <div className="rounded-lg border bg-background/80 p-3">
          <div className="text-xs font-medium text-muted-foreground">父级约束</div>
          <p className="mt-2 text-sm leading-6 text-foreground">{relationLabel}</p>
        </div>
      </div>

      {structureTags.length > 0 ? (
        <div className="mt-4 space-y-2">
          <div className="text-xs font-medium text-muted-foreground">当前结构</div>
          <SignalTagList tags={structureTags} />
        </div>
      ) : null}
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
          按级别切换查看该级别概览、结构拓扑和证据。
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

              <section className="space-y-3 rounded-xl border bg-muted/20 p-4">
                <div className="space-y-1">
                  <h3 className="text-sm font-semibold text-foreground">证据区</h3>
                  <p className="text-xs text-muted-foreground">{resolveEvidenceCaption(section)}</p>
                </div>

                {explainabilityStructure ? (
                  <div className="space-y-2">
                    <div className="text-sm font-medium text-foreground">结构说明</div>
                    <StructureExplainabilityPanel
                      structure={explainabilityStructure}
                      decision={section.period?.trinity_decision ?? null}
                      levelLabel={section.label}
                      displayMode="period_evidence"
                      movingAverages={section.period?.moving_averages ?? null}
                      executionSummary={buildExecutionSummary(section.period)}
                      structureColors={STRUCTURE_COLORS}
                    />
                  </div>
                ) : (
                  <div className="rounded-md border border-dashed bg-background/70 px-3 py-3 text-sm text-muted-foreground">
                    <div className="font-medium text-foreground">{resolveTopologyTitle(section)}</div>
                    <div className="mt-1 leading-6">{resolveStructureEvidence(section)}</div>
                  </div>
                )}
              </section>
            </TabsContent>
          );
        })}
      </Tabs>
    </section>
  );
}
