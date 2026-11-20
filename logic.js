'use strict';
// ===== ИИ, физика, спавн =====
const cam={x:0,y:0};
const START={x:MAPDATA.POI.start[0],y:MAPDATA.POI.start[1]};
const minSpawn=()=>680;
// ---- граф дорог для трафика ----
let GADJ=null;
function initGraph(){
  const G=MAPDATA.G;GADJ=G.n.map(()=>[]);
  G.e.forEach((e,i)=>{let L=0;for(let k=1;k<e.p.length;k++)L+=Math.hypot(e.p[k][0]-e.p[k-1][0],e.p[k][1]-e.p[k-1][1]);e.L=L;GADJ[e.a].push([i,1]);GADJ[e.b].push([i,-1]);});
}
// точка правой полосы ребра e в направлении d на расстоянии s вдоль движения
function lanePt(e,d,s){
  const P=e.p,L=e.L;let t=d>0?s:L-s;t=clamp(t,0,L);
  for(let i=1;i<P.length;i++){
    const dx=P[i][0]-P[i-1][0],dy=P[i][1]-P[i-1][1],l=Math.hypot(dx,dy);
    if(t<=l||i===P.length-1){
      const u=l?clamp(t/l,0,1):0,hx=dx/(l||1)*d,hy=dy/(l||1)*d,off=e.w/4;
      return {x:P[i-1][0]+dx*u-hy*off,y:P[i-1][1]+dy*u+hx*off,hx,hy};
    }
    t-=l;
  }
}
function laneSpawn(maxTry){
  if(!GADJ)initGraph();
  const E=MAPDATA.G.e;
  for(let i=0;i<maxTry*4;i++){
    const ei=Math.floor(Math.random()*E.length),e=E[ei];if(e.L<160)continue;
    const d=Math.random()<.5?1:-1,s=rnd(40,e.L-40),p=lanePt(e,d,s);
    const dd=Math.hypot(p.x-P.x,p.y-P.y);
    if(dd<minSpawn()||dd>minSpawn()+620)continue;
    if(tileAt(Math.floor(p.x/TS),Math.floor(p.y/TS))!==0)continue;
    if(s<(d>0?e.sa:e.sb)+70||s>e.L-(d>0?e.sb:e.sa)-70)continue;   // не появляться у перекрёстков и зебр
    {const sd=e.stopD&&e.stopD[d>0?1:0];            // не появляться на подходе к светофору, если не горит зелёный с запасом
     if(sd!=null){const dl=(e.L-sd)-s;if(dl>-30&&dl<170){const st=tlState(d>0?e.b:e.a,ei,d>0?1:0);if(!st||st.c!=='g'||st.left<240)continue;}}}
    if(cars.some(c=>Math.hypot(c.x-p.x,c.y-p.y)<80))continue;
    return {x:p.x,y:p.y,a:Math.atan2(p.hy,p.hx),edge:ei,ed:d,s};
  }
  return null;
}
function spawnTraffic(){
  const s=laneSpawn(12);if(!s)return;
  const r=Math.random(),type=r<.07?'taxi':r<.14?'van':r<.17?'limo':r<.3?'executive':r<.46?'compact':r<.62?'sport':'sedan';
  const c=new Car(type,s.x,s.y,s.a);
  c.ai='traffic';c.edge=s.edge;c.ed=s.ed;c.s=s.s;
  const sp=c.t.max*.5;c.vx=Math.cos(s.a)*sp;c.vy=Math.sin(s.a)*sp;
  cars.push(c);
}
function spawnCop(){
  const s=laneSpawn(12);if(!s)return;
  const c=new Car('cop',s.x,s.y,s.a);c.ai='cop';cars.push(c);
}
function spawnPed(kind){
  for(let i=0;i<12;i++){
    const a=rnd(0,6.28),d=rnd(minSpawn(),minSpawn()+600);
    const x=P.x+Math.cos(a)*d,y=P.y+Math.sin(a)*d;
    if(tileAt(Math.floor(x/TS),Math.floor(y/TS))!==1)continue;
    peds.push(new Ped(x,y,kind));return;
  }
}
// ---- закоулки: места для находок (оружие, броня) ----
const ALLEY=[];
function buildAlleys(){
  ALLEY.length=0;
  const near=(tx,ty,r,f)=>{for(let j=-r;j<=r;j++)for(let i=-r;i<=r;i++)if(f(tileAt(tx+i,ty+j)))return true;return false;};
  for(let ty=2;ty<MH-2;ty++)for(let tx=2;tx<MW-2;tx++){
    if(T[ty*MW+tx]!==3)continue;                                                   // двор
    if(![[1,0],[-1,0],[0,1],[0,-1]].some(([dx,dy])=>tileAt(tx+dx,ty+dy)===2))continue;   // у стены здания
    if(near(tx,ty,2,t=>t===0||t===5))continue;                                      // далеко от дороги и воды: задний двор
    ALLEY.push([(tx+.5)*TS,(ty+.5)*TS]);
  }
  // тупики графа: тайлы 1/3 у концов дорог
  const deg=new Array(MAPDATA.G.n.length).fill(0);for(const e of MAPDATA.G.e){deg[e.a]++;deg[e.b]++;}
  MAPDATA.G.n.forEach((n,i)=>{if(deg[i]!==1)return;for(let k=0;k<8;k++){const a=rnd(0,6.28),x=n[0]+Math.cos(a)*rnd(60,110),y=n[1]+Math.sin(a)*rnd(60,110),t=tileAt(Math.floor(x/TS),Math.floor(y/TS));if(t===1||t===3){ALLEY.push([x,y]);break;}}});
}
const CACHE_N=70,CACHE_W=[[1,.16],[2,.16],[6,.1],[7,.1],[5,.1],[3,.08],[4,.08]]; // вид оружия и вес выпадения; остальное — броня
function cacheKind(){
  const r=Math.random();let s=0;
  for(const [w,p] of CACHE_W){s+=p;if(r<s)return {type:'weapon',w};}
  return {type:'armor'};
}
const cacheCount=()=>picks.reduce((n,k)=>n+(k.cache?1:0),0);
function spawnCache(near){
  if(!ALLEY.length)return false;
  for(let i=0;i<20;i++){
    const [x,y]=pick(ALLEY);
    if(near){const d=Math.hypot(x-P.x,y-P.y);if(d<350||d>2400)continue;}
    if(picks.some(k=>k.cache&&Math.hypot(k.x-x,k.y-y)<60))continue;
    picks.push(Object.assign({x,y,v:0,t:99999,cache:true},cacheKind()));return true;
  }
  return false;
}
function spawnPick(){
  for(let i=0;i<12;i++){
    const a=rnd(0,6.28),d=rnd(250,1300);
    const x=P.x+Math.cos(a)*d,y=P.y+Math.sin(a)*d;
    if(tileAt(Math.floor(x/TS),Math.floor(y/TS))!==1)continue;
    const r=Math.random();
    picks.push({x,y,type:r<.6?'cash':r<.82?'ammo':'hp',v:ri(50,250),t:99999});return;
  }
}

