"""Parity rows drawn again in place, the rest of the export left alone."""

import json
from types import SimpleNamespace

import pytest

from han_compose import web_export


def _export(folder, style="kaisho"):
    (folder / "manifest.json").write_text(json.dumps({"style": style}), encoding="utf8")
    rows = [{"c": "木", "s": "木", "d": "M0 0Z"}, {"c": "口", "s": "口", "d": "M1 1Z"}]
    (folder / "parity.json").write_text(json.dumps({"version": "v", "rows": rows}), encoding="utf8")


def test_rows_are_drawn_again_and_the_changes_counted(tmp_path, monkeypatch) -> None:
    _export(tmp_path)
    monkeypatch.setattr(web_export, "_draw", lambda item: ({"c": item[0], "s": item[1], "d": "M0 0Z"}, []))
    composer = SimpleNamespace(font=SimpleNamespace(style=SimpleNamespace(name="kaisho")))
    assert web_export.redraw_parity(composer, tmp_path, log=lambda line: None) == {"parity.json": 1}
    data = json.loads((tmp_path / "parity.json").read_text(encoding="utf8"))
    assert data["version"] == "v" and [row["d"] for row in data["rows"]] == ["M0 0Z", "M0 0Z"]


def test_a_composer_of_another_style_is_refused(tmp_path) -> None:
    _export(tmp_path)
    composer = SimpleNamespace(font=SimpleNamespace(style=SimpleNamespace(name="sans")))
    with pytest.raises(ValueError, match="kaisho export"):
        web_export.redraw_parity(composer, tmp_path)
