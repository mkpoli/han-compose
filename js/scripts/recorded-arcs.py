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
    if kind == 3:
        return vertices[:3]
    if kind == 7:
        return points(*vertices[:2])[:-1] + [curve(vertices[1:4], i / STEPS) for i in range(STEPS + 1)]
    if kind in (2, 6):
        end = 3 if kind == 2 else 4
        return [curve(vertices[:end], i / STEPS) for i in range(STEPS + 1)]
    raise ValueError(f"Unsupported source stroke {program}")


def polygon_vertices(edges):
    """Intersect adjacent KAGE centerlines at their shared mitred corners."""
    def cross(a, b):
        return a[0] * b[1] - a[1] * b[0]

    if len(edges) < 3 or any(math.dist(a, b) < 1e-8 for a, b in edges):
        raise ValueError("Source polygon requires three or more nonzero edges")
    vertices = []
    for previous, current in zip(edges[-1:] + edges[:-1], edges):
        a, b = previous
        c, d = current
        ab = (b[0] - a[0], b[1] - a[1])
        cd = (d[0] - c[0], d[1] - c[1])
        determinant = cross(ab, cd)
        if abs(determinant) < 1e-8:
            raise ValueError("Source polygon has parallel adjacent edges")
        t = cross((c[0] - a[0], c[1] - a[1]), cd) / determinant
        vertices.extend([round(a[0] + ab[0] * t, 3), round(-a[1] - ab[1] * t, 3)])
    corners = list(zip(vertices[::2], vertices[1::2]))
    turns = []
    for i, corner in enumerate(corners):
        prev, after = corners[i - 1], corners[(i + 1) % len(corners)]
        turns.append(cross((corner[0] - prev[0], corner[1] - prev[1]),
                           (after[0] - corner[0], after[1] - corner[1])))
    if not (all(t > 0 for t in turns) or all(t < 0 for t in turns)):
        raise ValueError("Source polygon needs distinct, strictly convex corners")
    return vertices


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
    for key, (host, variant, source, indices, *shape) in plan.items():
        paths = []
        edges = []
        for index in indices:
            program = programs[source][index]
            samples = stroke(program)
            if shape == ["polygon"]:
                corners = samples if program.startswith("3:") else [samples[0], samples[-1]]
                edges.extend(zip(corners, corners[1:]))
                continue
            # Convert KAGE's y-down coordinates to the composer's y-up coordinates.
            distinct = [samples[0]] + [b for a, b in zip(samples, samples[1:])
                                       if math.dist(a, b) > 1e-8]
            paths.append([round(v, 3) for x, y in distinct for v in (x, -y)])
        entries[key] = [host, variant, source, [polygon_vertices(edges)] if edges else paths, *shape]
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