// --- ИИ трафика: правая полоса, светофоры, дистанция, пропуск пешеходов (см. traffic.js) ---
function aiTraffic(c){
  if(!GADJ)initGraph();
  const E=MAPDATA.G.e;let e=E[c.edge];
  if(!e){c.off=9999;return;}
  { // прогресс по ребру — по ближайшей точке полосы впереди (иначе машина, въехавшая далеко от начала полосы, ходит по кругу)
    let best=c.s,bd=1e9;
    for(let s=c.s;s<=Math.min(e.L,c.s+170);s+=8){const q=lanePt(e,c.ed,s),d=Math.hypot(c.x-q.x,c.y-q.y);if(d<bd){bd=d;best=s;}}
    c.s=best;
  }
  // следующее ребро выбирается заранее (нужно, чтобы уступить пешеходам на зебре выезда)
  const nk=c.edge+','+c.ed;
  if(c.nxk!==nk){const node=c.ed>0?e.b:e.a,opts=GADJ[node].filter(([i,d])=>!(i===c.edge&&d===-c.ed));c.nxt=opts.length?pick(opts):[c.edge,-c.ed];c.nxk=nk;}
  if(c.s>=e.L-2){ // конец ребра: на перекрёстке едем по выбранному
    const ch=c.nxt;
    c.edge=ch[0];c.ed=ch[1];c.s=0;e=E[c.edge];
  }
  const tgt=lanePt(e,c.ed,Math.min(e.L,c.s+46));
  if(tileAt(Math.floor(c.x/TS),Math.floor(c.y/TS))!==0){c.off++;}else c.off=0;
  const want=Math.atan2(tgt.y-c.y,tgt.x-c.x),str=clamp(angDiff(c.a,want)*2,-1,1);
  const vf=c.vx*Math.cos(c.a)+c.vy*Math.sin(c.a),maxV=c.t.max*.5;
  let vd=maxV;
  // дистанция до машины, пешехода или занятой зебры впереди
  if(c.push>0)c.push--;
  const g=leadGap(c,220,c.push>0);
  if(g.d<1e8)vd=Math.min(vd,clamp(g.v+(g.d-8)*.085,0,maxV));
  const L=lightAhead(c,c.edge);
  let atLight=false;
  // на зебре выезда стоит пешеход: не въезжаем на перекрёсток, ждём у стоп-линии
  if(L&&L.d>-8&&c.nxt&&c.nxk===c.edge+','+c.ed){
    const zi=exitZebra(c.nxt);if(zi>=0&&RN.zebras[zi].occ>0){vd=Math.min(vd,clamp((L.d-6)*.085,0,maxV));atLight=L.d<60;}
  }
  // уже на перекрёстке (в том числе уже на зебре): не выезжать вперёд, пока на ней пешеход (путь до неё — вдоль выезжающей дороги, работает и при повороте)
  if((!L||L.d<=-8)&&c.nxt&&c.nxk===c.edge+','+c.ed){
    const zi=exitZebra(c.nxt);
    if(zi>=0&&RN.zebras[zi].occ>0){const z=RN.zebras[zi],sc=(c.x-z.x)*z.rx+(c.y-z.y)*z.ry,gap=-sc-z.wid/2-c.len/2;
      if(gap>-(c.len+8)&&gap<260)vd=Math.min(vd,clamp((gap-6)*.085,0,maxV));}
  }
  // светофор: решение по расстоянию до стоп-линии. Красный — встаём, жёлтый — встаём, если не успеваем проскочить до красного
  // и ещё можем остановиться (аварийное торможение 3·v+3). Если и то и другое невозможно — остановка уже невозможна, едем дальше.
  let bk=0;
  if(L&&L.d>-12&&L.c!=='g'){
    const reach=vf>.3&&L.d/vf<L.left*.9,hardD=3*Math.max(vf,0)+3;
    if(L.c==='r'||(!reach&&L.d>hardD)){
      vd=Math.min(vd,clamp((L.d-14)*.085,0,maxV));atLight=L.d<70;      // встаём за ~10 ед. до линии: запас на толчок
      bk=clamp(1-vf/Math.max(L.d-10,1.5),.45,.9);   // тормозим так, чтобы встать ровно перед линией
    }
  }
  // не въезжать в забитый перекрёсток (если очередь не рассасывается слишком долго — едем, иначе затор навсегда)
  if(L&&L.d>-12&&c.nxt&&c.nxk===c.edge+','+c.ed){
    const node=c.ed>0?E[c.edge].b:E[c.edge].a;
    if(L.c!=='g'||true){
      if(junctionBlocked(c,node,c.nxt)||exitRoomBlocked(c,c.nxt)){c.jw=(c.jw||0)+1;if(c.jw<900){vd=Math.min(vd,clamp((L.d-6)*.085,0,maxV));atLight=L.d<70;if(vf>.3&&9*vf+6>L.d)bk=Math.min(bk||.9,clamp(1-vf/Math.max(L.d-3,1.2),.45,.9));}}
      else c.jw=0;
    }
  }
  // зебра: не въезжать на неё, если за ней нет места для всей машины (иначе встанем на переходе)
  if(g.d<1e8&&g.v<1){
    const tryZ=(zi,dir)=>{
      if(zi===undefined||zi<0)return;const z=RN.zebras[zi];
      const sc=(c.x-z.x)*z.rx+(c.y-z.y)*z.ry,near=(dir>0?-sc:sc)-z.wid/2-c.len/2;       // от бампера до ближней кромки
      if(near<-2||near>200)return;
      if(g.d<near+z.wid+6+c.len+8)vd=Math.min(vd,clamp((near-6)*.085,0,maxV));
    };
    const arr=c.ed>0?1:0;tryZ(RN.zmap&&RN.zmap.get(c.edge*2+arr),-1);   // зебра подъезда: r направлен от перекрёстка, до неё sc>0
    if(c.nxt)tryZ(exitZebra(c.nxt),1);
  }
  // затор не на светофоре: через время подтолкнуть, игнорируя машины впереди
  const redAhead=L&&L.c==='r'&&L.d<900;        // очередь у красного светофора — не затор, подталкивать нельзя
  const gapBlock=g.d<14&&!atLight&&!redAhead;
  c.blocked=gapBlock&&vf<.3?c.blocked+1:0;
  if(c.blocked===150&&Math.random()<.5)snd('honk');
  if(c.blocked>700){c.push=120;c.blocked=0;}
  if(vf>vd+.1||(vd<.3&&vf>.02))c.drive(0,str,true,false,bk);   // у линии тормозим до полной остановки, ползти нельзя
  else c.drive(vf<vd?clamp((vd-vf)/1.2,.2,1):0,str,false,false);
}
function aiCop(c){
  if(P.heat<1||P.dead){c.drive(0,0,true,false);return;}
  const tgt=P.car||P;
  const tx=P.seen?tgt.x:P.lastX,ty=P.seen?tgt.y:P.lastY;
  const dx=tx-c.x,dy=ty-c.y,d=Math.hypot(dx,dy);
  let want=Math.atan2(dy,dx);
  const cs=Math.cos(c.a),sn=Math.sin(c.a);
  const probe=(ang)=>solidAt(c.x+Math.cos(ang)*65,c.y+Math.sin(ang)*65);
  let brake=false;
  if(probe(c.a)||probe(c.a-.5)||probe(c.a+.5)){
    const l=probe(c.a-.6),r=probe(c.a+.6);
    want=c.a+(l&&!r?1.2:!l&&r?-1.2:1.2);brake=c.speed>4;
  }
  let thr=1;
  if(c.rev>0){c.rev--;c.drive(-1,-clamp(angDiff(c.a,want),-1,1),false,false);return;}
  if(c.speed<.4){c.stuck++;if(c.stuck>50){c.rev=50;c.stuck=0;}}else c.stuck=0;
  if(!P.seen&&d<150){ // поиск: медленно кружит у места, где видели
    c.srch=(c.srch||0)+1;want=c.a+Math.sin(c.srch*.03)*1.1;thr=c.speed<3?.6:0;
  }else if(d<90&&c.speed>5)thr=0;
  c.drive(thr,clamp(angDiff(c.a,want)*2,-1,1),brake,false);
  c.flash+=1;
}

