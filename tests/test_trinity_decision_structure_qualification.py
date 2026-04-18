import pytest

from scripts.stock_analyzer import TrinityStockAnalyzer


@pytest.mark.parametrize(
    ('focus_type', 'expected_family', 'expected_qualification', 'expected_standard_candidate'),
    [
        ('A五段式', 'standard', 'standard', 'A五段式'),
        ('延伸A', 'extended', 'extended', 'A五段式'),
        ('B双平台式', 'standard', 'standard', 'B双平台式'),
        ('延伸B', 'extended', 'extended', 'B双平台式'),
        ('C单平台式', 'standard', 'standard', 'C单平台式'),
        ('延伸C', 'extended', 'extended', 'C单平台式'),
        ('上升通道', 'channel', 'over_limit', None),
        ('大平台震荡', 'range', 'over_limit', None),
        ('未完成结构', 'unfinished', 'unfinished', None),
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
