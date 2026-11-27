#!/usr/bin/env python3
"""Build an offline inventory of Yi Bai stroke-chain spellings and guide outlines."""

import argparse
from collections import defaultdict
from functools import lru_cache
from html import unescape
import gzip
import json
from pathlib import Path
import re
import subprocess

LEVELS = ("ids_lv0.txt", "ids_lv1.txt", "ids_lv2.txt")
CHAIN = re.compile(r"#\([^()]+\)")
IDENTITY = re.compile(r"^\s*\{[^}]+\}")
FIGURE = re.compile(r'<div class="text-figure">(.*?)</div>\s*</div>', re.S)
HIGHLIGHT = re.compile(r'<span style="color: gold;">([^<]+)</span>')
DATABASE = "https://github.com/yi-bai/ids"
GUIDE = "https://github.com/NightFurySL2001/bai-ids"
GUIDE_FONT = "fonts/example.woff2"
LOCALE = re.compile(r"(?<!#)\(([^()]*)\)$")
OUTSIDE_COMPONENTS = re.compile(r"#\([^()]+\)|\[[^\]]*\]|[.A-Za-z0-9]+")


def git(repo, *args):
    return subprocess.check_output(["git", "-C", repo, *args], text=True, encoding="utf-8").rstrip("\n")


def occurrences(text):
    for line_number, line in enumerate(text.splitlines(), 1):
        if "#(" not in line:
            continue
        host, tab, descriptions = line.partition("\t")
        if not tab or not host or host.startswith("#"):
            continue
        for column, entry in enumerate(descriptions.split("\t"), 1):
            for variant, sequence in enumerate(entry.split(";"), 1):
                stripped = IDENTITY.sub("", sequence).lstrip()
                for ordinal, match in enumerate(CHAIN.finditer(stripped), 1):
                    yield match[0], (line_number, host, column, variant, ordinal, match.start() == 0, sequence)


def normalized_description(sequence):
    """Read the bare IDS in an upstream row, allowing only explicit defaults."""
    locale = LOCALE.search(sequence)
    if locale:
        sequence = sequence[:locale.start()]
    bare = IDENTITY.sub("", sequence)
    default = sequence == bare and (locale is None or locale[1] == ".")
    nondefault_component = False

    def remove_annotation(match):
        nonlocal nondefault_component
        token = match[0]
        if token.startswith(("#", "[")):
            return token
        if token.strip("."):
            nondefault_component = True
        return ""

    bare = OUTSIDE_COMPONENTS.sub(remove_annotation, bare)
    return bare, default and not nondefault_component


def native_matches(catalog, commit):
    hosts = defaultdict(set)
    primary = {}
    for entry in catalog.values():
        for records in entry["history"].values():
            for host, _, description, *_ in records:
                bare, _ = normalized_description(description)
                hosts[bare].add(host)
        for level, records in entry["current"].items():
            for line, host, column, _, _, _, description in records:
                bare, default = normalized_description(description)
                hosts[bare].add(host)
                if level == LEVELS[0] and column == 1 and default and len(host) == 1:
                    primary[bare] = {
                        "char": host, "source": {
                            "level": level, "line": line, "commit": commit, "rawDescription": description,
                        },
                    }
    return {key: match for key, match in sorted(primary.items()) if len(hosts[key]) == 1}


def guide_references(repo, revision, outlines):
    if outlines:
        from fontTools.pens.boundsPen import BoundsPen
        from fontTools.pens.svgPathPen import SVGPathPen
        from fontTools.ttLib import TTFont
        from io import BytesIO

        font_bytes = subprocess.check_output(["git", "-C", repo, "show", f"{revision}:{GUIDE_FONT}"])
        font = TTFont(BytesIO(font_bytes))
        glyphs = font.getGlyphSet()
        cmap = font.getBestCmap()
    html = git(repo, "show", f"{revision}:index.html")
    out = defaultdict(list)
    for fig in FIGURE.findall(html):
        fields = HIGHLIGHT.findall(fig)
        if len(fields) != 2 or not CHAIN.fullmatch(fields[0]):
            continue
        spelling, pua = fields[0], unescape(fields[1])
        assert len(pua) == 1 and 0xE000 <= ord(pua) <= 0xF8FF, fields
        code = ord(pua)
        reference = {"codePoint": f"U+{code:04X}", "glyph": f"uni{code:04X}"}
        if outlines:
            glyph_id = cmap[code]
            path = SVGPathPen(glyphs)
            bounds = BoundsPen(glyphs)
            glyphs[glyph_id].draw(path)
            glyphs[glyph_id].draw(bounds)
            reference.update({
                "glyph": glyph_id, "bounds": bounds.bounds,
                "path": path.getCommands(), "unitsPerEm": font["head"].unitsPerEm,
            })
        out[spelling].append(reference)
    return dict(out)


