"""The host index found one operand at a time lists what indexing every sequence lists."""
from types import SimpleNamespace

import pytest

from han_compose import compose

#: Sequences that put an operand at several depths, inside components written out one and two
#: levels down, under an operator that is not laid out, and in a character no font draws.
SEQUENCES = {
    "甲": "⿰木口",
    "乙": "⿰木日",
    "丙": "⿱艹甲",
    "丁": "⿰丙彡",
    "戊": "⿰木⿱日口",
    "己": "⿰⿰木口口",
    "庚": "⿾甲",
    "辛": "⿰木",
    "壬": "⿻十口",
    "癸": "⿸厂甲",
    "子": "⿰氵癸",
    "丑": "⿰木丑",
    "寅": "⿲木口日",
    "卯": "⿰木月",
    "辰": "⿱卯心",
    "未": "⿱二小",
    "申": "⿰未口",
    "酉": "⿱艹葛\U000E0100",
}
UNDRAWN = {"卯"}
ATOMIC = {"未"}


def composer(sequences=SEQUENCES, undrawn=UNDRAWN, atomic=ATOMIC) -> compose.Composer:
    font = SimpleNamespace(has=lambda char: char not in undrawn, own=lambda char: char not in undrawn,
                           style=SimpleNamespace(own_hosts=False, weighted=False))
    c = compose.Composer(font, dict(sequences))
    c.__dict__["atomic"] = set(atomic)
    return c


def flat(entries):
    """Entries with each tree as its sequence: a component is written out afresh for each search."""
    return [(char, compose.key(tree), path, i) for char, tree, path, i in entries]


def assert_same_as_whole(c: compose.Composer, keys, operands, operators) -> None:
    whole_hosts, whole_templates = c._indexed(c.font.has)
    hosts, templates = c._index
    for key in keys:
        assert flat(hosts.get(key, [])) == flat(whole_hosts.get(key, [])), key
        assert (key in hosts) == (key in whole_hosts), key
    for operand in operands:
        assert c._places.get(operand, []) == [k for k in whole_hosts if k[1] == operand], operand
    for op in operators:
        assert templates.get(op, []) == whole_templates.get(op, []), op
    assert hosts._whole is None


def test_each_operand_is_found_as_indexing_every_sequence_lists_it(monkeypatch):
    monkeypatch.setattr(compose, "SEARCHED", float("inf"))
    c = composer()
    whole, templates = c._indexed(c.font.has)
    absent = [("L", "無"), ("R", "⿰木"), ("⿸0", "木"), ("B", "⿱日口"), ("L", "")]
    assert_same_as_whole(c, [*whole, *absent], {w for _, w in whole} | {"無", "⿰木"}, [*templates, "⿶"])
    hosts, _ = c._index
    # Inside a component written out, under the component's own name and under its sequence.
    assert flat(hosts[("B", "甲")]) == [("丙", "⿱艹甲", (), 1), ("丁", "⿰⿱艹⿰木口彡", (0,), 1)]
    assert flat(hosts[("B", "⿰木口")]) == [("丙", "⿱艹⿰木口", (), 1), ("丁", "⿰⿱艹⿰木口彡", (0,), 1)]
    # Only inside a component, itself drawn by no font; and never out of an atomic one.
    assert flat(hosts[("R", "月")]) == [("辰", "⿱⿰木月心", (0,), 1)]
    assert [entry[0] for entry in hosts[("T", "二")]] == ["未"]
    # Where enough characters write it out, none holding it inside a component joins them.
    assert [entry[0] for entry in hosts[("L", "木")]] == ["甲", "乙", "戊", "己", "丑", "寅"]
    # Twice in one character, the deeper node first, as the walk meets them.
    assert [entry[2] for entry in hosts[("R", "口")] if entry[0] == "己"] == [(0,), ()]


def test_a_search_reads_no_sequence_that_does_not_name_the_operand(monkeypatch):
    monkeypatch.setattr(compose, "SEARCHED", float("inf"))
    c = composer()
    monkeypatch.setattr(c, "_indexed", lambda drawn: pytest.fail("every sequence was indexed"))
    read = []
    parse = compose.parse
    monkeypatch.setattr(compose, "parse", lambda sequence: read.append(sequence) or parse(sequence))
    hosts, _ = c._index
    assert [entry[0] for entry in hosts.get(("⿻1", "口"), [])] == ["壬"]
    assert c._places.get("彡") == [("R", "彡")]
    # 口 and 彡 are named by these characters, or inside a component they name, and by no other.
    assert not {SEQUENCES[char] for char in "乙卯辰酉丑未"} & set(read)
    assert {SEQUENCES[char] for char in "甲戊己壬寅申丙癸丁"} <= set(read)


def test_searches_that_have_read_too_much_index_every_sequence(monkeypatch):
    # Eight sequences name 木 and three more name 日.
    monkeypatch.setattr(compose, "SEARCHED", 9 / len(SEQUENCES))
    c = composer()
    whole, templates = c._indexed(c.font.has)
    hosts, found = c._index
    assert flat(hosts[("L", "木")]) == flat(whole[("L", "木")]) and hosts._whole is None
    assert flat(hosts[("R", "日")]) == flat(whole[("R", "日")]) and hosts._whole is not None
    assert flat(hosts.get(("B", "甲"), [])) == flat(whole[("B", "甲")])
    assert ("L", "無") not in hosts and c._places.get("木") == [k for k in whole if k[1] == "木"]
    assert found.get("⿰") == templates["⿰"] and list(hosts) == list(whole)


def test_reading_every_operand_indexes_every_sequence():
    c = composer()
    whole, templates = c._indexed(c.font.has)
    hosts, found = c._index
    assert hosts.get(("L", "木")) is not None and hosts._whole is None
    assert {key: flat(entries) for key, entries in hosts.items()} == {key: flat(entries) for key, entries in whole.items()}
    assert dict(found.items()) == templates and len(hosts) == len(whole)
    assert dict(c._places.items()) == {w: [k for k in whole if k[1] == w] for w in dict.fromkeys(w for _, w in whole)}


def test_usage_counts_the_japanese_hosts_of_the_position_asked_about(monkeypatch):
    monkeypatch.setattr(compose, "SEARCHED", float("inf"))
    c = composer()
    c.__dict__["japanese"] = {"甲", "戊", "寅", "丙"}
    assert c.usage[("L", "木")] == 3 and c.usage[("B", "甲")] == 1 and c.usage[("L", "無")] == 0
    assert c._index[0]._whole is None


def test_the_real_sequences_are_searched_as_they_are_indexed(monkeypatch):
    """A sample of the operands the real sequences hold, the commonest and the rarest among them,
    with every character past Extension B taken as drawn by no font."""
    monkeypatch.setattr(compose, "SEARCHED", float("inf"))
    c = composer(compose.japanese_sequences(), undrawn=(), atomic=compose.atomic_characters())
    c.font.has = lambda char: ord(char[0]) < 0x2B740
    whole, _ = c._indexed(c.font.has)
    keys = list(whole)
    few = [key for key in keys if len(whole[key]) < compose.EXPAND_FEW]
    sample = keys[::401] + few[::601] + sorted(keys, key=lambda key: -len(whole[key]))[:12]
    assert_same_as_whole(c, sample, [written for _, written in keys[::997]], ["⿲", "⿳", "⿼"])