// --- Физика столкновений ---
function carWalls(c){
  let impact=0;
  for(let it=0;it<2;it++){
    for(const [x,y,r] of c.circles()){
      const p=circleTilePush(x,y,r);
      if(p){
        c.x+=p.x;c.y+=p.y;
        const l=Math.hypot(p.x,p.y)||1,nx=p.x/l,ny=p.y/l,vn=c.vx*nx+c.vy*ny;
        if(vn<0){impact=Math.max(impact,-vn);c.vx-=1.25*vn*nx;c.vy-=1.25*vn*ny;c.vx*=.96;c.vy*=.96;}
      }
    }
  }
  c.x=clamp(c.x,20,WW-20);c.y=clamp(c.y,20,WH-20);
  if(impact>2.2){c.damage((impact-2)*7,c===P.car?'wall':'ai');if(c===P.car){snd('hit');shake=Math.max(shake,impact);}}
}
function carCars(){
  for(let i=0;i<cars.length;i++)for(let j=i+1;j<cars.length;j++){
    const a=cars[i],b=cars[j];
    if(Math.hypot(a.x-b.x,a.y-b.y)>(a.len+b.len)/2+4)continue;
    const ia=a.dead?0:1/(a.t.mass||1),ib=b.dead?0:1/(b.t.mass||1),tot=ia+ib;
    if(!tot)continue;
    let done=false;
    for(const A of a.circles()){
      for(const B of b.circles()){
        const dx=B[0]-A[0],dy=B[1]-A[1],d=Math.hypot(dx,dy),m=A[2]+B[2];
        if(d<m&&d>.001){
          const nx=dx/d,ny=dy/d,o=m-d;
          a.x-=nx*o*ia/tot;a.y-=ny*o*ia/tot;b.x+=nx*o*ib/tot;b.y+=ny*o*ib/tot;
          const rv=(b.vx-a.vx)*nx+(b.vy-a.vy)*ny;
          if(rv<0){
            const j2=-1.3*rv/tot;
            a.vx-=j2*ia*nx;a.vy-=j2*ia*ny;b.vx+=j2*ib*nx;b.vy+=j2*ib*ny;
            const imp=-rv;
            if(imp>1.5){
              const dm=(imp-1)*6;
              a.damage(dm,b===P.car?'player':'ai');b.damage(dm,a===P.car?'player':'ai');
              snd('hit');if(a===P.car||b===P.car)shake=Math.max(shake,imp);
              for(let k=0;k<4;k++)part(A[0],A[1],rnd(-3,3),rnd(-3,3),rnd(8,16),2,'255,220,120','k');
            }
          }
          done=true;break;
        }
      }
      if(done)break;
    }
  }
}
function updateCar(c,tm){
  if(c.burn>0){
    c.burn--;
    if(tm%3===0)part(c.x+rnd(-8,8),c.y+rnd(-8,8),rnd(-.3,.3),rnd(-1,-.3),rnd(25,45),rnd(8,14),'255,140,30','f');
    if(tm%4===0)part(c.x,c.y,rnd(-.4,.4),rnd(-1.2,-.4),rnd(40,70),rnd(10,18),'40,40,40','s');
    if(c.burn===0){
      c.dead=true;c.fire=900;
      explode(c.x,c.y,85,70,c.ai==='cop'?'player':'ai');
      if(P.car===c){P.car=null;P.hp=0;}
    }
  }
  if(c.dead){
    c.vx*=.9;c.vy*=.9;
    if(c.fire>0){c.fire--;if(tm%5===0)part(c.x+rnd(-10,10),c.y+rnd(-8,8),rnd(-.2,.2),rnd(-.9,-.3),rnd(20,38),rnd(7,13),'255,130,30','f');}
  }else if(c===P.car){/* управляет игрок */}
  else if(c.burn>0){c.drive(0,0,true,false);}
  else if(c.ai==='traffic')aiTraffic(c);
  else if(c.ai==='cop')aiCop(c);
  else if(c.ai==='block'){c.drive(0,0,true,false);c.flash+=1;}
  else{c.vx*=.94;c.vy*=.94;}
  c.x+=c.vx;c.y+=c.vy;
  carWalls(c);
  if(c.ai==='traffic'&&c.off>200)c.off=9999;
}
// --- Пешеходы ---
const PED_KILL_SPD=2.8;      // скорость машины, при которой сбитый пешеход гибнет
const PLAYER_HIT_SPD=1.8,PLAYER_KILL_SPD=6.3;
function carHitPed(p){
  for(const c of cars){
    if(c.dead)continue;
    const dx=p.x-c.x,dy=p.y-c.y;if(Math.abs(dx)>40||Math.abs(dy)>40)continue;
    const cs=Math.cos(c.a),sn=Math.sin(c.a),lx=dx*cs+dy*sn,ly=-dx*sn+dy*cs;
    if(Math.abs(lx)<c.len/2+3&&Math.abs(ly)<c.wid/2+3){
      if(c.speed>=PED_KILL_SPD){killPed(p,c===P.car?'player':'ai');alertPeds(p.x,p.y,300);}
      else{const side=ly>0?1:-1;p.x+=-sn*side*3;p.y+=cs*side*3;}  // тихий ход: просто оттолкнуть в сторону
      return;
    }
  }
}
// игрок пешком: машины твёрдые, на скорости наезд бьёт или убивает
function playerCarHit(){
  if(P.car||P.dead||P.busted>0)return;
  P.hitCd=(P.hitCd||0)-1;
  for(const c of cars){
    const dx=P.x-c.x,dy=P.y-c.y;if(Math.abs(dx)>46||Math.abs(dy)>46)continue;
    const cs=Math.cos(c.a),sn=Math.sin(c.a),lx=dx*cs+dy*sn,ly=-dx*sn+dy*cs,hl=c.len/2+5,hw=c.wid/2+5;
    if(Math.abs(lx)>=hl||Math.abs(ly)>=hw)continue;
    const ox=hl-Math.abs(lx),oy=hw-Math.abs(ly);
    if(ox<oy){const s=lx>0?1:-1;P.x+=cs*s*ox;P.y+=sn*s*ox;}else{const s=ly>0?1:-1;P.x+=-sn*s*oy;P.y+=cs*s*oy;}
    const sp=c.speed;
    if(!c.dead&&sp>=PLAYER_HIT_SPD&&P.hitCd<=0){
      P.hitCd=40;
      if(sp>=PLAYER_KILL_SPD){P.armor=0;P.hp=0;blood(P.x,P.y);snd('hit');}
      else hurtPlayer((sp-1.2)*15);
      P.x+=c.vx*2.5;P.y+=c.vy*2.5;
    }
  }
}
function updatePeds(){
  for(const z of RN.zebras)z.occ=0;
  // занятость зебры: пешеход (или игрок) стоит на проезжей части в её прямоугольнике; ждущие на тротуаре машин не задерживают
  const onRoad=(x,y)=>tileAt(Math.floor(x/TS),Math.floor(y/TS))===0;
  for(const p of peds)if(!p.dead&&onRoad(p.x,p.y)){const zi=zebraAt(p.x,p.y);if(zi>=0)RN.zebras[zi].occ++;}
  if(!P.car&&!P.dead&&onRoad(P.x,P.y)){const zi=zebraAt(P.x,P.y);if(zi>=0)RN.zebras[zi].occ++;}
  for(const p of peds){
    if(p.dead)continue;
    carHitPed(p);
    if(p.dead)continue;
    if(p.kind==='civ'){
      if(P.car&&p.flee<=0&&P.car.speed>3&&Math.hypot(p.x-P.car.x,p.y-P.car.y)<110){p.flee=120;p.a=Math.atan2(p.y-P.car.y,p.x-P.car.x)+rnd(-.6,.6);}
      if(p.cow>0){p.cow--;p.moving=false;if(p.cow===0)p.flee=200;continue;}
      civStep(p);
      continue;
    }
    // полицейский на ногах: идёт куда угодно, кроме твёрдых тайлов
    const tgt=P.car||P,r=copFootAI(p,tgt);p.moving=r.move>0;if(!r.move)continue;p.mv=r.move;
    const sp=1.6*(p.mv||1);
    const nx=p.x+Math.cos(p.a)*sp,ny=p.y+Math.sin(p.a)*sp;
    if(!isSol(tileAt(Math.floor(nx/TS),Math.floor(ny/TS)))){p.x=nx;p.y=ny;p.step+=sp*.35;}
    else p.a+=(Math.random()<.5?1:-1)*(Math.PI/2)+rnd(-.4,.4);
  }
}
function alertPeds(x,y,r){
  for(const p of peds)if(p.kind==='civ'&&!p.dead&&p.flee<=0&&Math.hypot(p.x-x,p.y-y)<r){p.flee=150;p.a=Math.atan2(p.y-y,p.x-x)+rnd(-.5,.5);}
}
// --- Пули ---
function fireBullet(x,y,a,w,owner){
  const W=WEAPONS[w];
  bullets.push({x,y,vx:Math.cos(a)*W.spd,vy:Math.sin(a)*W.spd,l:W.life,dmg:W.dmg,owner,rocket:W.kind==='rocket',blast:W.blast});
}
// ближний бой: удар в конусе перед игроком (кастет, дубина, нож, бензопила)
function meleeAttack(W){
  const half=W.arc/2;let hit=0;
  for(const p of peds){
    if(p.dead)continue;
    const dx=p.x-P.x,dy=p.y-P.y,d=Math.hypot(dx,dy);if(d>W.range+6)continue;
    if(d>10&&Math.abs(angDiff(P.a,Math.atan2(dy,dx)))>half)continue;
    hit++;p.hp-=W.dmg;
    for(let i=0;i<3;i++)part(p.x,p.y,rnd(-1.5,1.5),rnd(-1.5,1.5),rnd(8,16),2,'170,20,20','k');
    if(p.hp<=0)killPed(p,'player');else{p.flee=140;p.a=Math.atan2(dy,dx);}
  }
  const tx=P.x+Math.cos(P.a)*W.range*.7,ty=P.y+Math.sin(P.a)*W.range*.7;
  part(tx,ty,Math.cos(P.a)*1.5,Math.sin(P.a)*1.5,6,2,W.id==='saw'?'255,220,120':'230,230,230','k');
  if(hit){crime('assault',P.x,P.y,.2,1);alertPeds(P.x,P.y,160);shake=Math.max(shake,W.id==='saw'?2:1);}
}
// огнемёт: струя огня и урон по площади (конус)
function flameAttack(W){
  for(let i=0;i<4;i++){const a=P.a+rnd(-W.arc/2,W.arc/2),s=rnd(2.2,4.2);part(P.x+Math.cos(P.a)*12,P.y+Math.sin(P.a)*12,Math.cos(a)*s,Math.sin(a)*s,rnd(14,26),rnd(5,10),'255,150,40','f');}
  if(tm%6===0)part(P.x+Math.cos(P.a)*20,P.y+Math.sin(P.a)*20,Math.cos(P.a)*1.5,Math.sin(P.a)*1.5,rnd(30,50),rnd(8,14),'40,40,40','s');
  const half=W.arc/2;
  for(const p of peds){
    if(p.dead)continue;const dx=p.x-P.x,dy=p.y-P.y,d=Math.hypot(dx,dy);if(d>W.range||(d>10&&Math.abs(angDiff(P.a,Math.atan2(dy,dx)))>half))continue;
    p.hp-=W.dmg*3;if(p.hp<=0)killPed(p,'player');else{p.flee=140;}
  }
  for(const c of cars){
    if(c.dead||c===P.car)continue;const dx=c.x-P.x,dy=c.y-P.y,d=Math.hypot(dx,dy)-c.len/2;if(d>W.range||(d>10&&Math.abs(angDiff(P.a,Math.atan2(dy,dx)))>half+.25))continue;
    c.damage(W.dmg*.9,'player');
  }
}
function updateBullets(tm){
  for(const b of bullets){
    if(b.dead)continue;
    for(let s=0;s<2&&!b.dead;s++){
      b.x+=b.vx/2;b.y+=b.vy/2;
      if(b.rocket&&tm%2===0)part(b.x,b.y,rnd(-.3,.3),rnd(-.3,.3),rnd(12,20),5,'200,200,200','s');
      if(solidAt(b.x,b.y)){b.dead=true;break;}
      for(const c of cars){
        if(c===P.car&&b.owner==='player')continue;
        const dx=b.x-c.x,dy=b.y-c.y;if(Math.abs(dx)>40||Math.abs(dy)>40)continue;
        const cs=Math.cos(c.a),sn=Math.sin(c.a),lx=dx*cs+dy*sn,ly=-dx*sn+dy*cs;
        if(Math.abs(lx)<c.len/2&&Math.abs(ly)<c.wid/2){
          if(!b.rocket)c.damage(b.dmg*(b.owner==='cop'?.5:.6),b.owner);
          b.dead=true;part(b.x,b.y,rnd(-2,2),rnd(-2,2),10,2,'255,220,120','k');break;
        }
      }
      if(b.dead)break;
      if(b.owner==='player'){
        for(const p of peds){
          if(p.dead||Math.hypot(p.x-b.x,p.y-b.y)>8)continue;
          if(!b.rocket){p.hp-=b.dmg;if(p.hp<=0)killPed(p,'player');else{p.flee=120;}}
          if(p.kind==='civ'&&!p.dead)p.a=Math.atan2(p.y-P.y,p.x-P.x);
          b.dead=true;break;
        }
      }else if(!P.car&&!P.dead&&Math.hypot(P.x-b.x,P.y-b.y)<8){hurtPlayer(b.dmg);b.dead=true;}
    }
    b.l--;
    if(b.l<=0)b.dead=true;
    if(b.dead&&b.rocket)explode(b.x,b.y,b.blast?b.blast.r:75,b.blast?b.blast.dmg:95,b.owner);
  }
  for(let i=bullets.length-1;i>=0;i--)if(bullets[i].dead)bullets.splice(i,1);
}
function updateParts(){
  for(let i=parts.length-1;i>=0;i--){
    const p=parts[i];p.x+=p.vx;p.y+=p.vy;p.l--;
    if(p.k==='s'){p.vx*=.97;p.vy*=.97;p.s+=.15;}else if(p.k==='f'){p.vx*=.96;p.vy*=.96;p.s*=.97;}else p.vx*=.95;
    if(p.l<=0)parts.splice(i,1);
  }
}
