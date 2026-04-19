import test from 'node:test';
import assert from 'node:assert/strict';

const vocabulary = await import(
  new URL('../src/lib/trinity-display-vocabulary.ts', import.meta.url).href
) as typeof import('../src/lib/trinity-display-vocabulary.ts');

test('exports planned status and direction type aliases through runtime helpers', () => {
  const status: vocabulary.ActionStatus = 'passed';
  const direction: vocabulary.DirectionTone = 'bullish';
  const statusLabel: vocabulary.ActionStatusLabel = '可执行';
  const ruleState: vocabulary.ActionRuleState = '已满足';

  assert.equal(vocabulary.getActionStatusMeta(status).label, statusLabel);
  assert.equal(vocabulary.getActionStatusMeta(status).ruleState, ruleState);
  assert.equal(vocabulary.getDirectionMeta(direction).label, '偏多');
});

test('maps backend status to trading language labels, icons and rule state', () => {
  assert.deepEqual(vocabulary.getActionStatusMeta('passed'), {
    label: '可执行',
    icon: '✓',
    badgeClassName: 'border-emerald-200 bg-emerald-50 text-emerald-700',
    cardClassName: 'border-emerald-200/70 bg-emerald-50/40',
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

  assert.equal(vocabulary.getStructureTagMeta('未知结构').label, '未知结构');
});

test('maps structure direction enum into direction tone', () => {
  assert.equal(vocabulary.directionFromStructure('up'), 'bullish');
  assert.equal(vocabulary.directionFromStructure('down'), 'bearish');
  assert.equal(vocabulary.directionFromStructure('neutral'), 'neutral');
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
