export type ActionStatus = 'passed' | 'info' | 'warning' | 'failed';
export type DirectionTone = 'bullish' | 'bearish' | 'neutral';
export type SignalTagTone = 'bullish' | 'bearish' | 'warning' | 'neutral';
export type ActionStatusLabel = '可执行' | '观察中' | '谨慎看' | '暂不做';
export type ActionRuleState = '已满足' | '待确认' | '有约束' | '不成立';
type StructureFamily =
  | 'A'
  | 'B'
  | 'C'
  | 'D'
  | 'channel'
  | 'range'
  | 'unfinished'
  | 'complex'
  | 'extended'
  | 'unknown';

export interface ActionStatusMeta {
  label: ActionStatusLabel;
  icon: '✓' | '○' | '!' | '×';
  badgeClassName: string;
  cardClassName: string;
  tradeMeaning: string;
  ruleState: ActionRuleState;
}

export interface DirectionMeta {
  label: '偏多' | '偏空' | '中性';
  badgeClassName: string;
  cardClassName: string;
  textClassName: string;
}

export interface StructureTagMeta {
  label: string;
  family: StructureFamily;
  className: string;
  explanation: string;
  tradeMeaning: string;
}

export interface SignalTagToneMeta {
  badgeClassName: string;
}

interface StatusExplanationInput {
  status?: ActionStatus | string | null;
  direction?: DirectionTone | string | null;
  reason?: string | null;
}

export interface StatusExplanation {
  tradeMeaning: string;
  ruleState: ActionRuleState;
  directionLabel: DirectionMeta['label'];
  reason: string;
}

const NEUTRAL_CLASS_NAME = 'border-slate-200 bg-slate-50 text-slate-700';

const ACTION_STATUS_META: Record<ActionStatus, ActionStatusMeta> = {
  passed: {
    label: '可执行',
    icon: '✓',
    badgeClassName: NEUTRAL_CLASS_NAME,
    cardClassName: 'border-slate-200 bg-slate-50/60',
    tradeMeaning: '这条规则已满足，可纳入当前执行判断',
    ruleState: '已满足',
  },
  info: {
    label: '观察中',
    icon: '○',
    badgeClassName: NEUTRAL_CLASS_NAME,
    cardClassName: 'border-slate-200 bg-slate-50/60',
    tradeMeaning: '已有方向或预案，但还差确认，不急着动作',
    ruleState: '待确认',
  },
  warning: {
    label: '谨慎看',
    icon: '!',
    badgeClassName: NEUTRAL_CLASS_NAME,
    cardClassName: 'border-slate-200 bg-slate-50/60',
    tradeMeaning: '存在约束，不能直接放大动作',
    ruleState: '有约束',
  },
  failed: {
    label: '暂不做',
    icon: '×',
    badgeClassName: NEUTRAL_CLASS_NAME,
    cardClassName: 'border-slate-200 bg-slate-50/60',
    tradeMeaning: '当前不支持按这条规则交易',
    ruleState: '不成立',
  },
};

const DIRECTION_META: Record<DirectionTone, DirectionMeta> = {
  bullish: {
    label: '偏多',
    badgeClassName: 'border-red-200 bg-red-50 text-red-700',
    cardClassName: 'border-red-200 bg-red-50 text-red-950',
    textClassName: 'text-red-700',
  },
  bearish: {
    label: '偏空',
    badgeClassName: 'border-green-200 bg-green-50 text-green-700',
    cardClassName: 'border-green-200 bg-green-50 text-green-950',
    textClassName: 'text-green-700',
  },
  neutral: {
    label: '中性',
    badgeClassName: NEUTRAL_CLASS_NAME,
    cardClassName: 'border-slate-200 bg-slate-50 text-slate-900',
    textClassName: 'text-slate-700',
  },
};

export const SIGNAL_TAG_TONE_META: Record<SignalTagTone, SignalTagToneMeta> = {
  bullish: {
    badgeClassName: 'border-rose-200 bg-rose-50 text-rose-700',
  },
  bearish: {
    badgeClassName: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  },
  warning: {
    badgeClassName: 'border-amber-200 bg-amber-50 text-amber-800',
  },
  neutral: {
    badgeClassName: NEUTRAL_CLASS_NAME,
  },
};

