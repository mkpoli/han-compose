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


def test_learned_lower_left_enclosure_uses_outer_host_bay_when_predicted_box_collides(monkeypatch) -> None:
    # Outer L-shaped sweep covering left wall (0..480) and bottom foot (0..960, y=0..100),
    # with its designer-authored inner bay cleanly at (540, 140, 960, 840).
    outer_piece = compose.Part([rect(0, 0, 480, 840), rect(0, 0, 960, 100)])
    bay_piece = compose.Part([rect(540, 140, 960, 840)])
    outer_host = compose.Host("颱", [outer_piece, bay_piece], (0, 0, 960, 840), 0.0, whole=True)

    inner_piece = compose.Part([rect(360, 0, 960, 840)])
    inner_host = compose.Host("䢦", [compose.Part([rect(0, 0, 300, 840)]), inner_piece], (0, 0, 960, 840), 0.0, whole=True)

    font = SimpleNamespace(
        own=lambda _: True,
        has=lambda _: True,
        glyph=lambda _: outer_piece,
        stem=((40.0, 40.0), (40.0, 40.0)),
    )
    c = compose.Composer(font, {}, weighted=True)
    c.__dict__["face"] = (0.0, 0.0, 1000.0, 880.0)
    # Predicted inner box intrudes into outer_piece's left wall (x=440..480), creating a modest
    # collision below COLLIDE=0.03 but above 0.005.
    monkeypatch.setattr(c, "_learned_boxes", lambda op, ks, reg: [(0.0, 0.0, 960.0, 840.0), (440.0, 140.0, 960.0, 840.0)])
    monkeypatch.setattr(c, "_host", lambda op, i, *args, **kwargs: (outer_host, 0) if i == 0 else (inner_host, 1))
    monkeypatch.setattr(c, "_room", lambda *args: (540.0, 140.0, 960.0, 840.0))
    monkeypatch.setattr(c, "ink", lambda _: 100.0)

    placed = c._learned("⿺", ["風", "率"])
    assert placed is not None and len(placed) == 2
    assert placed[1].target == (540.0, 140.0, 960.0, 840.0)
    assert compose._collision([placed[0]], [placed[1]], c.face, size=256) == 0.0


def test_enclosures_lower_left_separates_low_inner_strokes_from_outer_left_body() -> None:
    # Outer sweep spans full width along bottom; outer left body sits at x=160..420, y=220..760;
    # inner component sits on the right (x=520..920) with a low stroke at y=50..120 closer to Y0
    # than the outer left body is to X0.
    sweep = rect(20, 0, 960, 80)
    outer_body = rect(160, 220, 420, 760)
    inner_top = rect(520, 420, 920, 780)
    inner_low = rect(540, 50, 900, 120)
    combined = compose.Part([sweep, outer_body, inner_top, inner_low])

    cuts = compose.enclosures(combined, "⿺")
    expected_inner = {id(inner_top), id(inner_low)}
    expected_outer = {id(sweep), id(outer_body)}
    assert any(
        {id(c) for c in inn.contours} == expected_inner and {id(c) for c in out.contours} == expected_outer
        for out, inn in cuts
    )


def test_learned_lower_left_enclosure_uses_enclosed_room_when_predicted_box_floats_high(monkeypatch) -> None:
    outer_piece = compose.Part([rect(0, 0, 460, 840), rect(0, 0, 960, 40)])
    bay_piece = compose.Part([rect(510, 75, 960, 840)])
    outer_host = compose.Host("飂", [outer_piece, bay_piece], (0, 0, 960, 840), 0.0, whole=True)

    inner_piece = compose.Part([rect(320, 40, 950, 840)])
    inner_host = compose.Host("䢦", [compose.Part([rect(0, 0, 280, 840)]), inner_piece], (0, 0, 960, 840), 0.0, whole=True)

    font = SimpleNamespace(
        own=lambda _: True,
        has=lambda _: True,
        glyph=lambda _: outer_piece,
        stem=((40.0, 40.0), (40.0, 40.0)),
    )
    c = compose.Composer(font, {}, weighted=True)
    c.__dict__["face"] = (0.0, 0.0, 1000.0, 880.0)
    # Predicted inner box does not collide, but floats 120 units above the enclosed room floor (y0=195 vs 75).
    monkeypatch.setattr(c, "_learned_boxes", lambda op, ks, reg: [(0.0, 0.0, 960.0, 840.0), (520.0, 195.0, 960.0, 840.0)])
    monkeypatch.setattr(c, "_host", lambda op, i, *args, **kwargs: (outer_host, 0) if i == 0 else (inner_host, 1))
    monkeypatch.setattr(c, "_enclosed_room", lambda *args: (510.0, 75.0, 960.0, 840.0))
    monkeypatch.setattr(c, "_room", lambda *args: (510.0, 75.0, 960.0, 840.0))
    monkeypatch.setattr(c, "ink", lambda _: 100.0)

    placed = c._learned("⿺", ["風", "率"])
    assert placed is not None and len(placed) == 2
    assert placed[1].target == (510.0, 75.0, 960.0, 840.0)


def test_descend_enclosure_stem_lowers_narrow_stem_but_keeps_wide_bottom() -> None:
    # Outer sweep floor sits at y=-20..0; inner sits high at y=100..800 (v_gap=100u).
    outer_piece = compose.Part([rect(0, -20, 440, 820), rect(0, -20, 960, 0)])
    # Narrow centered stem at bottom (width 40 out of 400 -> low_w=0.10 < 0.25), like 十 in 率.
    stem_inner = compose.Part([rect(520, 300, 920, 800), rect(700, 100, 740, 800)])
    # Wide flat bottom (width 400 out of 400 -> low_w=1.0 >= 0.25), like 口/日/包.
    wide_inner = compose.Part([rect(520, 100, 920, 800)])

    font = SimpleNamespace(own=lambda _: True, has=lambda _: True, glyph=lambda _: outer_piece, stem=((80.0, 80.0), (80.0, 80.0)))
    c = compose.Composer(font, {}, weighted=True)
    region = (0.0, -40.0, 1000.0, 860.0)
    outer_p = [compose.Placed(outer_piece, outer_piece.box, outer_piece.box)]

    stem_p = [compose.Placed(stem_inner, stem_inner.box, stem_inner.box)]
    c._descend_enclosure_stem(outer_p, stem_p, region)
    # Target gap is 0.52 * 80 = 41.6u above y=0, so y0 descends from 100 to ~42.
    assert 30.0 <= stem_p[0].target[1] <= 55.0
    assert stem_p[0].target[3] == 800.0

    wide_p = [compose.Placed(wide_inner, wide_inner.box, wide_inner.box)]
    c._descend_enclosure_stem(outer_p, wide_p, region)
    assert wide_p[0].target == wide_inner.box
