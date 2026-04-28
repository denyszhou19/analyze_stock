import test from 'node:test';
import assert from 'node:assert/strict';

const { parseAiReportContract } = await import(
  new URL('../src/lib/ai-report-contract.ts', import.meta.url).href
);

test('parseAiReportContract splits JSON summary and markdown body', () => {
  const report = [
    '```json',
    JSON.stringify(
      {
        headline: '先等确认，暂不激进操作',
        action: 'wait',
        bias: 'neutral',
        primary_reason: '日线结构未完成确认',
        triggers: ['重新站回平台上沿'],
        risks: ['跌回平台下沿'],
        guardrail: 'deterministic_decision.action=wait 时不得升级为 buy/add',
      },
      null,
      2
    ),
    '```',
    '',
    '# 综合判断',
    '',
    '- 当前以等待为主',
  ].join('\n');

  const parsed = parseAiReportContract(report);

  assert.equal(parsed.summary.action, 'wait');
  assert.equal(parsed.summary.bias, 'neutral');
  assert.equal(parsed.summary.headline, '先等确认，暂不激进操作');
  assert.equal(parsed.summary.judgment, undefined);
  assert.equal(parsed.summary.candidate_structure, undefined);
  assert.equal(parsed.summary.wait_state, undefined);
  assert.equal(parsed.markdown, '# 综合判断\n\n- 当前以等待为主');
});

test('parseAiReportContract throws clear error when JSON summary block is missing', () => {
  assert.throws(
    () => parseAiReportContract('# 只有 Markdown\n\n- 没有 JSON 摘要'),
    /AI 报告缺少 JSON 摘要/
  );
});

test('parseAiReportContract normalizes Chinese action and bias aliases from AI output', () => {
  const report = [
    '```json',
    JSON.stringify(
      {
        headline: '当前先观望，偏谨慎',
        action: '观望',
        bias: '中性偏空',
        primary_reason: '父级别未放行',
        triggers: ['站上关键压力位'],
        risks: ['再度跌破平台下沿'],
        guardrail: '未确认前不升级为买入',
      },
      null,
      2
    ),
    '```',
    '',
    '# 综合判断',
    '',
    '- 当前先观望',
  ].join('\n');

  const parsed = parseAiReportContract(report);

  assert.equal(parsed.summary.action, 'wait');
  assert.equal(parsed.summary.bias, 'bearish');
});

test('parseAiReportContract parses phase3 enhancement fields when present', () => {
  const report = [
    '```json',
    JSON.stringify(
      {
        headline: '候选可试，但仍需等待确认',
        action: 'hold',
        bias: 'neutral',
        primary_reason: '30分钟仍在回抽确认',
        triggers: ['站上关键压力位'],
        risks: ['跌破 30 分钟结构低点'],
        guardrail: '未确认前不要升级动作',
        judgment: '候选可试',
        critical_reason: '父级支持但30分钟仍待确认',
        spacetime_summary: '日线中偏强，30分钟顺父级，零轴强信号偏支持',
        structure_summary: '正式结构未完全确认，当前更偏 D 候选',
        execution_summary: '先看30分钟止跌，确认后再加',
        candidate_structure: {
          label: 'A延续候选',
          current_leg: '30分钟回抽段',
          upgrade_condition: '30分钟回抽不破 MA55',
          invalidation: '跌破 30分钟结构低点',
        },
        wait_state: {
          label: '等待回抽确认',
          current_block: '30分钟回抽段尚未完成止跌确认',
          next_action: '观察30分钟止跌并重新转强',
        },
        judgment_warning: '当前后端判断偏保守，仍需关注30分钟确认后的升级路径',
      },
      null,
      2
    ),
    '```',
    '',
    '# 综合判断',
    '',
    '- 当前以等待为主',
  ].join('\n');

  const parsed = parseAiReportContract(report);

  assert.equal(parsed.summary.judgment, '候选可试');
  assert.equal(parsed.summary.critical_reason, '父级支持但30分钟仍待确认');
  assert.equal(
    parsed.summary.spacetime_summary,
    '日线中偏强，30分钟顺父级，零轴强信号偏支持'
  );
  assert.equal(parsed.summary.structure_summary, '正式结构未完全确认，当前更偏 D 候选');
  assert.equal(parsed.summary.execution_summary, '先看30分钟止跌，确认后再加');
  assert.deepEqual(parsed.summary.candidate_structure, {
    label: 'A延续候选',
    current_leg: '30分钟回抽段',
    upgrade_condition: '30分钟回抽不破 MA55',
    invalidation: '跌破 30分钟结构低点',
  });
  assert.deepEqual(parsed.summary.wait_state, {
    label: '等待回抽确认',
    current_block: '30分钟回抽段尚未完成止跌确认',
    next_action: '观察30分钟止跌并重新转强',
  });
  assert.equal(
    parsed.summary.judgment_warning,
    '当前后端判断偏保守，仍需关注30分钟确认后的升级路径'
  );
});

