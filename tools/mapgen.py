#!/usr/bin/env python3
"""Fixer: карта (assets/map.png) -> mapdata.js. Запуск: python3 tools/mapgen.py"""
import json,base64,sys,math
import numpy as np
from PIL import Image,ImageDraw
from scipy import ndimage as ndi
from skimage.morphology import skeletonize,binary_closing,disk
from skimage.measure import approximate_polygon
SRC='assets/map.png';OUT='mapdata.js'
S=8.0            # единиц мира на пиксель карты (тайл 32 = 4 px)
TS=32            # размер тайла (4 px карты)
im=np.array(Image.open(SRC).convert('RGB')).astype(int)
H,W,_=im.shape
R,G,B=im[...,0],im[...,1],im[...,2];lum=(R+G+B)/3
void=(lum<58)&(B>=R-2)
water=(B>R+35)&(B>G+10)&~void
green=(G>R+6)&(G>B+14)
road=(lum>172)&(abs(R-B)<45)&~green&~void&~water
road=binary_closing(road,disk(1))
land=~void&~water
# --- острова: компоненты суши, почти целиком окружённые водой
lab,n=ndi.label(land&~road)
isl=np.zeros_like(land)
for i in range(1,n+1):
    m=lab==i
    if m.sum()>20000:continue
    ring=ndi.binary_dilation(m,iterations=4)&~m
    if (water&ring).sum()>0.7*ring.sum():isl|=m
# --- скелет дорог
sk=skeletonize(road)
dt=ndi.distance_transform_edt(road)
def nbrs(sk):
    k=np.ones((3,3));k[1,1]=0
    return ndi.convolve(sk.astype(int),k,mode='constant')*sk
# прунинг коротких шипов
def prune(sk,L):
    sk=sk.copy()
    for _ in range(3):
        nb=nbrs(sk);ends=np.argwhere((nb==1))
        for y,x in ends:
            path=[(y,x)];cy,cx=y,x;prev=None;ok=False
            for _ in range(L):
                nxt=[(cy+dy,cx+dx) for dy in(-1,0,1) for dx in(-1,0,1) if(dy or dx) and 0<=cy+dy<H and 0<=cx+dx<W and sk[cy+dy,cx+dx] and (cy+dy,cx+dx)!=prev and (cy+dy,cx+dx) not in path]
                if len(nxt)!=1:ok=len(nxt)>1;break
                prev=(cy,cx);cy,cx=nxt[0];path.append((cy,cx))
            if ok and len(path)<L:
                for p in path[:-1]:sk[p]=False
    return skeletonize(sk)
sk=prune(sk,9)
nb=nbrs(sk)
junc=(nb>=3)
jl,jn=ndi.label(ndi.binary_dilation(junc,structure=np.ones((3,3)),iterations=1)&sk,structure=np.ones((3,3)))
ends=(nb==1)
nodes=[]  # (x,y)
nid=-np.ones((H,W),int)
for i in range(1,jn+1):
    ys,xs=np.where(jl==i);nodes.append((xs.mean(),ys.mean()));nid[jl==i]=len(nodes)-1
for y,x in np.argwhere(ends):
    if nid[y,x]<0:nodes.append((float(x),float(y)));nid[y,x]=len(nodes)-1
skp=sk&(nid<0)  # пиксели рёбер
el,en=ndi.label(skp,structure=np.ones((3,3)))
edges=[]
def trace(comp_pixels):
    pts=set(map(tuple,comp_pixels))
    # найти концы (пиксели, соседствующие с узлами)
    def nodeNb(p):
        s=set()
        for dy in(-1,0,1):
            for dx in(-1,0,1):
                y,x=p[0]+dy,p[1]+dx
                if 0<=y<H and 0<=x<W and nid[y,x]>=0:s.add(nid[y,x])
        return s
    starts=[p for p in pts if nodeNb(p)]
    return pts,starts,nodeNb
