import numpy as np

from han_compose import compose as C


def rect(x0, y0, x1, y1) -> C.Part:
    points = np.array([[x0, y0], [x1, y0], [x1, y1], [x0, y1]], dtype=float)
    return C.Part([C.Contour((), points, points, None)])


def placed(x0, y0, x1, y1) -> C.Placed:
    part = rect(x0, y0, x1, y1)
    return C.Placed(part, part.box, part.box, native=0.0)


def test_the_property_follows_the_sequence():
    covers = C.covers()
    assert {"冖", "宀", "穴", "雨", "龸", "𤇾", "𫇦", "𰃮", "𦥯"} <= covers
    assert "木" not in covers


def test_a_middle_cover_closes_on_both_neighbours():
    top = placed(0, 500, 900, 800)
    cover = placed(0, 350, 900, 450)
    lower = placed(0, -50, 900, 300)
    groups = [[top], [cover], [lower]]
    C._fit_under_cover("⿳", ["大", "冖", "牛"], groups)
    assert cover.target[1] > 350
    assert lower.target[1] > -50
    assert lower.target[3] > 300


def test_a_compound_top_leaves_the_cover_where_it_is():
    top = placed(0, 500, 900, 800)
    cover = placed(0, 350, 900, 450)
    lower = placed(0, -50, 900, 300)
    groups = [[top], [cover], [lower]]
    C._fit_under_cover("⿳", [("⿱", "艹", "罒"), "冖", "瓦"], groups)
    assert cover.target[1] == 350


def test_a_derived_cover_narrows_the_bar_under_it():
    cover = placed(100, 500, 800, 700)
    bar = rect(0, 250, 900, 300)
    body = rect(0, 0, 900, 250)
    lower = C.Placed(C.Part([bar.contours[0], body.contours[0]]), (0, 0, 900, 300), (0, 0, 900, 300), native=0.0)
    C._fit_under_cover("⿱", ["龸", "木"], [[cover], [lower]])
    contour = lower.part.contours[0].light
    width = contour[:, 0].max() - contour[:, 0].min()
    assert 0.6 * 700 <= width <= 0.75 * 700
