"""Read the Yi Bai IDS Git history and write a catalogue of equivalent chain spellings.

The stroke and endpoint conventions come from NightFurySL2001,
（白式）IDS 延展语法导论 §5, 2026-03-20,
https://nightfurysl2001.github.io/bai-ids/. Earlier notations are read against
the source migrations in 629d0b74, 078797d2, and b0681898 in yi-bai/ids (MIT).
"""
from __future__ import annotations

import argparse
from collections import defaultdict
from itertools import accumulate, chain, permutations, product
from bisect import bisect_right
import json
from pathlib import Path
import re
import subprocess

PIN = "2597437b928e8d530b7ae09cf53fe5ec7868569c"
FILES = ("ids_lv0.txt", "ids_lv1.txt", "ids_lv2.txt")
SOURCE = "https://github.com/yi-bai/ids"
CHAIN = re.compile(r"#\([^()\s]+\)")
LETTERS = dict(zip("HSPNDTJ", "一丨丿乀丶㇀㇝")) | {
    "SZ": "㇘", "HP": "㇇", "SHw": "㇄", "SH": "𠃊",
    "HSHw": "㇍", "HSHWg": "㇈", "HSHwg": "㇈",
}
TURNS = dict(zip("abcdwxyz", ("◝", "◞", "◟", "◜", "-◜", "-◟", "-◞", "-◝")))
TOKEN = re.compile(r"(-?)(Q[abcdwxyz]|HSH[Ww]g|HSHw|SHw|SH|SZ|HP|[HSPNDTJ]|[^\x00-\x7f])(?:x(\d+)|b)?")
OLD = re.compile(r"([^>^v]*?)([>^v]+)((?:,\d+[>^vx]\d+)*)")
JOINS = {">": (1, 0), "v": (1, 1), "^": (0, 0)}


def git(repo, *args):
    return subprocess.check_output(["git", "-C", repo, *args], encoding="utf8")


def strokes(text):
    matches = list(TOKEN.finditer(text))
    if "".join(m[0] for m in matches) != text or not matches:
        return None
    result = []
    for reversed_, glyph, cross in (m.groups() for m in matches):
        if glyph.startswith("Q"):
            glyph = TURNS[glyph[1]]
        result.append((
            LETTERS.get(glyph, glyph.removeprefix("-")),
            bool(reversed_) ^ glyph.startswith("-"),
            None if cross is None else int(cross),
        ))
    return result


def connections(text):
    """Stroke labels, joined endpoints and crossed stroke pairs."""
    body = text[2:-1]
    old = OLD.fullmatch(body)
    joins, crosses = [], []
    if old:
        parts = strokes(old[1].replace(",", ""))
        if not parts:
            return None
        relations = [(i, op, i + 1) for i, op in enumerate(old[2])]
        relations += [(int(a), op, int(b)) for a, op, b in re.findall(r",(\d+)([>^vx])(\d+)", old[3])]
        for a, op, b in relations:
            if max(a, b) >= len(parts):
                return None
            if op == "x":
                crosses.append((a, b))
            else:
                start, end = JOINS[op]
                joins.append(((a, start ^ parts[a][1]), (b, end ^ parts[b][1])))
    else:
        # Compact pre-15.1 crossings took two successive two-digit elementary
        # stroke indices. In these rows HP counts as two elementary strokes.
        numbers = None if re.search(r"x\d", re.sub("Q[abcdwxyz]", "", body)) else re.search(r"(?:\d{4})+$", body)
        if numbers:
            body = body[:numbers.start()]
        closed = body.endswith("z") and not body.endswith("Qz")
        parts = strokes(body[:-1] if closed else body)
        if not parts:
            return None
        adjacent = list(zip(range(len(parts) - 1), range(1, len(parts))))
        if closed:
            adjacent.append((len(parts) - 1, 0))
        joins = [((a, 1 ^ parts[a][1]), (b, int(parts[b][1]))) for a, b in adjacent]
        crosses = [(i, cross) for i, (_, _, cross) in enumerate(parts) if cross is not None]
        if numbers:
            end_indices = list(accumulate(2 if glyph == "㇇" else 1 for glyph, _, _ in parts))
            numbering = [int(numbers[0][i:i + 2]) for i in range(0, len(numbers[0]), 2)]
            if max(numbering) >= end_indices[-1]:
                return None
            pairs = [bisect_right(end_indices, index) for index in numbering]
            crosses += list(zip(pairs[::2], pairs[1::2]))
    if any(a >= len(parts) or b >= len(parts) for a, b in crosses):
        return None

    points = [{(i, end)} for i in range(len(parts)) for end in (0, 1)]
    for a, b in joins:
        meeting = [point for point in points if a in point or b in point]
        points = [point for point in points if point not in meeting] + [set.union(*meeting)]
    return [glyph for glyph, _, _ in parts], [point for point in points if len(point) > 1], crosses


