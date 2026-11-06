import numpy as np

from han_compose import compose as C


def box(x0, y0, x1, y1):
    points = np.array([[x0, y0], [x1, y0], [x1, y1], [x0, y1]], dtype=float)
    ops = [("moveTo", 1, False), ("lineTo", 1, False), ("lineTo", 1, False), ("lineTo", 1, False)]
    return C.Contour(ops, points, points.copy())


def placed(*contours):
    part = C.Part(list(contours))
    return C.Placed(part, part.box, part.box)


def composer():
    return C.Composer(None, {}, weighted=False)


def test_a_bar_under_a_cover_is_narrowed_and_centred():
    cover = placed(box(100, 500, 900, 700))
    bar, stem, foot = box(50, 400, 950, 480), box(480, 80, 520, 400), box(50, 0, 950, 80)
    lower = placed(bar, stem, foot)
    c = composer()

    C._fit_under_cover("⿱", ["宀", "X"], [[cover], [lower]])

    xs = [p[:, 0] for p in lower.contours()]
    width = max(x.max() for x in xs) - min(x.min() for x in xs)
    bar_points = lower.contours()[0]
    assert bar_points[:, 0].max() - bar_points[:, 0].min() == C.COVER_BAR * 800
    assert (bar_points[:, 0].max() + bar_points[:, 0].min()) / 2 == 500
    assert width == 900  # the stem below keeps the part's full extent


def test_a_middle_cover_in_a_stack_fits_the_part_below_it():
    top = placed(box(100, 800, 900, 950))
    cover = placed(box(100, 500, 900, 700))
    lower = placed(box(50, 400, 950, 480), box(480, 0, 520, 400))
    c = composer()

    C._fit_under_cover("⿳", ["X", "冖", "Y"], [[top], [cover], [lower]])

    bar_points = lower.contours()[0]
    assert bar_points[:, 0].max() - bar_points[:, 0].min() == C.COVER_BAR * 800
    assert (bar_points[:, 0].max() + bar_points[:, 0].min()) / 2 == 500


def test_a_part_under_a_non_cover_keeps_its_bar():
    above = placed(box(100, 500, 900, 700))
    lower = placed(box(50, 400, 950, 480), box(480, 0, 520, 400))
    c = composer()

    C._fit_under_cover("⿱", ["木", "X"], [[above], [lower]])

    assert lower.contours()[0][:, 0].min() == 50
    assert lower.contours()[0][:, 0].max() == 950


def test_a_mid_height_bar_under_a_cover_is_kept():
    cover = placed(box(100, 500, 900, 700))
    lower = placed(box(50, 200, 950, 280), box(480, 0, 520, 480))
    c = composer()

    C._fit_under_cover("⿱", ["宀", "X"], [[cover], [lower]])

    assert lower.contours()[0][:, 0].min() == 50
    assert lower.contours()[0][:, 0].max() == 950


def test_the_first_lower_bar_of_宇_is_narrowed():
    cover = placed(box(80, 700, 842, 900))
    lower = placed(box(135, 564, 873, 636), box(57, 336, 944, 408), box(475, 408, 525, 636))
    c = composer()

    C._fit_under_cover("⿱", ["宀", "于"], [[cover], [lower]])

    bar = lower.contours()[0]
    width = bar[:, 0].max() - bar[:, 0].min()
    assert round(width, 2) == round(0.72 * 762, 2)
    assert round((bar[:, 0].max() + bar[:, 0].min()) / 2, 2) == 461
