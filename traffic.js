'use strict';
// ===== Светофоры, зебры и правила движения =====
// Светофор на каждом перекрёстке графа (узел степени ≥3): две группы направлений, цикл зелёный → жёлтый → красный.
// Зебры берутся из RN.zebras (тот же список, по которому рисуется разметка), пешеходы переходят только по ним.
const TL={ctl:[],byNode:new Map(),zg:new Map(),G:560,Y:110,AR:70,lamps:null,ready:false};
const TL_CYC=()=>2*(TL.G+TL.Y+TL.AR);
const PED_SPD=.7,PED_RUN=2.1;
// сигнал группы g на узле: {c:'g'|'y'|'r', left: кадров до смены}
function lampState(c,g){
  const cyc=TL_CYC(),half=TL.G+TL.Y+TL.AR,t=((tm+c.off+(g?half:0))%cyc+cyc)%cyc;
  if(t<TL.G)return {c:'g',left:TL.G-t};
  if(t<TL.G+TL.Y)return {c:'y',left:TL.G+TL.Y-t};
  return {c:'r',left:cyc-t};
}
// сигнал для подъезда по ребру ei к концу end (узел e.a при end=0, e.b при end=1)
function tlState(node,ei,end){
  const c=TL.byNode.get(node);if(!c)return null;
  const o=c.ends.find(q=>q.ei===ei&&q.end===end);if(!o)return null;
  return lampState(c,o.g);
}
function initTraffic(){
  TL.ctl.length=0;TL.byNode.clear();TL.zg.clear();
  const G=MAPDATA.G;
  for(const pl of RN.plates){
    if(pl.list.length<3)continue;
    const th0=pl.list[0].ang,grp=pl.list.map(o=>{const d=(((o.ang-th0)%Math.PI)+Math.PI)%Math.PI;return (d<Math.PI/4||d>3*Math.PI/4)?0:1;});
    if(!grp.includes(0)||!grp.includes(1))grp.forEach((_,i)=>grp[i]=i%2);
    const c={ni:pl.ni,n:pl.n,off:Math.floor(Math.random()*TL_CYC()),last:['',''],ends:pl.list.map((o,i)=>({ei:o.ei,end:o.end,g:grp[i],u:o.u,h:o.h,li:-1}))};
    TL.ctl.push(c);TL.byNode.set(pl.ni,c);
  }
  // сетка зебр по тайлам
  RN.zebras.forEach((z,zi)=>{
    z.occ=0;z.ha=z.len/2+22;z.hr=z.wid/2+5;
    const R=Math.hypot(z.ha,z.hr),x0=Math.floor((z.x-R)/TS),x1=Math.floor((z.x+R)/TS),y0=Math.floor((z.y-R)/TS),y1=Math.floor((z.y+R)/TS);
    for(let ty=y0;ty<=y1;ty++)for(let tx=x0;tx<=x1;tx++){const k=ty*MW+tx;let a=TL.zg.get(k);if(!a)TL.zg.set(k,a=[]);a.push(zi);}
  });
  RN.zmap=new Map();RN.zebras.forEach((z,zi)=>RN.zmap.set(z.edge*2+z.end,zi));
  TL.ready=true;
}
// зебра на выезде: ch=[ребро, направление движения]; движение a→b стартует у конца 0 этого ребра
function exitZebra(ch){const zi=RN.zmap&&RN.zmap.get(ch[0]*2+(ch[1]>0?0:1));return zi===undefined?-1:zi;}
// индекс зебры, в прямоугольнике которой лежит точка, иначе -1
function zebraAt(x,y){
  const a=TL.zg.get(Math.floor(y/TS)*MW+Math.floor(x/TS));if(!a)return -1;
  for(const zi of a){const z=RN.zebras[zi],dx=x-z.x,dy=y-z.y;if(Math.abs(dx*z.ax+dy*z.ay)<=z.ha&&Math.abs(dx*z.rx+dy*z.ry)<=z.hr)return zi;}
  return -1;
}
// ---------- 3D: стойки со светофорами (инстансы) ----------
function buildLights(){
  TL.lamps=null;
  const E=[];for(const c of TL.ctl)for(const o of c.ends)E.push({c,o});
  const n=E.length;if(!n)return;
  const G=MAPDATA.G;
  const metal=new THREE.MeshStandardMaterial({color:0x23272b,roughness:.5,metalness:.8,envMapIntensity:.8});
  const pole=new THREE.InstancedMesh(new THREE.CylinderGeometry(.9,1.2,46,10),metal,n);
  const hg=new THREE.BoxGeometry(4.4,13,4.6);hg.translate(0,0,0);
  const box=new THREE.InstancedMesh(hg,new THREE.MeshStandardMaterial({color:0x14171a,roughness:.6,metalness:.4}),n);
  const lg=new THREE.CylinderGeometry(1.55,1.55,.8,12);lg.rotateZ(Math.PI/2);
  const lamps=[0,1,2].map(()=>new THREE.InstancedMesh(lg,new THREE.MeshBasicMaterial({color:0xffffff}),n));
  const LY=[4.2,0,-4.2];
  const M=new THREE.Matrix4(),T=new THREE.Matrix4(),col=new THREE.Color(.05,.05,.05);
  E.forEach(({o},i)=>{
    const e=G.e[o.ei],sd=e.stopD&&e.stopD[o.end];
    let x,z,ux=o.u[0],uy=o.u[1];
    if(sd==null){x=-1e5;z=-1e5;}
    else{
      const A=polyAt(e.p,o.end===0?sd:e.L-sd);
      const rx=uy,ry=-ux,off=o.h+RD.CW+5;            // правая сторона по ходу подъезжающего
      x=A.x+rx*off;z=A.y+ry*off;
    }
    const y=hAt(x,z)+SW+RD.WALK,ry=Math.atan2(-uy,ux);
    pole.setMatrixAt(i,mat4(x,y+23,z,1,1,1,0));
    M.copy(mat4(x,y+52,z,1,1,1,ry));box.setMatrixAt(i,M);
    for(let k=0;k<3;k++){M.copy(mat4(x,y+52,z,1,1,1,ry));T.makeTranslation(2.35,LY[k],0);M.multiply(T);lamps[k].setMatrixAt(i,M);lamps[k].setColorAt(i,col);}
    o.li=i;
  });
  for(const m of [pole,box,...lamps]){m.frustumCulled=false;world.add(m);}
  pole.castShadow=true;
  TL.lamps=lamps;
  for(const c of TL.ctl)c.last=['',''];
}
const LAMPC={r:[4,.25,.2],y:[4,2.8,.2],g:[.15,3.2,.5],off:[.05,.05,.05]};
function updateLights(){
  if(!TL.lamps)return;
  const col=new THREE.Color();let dirty=false;
  for(const c of TL.ctl)for(const g of [0,1]){
    const s=lampState(c,g).c;if(s===c.last[g])continue;c.last[g]=s;dirty=true;
    for(const o of c.ends)if(o.g===g&&o.li>=0)for(let k=0;k<3;k++){
      const on=(k===0&&s==='r')||(k===1&&s==='y')||(k===2&&s==='g'),v=LAMPC[on?s:'off'];
      col.setRGB(v[0],v[1],v[2]);TL.lamps[k].setColorAt(o.li,col);
    }
  }
  if(dirty)for(const m of TL.lamps)m.instanceColor.needsUpdate=true;
}
// ---------- правила для машин ----------
// ближайшее препятствие впереди по ходу: {d: зазор, v: скорость препятствия вдоль хода}
function leadGap(c,range,ignoreCars){
  const cs=Math.cos(c.a),sn=Math.sin(c.a);const best={d:1e9,v:0};
  const consider=(x,y,hw,hl,vx,vy)=>{
    const dx=x-c.x,dy=y-c.y,f=dx*cs+dy*sn;if(f<=0||f>range+c.len)return;
    if(Math.abs(-dx*sn+dy*cs)>c.wid/2+hw+3)return;
    const gap=f-c.len/2-hl;if(gap<best.d){best.d=gap;best.v=vx*cs+vy*sn;}
  };
  if(!ignoreCars)for(const o of cars)if(o!==c)consider(o.x,o.y,o.wid/2,o.len/2,o.vx,o.vy);
  for(const p of peds)if(!p.dead)consider(p.x,p.y,5,3,0,0);
  if(!P.car&&!P.dead)consider(P.x,P.y,5,3,0,0);
  // зебра с пешеходом: останавливаемся у её ближней кромки
  for(const z of RN.zebras){
    if(!z.occ||Math.abs(z.x-c.x)>range+60||Math.abs(z.y-c.y)>range+60)continue;
    if(Math.abs(z.rx*cs+z.ry*sn)<.5)continue;   // едем вдоль этой дороги (в том числе выезжая с перекрёстка поворотом)
    const dx=z.x-c.x,dy=z.y-c.y,f=dx*cs+dy*sn;if(f<=0||f>range+c.len)continue;
    if(Math.abs(-dx*sn+dy*cs)>z.len/2+8)continue;
    const gap=f-z.wid/2-3-c.len/2;if(gap<best.d){best.d=gap;best.v=0;}
  }
  return best;
}
// стоп-линия впереди: {d: расстояние от бампера до линии, c: сигнал}
function lightAhead(c,ei){
  const e=MAPDATA.G.e[ei],endIdx=c.ed>0?1:0,sd=e.stopD&&e.stopD[endIdx];if(sd==null)return null;
  const st=tlState(endIdx?e.b:e.a,ei,endIdx);if(!st)return null;
  const sp=lanePt(e,c.ed,e.L-sd);
  return {d:(sp.x-c.x)*Math.cos(c.a)+(sp.y-c.y)*Math.sin(c.a)-c.len/2,c:st.c,left:st.left};
}
// ---------- пешеходы: можно ли встать в точку ----------
const walkTile=t=>t===1||t===3||t===7||t===8;
function pedOk(x,y,mode){
  const t=tileAt(Math.floor(x/TS),Math.floor(y/TS));
  if(isSol(t))return false;
  if(mode==='panic')return true;
  if(t===0)return zebraAt(x,y)>=0;
  return walkTile(t);
}
function pedMove(p,ang,spd,mode){
  const nx=p.x+Math.cos(ang)*spd,ny=p.y+Math.sin(ang)*spd;
  if(pedOk(nx,ny,mode)){p.x=nx;p.y=ny;p.step+=spd*.35;p.moving=true;return true;}
  p.moving=false;return false;
}
// все точки отрезка (от пешехода до цели) проходимы
function walkableLine(x0,y0,x1,y1){
  const d=Math.hypot(x1-x0,y1-y0),n=Math.ceil(d/10);
  for(let i=1;i<=n;i++){const t=i/n,x=x0+(x1-x0)*t,y=y0+(y1-y0)*t,tt=tileAt(Math.floor(x/TS),Math.floor(y/TS));if(!walkTile(tt))return false;}
  return true;
}
// сигнал для перехода зебры z: машины на этой дороге стоят на красном, и красного хватит дойти
function pedGreen(z){
  const e=MAPDATA.G.e[z.edge],st=tlState(z.end?e.b:e.a,z.edge,z.end);
  if(!st)return true;
  return st.c==='r'&&st.left>z.len/PED_SPD+40;
}
// по дороге к зебре кто-то едет (в обе стороны, до 170 ед.) — пешеход не выходит
function carOnZebra(z){
  for(const c of cars){
    if(c.dead)continue;
    const dx=z.x-c.x,dy=z.y-c.y;if(Math.abs(dx)>180||Math.abs(dy)>180)continue;
    const d=Math.hypot(dx,dy);
    const ahead=(dx*Math.cos(c.a)+dy*Math.sin(c.a))>-c.len/2;
    if(c.speed>.3&&d<200&&ahead)return true;                            // едет в сторону зебры
    if(d<c.len/2+z.wid/2+z.len/2*.2)return true;                          // стоит на зебре
  }
  return false;
}
// выбрать ближайшую зебру «по пути»: пешеход на одном её краю, идёт примерно к другому
function tryCross(p){
  let best=-1,bd=1e9;
  RN.zebras.forEach((z,i)=>{
    const dx=p.x-z.x,dy=p.y-z.y;if(Math.abs(dx)>260||Math.abs(dy)>260)return;
    const la=dx*z.ax+dy*z.ay,sg=la>0?1:-1,away=-sg;           // идти надо в сторону away*a
    if(Math.abs(la)<z.len/2-10)return;
    if(Math.cos(p.a)*z.ax*away+Math.sin(p.a)*z.ay*away<.2)return;  // примерно в нужную сторону
    const ex=z.x+z.ax*sg*(z.len/2+14),ey=z.y+z.ay*sg*(z.len/2+14),ox=z.x-z.ax*sg*(z.len/2+14),oy=z.y-z.ay*sg*(z.len/2+14);
    const te=tileAt(Math.floor(ex/TS),Math.floor(ey/TS)),to=tileAt(Math.floor(ox/TS),Math.floor(oy/TS));
    if(!walkTile(te)||!walkTile(to))return;
    const d=Math.hypot(ex-p.x,ey-p.y);if(d>=bd)return;
    if(!walkableLine(p.x,p.y,ex,ey))return;
    bd=d;best=i;p.tx=ex;p.ty=ey;p.ex=ox;p.ey=oy;p.ca=Math.atan2(away*z.ay,away*z.ax);
  });
  if(best<0)return false;
  p.mode='goto';p.zi=best;p.mt=0;p.stuck=0;return true;
}
// ближайшее направление на проходимый тайл (для пешехода, оказавшегося на проезжей части)
function safeDir(p){
  for(let r=10;r<=70;r+=10)for(let k=0;k<16;k++){
    const a=k*Math.PI/8,x=p.x+Math.cos(a)*r,y=p.y+Math.sin(a)*r;
    if(walkTile(tileAt(Math.floor(x/TS),Math.floor(y/TS))))return a;
  }
  return null;
}
// шаг гражданского пешехода: прогулка по тротуарам, переход по зебре на разрешающий сигнал, паника
function civStep(p){
  if(p.mode===undefined){p.mode='walk';p.k=ri(0,39);p.zi=-1;}
  if(p.flee>0){p.mode='walk';p.zi=-1;pedMove(p,p.a,PED_RUN,'panic');p.flee--;return;}
  p.flee--;
  const t=tileAt(Math.floor(p.x/TS),Math.floor(p.y/TS));
  if(t===0&&zebraAt(p.x,p.y)<0){ // оказался на проезжей части вне зебры (после паники): бегом на ближайший тротуар
    const a=safeDir(p);if(a!==null){p.a=a;pedMove(p,a,PED_RUN,'panic');}else p.moving=false;
    p.mode='ret';return;
  }
  if(p.mode==='ret')p.mode='walk';
  if(p.mode==='goto'){
    const d=Math.hypot(p.tx-p.x,p.ty-p.y);
    if(d<7){p.mode='wait';p.wt=0;p.a=p.ca;p.moving=false;return;}
    p.a=Math.atan2(p.ty-p.y,p.tx-p.x);
    if(!pedMove(p,p.a,PED_SPD,'walk')){if(++p.stuck>40)p.mode='walk';}else p.stuck=0;
    if(++p.mt>900)p.mode='walk';
    return;
  }
  if(p.mode==='wait'){
    p.moving=false;p.wt++;
    const z=RN.zebras[p.zi];
    if(z&&pedGreen(z)&&!carOnZebra(z)){p.mode='cross';p.a=p.ca;}
    else if(p.wt>2400)p.mode='walk';
    return;
  }
  if(p.mode==='cross'){
    pedMove(p,p.ca,PED_SPD,'walk');
    const z=RN.zebras[p.zi];
    // дошли до выходной точки или вышли за край зебры
    if(Math.hypot(p.ex-p.x,p.ey-p.y)<8||(z&&zebraAt(p.x,p.y)<0&&tileAt(Math.floor(p.x/TS),Math.floor(p.y/TS))!==0)){p.mode='walk';p.t=ri(80,300);}
    return;
  }
  // прогулка
  p.t--;if(p.t<=0){p.a+=rnd(-1,1);p.t=ri(80,300);}
  if((tm+p.k)%40===0&&Math.random()<.35&&tryCross(p))return;
  if(!pedMove(p,p.a,PED_SPD,'walk'))p.a+=(Math.random()<.5?1:-1)*(Math.PI/2)+rnd(-.4,.4);
}
function trafficUpdate(){
  if(!TL.ready)return;
  updateLights();
}