def equivalent(old, new):
    a, b = connections(old), connections(new)
    if not a or not b or sorted(a[0]) != sorted(b[0]):
        return False
    labels = sorted(set(a[0]))
    groups = [[i for i, glyph in enumerate(a[0]) if glyph == label] for label in labels]
    orders = [permutations(i for i, glyph in enumerate(b[0]) if glyph == label) for label in labels]
    joins, crosses = {frozenset(point) for point in b[1]}, {frozenset(pair) for pair in b[2]}
    for order in product(*orders):
        match = dict(chain.from_iterable(zip(g, p) for g, p in zip(groups, order)))
        if {frozenset((match[i], end) for i, end in point) for point in a[1]} == joins and {
            frozenset(match[i] for i in pair) for pair in a[2]
        } == crosses:
            return True
    return False


def revisions(repo, pin):
    current = {seq for file in FILES for seq in CHAIN.findall(git(repo, "show", f"{pin}:{file}"))}
    commits = git(repo, "rev-list", "--reverse", pin).splitlines()
    attestations = defaultdict(set)
    changes = defaultdict(lambda: defaultdict(set))
    for commit in commits[1:]:
        parent = git(repo, "rev-parse", commit + "^").strip()
        diff = git(repo, "diff", "-U0", "--no-renames", parent, commit, "--", *FILES)
        removed, inserted = defaultdict(set), defaultdict(set)
        file = ""
        for line in diff.splitlines():
            if line.startswith("diff --git"):
                file = line.rsplit("/", 1)[-1]
            if line[:1] not in ("-", "+") or "#(" not in line:
                continue
            host, _, descriptions = line[1:].partition("\t")
            for description in re.split(r"[\t;]", descriptions):
                spelling = tuple(CHAIN.findall(description))
                if spelling:
                    added = line[0] == "+"
                    for token in spelling:
                        attestations[token].add((commit if added else parent, file, host, description))
                    table = inserted if added else removed
                    table[(file, host, CHAIN.sub("□", description))].add(spelling)
        for (file, host, context), before in removed.items():
            after = inserted.get((file, host, context))
            if not after or len(before) != 1 or len(after) != 1:
                continue
            for old, new in zip(next(iter(before)), next(iter(after))):
                if old != new:
                    changes[old][new].add((commit, file, host, context))

    # 𠆭 retains the same chain in the lowest band as the two upper operands
    # change from an enclosure to a three-part stack at the syntax migration.
    # Bind this transition to the exact witness rows before comparing its graph.
    change = "078797d2"
    host = "𠆭"
    file = FILES[0]
    old = "#(丨,Qb,Qc,Qd,Qa,Qb,Qa,Qb,Qa>>>>>>>>,0x4)"
    new = "#(丨x4QbQcQdQaQbQaQbQa)"
    before = f"{host}\t⿱⿵人.二{old}"
    after = f"{host}\t⿳人.二{new}\t⿳亼.一{new}"
    evidence = git(repo, "diff", "-U0", change + "^", change, "--", file).splitlines()
    if "-" + before in evidence and "+" + after in evidence:
        changes[old][new].add((git(repo, "rev-parse", change).strip(), file, host, "lowest band"))
    return current, attestations, changes



