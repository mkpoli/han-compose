"""Font-free standalone selection regressions for tied contour-count modes."""
from types import SimpleNamespace as NS
import numpy as np
import pytest
from han_compose import compose as C


def item(char, count, box=(0, 0, 100, 100)):
    return NS(contours=[None]*count, box=box, label=char), (0, 0, 100, 100), char


def composer(native=(), japanese=()):
    return NS(standalone=object(), hosted=True, font=NS(own=lambda ch: ch in native),
              japanese=set(japanese), ink=lambda ch: 1, _stretch=C.Composer._stretch)


@pytest.fixture
def shapes(monkeypatch):
    seen=[]
    def shape(part, size):
        seen.append(part.label)
        return np.ones((size, size), dtype=bool)
    monkeypatch.setattr(C, '_shape', shape)
    return seen


@pytest.mark.parametrize('reverse', [False, True])
def test_tied_counts_both_reach_ranking(reverse, shapes):
    rows=[item('甲', 2, (0, 0, 50, 100)), item('乙', 3)]
    if reverse: rows.reverse()
    result=C.Composer._alone(composer('甲乙'), '凵', found=rows)
    assert set(shapes)=={'甲','乙'}
    assert result.origin=='alone 乙'


def test_every_maximal_count_retained(shapes):
    rows=[item(ch, count) for ch,count in zip('甲乙丙丁戊', [2,3,2,3,4])]
    C.Composer._alone(composer('甲乙丙丁戊'), '凵', found=rows)
    assert shapes==list('甲乙丙丁')


def test_unique_mode_unchanged(shapes):
    rows=[item('甲',2),item('乙',3),item('丙',2)]
    result=C.Composer._alone(composer('甲乙丙'), '凵', found=rows)
    assert shapes==['甲','丙']
    assert result.origin=='alone 甲'


def test_empty_candidates(shapes):
    assert C.Composer._alone(composer(), '凵', found=[]) is None
    assert shapes==[]


@pytest.mark.parametrize('fallback', [False, True])
def test_native_filter_precedes_mode(fallback, shapes):
    rows=[item('甲',2),item('乙',3),item('丙',3)]
    result=C.Composer._alone(composer('甲'), '凵', fallback=fallback, found=rows)
    assert result.origin=='alone 甲'
    assert shapes==['甲']


def test_foreign_candidates_require_fallback(shapes):
    rows=[item('甲',2),item('乙',3)]
    assert C.Composer._alone(composer(), '凵', found=rows) is None
    assert shapes==[]
    assert C.Composer._alone(composer(), '凵', fallback=True, found=rows) is not None
    assert shapes==['甲','乙']


def test_japanese_filter_unchanged(shapes):
    rows=[item('甲',2),item('乙',3),item('丙',3)]
    result=C.Composer._alone(composer('甲乙丙','甲'), '凵', found=rows)
    assert result.origin=='alone 甲'
    assert shapes==['甲']


def test_excluded_target_never_enters_candidates(shapes):
    c=composer('凵甲乙')
    c.exclude={'凵'};c.sequences={'凵':'凵'}
    place=C.slot('⿱',1)
    rows=[item('凵',2),item('甲',2,(0,0,50,100)),item('乙',3)]
    c._places={'凵':[(place,'凵')]}
    c._index=({(place,'凵'):[(ch,('⿱','大','凵'),(),1) for _,_,ch in rows]}, {})
    calls=[];leaves=[]
    def host(ch,tree,path):
        calls.append(ch)
        return NS(pieces=[None,next(part for part,_,name in rows if name==ch)])
    c._host_node=host
    def nearest(place,box,leave):
        leaves.append(leave)
        return (0,0,100,100)
    c.standalone=NS(nearest=nearest)
    c._instances=lambda char: C.Composer._instances(c,char)
    result=C.Composer._alone(c,'凵')
    assert calls==['甲','乙'] and leaves==['凵','凵']
    assert shapes==['甲','乙'] and result.origin=='alone 乙'