const STRUCTURE_TAG_META: Record<string, StructureTagMeta> = {
  A五段式: {
    label: 'A五段式',
    family: 'A',
    className: 'border-amber-200 bg-amber-50 text-amber-700',
    explanation: '标准A类结构，五段推进完整，适合围绕标准节点理解节奏。',
    tradeMeaning: '若级别、均线与量能配合，可优先按标准节点跟踪。',
  },
  '延伸A类': {
    label: '延伸A类',
    family: 'A',
    className: 'border-amber-200 bg-amber-50 text-amber-700',
    explanation: 'A类原型继续延展，仍保留A类语义，但标准编号不再继续扩写。',
    tradeMeaning: '可以沿A类方向观察，但不能把后续段落直接当作标准A节点处理。',
  },
  B双平台式: {
    label: 'B双平台式',
    family: 'B',
    className: 'border-violet-200 bg-violet-50 text-violet-700',
    explanation: '标准B类结构，由双平台转换构成，关注平台切换与确认。',
    tradeMeaning: '适合围绕平台转换、突破与回踩确认来判断动作。',
  },
  '延伸B类': {
    label: '延伸B类',
    family: 'B',
    className: 'border-violet-200 bg-violet-50 text-violet-700',
    explanation: 'B类结构继续拉长，保留双平台语义，但不再等同于标准B。',
    tradeMeaning: '可沿B类边界观察，但需要降低对标准节点精确性的预期。',
  },
  C单平台式: {
    label: 'C单平台式',
    family: 'C',
    className: 'border-blue-200 bg-blue-50 text-blue-700',
    explanation: '标准C类结构，围绕单平台边界整理，重点看平台上下沿与出平台确认。',
    tradeMeaning: '适合用平台边界、突破与跌破回抽来组织交易语言。',
  },
  '延伸C类': {
    label: '延伸C类',
    family: 'C',
    className: 'border-blue-200 bg-blue-50 text-blue-700',
    explanation: 'C类原型继续延展，仍可沿单平台语义解释，但结构已超出标准编号范畴。',
    tradeMeaning: '不能直接等同于标准C，应更多依赖平台边界与当前执行段确认。',
  },
  D三段式: {
    label: 'D三段式',
    family: 'D',
    className: 'border-rose-200 bg-rose-50 text-rose-700',
    explanation: '标准D类结构，三段关系清晰，重点看终段完成度与转折确认。',
    tradeMeaning: '适合围绕第三段衰竭、确认与反转窗口安排动作。',
  },
  '延伸D类': {
    label: '延伸D类',
    family: 'D',
    className: 'border-rose-200 bg-rose-50 text-rose-700',
    explanation: 'D类结构延伸后，仍保留三段转折语义，但不应机械套用标准D节点。',
    tradeMeaning: '更强调阶段确认与风险控制，不直接视作标准D完成态。',
  },
  上升通道: {
    label: '上升通道',
    family: 'channel',
    className: 'border-red-200 bg-red-50 text-red-700',
    explanation: '通道类结构，价格沿上升斜率推进，边界比标准节点更重要。',
    tradeMeaning: '更适合按通道支撑、压力与破位管理节奏。',
  },
  下降通道: {
    label: '下降通道',
    family: 'channel',
    className: 'border-green-200 bg-green-50 text-green-700',
    explanation: '通道类结构，价格沿下降斜率运行，先看压制是否解除。',
    tradeMeaning: '通常以反弹承压、破通道或止跌信号作为动作依据。',
  },
  大平台震荡: {
    label: '大平台震荡',
    family: 'range',
    className: NEUTRAL_CLASS_NAME,
    explanation: '平台震荡类结构，以区间边界和内部往复为主，不强调标准节点。',
    tradeMeaning: '更适合边界交易或等待突破，不宜提前放大趋势判断。',
  },
  延伸结构: {
    label: '延伸结构',
    family: 'extended',
    className: 'border-indigo-200 bg-indigo-50 text-indigo-700',
    explanation: '结构已超出标准原型点数，但仍保留可跟踪的结构语义。',
    tradeMeaning: '可以继续观察主导方向，但要降低标准节点交易的权重。',
  },
  未完成结构: {
    label: '未完成结构',
    family: 'unfinished',
    className: 'border-amber-200 bg-amber-50 text-amber-800',
    explanation: '结构尚未完成关键确认，解释力不足，需等待后续段落补齐。',
    tradeMeaning: '先以等待确认为主，不直接升级为明确执行信号。',
  },
  复杂结构: {
    label: '复杂结构',
    family: 'complex',
    className: 'border-orange-200 bg-orange-50 text-orange-800',
    explanation: '结构解释力不足或出现多套竞争语义，无法稳定映射到标准原型。',
    tradeMeaning: '优先控制风险，避免把复杂结构误当成高质量执行结构。',
  },
};

