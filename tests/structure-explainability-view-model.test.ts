import test from 'node:test';
import assert from 'node:assert/strict';

const { buildStructureExplainabilityViewModel } = await import(
  new URL('../src/lib/structure-explainability-view-model.ts', import.meta.url).href
);

test('buildStructureExplainabilityViewModel exposes explainability topology and archetype labels', () => {
  const result = buildStructureExplainabilityViewModel({
    structure_type: 'A五段式',
    archetype: {
      primary: 'A五段式',
      reason: 'Directional -> Platform',
      alternatives: [{ type: 'C单平台式' }],
    },
    structure_details: {
      explainability: {
        structure_start_point_id: 'a1',
        current_point_id: 'a4',
        current_segment: {
          label: 'a3→a4',
        },
        next_segment_preview: {
          label: 'a4→a5',
        },
      },
    },
  });

  assert.equal(result.topology.startLabel, 'a1');
  assert.equal(result.topology.currentLabel, 'a4');
  assert.equal(result.topology.currentSegmentLabel, 'a3→a4');
  assert.equal(result.topology.nextSegmentLabel, 'a4→a5');
  assert.equal(result.archetype.primaryLabel, 'A五段式');
  assert.deepEqual(result.archetype.alternativeLabels, ['C单平台式']);
});

test('buildStructureExplainabilityViewModel falls back to prediction text when explainability is absent', () => {
  const result = buildStructureExplainabilityViewModel({
    structure_type: '复杂结构',
    structure_details: {
      prediction: {
        current_stage: '第3个拐点',
        next_stage: '结构完成，等待方向选择',
      },
    },
  });

  assert.equal(result.topology.startLabel, null);
  assert.equal(result.topology.currentLabel, null);
  assert.equal(result.topology.nextSegmentLabel, null);
  assert.equal(result.topology.hasExplainability, false);
  assert.match(result.topology.fallbackText ?? '', /prediction/);
});

test('buildStructureExplainabilityViewModel falls back archetype reason to structure description', () => {
  const result = buildStructureExplainabilityViewModel({
    structure_type: '复杂结构',
    description: '结构仍在演化，先跟随关键锚点',
    archetype: {
      primary: '复杂结构',
      alternatives: [],
    },
  });

  assert.equal(result.archetype.reason, '结构仍在演化，先跟随关键锚点');
});

test('buildStructureExplainabilityViewModel de-duplicates alternatives and excludes primary label', () => {
  const result = buildStructureExplainabilityViewModel({
    structure_type: 'A五段式',
    archetype: {
      primary: 'A五段式',
      alternatives: [
        { type: 'A五段式' },
        { type: 'C单平台式' },
        { type: 'C单平台式' },
        'C单平台式',
      ],
    },
  });

  assert.deepEqual(result.archetype.alternativeLabels, ['C单平台式']);
});
