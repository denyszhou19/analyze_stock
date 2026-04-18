import pytest

from scripts.stock_analyzer import TrinityStockAnalyzer


@pytest.mark.parametrize(
    ('focus_type', 'expected_family', 'expected_qualification', 'expected_standard_candidate'),
    [
        ('A五段式', 'standard', 'standard', 'A五段式'),
        ('延伸A', 'extended', 'extended', 'A五段式'),
        ('延伸A类', 'extended', 'extended', 'A五段式'),
        ('B双平台式', 'standard', 'standard', 'B双平台式'),
        ('延伸B', 'extended', 'extended', 'B双平台式'),
        ('延伸B类', 'extended', 'extended', 'B双平台式'),
        ('C单平台式', 'standard', 'standard', 'C单平台式'),
        ('延伸C', 'extended', 'extended', 'C单平台式'),
        ('延伸C类', 'extended', 'extended', 'C单平台式'),
        ('D三段式', 'standard', 'standard', 'D三段式'),
        ('延伸D', 'extended', 'extended', 'D三段式'),
        ('延伸D类', 'extended', 'extended', 'D三段式'),
        ('上升通道', 'channel', 'over_limit', None),
        ('下降通道', 'channel', 'over_limit', None),
        ('大平台震荡', 'range', 'over_limit', None),
        ('延伸结构', 'extended', 'extended', None),
        ('未完成结构', 'unfinished', 'unfinished', None),
        ('结构未完成', 'unfinished', 'unfinished', None),
        ('复杂结构', 'complex', 'failed', None),
    ],
)
def test_structure_qualification_family_matrix(
    focus_type,
    expected_family,
    expected_qualification,
    expected_standard_candidate,
):
    analyzer = TrinityStockAnalyzer()
    decision = analyzer._build_trinity_structure_decision(
        {
            'structure_type': focus_type,
            'trend_direction': '上涨',
            'description': f'{focus_type} 测试',
            'interpretation': {'focus_structure': {}},
            'structure_details': {
                'focus_classification': {
                    'type': focus_type,
                    'standard_qualification': expected_qualification,
                    'qualification_reason': '测试结构资格',
                    'trend_direction': '上涨',
                }
            },
        }
    )

    assert decision['family'] == expected_family
    assert decision['qualification'] == expected_qualification
    assert decision['standard_candidate'] == expected_standard_candidate


def test_structure_qualification_uses_public_structure_type_after_downgrade() -> None:
    analyzer = TrinityStockAnalyzer()

    decision = analyzer._build_trinity_structure_decision(
        {
            'structure_type': '复杂结构',
            'trend_direction': '上涨',
            'description': '解释性降级后的公开结构',
            'interpretation': {
                'focus_structure': {
                    'standard_qualification': 'standard',
                }
            },
            'structure_details': {
                'focus_classification': {
                    'type': 'A五段式',
                    'standard_qualification': 'standard',
                    'qualification_reason': '旧聚焦分类残留',
                    'trend_direction': '上涨',
                },
                'explainability': {
                    'structure_start_point_id': 'a1',
                    'current_point_id': 'a4',
                    'a4_price': 10.8,
                    'last_confirmed_price': 10.8,
                },
            },
        }
    )

    assert decision['family'] == 'complex'
    assert decision['qualification'] == 'failed'
    assert decision['standard_candidate'] is None
    assert decision['node_map'] == {
        'a4': None,
        'b8': None,
        'd3': None,
        'd4': None,
        'last_confirmed': None,
    }
    assert decision['can_trade_by_structure_nodes'] is False


def test_extended_structure_family_is_consistent_between_interpretation_and_trinity_decision() -> None:
    analyzer = TrinityStockAnalyzer()

    interpretation = analyzer._build_structure_interpretation(
        structure_type='延伸结构',
        trend_direction='上涨',
        explanation={
            'structure_start_point_id': 'p1',
            'focus_origin_source': 'recent_component',
            'explainability_status': 'extended',
            'qualification_reason': '笔数超出标准原型，停止标准编号',
        },
        prediction={
            'current_stage': '延伸结构进行中',
            'next_stage': '等待结构再次明朗',
        },
        moving_averages={
            'price_vs_ma55': 'above',
            'price_vs_ma233': 'above',
            'ma_status': '多头排列',
        },
        peak_analysis=None,
        labeled_points=[
            {'point_id': 'p1', 'price': 10.0, 'date': '2024-01-01 00:00'},
            {'point_id': 'p2', 'price': 12.0, 'date': '2024-01-02 00:00'},
            {'point_id': 'live', 'price': 11.5, 'date': '2024-01-03 00:00', 'is_current': True},
        ],
        valid_range=None,
    )
    decision = analyzer._build_trinity_structure_decision(
        {
            'structure_type': '延伸结构',
            'trend_direction': '上涨',
            'description': '延伸结构测试',
            'interpretation': interpretation,
            'structure_details': {
                'focus_classification': {
                    'type': '延伸结构',
                    'standard_qualification': 'extended',
                    'qualification_reason': '笔数超出标准原型，停止标准编号',
                }
            },
        }
    )

    assert interpretation['focus_structure']['archetype_family'] == 'extended'
    assert interpretation['focus_structure']['standard_qualification'] == 'extended'
    assert decision['family'] == interpretation['focus_structure']['archetype_family']
    assert decision['qualification'] == interpretation['focus_structure']['standard_qualification']
    assert decision['standard_candidate'] is None
