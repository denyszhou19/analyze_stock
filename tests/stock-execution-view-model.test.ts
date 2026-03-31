import test from 'node:test';
import assert from 'node:assert/strict';

const { buildExecutionSummary, formatTimeframeCap } = await import(
  new URL('../src/lib/stock-execution-view-model.ts', import.meta.url).href
);

test('buildExecutionSummary prefers execution phase, action, setup quality, and archetype labels', () => {
  const result = buildExecutionSummary({
    structure: {
      structure_type: 'C单平台式',
      execution_phase: {
        label: '回抽确认',
      },
      execution: {
        action: 'add',
        setup_quality: 'A',
      },
      archetype: {
        primary: 'A五段式',
      },
    },
  });

  assert.equal(result.phaseLabel, '回抽确认');
  assert.equal(result.actionLabel, '加仓');
  assert.equal(result.setupQuality, 'A');
  assert.equal(result.archetypeLabel, 'A五段式');
});

test('buildExecutionSummary falls back to structure_type when archetype is missing', () => {
  const result = buildExecutionSummary({
    structure: {
      structure_type: '复杂结构',
      execution_phase: {
        label: '等待触发',
      },
      execution: {
        action: 'wait',
        setup_quality: 'avoid',
      },
    },
  });

  assert.equal(result.archetypeLabel, '复杂结构');
  assert.equal(result.actionLabel, '等待');
});

test('formatTimeframeCap renders one-third cap as最多补仓 1/3', () => {
  assert.equal(formatTimeframeCap(1 / 3), '最多补仓 1/3');
});
