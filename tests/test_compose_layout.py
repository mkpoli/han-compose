from __future__ import annotations

from types import SimpleNamespace

import numpy as np
import pytest

from han_compose import compose as C
from han_compose import compose_layout as L

ROWS = [
    {"c": "a", "op": "⿰", "kids": ["亻", "可"], "boxes": [[0, 0, 300, 800], [350, 0, 950, 800]]},
    {"c": "b", "op": "⿰", "kids": ["亻", "木"], "boxes": [[40, 0, 340, 800], [390, 0, 950, 800]]},
    {"c": "c", "op": "⿱", "kids": ["艹", "化"], "boxes": [[0, 600, 1000, 800], [0, 0, 1000, 550]]},
]


def test_an_operands_usual_box_can_leave_one_example_out() -> None:
    table = L.Table.of(ROWS)
    mean, spread, n = table.usual("L", "亻")
    assert n == 2 and mean.tolist() == [20, 0, 320, 800] and spread.tolist() == [20, 0, 20, 0]
    mean, spread, n = table.usual("L", "亻", np.array([0, 0, 300, 800]))
    assert n == 1 and mean.tolist() == [40, 0, 340, 800] and spread.tolist() == [0, 0, 0, 0]
    # An operand never seen in a place takes the place's usual box.
    mean, _, n = table.usual("R", "未")
    assert n == 0 and mean.tolist() == table.defaults["R"].tolist()


def test_a_model_is_saved_and_read_back_whole(tmp_path) -> None:
    table = L.Table.of(ROWS)
    rng = np.random.default_rng(0)
    layers = [rng.normal(size=(5, 4)), rng.normal(size=4), rng.normal(size=(4, 8)), rng.normal(size=8)]
    model = L.LayoutModel({"all": table, "0": table}, {"all": [layers], "0": [layers]}, {"a": 0})
    model.save(tmp_path / "m.npz")
    back = L.LayoutModel.load(tmp_path / "m.npz")
    assert back.fold_of == {"a": 0}
    assert back.tables["all"].counts == table.counts
    assert all(np.allclose(x, y) for x, y in zip(back.weights["0"][0], layers))


def test_gelu_is_the_tanh_form_training_uses() -> None:
    x = np.array([-3.0, -1.0, 0.0, 0.5, 2.0])
    expected = [-0.003637, -0.158808, 0.0, 0.345714, 1.954598]
    assert L._gelu(x) == pytest.approx(expected, abs=1e-5)


def learned_composer(monkeypatch, boxes):
    c = C.Composer(SimpleNamespace(own=lambda _: False), {})
    c._faces[None] = ((0, 0, 100, 100), set())
    c.__dict__["spelled"] = set()
    calls = []

    def predict(*args):
        calls.append("predict")
        return list(boxes)

    c.layout = SimpleNamespace(ops=("⿰", "⿱", "⿸"), predict=predict)
    source = SimpleNamespace(box=(0, 0, 20, 40))
    monkeypatch.setattr(c, "_host", lambda op, i, *args, **kwargs:
                        (SimpleNamespace(char=f"host{i}", whole=True, pieces=[source]), 0))
    monkeypatch.setattr(c, "ink", lambda *args: 1.0)
    monkeypatch.setattr(c, "_space", lambda *args: calls.append("space"))
    return c, calls


@pytest.mark.parametrize("op", ["⿰", "⿱"])
@pytest.mark.parametrize("bad_index", [0, 1])
def test_learned_rejects_the_pair_when_either_host_is_deformed(monkeypatch, op, bad_index):
    boxes = [(0, 0, 20, 40), (30, 0, 50, 40)] if op == "⿰" else [(0, 60, 20, 100), (0, 0, 20, 40)]
    bad = list(boxes[bad_index])
    axis = C.AXIS[op]
    bad[axis + 2] = bad[axis] + (5 if axis == 0 else 10)
    boxes[bad_index] = tuple(bad)
    c, calls = learned_composer(monkeypatch, boxes)
    assert c._learned(op, ["A", "B"]) is None
    assert calls == ["predict"]