for i in range(1,en+1):
    ys,xs=np.where(el==i)
    pts,starts,nodeNb=trace(np.c_[ys,xs])
    if not starts:
        # замкнутая петля без узлов: создаём узел
        p=next(iter(pts));nodes.append((float(p[1]),float(p[0])));ni=len(nodes)-1;nid[p]=ni;pts.discard(p)
        starts=[p]
        a=ni;b=ni
    # упорядочить
    s=starts[0];order=[s];seen={s};cur=s
    while True:
        nx=[(cur[0]+dy,cur[1]+dx) for dy in(-1,0,1) for dx in(-1,0,1) if(dy or dx) and (cur[0]+dy,cur[1]+dx) in pts and (cur[0]+dy,cur[1]+dx) not in seen]
        if not nx:break
        nx.sort(key=lambda q:abs(q[0]-cur[0])+abs(q[1]-cur[1]))
        cur=nx[0];order.append(cur);seen.add(cur)
    na=list(nodeNb(order[0]));nb2=list(nodeNb(order[-1]))
    a=na[0] if na else None;b=nb2[0] if nb2 else a
    if a is None:continue
    if len(order)==1 and a==b:continue
    poly=np.array([[p[1],p[0]] for p in order],float)
    poly=np.vstack([[nodes[a]],poly,[nodes[b]]])
    poly=approximate_polygon(poly,1.4)
    wid=float(np.median([dt[p] for p in order])*2)
    if a==b and len(poly)<4:continue
    edges.append(dict(a=int(a),b=int(b),p=[[round(float(x),1),round(float(y),1)] for x,y in poly],w=round(wid,1)))
# отбросить узлы без рёбер, пересчитать индексы
use=sorted({e['a'] for e in edges}|{e['b'] for e in edges});remap={o:i for i,o in enumerate(use)}
nodes=[nodes[o] for o in use]
for e in edges:e['a']=remap[e['a']];e['b']=remap[e['b']]
print('nodes',len(nodes),'edges',len(edges),'widths',np.percentile([e['w'] for e in edges],[10,50,90]))
np.save('/tmp/mapw/dt.npy',dt)
json.dump(dict(nodes=nodes,edges=edges),open('/tmp/mapw/graph.json','w'))
Image.fromarray((isl*255).astype(np.uint8)).save('/tmp/mapw/isl.png')
# оверлей
ov=Image.open(SRC).convert('RGB');d=ImageDraw.Draw(ov)
for e in edges:
    d.line([tuple(p) for p in e['p']],fill=(255,0,0) if e['w']>=7 else (255,160,0),width=1)
for x,y in nodes:d.ellipse([x-2,y-2,x+2,y+2],outline=(0,255,255))
ov.save('/tmp/mapw/overlay.png')

# ================= ЧАСТЬ 2: тайлы, дороги, участки, высоты =================
import random
random.seed(7);np.random.seed(7)
TW,TH=W//4,H//4            # 384x256
def red(m):                 # доля пикселей в тайле 4x4
    return m.reshape(TH,4,TW,4).mean(axis=(1,3))
void_f,water_f,road_f,green_f,isl_f=red(void),red(water),red(road),red(green),red(isl)
land_f=1-void_f-water_f
tvoid=void_f>0.5
twater=(water_f>=0.5)&~tvoid
tland=~tvoid&~twater
# лес / парк
gl,gn=ndi.label(green,structure=np.ones((3,3)))
areas=ndi.sum(green,gl,range(1,gn+1))
bigf=np.zeros_like(green)
for i,a in enumerate(areas,1):
    m=gl==i
    if a<4500:continue
    ys_,xs_=np.nonzero(m)
    if a>30000 or math.hypot(xs_.mean()-860,ys_.mean()-520)>330:bigf|=m
forest_t=(red(bigf)>0.4)&tland
park_t=(green_f>0.4)&tland&~forest_t
isl_t=(isl_f>0.4)&tland
# дороги: растр графа в системе пикселей карты
MINW=4.6
def overwater(e):
    pts=[]
    for (x0,y0),(x1,y1) in zip(e['p'][:-1],e['p'][1:]):
        for t in (0,.25,.5,.75):pts.append((x0+(x1-x0)*t,y0+(y1-y0)*t))
    pts.append(tuple(e['p'][-1]))
    wv=(water|void)
    return np.mean([wv[min(H-1,int(y)),min(W-1,int(x))] for x,y in pts])>.45
