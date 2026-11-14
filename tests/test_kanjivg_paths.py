"""KanjiVG's stroke paths as sampled centrelines."""

from __future__ import annotations

import numpy as np

from han_compose.kanjivg_cuts import Entry, Group, sample_path


def test_line_is_sampled_evenly_from_its_start():
    points = sample_path("M0,0L11,22")
    assert points.shape == (12, 2)
    np.testing.assert_allclose(points[:, 0], np.arange(12))
    np.testing.assert_allclose(points[:, 1], 2 * np.arange(12))


def test_cubic_runs_from_its_start_to_its_end():
    points = sample_path("M10,20C10,40 50,40 50,20")
    assert points.shape == (12, 2)
    np.testing.assert_array_equal(points[0], [10, 20])
    np.testing.assert_allclose(points[-1], [50, 20])
    # Halfway along, the curve is at the mean of its ends in x and three quarters of the way to its controls in y.
    np.testing.assert_allclose(sample_path("M10,20C10,40 50,40 50,20", steps=3)[1], [30, 35])


def test_relative_commands_draw_what_absolute_ones_do():
    absolute = sample_path("M10,20C12,24 16,28 20,30S30,34 34,30L40,40")
    relative = sample_path("m10,20c2,4 6,8 10,10s10,4 14,0l6,10")
    np.testing.assert_allclose(relative, absolute)


def test_smooth_curve_mirrors_the_control_before_it():
    smooth = sample_path("M0,0C0,10 10,10 10,0S20,-10 20,0")
    spelled = sample_path("M0,0C0,10 10,10 10,0C10,-10 20,-10 20,0")
    np.testing.assert_allclose(smooth, spelled)


def test_entry_samples_its_strokes_when_first_read():
    entry = Entry(Group("一", None, [0]), ["M0,0L11,0"])
    assert "paths" not in vars(entry)
    assert [len(path) for path in entry.paths] == [12]
    assert entry.paths is entry.paths
