import test from 'node:test';
import assert from 'node:assert/strict';

const { buildStructureExplainabilityViewModel } = await import(
  new URL('../src/lib/structure-explainability-view-model.ts', import.meta.url).href
);

test('buildStructureExplainabilityViewModel exposes explainability topology and archetype labels', () => {
  const result = buildStructureExplainabilityViewModel({
    structure_type: 'A五段式',
    interpretation: {
      macro_background: {
        label: '偏多',
      },
      focus_structure: {
        archetype_label: 'A五段式原型',
        maturity: 'developing',
        start_anchor: {
          point_id: 'a1',
          price: 10.5,
          date: '2026-03-21 00:00',
        },
        reference_origin: {
          point_id: null,
          price: 9.8,
          date: '2026-02-10 00:00',
        },
        display_reason: '主升趋势中的右侧确认阶段',
      },
      current_leg: {
        label: 'a4→live 上行形成中',
      },
      next_confirmation: {
        label: '等待 a5 确认',
      },
      scenario_paths: [
        {
          code: 'up_break',
          label: '上破前高',
          trigger: '重新站上 12.80',
          effect: '延续 A 推进',
        },
      ],
    },
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

  assert.equal(result.topology.startLabel, 'a1 @ 10.50');
  assert.equal(result.topology.startMetaLabel, '参考原点 2026-02-10 @ 9.80');
  assert.equal(result.topology.currentLabel, 'a4');
  assert.equal(result.topology.currentSegmentLabel, 'a4→live 上行形成中');
  assert.equal(result.topology.nextSegmentLabel, '等待 a5 确认');
  assert.equal(result.interpretation.backgroundLabel, '偏多');
  assert.equal(result.interpretation.archetypeLabel, 'A五段式原型');
  assert.equal(result.interpretation.maturityLabel, '开展中');
  assert.equal(result.interpretation.currentLegLabel, 'a4→live 上行形成中');
  assert.equal(result.interpretation.nextConfirmationLabel, '等待 a5 确认');
  assert.deepEqual(result.interpretation.scenarioPathLabels, ['上破前高：重新站上 12.80']);
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
