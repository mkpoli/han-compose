from __future__ import annotations

from types import SimpleNamespace

import numpy as np

from han_compose import compose


def rect(x0: float, y0: float, x1: float, y1: float) -> compose.Contour:
    points = np.array([(x0, y0), (x1, y0), (x1, y1), (x0, y1)], dtype=float)
    ops = [("moveTo", 1, False)] + [("lineTo", 1, False)] * 3
    return compose.Contour(ops, points, points.copy())


def _make_ranked_composer(monkeypatch, own_hosts: list[str], foreign_hosts: list[str], good_hosts: set[str]):
    tree = ("⿺", "風", "台")
    piece_outer = compose.Part([rect(30, -80, 960, 800)])
    piece_inner = compose.Part([rect(520, 120, 940, 780)])
    all_hosts = own_hosts + foreign_hosts

    font = SimpleNamespace(
        own=lambda ch: ch in own_hosts or ch == "風",
        has=lambda ch: ch in all_hosts or ch == "風",
        glyph=lambda ch: piece_outer if ch == "風" else None,
        stem=((20.0, 20.0), (20.0, 20.0)),
    )
    c = compose.Composer(font, {}, weighted=True)
    c.__dict__["_index"] = ({("⿺0", "風"): [(ch, tree, (), 0) for ch in all_hosts]}, {})
    c.__dict__["japanese"] = set(all_hosts)
    monkeypatch.setattr(c, "alternatives", lambda node, place: [node])
    monkeypatch.setattr(c, "ink", lambda node: 100.0)
    monkeypatch.setattr(c, "_native_shapes", lambda rows: rows)

    calls: list[str] = []

    def host_node(char: str, node: tuple, path: tuple) -> compose.Host | None:
        calls.append(char)
        if char in good_hosts:
            return compose.Host(char, [piece_outer, piece_inner], (30, -80, 960, 800), 0.0, whole=True)
        return None

    monkeypatch.setattr(c, "_host_node", host_node)
    return c, calls


def test_ranked_scans_past_limit_when_only_foreign_hosts_cut(monkeypatch) -> None:
    own_hosts = [chr(0xE000 + i) for i in range(26)]
    foreign_hosts = [chr(0xE100 + i) for i in range(2)]
    # Six valid own hosts past limit=16: scanning should stop after 4 native cuts.
    good_own = own_hosts[18:24]
    c, calls = _make_ranked_composer(monkeypatch, own_hosts, foreign_hosts, set(good_own) | set(foreign_hosts))

    ranked = c._ranked("⿺", 0, "風", ["率"], (30, -80, 960, 800))
    own_ranked = [h.char for _, h, _ in ranked if h.char in own_hosts]
    assert own_ranked == good_own[:4]
    assert own_hosts[22] not in calls


def test_ranked_caps_tail_attempts_and_skips_tail_when_head_cuts(monkeypatch) -> None:
    own_hosts = [chr(0xE000 + i) for i in range(100)]
    # Valid own host beyond limit + 64 is not reached when tail scan is bounded.
    c, calls = _make_ranked_composer(monkeypatch, own_hosts, [], {own_hosts[95]})
    assert c._ranked("⿺", 0, "風", ["率"], (30, -80, 960, 800)) == []
    assert len(calls) == 16 + 64

    # When an own host inside top `limit` already cuts, own_hosts[16:] is not scanned.
    c2, calls2 = _make_ranked_composer(monkeypatch, own_hosts[:25], [], {own_hosts[3], own_hosts[20]})
    ranked = c2._ranked("⿺", 0, "風", ["率"], (30, -80, 960, 800))
    assert [h.char for _, h, _ in ranked] == [own_hosts[3]]
    assert own_hosts[20] not in calls2


def test_cut_rejects_left_body_inner_in_lower_left_enclosure_without_rejecting_centered_inner(monkeypatch) -> None:
    outer_wrap = compose.Part([rect(10, -80, 960, 760)])
    # Inner stuck inside outer's left body (center 310 < 10 + 0.4 * 950 = 390), like 虫 in 颼.
    wrong_inner_left = compose.Part([rect(140, 20, 480, 620)])
    # Valid centered/slightly-left-of-midpoint inner (center 485 >= 390), like 㓳 / 匕.
    centered_inner = compose.Part([rect(310, 170, 660, 740)])
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
    # Give wrong_inner_left HIGHER likeness so it is rejected by geometry, not score tie-breaking.
    monkeypatch.setattr(c, "likeness", lambda p, n: 0.95 if p is wrong_inner_left else 0.85)
    monkeypatch.setattr(compose, "enclosures", lambda part, op: [(outer_wrap, wrong_inner_left)])
    assert c._cut(combined, ("⿺", "風", "昜"), strict=True) is None

    monkeypatch.setattr(
        compose,
        "enclosures",
        lambda part, op: [(outer_wrap, wrong_inner_left), (outer_wrap, right_inner)],
    )
    result = c._cut(combined, ("⿺", "風", "昜"), strict=True)
    assert result is not None and result[0][1] is right_inner

    monkeypatch.setattr(compose, "enclosures", lambda part, op: [(outer_wrap, centered_inner)])
    centered = c._cut(combined, ("⿺", "是", "刂"), strict=True)
    assert centered is not None and centered[0][1] is centered_inner


def test_consensus_skips_standalone_glyph_fallback_for_combining_places(monkeypatch) -> None:
    glyph = compose.Part([rect(100, 0, 900, 800)])
    font = SimpleNamespace(own=lambda _: True, glyph=lambda _: glyph)
    c = compose.Composer(font, {}, weighted=True)
    monkeypatch.setattr(compose, "_square", lambda part: np.ones((4, 4), dtype=bool))

    # 0 hosts -> None for ⿺0, standalone glyph fallback for L
    c.__dict__["_index"] = ({}, {})
    assert c._consensus("⿺0", "風") is None
    assert c._consensus("L", "木")[1] is False

    # 2 hosts (< TYPICAL_FEW=4) -> still None for ⿺0
    tree = ("⿺", "風", "台")
    c2 = compose.Composer(font, {}, weighted=True)
    c2.__dict__["_index"] = ({("⿺0", "風"): [(ch, tree, (), 0) for ch in "颺颱"]}, {})
    monkeypatch.setattr(c2, "_host_node", lambda *args, **kwargs: SimpleNamespace(pieces=[glyph]))
    assert c2._consensus("⿺0", "風") is None

    # TYPICAL_FEW hosts -> returns fellow consensus as usual
    c3 = compose.Composer(font, {}, weighted=True)
    c3.__dict__["_index"] = ({("⿺0", "風"): [(ch, tree, (), 0) for ch in "颺颱颳颸"]}, {})
    monkeypatch.setattr(c3, "_host_node", lambda *args, **kwargs: SimpleNamespace(pieces=[glyph]))
    masks, fellows = c3._consensus("⿺0", "風")
    assert fellows is True and len(masks) == 4
