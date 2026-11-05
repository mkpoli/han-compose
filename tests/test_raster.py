"""The Rust kernels against the array arithmetic they must reproduce bit for bit: an export's bytes
depend on these masks and rings."""

from __future__ import annotations

import numpy as np

from han_compose import compose


def _fill_by_arrays(rings: list[np.ndarray], size: int, box: tuple[float, float, float, float]) -> np.ndarray:
    x0, y0, x1, y1 = box
    xs = x0 + (np.arange(size) + 0.5) * (x1 - x0) / size
    ys = y1 - (np.arange(size) + 0.5) * (y1 - y0) / size
    if not rings:
        return np.zeros((size, size), bool)
    a = np.concatenate(rings)
    b = np.concatenate([np.roll(r, -1, axis=0) for r in rings])
    y = ys[:, None]
    up = (a[None, :, 1] <= y) & (b[None, :, 1] > y)
    rows, edges = np.nonzero(up | ((a[None, :, 1] > y) & (b[None, :, 1] <= y)))
    if not len(rows):
        return np.zeros((size, size), bool)
    p, q = a[edges], b[edges]
    x = p[:, 0] + (ys[rows] - p[:, 1]) * (q[:, 0] - p[:, 0]) / (q[:, 1] - p[:, 1])
    delta = np.zeros((size, size + 1), np.int32)
    np.add.at(delta, (rows, np.searchsorted(xs, x, side="right")), np.where(up[rows, edges], 1, -1))
    return np.cumsum(delta[:, :size], axis=1) != 0


def test_a_mask_matches_the_array_arithmetic_on_random_polygons() -> None:
    random = np.random.default_rng(5)
    for size in (40, 96, 200):
        for _ in range(200):
            rings = [random.uniform(-200, 1200, (random.integers(3, 40), 2)) for _ in range(random.integers(1, 5))]
            box = (float(random.uniform(-100, 300)), float(random.uniform(-100, 300)), float(random.uniform(400, 1000)), float(random.uniform(400, 1000)))
            assert (compose.fill(rings, size, box) == _fill_by_arrays(rings, size, box)).all()


def test_a_mask_counts_edges_on_pixel_centres_as_the_arithmetic_does() -> None:
    # Vertices exactly on row and column centres, and a horizontal edge along a row.
    ring = np.array([[5.0, 5.0], [15.0, 5.0], [15.0, 15.0], [5.0, 15.0]])
    assert (compose.fill([ring], 20, (0.0, 0.0, 20.0, 20.0)) == _fill_by_arrays([ring], 20, (0.0, 0.0, 20.0, 20.0))).all()
    half = ring + 0.5
    assert (compose.fill([half], 20, (0.0, 0.0, 20.0, 20.0)) == _fill_by_arrays([half], 20, (0.0, 0.0, 20.0, 20.0))).all()


def test_a_mask_of_nothing_is_empty_and_a_flat_box_does_not_fail() -> None:
    assert not compose.fill([], 8, (0.0, 0.0, 1.0, 1.0)).any()
    ring = np.array([[0.0, 0.0], [1.0, 0.0], [1.0, 1.0]])
    assert (compose.fill([ring], 8, (0.5, 0.5, 0.5, 0.5)) == _fill_by_arrays([ring], 8, (0.5, 0.5, 0.5, 0.5))).all()
