#!/usr/bin/env python3
"""Extract centerlines selected from the named records in a GlyphWiki dump."""

import argparse
import hashlib
import json
import math
from pathlib import Path

STEPS = 16


def points(a, b):
    return [(a[0] + (b[0] - a[0]) * step / STEPS,
             a[1] + (b[1] - a[1]) * step / STEPS) for step in range(STEPS + 1)]


def curve(points, t):
    while len(points) > 1:
        points = [(a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t)
                  for a, b in zip(points, points[1:])]
    return points[0]


def stroke(program):
    kind, _, _, *coords = map(int, program.split(":"))
    vertices = list(zip(coords[::2], coords[1::2]))
    if kind == 1:
        return vertices[:2]
    if kind == 7:
        return points(*vertices[:2])[:-1] + [curve(vertices[1:4], i / STEPS) for i in range(STEPS + 1)]
    if kind in (2, 6):
        end = 3 if kind == 2 else 4
        return [curve(vertices[:end], i / STEPS) for i in range(STEPS + 1)]
    raise ValueError(f"Unsupported source stroke {program}")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--dump", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()

    plan = json.loads(Path(__file__).with_name("recorded-arc-cuts.json").read_text())
    names = {entry[2] for entry in plan.values()}
    programs = {}
    digest = hashlib.sha256()
    with args.dump.open("rb") as dump:
        for raw in dump:
            digest.update(raw)
            fields = raw.decode().split("|", 2)
            if len(fields) == 3 and fields[0].strip() in names:
                programs[fields[0].strip()] = fields[2].strip().split("$")

    entries = {}
    for key, (host, variant, source, indices) in plan.items():
        paths = []
        for index in indices:
            samples = stroke(programs[source][index])
            # Convert KAGE's y-down coordinates to the composer's y-up coordinates.
            distinct = [samples[0]] + [b for a, b in zip(samples, samples[1:])
                                       if math.dist(a, b) > 1e-8]
            paths.append([round(v, 3) for x, y in distinct for v in (x, -y)])
        entries[key] = [host, variant, source, paths]
    args.output.write_text(json.dumps({
        "source": {
            "site": "https://glyphwiki.org",
            "dump": "https://glyphwiki.org/dump.tar.gz",
            "dumpSha256": digest.hexdigest(),
            "license": "LicenseRef-GlyphWiki",
            "idsRevision": "2597437b928e8d530b7ae09cf53fe5ec7868569c",
        },
        "entries": entries,
    }, ensure_ascii=False, separators=(",", ":")) + "\n")


if __name__ == "__main__":
    main()
