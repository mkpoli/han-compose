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


@pytest.mark.parametrize("height, kept", [(42, (0, 0, 20, 40)), (46, (0, 0, 20, 46))])
def test_a_host_part_a_learned_box_barely_stretches_keeps_its_extent(monkeypatch, height, kept):
    boxes = [(0, 0, 20, height), (30, 0, 50, 40)]
    c, _ = learned_composer(monkeypatch, boxes)
    assert c._learned("⿰", ["A", "B"])[0].target == kept

