from types import SimpleNamespace

import numpy as np

from han_compose import compose as C


def test_a_part_squeezed_into_a_narrow_box_grows_past_the_heavy_master():
    contour = C.Contour(
        [("moveTo", 1, False), ("lineTo", 1, False), ("lineTo", 1, False), ("lineTo", 1, False)],
        np.array([[0.0, 0.0], [40.0, 100.0], [40.0, 0.0], [0.0, 100.0]]),
        np.array([[0.0, 0.0], [40.0, 100.0], [40.0, 0.0], [0.0, 100.0]]),
        width=(5.0, 5.0),
    )
    part = C.Part([contour])
    placed = C.Placed(part, part.box, (0.0, 0.0, 4.0, 100.0), native=1000.0)
    font = SimpleNamespace(stem=((10.0, 20.0), (10.0, 20.0)), width=lambda density, axis: 100.0)
    composer = C.Composer(font, {}, weighted=True)
    composer.ink = lambda *args, **kwargs: 1000.0

    composer._balance([placed])

    assert placed.weight == (C.WEIGHT_GROWTH, C.WEIGHT_GROWTH)
    assert C.WEIGHT_GROWTH > 1.0