const STRUCTURE_TAG_ALIASES: Record<string, string> = {
  '延伸A': '延伸A类',
  '延伸A类': '延伸A类',
  '延伸B': '延伸B类',
  '延伸B类': '延伸B类',
  '延伸C': '延伸C类',
  '延伸C类': '延伸C类',
  '延伸D': '延伸D类',
  '延伸D类': '延伸D类',
  '结构未完成': '未完成结构',
  '未完成结构': '未完成结构',
};

function cleanText(value?: string | null): string {
  return typeof value === 'string' ? value.trim() : '';
}

function normalizeActionStatus(status?: ActionStatus | string | null): ActionStatus {
  const cleaned = cleanText(status).toLowerCase();
  if (cleaned === 'passed' || cleaned === 'info' || cleaned === 'warning' || cleaned === 'failed') {
    return cleaned;
  }
  return 'info';
}

function normalizeDirection(direction?: DirectionTone | string | null): DirectionTone {
  const cleaned = cleanText(direction);
  const lower = cleaned.toLowerCase();

  if (
    lower === 'bullish' ||
    cleaned === '偏多' ||
    cleaned === '看多' ||
    cleaned === '中性偏多' ||
    lower === 'up' ||
    cleaned === '向上'
  ) {
    return 'bullish';
  }

  if (
    lower === 'bearish' ||
    cleaned === '偏空' ||
    cleaned === '看空' ||
    cleaned === '中性偏空' ||
    lower === 'down' ||
    cleaned === '向下'
  ) {
    return 'bearish';
  }

  return 'neutral';
}

function normalizeStructureTag(tag?: string | null): string {
  const cleaned = cleanText(tag);
  return STRUCTURE_TAG_ALIASES[cleaned] ?? cleaned;
}

export function getActionStatusMeta(status?: ActionStatus | string | null): ActionStatusMeta {
  return ACTION_STATUS_META[normalizeActionStatus(status)];
}

export function getDirectionMeta(direction?: DirectionTone | string | null): DirectionMeta {
  return DIRECTION_META[normalizeDirection(direction)];
}

export function getSignalTagToneMeta(tone: SignalTagTone): SignalTagToneMeta {
  return SIGNAL_TAG_TONE_META[tone];
}

export function getStructureTagMeta(tag?: string | null): StructureTagMeta {
  const normalizedTag = normalizeStructureTag(tag);
  const knownMeta = STRUCTURE_TAG_META[normalizedTag];
  if (knownMeta) {
    return knownMeta;
  }

  return {
    label: normalizedTag || '未知结构',
    family: 'unknown',
    className: NEUTRAL_CLASS_NAME,
    explanation: '该结构暂未纳入全局展示词典，先按原始标签展示并保持中性解释。',
    tradeMeaning: '需结合原始结构描述与上下文单独判断，默认不强化方向与执行结论。',
  };
}

export function directionFromBias(bias?: string | null): DirectionTone {
  return normalizeDirection(bias);
}

export function directionFromStructure(direction?: string | null): DirectionTone {
  const cleaned = cleanText(direction).toLowerCase();
  if (cleaned === 'up') {
    return 'bullish';
  }

  if (cleaned === 'down') {
    return 'bearish';
  }

  return 'neutral';
}

export function buildStatusExplanation(input: StatusExplanationInput): StatusExplanation {
  const statusMeta = getActionStatusMeta(input.status);
  const directionMeta = getDirectionMeta(input.direction);
  const reason = cleanText(input.reason) || '当前规则未提供明确原因';

  return {
    tradeMeaning: statusMeta.tradeMeaning,
    ruleState: statusMeta.ruleState,
    directionLabel: directionMeta.label,
    reason,
  };
}
