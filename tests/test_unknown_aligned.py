from types import SimpleNamespace

import pytest

from han_compose import compose as C


def composer():
    font = SimpleNamespace(glyph=lambda _: None, has=lambda _: False)
    return C.Composer(font, {}, weighted=True)


@pytest.mark.parametrize('op,axis', [('⿰', 0), ('⿲', 0), ('⿱', 1), ('⿳', 1)])
def test_unknown_aligned_tracks_compound_axis_and_exclusion(op, axis):
    c = composer()
    node = (op, 'A', 'B') if op in ('⿰', '⿱') else (op, 'A', 'B', 'C')
    assert c._unknown_aligned(node)
    assert c._unknown_aligned(node, axis)
    assert not c._unknown_aligned(node, 1 - axis)
    c.by_sequence[C.key(node)] = 'X'
    c.font.glyph = lambda name: object() if name == 'X' else None
    assert not c._unknown_aligned(node)
    c.exclude.add('X')
    assert c._unknown_aligned(node)
    c.exclude.clear()
    assert not c._unknown_aligned(node)
    c.font.glyph = lambda _: None
    assert c._unknown_aligned(node)


@pytest.mark.parametrize('node', ['A', ('⿹', 'A', 'B'), ('⿻', 'A', 'B'), ('⿴', 'A', 'B')])
def test_non_linear_operands_keep_their_ordinary_unknown_status(node):
    c = composer()
    assert c._unknown(node) == isinstance(node, tuple)
    assert not c._unknown_aligned(node)


@pytest.mark.parametrize('child,skip', [
    (('⿰', 'A', 'B'), True), (('⿲', 'A', 'B', 'C'), True),
    (('⿱', 'A', 'B'), False), (('⿳', 'A', 'B', 'C'), False),
    (('⿹', 'A', 'B'), False), (('⿻', 'A', 'B'), False),
])
@pytest.mark.parametrize('at_root', [False, True])
@pytest.mark.parametrize('parent', ['⿰', '⿱'])
def test_only_nested_horizontal_expansion_bypasses_prediction(monkeypatch, child, skip, at_root, parent):
    c = composer()
    c.spelled, c.atomic = set(), set()
    c.layout = SimpleNamespace(ops={'⿰', '⿱'})
    learned, fallback = object(), object()
    monkeypatch.setattr(c, '_instance', lambda *args: None)
    monkeypatch.setattr(c, '_respelled', lambda node: node)
    monkeypatch.setattr(c, '_learned', lambda *args: learned)
    monkeypatch.setattr(c, '_transplant', lambda *args: None)
    monkeypatch.setattr(c, '_template', lambda *args, **kwargs: None)
    monkeypatch.setattr(c, '_shares', lambda *args: fallback)
    result = c._node((parent, 'D', child), (0, 0, 100, 100), at_root=at_root)
    assert result is (fallback if skip and not at_root and parent == '⿰' else learned)


@pytest.mark.parametrize('child,linear', [
    (('⿰', 'A', 'B'), True), (('⿱', 'A', 'B'), True),
    (('⿻', 'A', 'B'), False), (('⿹', 'A', 'B'), False),
])
def test_crossing_allocation_requires_an_unknown_linear_operand(monkeypatch, child, linear):
    c = composer()
    boxes, crossed = [], []
    monkeypatch.setattr(c, 'ink', lambda node: 1.0)
    monkeypatch.setattr(c, 'crossings', lambda node, axis: crossed.append(node) or 1.0)
    monkeypatch.setattr(c, '_host', lambda *args: None)
    monkeypatch.setattr(c, '_row', lambda node, box, count: boxes.append(box) or [])
    monkeypatch.setattr(c, '_space', lambda *args: None)
    c._shares('⿰', ['D', child], (0, 0, 100, 100))
    assert bool(crossed) == linear
    gap = C.SHARES['⿰', 2][3] if linear else .04
    assert boxes[1][0] - boxes[0][2] == pytest.approx(100 * gap)