for e in edges:e['keep']=e['w']>=MINW or overwater(e)
for e in edges:
    if e['keep'] and e['w']<MINW:e['w']=6.0   # мосты и выезды: минимум улица
edges=[e for e in edges if e['keep']]
# убрать мелкие изолированные куски
par={}
def fnd(a):
    while par.setdefault(a,a)!=a:par[a]=par[par[a]];a=par[a]
    return a
for e in edges:par[fnd(e['a'])]=fnd(e['b'])
from collections import Counter
cnt=Counter(fnd(e['a']) for e in edges)
edges=[e for e in edges if cnt[fnd(e['a'])]>=4 or overwater(e)]
use=sorted({e['a'] for e in edges}|{e['b'] for e in edges});remap={o:i for i,o in enumerate(use)}
nodes=[nodes[o] for o in use]
for e in edges:e['a']=remap[e['a']];e['b']=remap[e['b']]
print('после фильтра: узлов',len(nodes),'рёбер',len(edges))
def wclass(wp):
    return 96 if wp<6.5 else 128 if wp<8.5 else 160
ri=Image.new('L',(W,H),0);dr=ImageDraw.Draw(ri)
for e in edges:
    wp=wclass(e['w'])/8.0;e['ww']=wclass(e['w'])
    pts=[tuple(p) for p in e['p']]
    dr.line(pts,fill=255,width=max(1,int(round(wp))),joint='curve')
    for p in (pts[0],pts[-1]):dr.ellipse([p[0]-wp/2,p[1]-wp/2,p[0]+wp/2,p[1]+wp/2],fill=255)
rr=red(np.array(ri)>127)
troad=(rr>=0.45)&(tland|(road_f>0.2))&~tvoid
# сушу вокруг моста: дорога поверх воды разрешена там, где была исходная дорога
twater&=~troad
# сводная карта типов
T=np.full((TH,TW),2,np.uint8)   # временно: 2=застраиваемая суша
T[tvoid]=6;T[twater]=5
T[tland&forest_t]=4;T[tland&park_t]=8;T[isl_t]=7
T[troad]=0
dist_road=ndi.distance_transform_edt(~troad)
ra=Image.new('L',(W,H),0);da=ImageDraw.Draw(ra)
for e in edges:
    if e['ww']>=128:
        wp=e['ww']/8.0;pts=[tuple(p) for p in e['p']]
        da.line(pts,fill=255,width=int(round(wp)),joint='curve')
dist_art=ndi.distance_transform_edt(~(red(np.array(ra)>127)>=0.45))
urban=(T==2)
# тротуары вдоль дорог
walk=urban&((dist_road<=1.2)|(dist_art<=2.2))
# набережная: городская суша у воды (не остров)
main_water=twater&~ndi.binary_dilation(isl_t,iterations=0)
dist_water=ndi.distance_transform_edt(~twater)
prom=urban&(dist_water<=3.2)
T[walk|prom]=1
# парки/острова/лес вдоль дорог: обочина (двор)
T[(T==4)&(dist_road<=1.2)]=3
T[(T==8)&(dist_road<=2.2)]=1
build=(T==2)
# ---- зоны ----
cxp,cyp=860,520
yy,xx=np.mgrid[0:TH,0:TW]
dc=np.hypot((xx*4+2)-cxp,(yy*4+2)-cyp)
df_px=ndi.distance_transform_edt(~bigf)
df=df_px[2::4,2::4][:TH,:TW]
bl,bn=ndi.label(build)
sizes=ndi.sum(build,bl,range(1,bn+1))
zone=np.zeros((TH,TW),np.uint8)  # 0 core,1 mid,2 priv,3 industrial
for i in range(1,bn+1):
    m=bl==i;a=sizes[i-1]
    mdc=dc[m].mean();mdf=df[m].mean()
    if a>=320 and mdc>280:z=3
    elif mdf<38 and mdc>230:z=2
    elif mdc<300:z=0
    else:z=1
    zone[m]=z
