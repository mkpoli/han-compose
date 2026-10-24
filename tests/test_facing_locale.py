"""Font-free facing-rescue donor eligibility and ordering regressions."""
from types import SimpleNamespace as NS
import pytest
from han_compose import compose as C


BOX=(0,0,100,100)


def run(same=(), facing=(), native=(), japanese=(), excluded=(), invalid=(), counts=None, boxes=None, no_facing=False, monkeypatch=None):
    slot=C.slot('⿱',1)
    facing_slot=C.FACING_PLACES[slot]
    if no_facing:monkeypatch.delitem(C.FACING_PLACES,slot)
    entries={(slot,'化'):[(ch,('⿱','甲','化'),(),1) for ch in same],
             (facing_slot,'化'):[(ch,('⿱','化','乙'),(),0) for ch in facing]}
    calls=[];counts=counts or {};boxes=boxes or {}
    def host(ch,tree,path):
        calls.append(ch)
        if ch in invalid:return None
        pieces=[NS(box=boxes.get(ch,BOX),contours=[None]*counts.get(ch,3)) for _ in range(2)]
        return NS(char=ch,pieces=pieces,whole=True)
    c=NS(hosted=True,_index=(entries,{}),font=NS(own=lambda ch:ch in native),exclude=set(excluded),
         japanese=set(japanese),ink=lambda node:100,alternatives=lambda node,place:['化'],
         _host_node=host,_outlines=lambda node:3,_native_shapes=lambda rows:rows)
    result=C.Composer._ranked(c,'⿱',1,'化',['艹'],BOX)
    return [h.char for _,h,_ in result],calls,result


def test_native_japanese_facing_cut_preferred_after_acceptance():
    chosen,_,_=run(same='甲',facing='乙丙',native='乙丙',japanese='丙',boxes={'丙':(0,0,10,100)})
    assert chosen==['丙']


@pytest.mark.parametrize('failure',['invalid','excluded','contour_mismatch'])
def test_unusable_japanese_facing_cut_does_not_suppress_pool(failure):
    options={'invalid':'丙'} if failure=='invalid' else {'excluded':'丙'} if failure=='excluded' else {'counts':{'丙':2}}
    chosen,calls,_=run(same='甲',facing='乙丙',native='乙丙',japanese='丙',**options)
    assert set(chosen)=={'甲','乙'}
    if failure=='excluded':assert '丙' not in calls


def test_native_same_slot_disables_rescue_and_locale_preference():
    chosen,calls,_=run(same='甲乙',facing='丙',native='甲乙丙',japanese='乙丙',boxes={'乙':(0,0,1,100)})
    assert chosen==['甲','乙']
    assert '丙' not in calls


def test_empty_same_slot_does_not_trigger_rescue():
    chosen,calls,_=run(facing='乙',native='乙',japanese='乙')
    assert chosen==[] and calls==[]


def test_absent_facing_route_unchanged(monkeypatch):
    chosen,calls,_=run(same='甲',facing='乙',native='乙',japanese='乙',no_facing=True,monkeypatch=monkeypatch)
    assert chosen==['甲'] and calls==['甲']


def test_original_combined_pool_retained_without_local_native():
    chosen,_,_=run(same='甲',facing='乙',native='乙')
    assert set(chosen)=={'甲','乙'}


def test_fallback_only_preserved_when_rescue_cuts_fail():
    chosen,_,_=run(same='甲',facing='乙',native='乙',japanese='乙',invalid='乙')
    assert chosen==['甲']


def test_japanese_fallback_does_not_qualify_as_native_subset():
    chosen,_,_=run(same='甲',facing='乙',native='乙',japanese='甲')
    assert set(chosen)=={'甲','乙'}


@pytest.mark.parametrize('order',['乙丙','丙乙'])
def test_equal_score_local_candidates_keep_stable_order(order):
    chosen,_,rows=run(same='甲',facing=order,native='乙丙',japanese='乙丙')
    assert chosen==list(order)
    assert rows[0][0]==rows[1][0]


def test_local_candidates_still_rank_by_existing_scores():
    chosen,_,_=run(same='甲',facing='乙丙',native='乙丙',japanese='乙丙',boxes={'乙':(0,0,10,100)})
    assert chosen==['丙','乙']
