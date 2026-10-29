from __future__ import annotations

import numpy as np

from han_compose.compose import Contour, Part, cover_stack_pieces


def square(x0: float, y0: float, x1: float, y1: float) -> Contour:
    light = np.array([[x0, y0], [x1, y0], [x1, y1], [x0, y1]], dtype=float)
    ops = [("moveTo", 1, False), ("lineTo", 1, False), ("lineTo", 1, False), ("lineTo", 1, False)]
    return Contour(ops, light, light.copy())


def test_a_cover_in_a_stack_is_cut_by_region() -> None:
    top = square(0, 600, 900, 800)
    cover = square(50, 450, 850, 520)
    left, right = square(0, 0, 400, 300), square(500, 0, 900, 300)
    pieces = cover_stack_pieces(Part([top, cover, left, right]))
    assert pieces is not None
    assert [len(p.contours) for p in pieces] == [1, 1, 2]
    assert [tuple(round(v) for v in p.box) for p in pieces] == [
        (0, 600, 900, 800), (50, 450, 850, 520), (0, 0, 900, 300)]


def test_no_thin_wide_stroke_leaves_the_stack_uncut() -> None:
    pieces = cover_stack_pieces(Part([square(0, 500, 900, 800), square(0, 200, 900, 500), square(0, 0, 900, 150)]))
    assert pieces is None


def test_a_stroke_crossing_the_cover_bottom_goes_with_the_lower_part() -> None:
    top = square(0, 600, 1000, 800)
    cover = square(100, 450, 900, 510)
    left, right = square(0, 0, 450, 300), square(500, 0, 900, 300)
    crossing = square(950, 400, 1000, 520)
    pieces = cover_stack_pieces(Part([top, cover, left, right, crossing]))
    assert pieces is not None
    assert [len(p.contours) for p in pieces] == [1, 1, 3]


def test_cover_stack_host_returns_pieces_only_when_every_check_passes() -> None:
    from types import SimpleNamespace

    from han_compose.compose import Composer

    part = Part([square(0, 600, 1000, 800), square(100, 450, 900, 510),
                 square(0, 0, 450, 300), square(500, 0, 900, 300), square(950, 400, 1000, 520)])
    tree = ("⿳", "X", "冖", "Y")

    def fake(traded: bool = False, like: bool = True) -> SimpleNamespace:
        return SimpleNamespace(
            font=SimpleNamespace(glyph=lambda ch: part),
            _traded=lambda pieces, operands: traded,
            _kept=lambda piece, operand: True,
            _counted=lambda piece, op, k, operand: True,
            _like_fellows=lambda piece, place, operand: like,
            slot=lambda op, k: ("T", "M", "B")[k],
        )

    host = Composer._cover_stack_host(fake(), "X", tree, (), True)
    assert host is not None
    assert [len(p.contours) for p in host.pieces] == [1, 1, 3]
    assert Composer._cover_stack_host(fake(traded=True), "X", tree, (), True) is None
    assert Composer._cover_stack_host(fake(like=False), "X", tree, (), True) is None
    assert Composer._cover_stack_host(fake(like=False), "X", tree, (), False) is not None