# ---- упаковка участков ----
K=dict(slab5=0,slab9=1,classic=2,spire=3,cathedral=4,slab12=5,works=6,depot=7,cabin=8,villa=9,arena=10,silo=11,mast=12)
SIZES={ # (wmin,wmax,hmin,hmax) в тайлах
 'slab5':(4,5,8,13),'slab9':(5,6,9,14),'slab12':(5,6,10,16),'classic':(7,10,7,12),
 'works':(10,15,7,11),'depot':(6,10,4,7),'silo':(3,4,3,4),'cabin':(3,3,3,4),'villa':(3,4,3,4)}
MIX={0:[('classic',.30),('slab12',.22),('slab5',.18),('slab9',.12),('works',.12),('depot',.06)],
     1:[('slab5',.28),('slab9',.2),('slab12',.2),('classic',.1),('works',.1),('villa',.07),('depot',.05)],
     2:[('cabin',.5),('villa',.38),('depot',.06),('silo',.06)],
     3:[('works',.36),('depot',.4),('silo',.1),('slab5',.04),('works',.10)]}
def pickk(z):
    r=random.random();s=0
    for k,p in MIX[z]:
        s+=p
        if r<s:return k
    return MIX[z][0][0]
free=build.copy()
B=[]
def fits(x,y,w,h):
    return x+w<=TW and y+h<=TH and free[y:y+h,x:x+w].all()
vys=[]
# особые здания
def reserve(kind,tx,ty,w,h):
    free[ty:ty+h,tx:tx+w]=False
    T[ty:ty+h,tx:tx+w]=2
    B.append([tx,ty,w,h,K[kind],tx,ty,w,h,0])
# арена, собор, мачта
st=(272,80,22,14)
T[st[1]-1:st[1]+st[3]+1,st[0]-1:st[0]+st[2]+1]=np.where(T[st[1]-1:st[1]+st[3]+1,st[0]-1:st[0]+st[2]+1]==5,5,3)
reserve('arena',*st)
bs=(254,137,12,10);T[bs[1]-1:bs[1]+bs[3]+1,bs[0]-1:bs[0]+bs[2]+1]=3;reserve('cathedral',*bs)
tw=(int(746/4)-1,int(138/4)-1,3,3);T[tw[1]-1:tw[1]+4,tw[0]-1:tw[0]+4]=3;reserve('mast',*tw)
cand=[(y,x) for y in range(2,TH-12) for x in range(2,TW-12) if zone[y,x]==0 and dc[y,x]<330 and free[y:y+10,x:x+10].all()]
random.shuffle(cand)
for y,x in cand:
    if len(vys)>=4:break
    if all(math.hypot(x-vx,y-vy)>34 for vx,vy in vys):
        vys.append((x,y));free[y-1:y+11,x-1:x+11]=False;T[y:y+10,x:x+10]=2;B.append([x,y,10,10,K['spire'],x-1,y-1,12,12,0])
order=[(y,x) for y in range(TH) for x in range(TW)]
for y,x in order:
    if not free[y,x]:continue
    z=int(zone[y,x]);k=pickk(z)
    # вертикальный/горизонтальный вариант
    if z==0 and len(vys)<4 and fits(x,y,10,10) and all(math.hypot(x-vx,y-vy)>34 for vx,vy in vys) and dc[y,x]<300:
        k='spire';w=h=10
    else:
        wmn,wmx,hmn,hmx=SIZES[k]
        w=random.randint(wmn,wmx);h=random.randint(hmn,hmx)
        if random.random()<.5 and k not in('cabin','villa','silo'):w,h=h,w
    done=False
    for _ in range(60):
        if fits(x,y,w,h):done=True;break
        # уменьшаем сторону, которая мешает
        if w>3 and (random.random()<.5 or h<=3):w-=1
        elif h>3:h-=1
        else:break
    if not done:
        free[y,x]=False;T[y,x]=3;continue
    if k not in('cabin','villa','silo','spire') and (w<3 or h<3):
        free[y,x]=False;continue
    if k=='spire':vys.append((x,y))
    # участок: здание + отступ справа/снизу
    pad=2 if k in('cabin','villa') else 1
    px_,py_,pw,ph=x,y,w+pad,h+pad
    ox=oy=0
    if k in('cabin','villa'):   # дом в центре участка
        pw,ph=w+3,h+3;ox,oy=1,1
    pw=min(pw,TW-px_);ph=min(ph,TH-py_)
    reg=free[py_:py_+ph,px_:px_+pw]
    T[py_:py_+ph,px_:px_+pw]=np.where(reg,3,T[py_:py_+ph,px_:px_+pw])
    free[py_:py_+ph,px_:px_+pw]=False
    bx_,by_=px_+ox,py_+oy
    if bx_+w>TW or by_+h>TH:continue
    T[by_:by_+h,bx_:bx_+w]=2
    B.append([bx_,by_,w,h,K[k],px_,py_,pw,ph,z])