def catalogue(ids, ids_ref, guide, guide_ref, outlines):
    ids_head = git(ids, "rev-parse", ids_ref)
    history = git(ids, "rev-list", "--reverse", "--topo-order", ids_head).splitlines()
    data = defaultdict(lambda: {"current": {}, "history": {}})
    revisions = {}
    first_last = {}

    @lru_cache(maxsize=3)
    def scan_blob(oid):
        return tuple(occurrences(git(ids, "cat-file", "blob", oid)))

    for commit in history:
        revisions[commit] = git(ids, "show", "-s", "--format=%aI", commit)
        previous_keys = set()
        for level in LEVELS:
            tree = git(ids, "ls-tree", commit, "--", level)
            if not tree:
                continue
            oid = tree.split()[2]
            for chain, record in scan_blob(oid):
                datum = data[chain]
                if commit == ids_head:
                    datum["current"].setdefault(level, []).append(record)
                _, host, _, _, _, whole, description = record
                key = (chain, level, host, whole, description)
                if key not in previous_keys:
                    if key not in first_last:
                        first_last[key] = [commit, commit, 0]
                    first_last[key][1] = commit
                    first_last[key][2] += 1
                    previous_keys.add(key)

    for (chain, level, host, whole, description), (first, last, count) in first_last.items():
        data[chain]["history"].setdefault(level, []).append((host, whole, description, first, last, count))

    guide_metadata = None
    if guide is not None:
        revision = git(guide, "rev-parse", guide_ref)
        guide_metadata = {
            "repository": GUIDE, "commit": revision, "path": GUIDE_FONT,
            "license": "OFL-1.1", "copyright": "© 2024–2025 -PT_AxH_RV-",
            "mapping": "index.html, section 5.1, examples",
        }
        for chain, refs in guide_references(guide, revision, outlines).items():
            data[chain]["guideReferences"] = refs

    return {
        "database": {"repository": DATABASE, "commit": ids_head, "license": "MIT", "revisions": revisions},
        "guideFont": guide_metadata,
        "schema": {
            "current": ["line", "host", "column", "variant", "ordinal", "whole", "rawDescription"],
            "history": ["host", "whole", "rawDescription", "firstCommit", "lastCommit", "commitCount"],
        },
        "chains": dict(sorted(data.items())),
        "native": native_matches(data, ids_head),
    }


def compact_indexes(catalog):
    commits = list(catalog["database"]["revisions"])
    revisions = {revision: index for index, revision in enumerate(commits)}
    chain_index = {}
    for key, entry in catalog["chains"].items():
        historical = [record for records in entry["history"].values() for record in records]
        if historical:
            first = min(revisions[record[3]] for record in historical)
            last = max(revisions[record[4]] for record in historical)
        else:
            first = last = None
        levels = [LEVELS.index(level) for level in entry["current"]]
        guides = [ref["codePoint"] for ref in entry.get("guideReferences", [])]
        chain_index[key] = [first, last, levels, guides]
    return {
        "commit": catalog["database"]["commit"],
        "revisions": commits,
        "guideFont": catalog["guideFont"],
        "chains": chain_index,
        "native": {key: [entry["char"], entry["source"]["line"], entry["source"]["rawDescription"]]
                   for key, entry in catalog["native"].items()},
    }


def write_json(path, data):
    serialized = (json.dumps(data, ensure_ascii=False, separators=(",", ":")) + "\n").encode("utf-8")
    if path.suffix == ".gz":
        with path.open("wb") as file, gzip.GzipFile(filename="", mode="wb", fileobj=file, mtime=0) as compressed:
            compressed.write(serialized)
    else:
        path.write_bytes(serialized)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--ids", type=Path, required=True, help="local yi-bai/ids Git checkout")
    parser.add_argument("--ids-ref", default="2597437b928e8d530b7ae09cf53fe5ec7868569c")
    parser.add_argument("--guide", type=Path, help="local NightFurySL2001/bai-ids Git checkout")
    parser.add_argument("--guide-ref", default="104501af0875a8ee9ce6cfbf41c2e1afae0762ee")
    parser.add_argument("--guide-outlines", action="store_true", help="extract guide font SVG paths for separate reference proofs")
    parser.add_argument("--runtime", type=Path, help="output the compact native and historical lookup indexes")
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    result = catalogue(args.ids, args.ids_ref, args.guide, args.guide_ref, args.guide_outlines)
    write_json(args.output, result)
    if args.runtime:
        write_json(args.runtime, compact_indexes(result))


if __name__ == "__main__":
    main()
