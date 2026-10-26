"""Font-free regressions for fitted-enclosure replacement evidence."""
from types import SimpleNamespace as NS
import numpy as np
import pytest
from han_compose import compose as C


def rectangle(x0, y0, x1, y1):
    points = np.array([(x0,y0),(x1,y0),(x1,y1),(x0,y1)], dtype=float)
    return C.Part([C.Contour([('moveTo',1,False)]+[('lineTo',1,False)]*3, points, points.copy())])


def learned(monkeypatch, *, outer=True, bare=True, nested=False, collision=0, refit=False, feasible=True, excluded=False):
    outer_part = rectangle(0,0,100,100)
    inner_part = rectangle(0,0,40,40)
    alternate = rectangle(0,0,40,40)
    skinny = rectangle(0,0,100,5)
    host = C.Host('甲', [outer_part], (0,0,100,100), 0)
    inner_host = C.Host('乙', [skinny], (0,0,100,100), 0)
    calls = []
    font = NS(own=lambda ch:False, glyph=lambda ch:inner_part if ch=='斤' else outer_part, stem=((5,8),(5,8)))
    def node(child, box):
        part = inner_part if child=='斤' and bare else alternate
        return [C.Placed(part, part.box, box, origin='opaque provenance')]
    def select(op, i, *args, **kwargs):
        return (host,0) if i==0 and outer else ((inner_host,0) if i==1 and refit else None)
    c = NS(exclude={'匠'}, face=(0,0,100,100), font=font, reuse=True, standalone=True,
        layout=NS(predict=lambda *args:[(0,0,100,100),(25,25,75,75)]),
        _host=select, _node=node, _room=lambda *args:(25,25,75,75) if refit else None,
        _kin_outer=lambda *args:None, _stretch=C.Composer._stretch, ink=lambda ch:1)
    if excluded:
        c.exclude.add('斤')
        font.glyph=lambda ch:pytest.fail('Excluded glyph identity must not be read')
    monkeypatch.setattr(C,'_fit_inside',lambda *args,**kwargs:(calls.append('fit'),feasible)[1])
    monkeypatch.setattr(C,'_collision',lambda *args,**kwargs:collision)
    result=C.Composer._learned(c,'⿷',['匚','斤'],(0,0,100,100) if nested else None)
    return result,calls


@pytest.mark.parametrize('refit',[False,True])
def test_root_hosted_outer_fitted_bare_inner(monkeypatch,refit):
    result,calls=learned(monkeypatch,refit=refit)
    assert isinstance(result,C._FittedEnclosure)
    assert calls==['fit']
    assert result[1].origin=='opaque provenance'


@pytest.mark.parametrize('change',[{'outer':False},{'bare':False},{'nested':True},{'collision':C.COLLIDE+.001},
                                    {'feasible':False},{'feasible':False,'refit':True},
                                    {'excluded':True},{'excluded':True,'refit':True}])
def test_unsupported_evidence_not_marked(monkeypatch,change):
    result,_=learned(monkeypatch,**change)
    assert not isinstance(result,C._FittedEnclosure)


def test_threshold_is_inclusive(monkeypatch):
    result,_=learned(monkeypatch,collision=C.COLLIDE)
    assert isinstance(result,C._FittedEnclosure)


def fake_composer(placed):
    replacement=NS(origin='alone donor')
    calls=[]
    class Fake:
        _normalize_mouth_grids = C.Composer._normalize_mouth_grids
        _standalone_mouth_grid = C.Composer._standalone_mouth_grid
        face=(0,0,100,100);by_sequence={'⿷匚斤':'匠'};reuse=True;exclude={'匠'}
        standalone=True;hosted=True;weighted=True;guide=None;rerank=False
        font=NS(own=lambda ch:True)
        def _respelled(self,t):return t
        def _node(self,*a,**kw):return placed
        def _instances(self,*a,**kw):calls.append('instances');return [(None,None,'甲')]*C.HELD_OFTEN
        def _unhosted(self,*a):return False
        def _alone(self,*a,**kw):calls.append('alone');return replacement
        def _balance(self,p):calls.append(('balance',p))
    return Fake(),replacement,calls


def test_guard_only_first_branch(monkeypatch):
    initial=C._FittedEnclosure([NS(origin='learned outer'),NS(origin='glyph inner')])
    c,replacement,calls=fake_composer(initial)
    assert C.Composer.compose(c,'⿷匚斤') is initial
    assert calls==[('balance',initial)]
    # Same flattened origins without structural evidence retain normal replacement.
    c,replacement,calls=fake_composer(list(initial))
    assert C.Composer.compose(c,'⿷匚斤')==[replacement]
    assert calls[:2]==['instances','alone']


def test_second_branch_preserved_even_with_marker(monkeypatch):
    initial=C._FittedEnclosure([NS(origin='learned outer'),NS(origin='learned inner')])
    c,replacement,calls=fake_composer(initial)
    monkeypatch.setattr(C,'raster',lambda p,size:np.array([[p is initial,p is not initial]]))
    assert C.Composer.compose(c,'⿷匚斤')==[replacement]
    assert calls[:2]==['instances','alone']


