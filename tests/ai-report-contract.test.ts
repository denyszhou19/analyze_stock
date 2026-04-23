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
