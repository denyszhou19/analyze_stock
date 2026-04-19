import test from 'node:test';
import assert from 'node:assert/strict';

type ActionStatus = import('../src/lib/trinity-display-vocabulary.ts').ActionStatus;
type DirectionTone = import('../src/lib/trinity-display-vocabulary.ts').DirectionTone;
type ActionStatusLabel = import('../src/lib/trinity-display-vocabulary.ts').ActionStatusLabel;
type ActionRuleState = import('../src/lib/trinity-display-vocabulary.ts').ActionRuleState;

const vocabulary = await import(
  new URL('../src/lib/trinity-display-vocabulary.ts', import.meta.url).href
) as typeof import('../src/lib/trinity-display-vocabulary.ts');

test('exports planned status and direction type aliases through runtime helpers', () => {
  const status: ActionStatus = 'passed';
  const direction: DirectionTone = 'bullish';
  const statusLabel: ActionStatusLabel = '可执行';
  const ruleState: ActionRuleState = '已满足';

  assert.equal(vocabulary.getActionStatusMeta(status).label, statusLabel);
  assert.equal(vocabulary.getActionStatusMeta(status).ruleState, ruleState);
  assert.equal(vocabulary.getDirectionMeta(direction).label, '偏多');
});

test('maps backend status to trading language labels, icons and rule state', () => {
  assert.deepEqual(vocabulary.getActionStatusMeta('passed'), {
    label: '可执行',
    icon: '✓',
    badgeClassName: 'border-slate-200 bg-slate-50 text-slate-700',
    cardClassName: 'border-slate-200 bg-slate-50/60',
    tradeMeaning: '这条规则已满足，可纳入当前执行判断',
    ruleState: '已满足',
  });
  assert.equal(vocabulary.getActionStatusMeta('info').label, '观察中');
  assert.equal(vocabulary.getActionStatusMeta('info').icon, '○');
  assert.equal(vocabulary.getActionStatusMeta('info').ruleState, '待确认');
  assert.equal(vocabulary.getActionStatusMeta('warning').label, '谨慎看');
  assert.equal(vocabulary.getActionStatusMeta('warning').icon, '!');
  assert.equal(vocabulary.getActionStatusMeta('warning').ruleState, '有约束');
  assert.equal(vocabulary.getActionStatusMeta('failed').label, '暂不做');
  assert.equal(vocabulary.getActionStatusMeta('failed').icon, '×');
  assert.equal(vocabulary.getActionStatusMeta('failed').ruleState, '不成立');

  for (const status of ['passed', 'info', 'warning', 'failed'] as const) {
    const meta = vocabulary.getActionStatusMeta(status);
    assert.doesNotMatch(meta.badgeClassName, /(red|green|emerald)/);
    assert.doesNotMatch(meta.cardClassName, /(red|green|emerald)/);
  }
});

test('maps direction tone to Chinese labels and color classes', () => {
  assert.equal(vocabulary.getDirectionMeta('bullish').label, '偏多');
  assert.equal(vocabulary.getDirectionMeta('bearish').label, '偏空');
  assert.equal(vocabulary.getDirectionMeta('neutral').label, '中性');
  assert.match(vocabulary.getDirectionMeta('bullish').cardClassName, /red/);
  assert.match(vocabulary.getDirectionMeta('bullish').textClassName, /red/);
  assert.match(vocabulary.getDirectionMeta('bearish').cardClassName, /green/);
  assert.match(vocabulary.getDirectionMeta('bearish').textClassName, /green/);
  assert.match(vocabulary.getDirectionMeta('neutral').cardClassName, /slate|gray/);
  assert.match(vocabulary.getDirectionMeta('neutral').textClassName, /slate|gray/);
});

test('normalizes structure tags globally', () => {
  const standardC = vocabulary.getStructureTagMeta('C单平台式');
  assert.equal(standardC.label, 'C单平台式');
  assert.equal(standardC.family, 'C');
  assert.equal(standardC.className, 'border-blue-200 bg-blue-50 text-blue-700');
  assert.match(standardC.explanation, /标准C类结构/);

  const extendedC = vocabulary.getStructureTagMeta('延伸C类');
  assert.equal(extendedC.label, '延伸C类');
  assert.equal(extendedC.family, 'C');
  assert.equal(extendedC.className, 'border-blue-200 bg-blue-50 text-blue-700');
  assert.match(extendedC.tradeMeaning, /不能直接等同于标准C/);

  const aliasA = vocabulary.getStructureTagMeta('延伸A');
  assert.equal(aliasA.label, '延伸A类');
  assert.equal(aliasA.family, 'A');

  assert.equal(vocabulary.getStructureTagMeta('未知结构').label, '未知结构');
});

test('maps structure direction enum into direction tone', () => {
  assert.equal(vocabulary.directionFromBias('bullish'), 'bullish');
  assert.equal(vocabulary.directionFromBias('bearish'), 'bearish');
  assert.equal(vocabulary.directionFromBias(''), 'neutral');
  assert.equal(vocabulary.directionFromBias('unknown'), 'neutral');

  assert.equal(vocabulary.directionFromStructure('up'), 'bullish');
  assert.equal(vocabulary.directionFromStructure('down'), 'bearish');
  assert.equal(vocabulary.directionFromStructure('neutral'), 'neutral');
  assert.equal(vocabulary.directionFromStructure(''), 'neutral');
  assert.equal(vocabulary.directionFromStructure('sideways'), 'neutral');
});

test('builds status hover explanation with reason and direction', () => {
  const explanation = vocabulary.buildStatusExplanation({
    status: 'warning',
    direction: 'bearish',
    reason: '父级偏空，当前级别反弹未确认',
  });

  assert.equal(explanation.tradeMeaning, '存在约束，不能直接放大动作');
  assert.equal(explanation.ruleState, '有约束');
  assert.equal(explanation.directionLabel, '偏空');
  assert.equal(explanation.reason, '父级偏空，当前级别反弹未确认');
});

test('builds status explanation fallback reason when input reason is empty', () => {
  const explanation = vocabulary.buildStatusExplanation({
    status: 'info',
    direction: 'neutral',
    reason: '   ',
  });

  assert.equal(explanation.tradeMeaning, '已有方向或预案，但还差确认，不急着动作');
  assert.equal(explanation.ruleState, '待确认');
  assert.equal(explanation.directionLabel, '中性');
  assert.equal(explanation.reason, '当前规则未提供明确原因');
});
