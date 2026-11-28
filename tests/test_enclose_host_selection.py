from __future__ import annotations

from types import SimpleNamespace

import numpy as np

from han_compose import compose


def rect(x0: float, y0: float, x1: float, y1: float) -> compose.Contour:
    points = np.array([(x0, y0), (x1, y0), (x1, y1), (x0, y1)], dtype=float)
    ops = [("moveTo", 1, False)] + [("lineTo", 1, False)] * 3
    return compose.Contour(ops, points, points.copy())


def test_ranked_scans_past_limit_when_top_own_hosts_fail_to_cut(monkeypatch) -> None:
    own_hosts = [chr(0xE000 + i) for i in range(20)]
    target_host = own_hosts[-1]
    tree = ("⿺", "風", "台")
    piece_outer = compose.Part([rect(30, -80, 960, 800)])
    piece_inner = compose.Part([rect(520, 120, 940, 780)])
    good = compose.Host(target_host, [piece_outer, piece_inner], (30, -80, 960, 800), 0.0, whole=True)

    font = SimpleNamespace(
        own=lambda ch: ch in own_hosts or ch == "風",
        has=lambda ch: ch in own_hosts or ch == "風",
        glyph=lambda ch: piece_outer if ch == "風" else None,
        stem=((20.0, 20.0), (20.0, 20.0)),
    )
    c = compose.Composer(font, {}, weighted=True)
    c.__dict__["_index"] = ({("⿺0", "風"): [(ch, tree, (), 0) for ch in own_hosts]}, {})
    c.__dict__["japanese"] = set(own_hosts)
    monkeypatch.setattr(c, "alternatives", lambda node, place: [node])
    monkeypatch.setattr(c, "ink", lambda node: 100.0)
    monkeypatch.setattr(c, "_native_shapes", lambda rows: rows)

    calls: list[str] = []

    def host_node(char: str, node: tuple, path: tuple) -> compose.Host | None:
        calls.append(char)
        return good if char == target_host else None

    monkeypatch.setattr(c, "_host_node", host_node)
    ranked = c._ranked("⿺", 0, "風", ["率"], (30, -80, 960, 800))
    assert len(ranked) == 1
    assert ranked[0][1].char == target_host
    assert target_host in calls


def test_cut_rejects_lower_left_enclosure_with_inner_left_of_outer_midpoint(monkeypatch) -> None:
    outer_wrap = compose.Part([rect(10, -80, 960, 760)])
    wrong_inner_left = compose.Part([rect(140, 20, 480, 620)])
    right_inner = compose.Part([rect(540, 80, 950, 750)])
    combined = compose.Part(outer_wrap.contours + wrong_inner_left.contours + right_inner.contours)

    font = SimpleNamespace(
        own=lambda _: True,
        has=lambda _: True,
        glyph=lambda _: outer_wrap,
        stem=((20.0, 20.0), (20.0, 20.0)),
    )
    c = compose.Composer(font, {}, weighted=True)
    monkeypatch.setattr(c, "_guided", lambda part, node: None)
    monkeypatch.setattr(c, "_counted", lambda *args: True)
    monkeypatch.setattr(c, "_outlines", lambda _: 1)
    monkeypatch.setattr(c, "likeness", lambda *args: 0.9)
    monkeypatch.setattr(
        compose,
        "enclosures",
        lambda part, op: [(outer_wrap, wrong_inner_left), (outer_wrap, right_inner)],
    )

    result = c._cut(combined, ("⿺", "風", "昜"), strict=True)
    assert result is not None
    pieces, _ = result
    assert pieces[1] is right_inner


def test_consensus_does_not_fall_back_to_standalone_glyph_for_lower_left_enclosure(monkeypatch) -> None:
    glyph = compose.Part([rect(100, 0, 900, 800)])
    font = SimpleNamespace(own=lambda _: True, glyph=lambda _: glyph)
    c = compose.Composer(font, {}, weighted=True)
    c.__dict__["_index"] = ({}, {})
    monkeypatch.setattr(compose, "_square", lambda part: np.ones((4, 4), dtype=bool))

    assert c._consensus("⿺0", "風") is None
    assert c._consensus("L", "木")[1] is False