test('parseAiReportContract downgrades invalid optional fields without failing', () => {
  const report = [
    '```json',
    JSON.stringify(
      {
        headline: '坏输入回归',
        action: 'wait',
        bias: 'neutral',
        primary_reason: '主字段仍然合法',
        triggers: ['保留触发器'],
        risks: ['保留风险'],
        guardrail: '主字段仍然合法',
        judgment: '完全看多',
        critical_reason: '   ',
        spacetime_summary: '\n',
        structure_summary: '   ',
        execution_summary: '可执行摘要仍应保留',
        candidate_structure: ['not-an-object'],
        wait_state: 'not-an-object',
        judgment_warning: '  仅作提示  ',
      },
      null,
      2
    ),
    '```',
    '',
    '# 综合判断',
    '',
    '- 坏输入不应阻断解析',
  ].join('\n');

  const parsed = parseAiReportContract(report);

  assert.equal(parsed.summary.judgment, undefined);
  assert.equal(parsed.summary.critical_reason, undefined);
  assert.equal(parsed.summary.spacetime_summary, undefined);
  assert.equal(parsed.summary.structure_summary, undefined);
  assert.equal(parsed.summary.execution_summary, '可执行摘要仍应保留');
  assert.equal(parsed.summary.candidate_structure, undefined);
  assert.equal(parsed.summary.wait_state, undefined);
  assert.equal(parsed.summary.judgment_warning, '仅作提示');
});

test('parseAiReportContract preserves valid optional parts when others are invalid', () => {
  const report = [
    '```json',
    JSON.stringify(
      {
        headline: '混合可选字段',
        action: 'hold',
        bias: 'neutral',
        primary_reason: '主字段合法',
        triggers: ['保留触发器'],
        risks: ['保留风险'],
        guardrail: '主字段合法',
        judgment: '候选可试',
        critical_reason: '仍需等确认',
        spacetime_summary: '   ',
        structure_summary: '结构摘要可空白降级',
        execution_summary: '执行摘要可保留',
        candidate_structure: {
          label: 'A延续候选',
          current_leg: '30分钟回抽段',
          upgrade_condition: '   ',
          invalidation: '跌破结构低点',
        },
        wait_state: {
          label: '等待回抽确认',
          current_block: '',
          next_action: '观察30分钟止跌',
        },
        judgment_warning: '',
      },
      null,
      2
    ),
    '```',
    '',
    '# 综合判断',
    '',
    '- 合法字段应保留',
  ].join('\n');

  const parsed = parseAiReportContract(report);

  assert.equal(parsed.summary.judgment, '候选可试');
  assert.equal(parsed.summary.critical_reason, '仍需等确认');
  assert.equal(parsed.summary.spacetime_summary, undefined);
  assert.equal(parsed.summary.structure_summary, '结构摘要可空白降级');
  assert.equal(parsed.summary.execution_summary, '执行摘要可保留');
  assert.deepEqual(parsed.summary.candidate_structure, {
    label: 'A延续候选',
    current_leg: '30分钟回抽段',
    upgrade_condition: undefined,
    invalidation: '跌破结构低点',
  });
  assert.deepEqual(parsed.summary.wait_state, {
    label: '等待回抽确认',
    current_block: undefined,
    next_action: '观察30分钟止跌',
  });
  assert.equal(parsed.summary.judgment_warning, undefined);
});

test('parseAiReportContract keeps markdown headings and blank lines while sanitizing english tokens', () => {
  const report = [
    '```json',
    JSON.stringify(
      {
        headline: '等待为主',
        action: 'wait',
        bias: 'neutral',
        primary_reason: '父级未放行',
        triggers: ['等待确认'],
        risks: ['跌破平台下沿'],
        guardrail: 'position_permission=no_position',
      },
      null,
      2
    ),
    '```',
    '',
    '# 综合判断',
    '',
    '当前 execution 字段给出 buy 含义，但 deterministic_decision 为 wait。',
    '',
    '## 时空怎么看',
    '',
    '- position_permission 为 no_position',
  ].join('\n');

  const parsed = parseAiReportContract(report);

  assert.equal(
    parsed.markdown,
    '# 综合判断\n\n当前 执行预案字段给出买入含义，但后端当前结论为等待。\n\n## 时空怎么看\n\n- 仓位权限为空仓等待'
  );
});
