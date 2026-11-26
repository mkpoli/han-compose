"""Explicit IDS choices for the Chinese and Japanese centers and dot pairs of 率."""
from functools import cache
import json
from pathlib import Path
import re

_DIR = Path(__file__).parent
_CATALOGUE = json.loads((_DIR / "catalogue.json").read_text(encoding="utf-8"))
_OPTIONS = {host: {shape: template.replace("@", root) for shape, root in _CATALOGUE["shapes"].items()}
            for host, template in _CATALOGUE["hosts"].items()}
_EXACT = {text: (host, i) for host, choices in _OPTIONS.items() for i, text in enumerate(choices.values())}
_HOST = {text: host for text, (host, _) in _EXACT.items()}
for host, template in _CATALOGUE["hosts"].items():
    _HOST[host] = _HOST[template.replace("@", "率")] = host
    for selector in _CATALOGUE["selectors"].get(host, ""):
        _HOST[host + selector] = host


def contains_rate_form(text: str) -> bool:
    return any(root in text for root in _CATALOGUE["shapes"].values())


def rate_forms_for(text: str) -> dict[str, str]:
    """Four shape IDs mapped to their persistable IDS spellings, or an empty mapping."""
    return dict(_OPTIONS.get(_HOST.get(text), {}))


@cache
def _face(style):
    return json.loads((_DIR / f"{style}.json").read_text(encoding="utf-8"))


@cache
def _part(style, host, cell):
    import numpy as np
    from ..compose import Contour, Part

    face = _face(style)
    contours = []
    names = {"M": "moveTo", "L": "lineTo", "C": "curveTo", "Q": "qCurveTo"}
    for index in face["forms"][host][cell]:
        commands, coords = face["contours"][index]
        ops = [(names[op], 3 if op == "C" else int(count or 1), False)
               for op, count in re.findall(r"([MLCQ])(\d*)", commands)]
        points = np.fromstring(coords, sep=" ").reshape(-1, 2)
        contours.append(Contour(ops, points, points))
    return Part(contours)


def rate_part(text, style, exclude, *, metric=False):
    selected = _EXACT.get(text)
    if selected and selected[0] not in exclude and style in {"sans", "serif", "fangsong", "pen-writing", "regular"}:
        return _part(style, selected[0], 0 if metric else selected[1])
    return None
