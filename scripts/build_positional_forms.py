"""Write the positional forms the browser composer's full-form families are built from.

`data/vocab/han-component-forms.tsv` gives a radical the form it takes in one place (釒 for 金 on
the left). Each such row of the CJKVI radical variants, the simplified ones left out, becomes
`[place, component, form]` in `js/src/positional-forms.json`, in the table's order.

    uv run python scripts/build_positional_forms.py
"""
from __future__ import annotations

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
POSITION = {"left": "L", "right": "R", "top": "T", "bottom": "B"}


def rows() -> list[list[str]]:
    out = []
    for line in (ROOT / "data/vocab/han-component-forms.tsv").read_text(encoding="utf-8").splitlines():
        if line.startswith(("#", "form\t")):
            continue
        form, char, source, detail = line.split("\t")
        kind, _, where = detail.partition(" ")
        if source == "cjkvi-variants" and kind == "radical-variant" and where in POSITION:
            out.append([POSITION[where], char, form])
    return out


def main() -> None:
    found = rows()
    (ROOT / "js/src/positional-forms.json").write_text(
        json.dumps(found, ensure_ascii=False, separators=(",", ":")) + "\n", encoding="utf-8")
    print(f"{len(found)} positional forms")


if __name__ == "__main__":
    main()
