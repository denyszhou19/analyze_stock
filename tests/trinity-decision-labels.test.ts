import test from 'node:test';
import assert from 'node:assert/strict';

const {
  containsChinese,
  formatDecisionActionLabel,
  preferChineseList,
  preferChineseText,
} = await import(new URL('../src/lib/trinity-decision-labels.ts', import.meta.url).href);

test('formatDecisionActionLabel maps backend english action labels to chinese', () => {
  assert.equal(formatDecisionActionLabel('wait', 'wait'), '等待');
  assert.equal(formatDecisionActionLabel('avoid', 'avoid'), '回避');
  assert.equal(formatDecisionActionLabel('t_trade', 't_trade'), '做 T');
  assert.equal(formatDecisionActionLabel('buy', null), '买入');
  assert.equal(formatDecisionActionLabel('add', '加仓'), '加仓');
});

test('preferChineseText falls back when candidate has no chinese', () => {
  assert.equal(preferChineseText('Signals remain unconfirmed.', '等待'), '等待');
  assert.equal(preferChineseText('等待回踩确认', '回避'), '等待回踩确认');
  assert.equal(preferChineseText('', '等待'), '等待');
});

test('preferChineseList falls back when items are entirely non-chinese', () => {
  assert.deepEqual(preferChineseList(['Daily closes back above 135.78.'], ['重新站上平台上沿']), ['重新站上平台上沿']);
  assert.deepEqual(preferChineseList(['重新站上平台上沿'], ['不追高']), ['重新站上平台上沿']);
  assert.deepEqual(preferChineseList([], ['等待确认']), ['等待确认']);
});

test('containsChinese identifies simplified chinese text', () => {
  assert.equal(containsChinese('等待'), true);
  assert.equal(containsChinese('wait'), false);
});