def real_geometry(opening=(49,49,51,51), predicted=(120,20,140,40)):
    outside=rectangle(0,0,100,100)
    hole=rectangle(*opening).contours[0]
    hole.light=hole.light[::-1].copy()
    hole.heavy=hole.heavy[::-1].copy()
    outer=C.Part(outside.contours+[hole])
    inner=rectangle(0,0,40,40)
    host=C.Host('甲',[outer],(0,0,100,100),0)
    font=NS(own=lambda ch:False,glyph=lambda ch:inner,stem=((5,8),(5,8)))
    c=NS(exclude={'匠'},face=(0,0,100,100),font=font,reuse=True,standalone=True,
         layout=NS(predict=lambda *args:[(0,0,100,100),predicted]),
         _host=lambda op,i,*args,**kwargs:(host,0) if i==0 else None,
         _node=lambda child,box:[C.Placed(inner,inner.box,box,origin='glyph '+child)],
         _room=lambda *args:opening,_stretch=C.Composer._stretch,ink=lambda ch:1)
    return c,outer,inner


def test_real_failed_fit_outside_face_has_no_signal():
    c,outer,inner=real_geometry()
    placed=[C.Placed(inner,inner.box,(120,20,140,40))]
    enclosing=[C.Placed(outer,outer.box,c.face)]
    assert C._fit_inside(enclosing,placed,c.face,5,room=(120,20,140,40)) is False
    assert placed[0].target==(120,20,140,40)
    assert C._collision(enclosing,placed,c.face,size=256)==0
    result=C.Composer._learned(c,'⿷',['匚','斤'])
    assert not isinstance(result,C._FittedEnclosure)


def test_real_feasible_fit_is_visible_and_marked():
    c,outer,inner=real_geometry(opening=(10,10,90,90),predicted=(30,30,70,70))
    result=C.Composer._learned(c,'⿷',['匚','斤'])
    assert isinstance(result,C._FittedEnclosure)
    assert C._visible_inside(result[1:],c.face)
    assert C._collision(result[:1],result[1:],c.face,size=256)<=C.COLLIDE


@pytest.mark.parametrize('target',[(120,20,140,40),(-10,20,20,40),(0,0,0,40),(0,0,float('nan'),40)])
def test_visibility_rejects_outside_clipped_or_invalid_bounds(target):
    part=rectangle(0,0,40,40)
    assert not C._visible_inside([C.Placed(part,part.box,target)],(0,0,100,100))


def test_visibility_requires_each_part_and_nonempty_ink():
    part=rectangle(0,0,40,40)
    solid=C.Placed(part,part.box,(20,20,40,40))
    cancel=rectangle(0,0,40,40).contours[0]
    cancel.light=cancel.light[::-1].copy();cancel.heavy=cancel.heavy[::-1].copy()
    empty=C.Part(part.contours+[cancel])
    assert not C._visible_inside([solid,C.Placed(empty,empty.box,(50,50,70,70))],(0,0,100,100))


def test_search_success_does_not_run_visibility_check(monkeypatch):
    c,outer,inner=real_geometry(opening=(10,10,90,90),predicted=(30,30,70,70))
    enclosing=[C.Placed(outer,outer.box,c.face)]
    placed=[C.Placed(inner,inner.box,(30,30,70,70))]
    monkeypatch.setattr(C,'_visible_inside',lambda *a,**k:pytest.fail('General fitter must not certify visibility'))
    assert C._fit_inside(enclosing,placed,c.face,5,room=(30,30,70,70)) is True


def test_search_success_can_require_additional_bounds_certification():
    outer=rectangle(0,0,10,100)
    inner=C.Part(rectangle(0,0,10,20).contours+rectangle(190,0,200,20).contours)
    enclosing=[C.Placed(outer,outer.box,outer.box)]
    placed=[C.Placed(inner,inner.box,(120,20,320,40))]
    assert C._fit_inside(enclosing,placed,(0,0,100,100),1,room=(0,0,200,20)) is True
    assert not C._visible_inside(placed,(0,0,100,100))


@pytest.mark.parametrize('change',[{'outer':False},{'bare':False},{'nested':True},{'feasible':False},
                                   {'feasible':False,'refit':True},{'excluded':True}])
def test_ineligible_root_paths_do_not_certify_visibility(monkeypatch,change):
    monkeypatch.setattr(C,'_visible_inside',lambda *a,**k:pytest.fail('Ineligible path must not rasterise visibility'))
    result,_=learned(monkeypatch,**change)
    assert not isinstance(result,C._FittedEnclosure)


def test_eligible_root_certifies_visibility_once(monkeypatch):
    calls=[]
    original=C._visible_inside
    def visible(*a,**kw):
        calls.append('visible')
        return original(*a,**kw)
    monkeypatch.setattr(C,'_visible_inside',visible)
    result,_=learned(monkeypatch)
    assert isinstance(result,C._FittedEnclosure)
    assert calls==['visible']


def test_signal_does_not_persist_across_calls():
    initial=C._FittedEnclosure([NS(origin='learned outer'),NS(origin='glyph inner')])
    c,replacement,calls=fake_composer(initial)
    assert C.Composer.compose(c,'⿷匚斤') is initial
    c._node=lambda *a,**kw:list(initial)
    assert C.Composer.compose(c,'⿷匚斤')==[replacement]
