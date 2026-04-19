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