@pytest.mark.parametrize("at_root", [False, True])
def test_rejected_learned_pair_uses_geometric_path_once(monkeypatch, at_root):
    boxes = [(0, 60, 20, 100), (0, 0, 20, 10)]
    c, calls = learned_composer(monkeypatch, boxes)
    fallback = [object()]
    monkeypatch.setattr(c, "_instance", lambda *args: None)

    def transplant(*args):
        calls.append("transplant")
        return None

    def template(*args, **kwargs):
        calls.append("template")
        return None

    def shares(*args):
        calls.append("shares")
        return fallback

    monkeypatch.setattr(c, "_transplant", transplant)
    monkeypatch.setattr(c, "_template", template)
    monkeypatch.setattr(c, "_shares", shares)
    assert c._node(("⿱", "A", "B"), (0, 0, 20, 100), at_root=at_root) is fallback
    assert calls == ["predict", *(["transplant"] if at_root else []), "template", "shares"]


@pytest.mark.parametrize("height", [40, 40 / C.STRETCH])
def test_accepted_learned_pair_preserves_boxes(monkeypatch, height):
    boxes = [(0, 60, 20, 60 + height), (0, 0, 20, 40)]
    c, calls = learned_composer(monkeypatch, boxes)
    monkeypatch.setattr(c, "_instance", lambda *args: None)
    result = c._node(("⿱", "A", "B"), c.face, at_root=True)
    assert [p.target for p in result] == boxes
    assert [p.origin for p in result] == ["learned host0", "learned host1"]
    assert calls == ["predict", "space"]


@pytest.mark.parametrize("height, kept", [(42, (0, 0, 20, 40)), (46, (0, 0, 20, 46))])
def test_a_host_part_a_learned_box_barely_stretches_keeps_its_extent(monkeypatch, height, kept):
    boxes = [(0, 0, 20, height), (30, 0, 50, 40)]
    c, _ = learned_composer(monkeypatch, boxes)
    assert c._learned("⿰", ["A", "B"])[0].target == kept


def test_learned_guard_runs_after_cross_axis_correction(monkeypatch):
    boxes = [(0, 60, 100, 100), (0, 0, 20, 40)]
    c, calls = learned_composer(monkeypatch, boxes)
    assert c._stretch((0, 0, 20, 40), boxes[0]) > C.STRETCH
    result = c._learned("⿱", ["A", "B"])
    assert result[0].target == (0, 60, 20, 100)
    assert calls == ["predict", "space"]


def test_linear_rejection_guard_does_not_change_enclosures(monkeypatch):
    boxes = [(0, 0, 100, 100), (40, 20, 60, 30)]
    c, calls = learned_composer(monkeypatch, boxes)
    monkeypatch.setattr(c, "_room", lambda *args: None)
    assert all(c._stretch((0, 0, 20, 40), b) > C.STRETCH for b in boxes)
    result = c._learned("⿸", ["A", "B"])
    assert [p.target for p in result] == boxes
    assert calls == ["predict"]


def teacher_composer(monkeypatch, op, bare_index, extent):
    axis = C.AXIS.get(op, 1)
    # Leave a ten-unit gap and give the bare operand the requested axial extent.
    intervals = [(100 - extent, 100), (0, 90 - extent)] if bare_index == 0 else [(extent + 10, 100), (0, extent)]
    if axis == 0:
        intervals = [(100 - hi, 100 - lo) for lo, hi in intervals]
    boxes = [(lo, 0, hi, 100) if axis == 0 else (0, lo, 100, hi) for lo, hi in intervals]
    source = SimpleNamespace(box=(0, 0, 100, 100))
    c = C.Composer(SimpleNamespace(glyph=lambda _: source), {})
    c._faces[None] = ((0, 0, 100, 100), set())
    c.__dict__["spelled"] = set()
    teacher = C.Host("donor", [SimpleNamespace(box=box) for box in boxes], c.face, 10)
    same = [i != bare_index for i in range(2)]
    calls = []
    fallback = [object()]
    monkeypatch.setattr(c, "ink", lambda *args: 1.0)
    monkeypatch.setattr(c, "_instance", lambda *args: None)
    monkeypatch.setattr(c, "_transplant", lambda *args: None)
    monkeypatch.setattr(c, "_template", lambda *args, **kwargs: (teacher, same))
    monkeypatch.setattr(c, "_host", lambda *args, **kwargs: None)
    monkeypatch.setattr(c, "_space", lambda *args: calls.append("space"))

    def shares(operator, children, region):
        calls.append(("shares", operator, children, region))
        return fallback

    monkeypatch.setattr(c, "_shares", shares)
    return c, boxes, source, calls, fallback