def encoded_references(repo, pin, aliases):
    """Record same-slot replacements confirmed by the target's named variant."""
    change = "629d0b74"
    file = FILES[0]
    revision = git(repo, "rev-parse", change).strip()
    diff = set(git(repo, "diff", "-U0", change + "^", change, "--", file).splitlines())
    definitions = dict(line.split("\t", 1) for line in git(repo, "show", f"{pin}:{file}").splitlines() if "\t" in line)
    references = {}
    for old, char, modifier, host, before, after in (
        ("#(丿𠃍^)", "⺆", "z", "月", "⿵⺆二(.);⿵#(丿𠃍^)二(z)", "⿵⺆二(.);⿵⺆z二(z)"),
        ("#(丿乁^)", "几", "n", "𤙍", "⿰牛t⿻屮.#(丿乁^)(.);⿰牛t⿻屮.几.(T)", "⿰牛t⿻屮.几n(.);⿰牛t⿻屮.几.(T)"),
    ):
        chain = aliases.get(old)
        if (chain and f"-{host}\t{before}" in diff and f"+{host}\t{after}" in diff
                and chain + f"({modifier})" in re.split(r"[;\t]", definitions[char])):
            references[old] = {"key": char + modifier, "chain": chain, "revision": revision, "file": file, "host": host}
    return references


def catalogue(repo, pin):
    current, observed, changes = revisions(repo, pin)
    proof = {
        old: {new: sorted(witnesses) for new, witnesses in possibilities.items() if equivalent(old, new)}
        for old, possibilities in changes.items()
    }

    def paths(spelling, seen):
        if spelling in current:
            return {spelling: []}
        results = {}
        for modern, evidence in sorted(proof.get(spelling, {}).items()):
            if modern in seen:
                continue
            for target, path in paths(modern, seen | {modern}).items():
                if target not in results:
                    results[target] = [[spelling, modern, *evidence[0], len(evidence)], *path]
        return results

    aliases, witnesses, undecided = {}, {}, {}
    for old in sorted(observed.keys() - current):
        found = paths(old, {old})
        if len(found) == 1:
            target, path = next(iter(found.items()))
            aliases[old] = target
            witnesses[old] = path
        else:
            undecided[old] = {
                "targets": sorted(found),
                "changes": {new: sorted(evidence) for new, evidence in sorted(changes.get(old, {}).items())},
            }
    graphs = {}
    for spelling in undecided:
        decoded = connections(spelling)
        if decoded is None:
            continue
        strokes, endpoints, crossings = decoded
        joins = []
        for origin, *others in sorted(map(sorted, endpoints)):
            joins.extend((origin, other) for other in others)
        witness = sorted(observed[spelling])[0]
        graphs[spelling] = {
            "strokes": strokes,
            "joins": joins,
            "crossings": crossings,
            "evidence": dict(zip(("revision", "file", "host", "description"), witness)),
        }
    def native_identity(spelling):
        witnesses = sorted(row for row in observed[spelling] if len(row[2]) == 1 and row[3] in (spelling, spelling + "(.)"))
        if len({row[2] for row in witnesses}) != 1:
            return None
        exact = next((row for row in witnesses if row[1] == FILES[0] and row[3] == spelling), None)
        if not exact:
            return None
        revision, file, host, description = exact
        return {"char": host, "revision": revision, "file": file, "description": description}

    identities = {old: identity for old in undecided if (identity := native_identity(old))}
    result = {
        "source": {"url": SOURCE, "revision": pin, "author": "Yi Bai", "license": "MIT",
                   "grammar": "https://nightfurysl2001.github.io/bai-ids/"},
        "aliases": aliases,
        "graphs": graphs,
        "references": encoded_references(repo, pin, aliases),
        "nativeIdentities": identities,
    }
    report = {
        "source": result["source"],
        "witness_fields": ["old", "new", "revision", "file", "host", "context", "witness_count"],
        "witnesses": witnesses,
        "native_identities": identities,
        "undecided": undecided,
    }
    return result, report


def main():
    cli = argparse.ArgumentParser(description=__doc__)
    cli.add_argument("repository", help="Complete local clone of yi-bai/ids")
    cli.add_argument("--output", type=Path, default=Path("js/src/historical-chains.json"))
    cli.add_argument("--report", type=Path, help="Write verified transitions and unresolved spellings")
    args = cli.parse_args()
    data, report = catalogue(args.repository, PIN)
    args.output.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf8")
    if args.report:
        args.report.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf8")
    print(f"{len(data['aliases'])} aliases, {len(data['graphs'])} graphs, {len(report['undecided']) - len(data['graphs'])} unresolved")


if __name__ == "__main__":
    main()