print('buildings',len(B),{k:sum(1 for b in B if b[4]==v) for k,v in K.items()})
# ---- высоты ----
bigf_s=ndi.binary_fill_holes(bigf)
edt_in=ndi.distance_transform_edt(bigf_s)
hf=210*np.clip(edt_in/70,0,1)**1.3
n1=ndi.gaussian_filter(np.random.randn(H,W),22);n1=n1/np.abs(n1).max()
hf=hf*(1+.25*n1)
yy2,xx2=np.mgrid[0:H,0:W]
hf+=80*np.exp(-(np.hypot(xx2-746,yy2-140)/50)**2)
hf=ndi.gaussian_filter(hf,9)
hf[(water)|(void)]=0
# сетка 8x8 пикселей (64 ед.)
hc=hf[::8,::8][:H//8+1,:W//8+1]
hg=np.zeros((H//8+1,W//8+1),np.int16);hg[:hc.shape[0],:hc.shape[1]]=np.round(hc).astype(np.int16)
# ---- старт: ближайший узел к центру ----
best=min(range(len(nodes)),key=lambda i:math.hypot(nodes[i][0]-870,nodes[i][1]-520))
sx,sy=nodes[best]
# ---- запись ----
def rle(a):
    f=a.ravel();out=[];s=f[0];n=1
    for v in f[1:]:
        if v==s:n+=1
        else:out+=[int(s),n];s=v;n=1
    out+=[int(s),n];return out
G=dict(n=[[round(x*S,1),round(y*S,1)] for x,y in nodes],
       e=[dict(a=e['a'],b=e['b'],p=[[round(x*S,1),round(y*S,1)] for x,y in e['p']],w=e['ww']) for e in edges])
data=dict(W=TW,H=TH,TS=TS,T=rle(T),B=B,G=G,
          HG=dict(w=int(hg.shape[1]),h=int(hg.shape[0]),cell=64,d=base64.b64encode(hg.astype('<i2').tobytes()).decode()),
          POI=dict(start=[round(sx*S),round(sy*S)],mast=[round(746*S),round(138*S)],arena=list(st),cathedral=list(bs)))
open(OUT,'w').write('// сгенерировано tools/mapgen.py из assets/map.png\nconst MAPDATA='+json.dumps(data,separators=(',',':'))+';\n')
import os;print('mapdata.js',os.path.getsize(OUT)//1024,'KB')
# отладочные картинки
col={0:(60,60,66),1:(200,195,180),2:(190,90,70),3:(220,225,230),4:(40,110,50),5:(50,100,170),6:(15,18,24),7:(180,170,120),8:(90,160,90)}
dbg=np.zeros((TH,TW,3),np.uint8)
for k,v in col.items():dbg[T==k]=v
Image.fromarray(dbg).resize((TW*3,TH*3),Image.NEAREST).save('/tmp/mapw/tiles.png')
zc={0:(230,60,60),1:(230,200,60),2:(60,200,60),3:(60,140,230)}
zd=np.zeros((TH,TW,3),np.uint8)
for k,v in zc.items():zd[(zone==k)&build]=v
Image.fromarray(zd).resize((TW*3,TH*3),Image.NEAREST).save('/tmp/mapw/zones.png')