@pytest.mark.parametrize("op", ["⿰", "⿱"])
@pytest.mark.parametrize("bare_index", [0, 1])
@pytest.mark.parametrize("at_root", [False, True])
def test_teacher_reallocates_whole_pair_when_bare_glyph_loses_width(monkeypatch, op, bare_index, at_root):
    c, boxes, source, calls, fallback = teacher_composer(monkeypatch, op, bare_index, 25)
    across = 1 - C.AXIS[op]
    fitted = C.fitted(source.box, boxes[bare_index])
    assert fitted[across + 2] - fitted[across] == 40
    assert c._node((op, "A", "B"), c.face, at_root=at_root) is fallback
    assert calls == [("shares", op, ["A", "B"], c.face)]


@pytest.mark.parametrize("op", ["⿰", "⿱"])
@pytest.mark.parametrize("extent", [65, 100 / C.STRETCH])
def test_teacher_preserves_feasible_bare_glyph_pair(monkeypatch, op, extent):
    c, boxes, _, calls, _ = teacher_composer(monkeypatch, op, 0, extent)
    result = c._node((op, "A", "B"), c.face, at_root=True)
    assert [p.target for p in result] == boxes
    assert [p.origin for p in result] == ["glyph A", "teacher donor"]
    assert calls == ["space"]


def test_teacher_keeps_fitting_that_only_shortens_composition_axis(monkeypatch):
    c, boxes, source, calls, _ = teacher_composer(monkeypatch, "⿱", 0, 65)
    source.box = (0, 0, 100, 20)
    result = c._node(("⿱", "A", "B"), c.face, at_root=True)
    assert result[0].target[2] - result[0].target[0] == 100
    assert result[0].target[3] - result[0].target[1] == 32
    assert result[1].target == boxes[1]
    assert calls == ["space"]


def test_teacher_keeps_hosted_replacement(monkeypatch):
    c, boxes, _, calls, _ = teacher_composer(monkeypatch, "⿱", 0, 25)
    source = SimpleNamespace(box=boxes[0])
    host = C.Host("host", [source], c.face, 0)
    monkeypatch.setattr(c, "_host", lambda *args, **kwargs: (host, 0))
    result = c._node(("⿱", "A", "B"), c.face, at_root=True)
    assert [p.origin for p in result] == ["host host", "teacher donor"]
    assert [p.target for p in result] == boxes
    assert calls == ["space"]


def test_teacher_guard_leaves_enclosures_unchanged(monkeypatch):
    c, boxes, source, calls, _ = teacher_composer(monkeypatch, "⿸", 1, 25)
    result = c._node(("⿸", "A", "B"), c.face, at_root=True)
    assert [p.origin for p in result] == ["teacher donor", "glyph B"]
    assert result[1].target == C.fitted(source.box, boxes[1])
    assert calls == []


@pytest.mark.parametrize("nested", [False, True])
@pytest.mark.parametrize("opening", [None, (30, 30, 50, 50), (20, 20, 80, 80), (10, 10, 90, 90)])
def test_missing_enclosed_host_uses_cleared_opening_without_another_inset(monkeypatch, nested, opening):
    boxes = [(0, 0, 100, 100), (20, 20, 80, 80)]
    c, _ = learned_composer(monkeypatch, boxes)
    c.font.stem = ((4, 4),)
    source = SimpleNamespace(box=c.face)
    outer = C.Host("outer", [source], c.face, 0)
    monkeypatch.setattr(c, "_host", lambda op, i, *args, **kwargs: (outer, 0) if i == 0 else None)
    monkeypatch.setattr(c, "_room", lambda *args: opening)
    monkeypatch.setattr(c, "_node", lambda child, box: [C.Placed(source, source.box, box, origin=f"glyph {child}")])
    fits = []
    monkeypatch.setattr(C, "_fit_inside", lambda outer, inner, region, stem, room: fits.append((inner[0].target, room)))
    region = c.face if nested else None
    result = c._learned("⿷", ["A", "B"], region)
    expected = opening if opening is not None and C._area(opening) > C._area(boxes[1]) else boxes[1]
    assert fits == [(boxes[1], expected)]
    assert [p.origin for p in result] == ["learned outer", "glyph B"]

