"""The benchmark's sets and its aligned overlap."""

from __future__ import annotations

import sys
from pathlib import Path

import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "scripts"))

import compose_ids

from han_compose import compose


def _square(x: float, y: float, side: float) -> compose.Placed:
    points = np.array([[x, y], [x + side, y], [x + side, y + side], [x, y + side]], float)
    contour = compose.Contour([("moveTo", 1, False), ("lineTo", 1, False), ("lineTo", 1, False), ("lineTo", 1, False)], points, points)
    part = compose.Part([contour])
    return compose.Placed(part, part.box, part.box)


def test_the_benchmark_sets_are_apart_and_every_character_has_a_sequence() -> None:
    sets = compose_ids._bench_sets()
    assert set(sets) == {"tracking", "hard"}
    assert not set(sets["tracking"]) & set(sets["hard"])
    sequences = compose.japanese_sequences()
    assert all(char in sequences for chars in sets.values() for char in chars)


def test_aligned_overlap_scores_the_shape_wherever_it_stands() -> None:
    real, moved = [_square(100, 100, 300)], [_square(500, 500, 300)]
    assert compose_ids._aligned_overlap(moved, real, 96) == 1.0
    assert not (compose.raster(moved, 96) & compose.raster(real, 96)).any()


def test_aligned_overlap_still_sees_a_different_shape() -> None:
    real = [_square(100, 100, 300)]
    two = [_square(100, 100, 100), _square(300, 300, 100)]
    assert compose_ids._aligned_overlap(two, real, 96) < 0.5


def test_aligned_overlap_fills_each_part_apart() -> None:
    square = _square(100, 100, 300)
    points = square.part.contours[0].light[::-1].copy()
    ops = square.part.contours[0].ops
    reversed_part = compose.Part([compose.Contour(ops, points, points)])
    reversed_square = compose.Placed(reversed_part, reversed_part.box, reversed_part.box)
    assert compose_ids._aligned_overlap([square, reversed_square], [square], 96) == 1.0


def test_a_set_with_nothing_drawn_still_reports() -> None:
    assert compose_ids._bench_summary([{"char": "甲"}]) == {"characters": 1, "drawn": 0, "failed_characters": "甲"}
