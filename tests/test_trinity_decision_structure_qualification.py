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
