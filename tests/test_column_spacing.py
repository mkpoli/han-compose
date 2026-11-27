import numpy as np
import pytest

from han_compose import compose as C


def column(x, width, solid=False):
    spans = [(0, width)] if solid else [(0, width / 4), (width * .75, width)]
    contours = []
    for left, right in spans:
        pts = np.array([[left, 0], [right, 0], [right, 700], [left, 700]])
        ops = (("moveTo", 1, False),) + (("lineTo", 1, False),) * 3
        contours.append(C.Contour(ops, pts, pts, None))
    part = C.Part(contours)
    return C.Placed(part, part.box, (x, 0, x + width, 700))


@pytest.mark.parametrize("style", ["serif", "pen-writing"])
def test_three_columns_keep_their_weight_ratio_and_outer_ink(style):
    parts = [column(x, 240) for x in (0, 360, 720)]
    a, b, c = parts
    C._settle_columns([[[a], [b], [c]], [[a, b], [c]]], parts, C.COLUMN_CLEARANCE[style])
    assert [p.target[2] - p.target[0] for p in parts] == pytest.approx([254.4] * 3)
    assert b.target[0] - a.target[2] == pytest.approx(c.target[0] - b.target[2])
    assert (a.target[0], a.target[1], c.target[2], c.target[3]) == pytest.approx((0, 0, 960, 700))


@pytest.mark.parametrize("origin", ["learned 賦", "teacher 賦"])
def test_leaves_sparse_strokes_and_native_pairs_alone(origin):
    a, b = column(0, 100), column(600, 250)
    a.origin = b.origin = origin
    for right in (b, column(650, 100, solid=True)):
        original = a.target, right.target
        C._settle_columns([[[a], [right]]], [a, right], C.COLUMN_CLEARANCE["serif"])
        assert (a.target, right.target) == original


def test_a_mask_belongs_to_the_entire_row():
    a, b, mask = column(0, 300), column(600, 300), column(50, 100)
    mask.cut = True
    original = a.target, b.target
    C._settle_columns([[[a], [b]]], [a, b, mask], C.COLUMN_CLEARANCE["serif"])
    assert (a.target, b.target) == original
