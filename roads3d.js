'use strict';
// ===== Улицы лентами вдоль рёбер графа: полотно, тротуар, бордюр, скруглённые перекрёстки, разметка =====
// Тайлы остаются для столкновений и навигации; здесь только визуальная геометрия и список зебр для симуляции.
const R2PI=Math.PI*2;
const RN={ready:false,zebras:[],stops:[],plates:[],cover:null,mats:null};
const RD={CW:3.2,CURB_H:1.7,ASPH:.35,WALK:.18,R0:40,STEP:24};
const swWidth=w=>w>=128?64:34;           // ширина тротуара за бордюром (≈ 1–2 тайла)
const eR=(a,b)=>Math.hypot(a[0]-b[0],a[1]-b[1]);
function pLen(p){let L=0;for(let i=1;i<p.length;i++)L+=eR(p[i],p[i-1]);return L;}
function cutFrom(p,s){ // [точка на расстоянии s, остаток ломаной...]
  let t=s;
  for(let i=1;i<p.length;i++){const dx=p[i][0]-p[i-1][0],dy=p[i][1]-p[i-1][1],l=Math.hypot(dx,dy);
    if(t<=l){const u=l?t/l:0;return [[p[i-1][0]+dx*u,p[i-1][1]+dy*u]].concat(p.slice(i).map(q=>q.slice()));}t-=l;}
  return [p[p.length-1].slice()];
}
const outward=(e,end)=>{const c=e.p.map(q=>q.slice());return end===0?c:c.reverse();};
const setOutward=(e,end,pts)=>{e.p=end===0?pts:pts.slice().reverse();};
// скругление вершин ломаной дугами; prot — защищённые (прямые) участки у концов
function roundPoly(p,R,protA,protB,minR){
  const n=p.length;if(n<3)return p.map(q=>q.slice());
  const seg=[];for(let i=0;i<n-1;i++){const dx=p[i+1][0]-p[i][0],dy=p[i+1][1]-p[i][1],l=Math.hypot(dx,dy)||1e-6;seg.push({l,ux:dx/l,uy:dy/l});}
  const out=[p[0].slice()];
  for(let i=1;i<n-1;i++){
    const a=seg[i-1],b=seg[i],del=Math.acos(clamp(a.ux*b.ux+a.uy*b.uy,-1,1));
    if(del<.03){out.push(p[i].slice());continue;}
    const capA=(i-1===0)?Math.max(0,a.l-(protA||0)):a.l*.5,capB=(i+1===n-1)?Math.max(0,b.l-(protB||0)):b.l*.5;
    const t=Math.min(R*Math.tan(del/2),capA,capB);
    if(t<2){out.push(p[i].slice());continue;}
    const r=t/Math.tan(del/2);if(r<(minR||0)){out.push(p[i].slice());continue;}
    const A=[p[i][0]-a.ux*t,p[i][1]-a.uy*t],sg=(a.ux*b.uy-a.uy*b.ux)>0?1:-1;
    const O=[A[0]-a.uy*sg*r,A[1]+a.ux*sg*r],a0=Math.atan2(A[1]-O[1],A[0]-O[0]),steps=Math.max(2,Math.ceil(del/.16));
    for(let k=0;k<=steps;k++){const th=a0+sg*del*k/steps;out.push([O[0]+Math.cos(th)*r,O[1]+Math.sin(th)*r]);}
  }
  out.push(p[n-1].slice());return out;
}
// касательная ребра на стыке (направление наружу от стыка) — общая у обоих рёбер, чтобы ленты сходились без клина
function joinTan(e,end,tOut){if(end===0)e.tgs=tOut;else e.tge=[-tOut[0],-tOut[1]];}
// заменить начало ломаной (от узла наружу) прямой до точки на расстоянии D: направление u совпадает с геометрией
function straighten(p,D){
  const L=pLen(p);if(D>=L-1){const q=p[p.length-1],dx=q[0]-p[0][0],dy=q[1]-p[0][1],l=Math.hypot(dx,dy)||1;return {pts:p.map(a=>a.slice()),u:[dx/l,dy/l],D:L};}
  const c=cutFrom(p,D),q=c[0],dx=q[0]-p[0][0],dy=q[1]-p[0][1],l=Math.hypot(dx,dy)||1;
  return {pts:[p[0].slice(),q].concat(c.slice(1)),u:[dx/l,dy/l],D};
}
// ---------- подготовка графа ----------
function smoothGraph(){
  const G=MAPDATA.G,N=G.n.length,ends=G.n.map(()=>[]);
  G.e.forEach((e,i)=>{if(!e.p0)e.p0=e.p.map(q=>q.slice());e.p=e.p0.map(q=>q.slice());e.sa=0;e.sb=0;e.z=[null,null];e.tgs=null;e.tge=null;ends[e.a].push({ei:i,end:0});ends[e.b].push({ei:i,end:1});});
  const kind=new Array(N).fill('plate');
  // 1) изгибы степени 2: проходная дуга, ребро продолжается без перекрёстка
  for(let ni=0;ni<N;ni++){
    const E=ends[ni];if(E.length===1){kind[ni]='end';continue;}
    if(E.length!==2||E[0].ei===E[1].ei)continue;
    const [A,B]=E,eA=G.e[A.ei],eB=G.e[B.ei];let pA=outward(eA,A.end),pB=outward(eB,B.end);const LA=pLen(pA),LB=pLen(pB);
    const h=Math.max(eA.w,eB.w)/2,R=Math.max(h*1.6,90);
    let DA=Math.min(LA*.45,70),DB=Math.min(LB*.45,70),sa,sb,del=0,t=0;
    for(let it=0;it<3;it++){
      sa=straighten(pA,DA);sb=straighten(pB,DB);
      del=Math.acos(clamp(-(sa.u[0]*sb.u[0]+sa.u[1]*sb.u[1]),-1,1));
      if(del<.05)break;
      t=R*Math.tan(del/2);DA=Math.min(LA*.45,t+30);DB=Math.min(LB*.45,t+30);
    }
    const uA=sa.u,uB=sb.u;
    if(del<.05){kind[ni]='pass';const tx=uB[0]-uA[0],ty=uB[1]-uA[1],tl=Math.hypot(tx,ty)||1;setOutward(eA,A.end,sa.pts);setOutward(eB,B.end,sb.pts);joinTan(eA,A.end,[-tx/tl,-ty/tl]);joinTan(eB,B.end,[tx/tl,ty/tl]);continue;}
    t=Math.min(t,Math.min(sa.D,sb.D)-4);
    const r=t/Math.tan(del/2);if(r<h*1.1)continue;            // внутренняя кромка схлопнулась бы: общий перекрёсток
    pA=sa.pts;pB=sb.pts;
    const n0=pA[0],Pa=[n0[0]+uA[0]*t,n0[1]+uA[1]*t],Pb=[n0[0]+uB[0]*t,n0[1]+uB[1]*t];
    let nx=-uA[1],ny=uA[0];if((Pb[0]-Pa[0])*nx+(Pb[1]-Pa[1])*ny<0){nx=-nx;ny=-ny;}
    const O=[Pa[0]+nx*r,Pa[1]+ny*r],a0=Math.atan2(Pa[1]-O[1],Pa[0]-O[0]);
    let da=Math.atan2(Pb[1]-O[1],Pb[0]-O[0])-a0;while(da>Math.PI)da-=R2PI;while(da<-Math.PI)da+=R2PI;
    const steps=Math.max(4,Math.ceil(Math.abs(da)/.14)),arc=[];
    for(let k=0;k<=steps;k++){const th=a0+da*k/steps;arc.push([O[0]+Math.cos(th)*r,O[1]+Math.sin(th)*r]);}
    const mid=Math.floor(steps/2);
    {const tx=arc[mid+1][0]-arc[mid-1][0],ty=arc[mid+1][1]-arc[mid-1][1],tl=Math.hypot(tx,ty)||1;joinTan(eA,A.end,[-tx/tl,-ty/tl]);joinTan(eB,B.end,[tx/tl,ty/tl]);}
    setOutward(eA,A.end,arc.slice(0,mid+1).reverse().concat(cutFrom(pA,t).slice(1)));
    setOutward(eB,B.end,arc.slice(mid).concat(cutFrom(pB,t).slice(1)));
    kind[ni]='pass';
  }
  return {ends,kind};
}
// ---------- перекрёсток: скруглённые углы между соседними рёбрами ----------
function cornerGeom(a,b,m){
  let al=b.ang-a.ang;if(al<=1e-6)al+=R2PI;
  const R={al,fillet:al<Math.PI-.15};
  if(!R.fillet)return R;
  const hi=a.h+m,hj=b.h+m,Ni=[-a.u[1],a.u[0]],Nj=[-b.u[1],b.u[0]];
  const rx=-Ni[0]*hi-Nj[0]*hj,ry=-Ni[1]*hi-Nj[1]*hj,det=-(a.u[0]*b.u[1]-a.u[1]*b.u[0]);
  if(Math.abs(det)<1e-4){R.fillet=false;return R;}
  const ti=(-rx*b.u[1]+b.u[0]*ry)/det,tj=(a.u[0]*ry-a.u[1]*rx)/det;
  const r0=RD.R0+(Math.max(a.h,b.h)*2-96)/64*20+m;
  let d=r0/Math.tan(al/2);const cap=Math.max(0,.5*Math.min(a.L,b.L)-Math.max(ti,tj));if(d>cap)d=cap;
  const r=d*Math.tan(al/2),C=[a.n[0]+Ni[0]*hi+a.u[0]*ti,a.n[1]+Ni[1]*hi+a.u[1]*ti];
  const Ti=[C[0]+a.u[0]*d,C[1]+a.u[1]*d],Tj=[C[0]+b.u[0]*d,C[1]+b.u[1]*d];
  const bx=a.u[0]+b.u[0],by=a.u[1]+b.u[1],bl=Math.hypot(bx,by)||1,k=r/Math.sin(al/2);
  const O=[C[0]+bx/bl*k,C[1]+by/bl*k],a0=Math.atan2(Ti[1]-O[1],Ti[0]-O[0]);
  let da=Math.atan2(Tj[1]-O[1],Tj[0]-O[0])-a0;while(da>Math.PI)da-=R2PI;while(da<-Math.PI)da+=R2PI;
  const steps=Math.max(4,Math.ceil((Math.PI-al)/.2)),arc=[];
  for(let q=0;q<=steps;q++){const th=a0+da*q/steps;arc.push([O[0]+Math.cos(th)*r,O[1]+Math.sin(th)*r]);}
  Object.assign(R,{ti,tj,d,r,arc});return R;
}
function planPlate(ni,E){
  const G=MAPDATA.G,list=[];
  for(const o of E){const e=G.e[o.ei],p0=outward(e,o.end),L=pLen(p0),st=straighten(p0,Math.min(L*.45,110)),u=st.u,p=st.pts;
    setOutward(e,o.end,p);
    list.push({ei:o.ei,end:o.end,L,u,D:st.D,h:e.w/2,w:e.w,n:p[0],ang:Math.atan2(u[1],u[0]),s:0});}
  list.sort((a,b)=>a.ang-b.ang);
  const k=list.length;
  for(let i=0;i<k;i++){
    const a=list[i],b=list[(i+1)%k],c=cornerGeom(a,b,RD.CW);
    if(c.fillet){a.s=Math.max(a.s,c.ti+c.d+3);b.s=Math.max(b.s,c.tj+c.d+3);}
  }
  return {ni,list,n:list[0].n};
}
// узловые точки: R(правая, к предыдущему)/L(левая, к следующему) на линии среза
function plateGeom(pl,m){
  const k=pl.list.length,poly=[],chains=[];
  const Rp=(e)=>[e.n[0]+e.u[0]*e.s+e.u[1]*(e.h+m),e.n[1]+e.u[1]*e.s-e.u[0]*(e.h+m)];
  const Lp=(e)=>[e.n[0]+e.u[0]*e.s-e.u[1]*(e.h+m),e.n[1]+e.u[1]*e.s+e.u[0]*(e.h+m)];
  for(let i=0;i<k;i++){
    const a=pl.list[i],b=pl.list[(i+1)%k],c=cornerGeom(a,b,m),Li=Lp(a),Rj=Rp(b);
    const chain=[Li];
    if(c.fillet)for(const q of c.arc)chain.push(q);
    chain.push(Rj);
    chains.push(chain);
    poly.push(Rp(a),Li);
    if(c.fillet)for(const q of c.arc)poly.push(q);
  }
  return {poly,chains,c:pl.n};
}
// ---------- станции вдоль ребра ----------
function stations(e,s0,s1,step){
  const p=e.p,cum=[0];for(let i=1;i<p.length;i++)cum.push(cum[i-1]+eR(p[i],p[i-1]));
  const S=[s0];for(let i=1;i<p.length-1;i++)if(cum[i]>s0+1&&cum[i]<s1-1)S.push(cum[i]);S.push(s1);
  const ss=[];for(let i=0;i<S.length-1;i++){const n=Math.max(1,Math.ceil((S[i+1]-S[i])/step));for(let j=0;j<n;j++)ss.push(S[i]+(S[i+1]-S[i])*j/n);}ss.push(s1);
  const segDir=(s)=>{let i=1;while(i<p.length-1&&cum[i]<s-1e-6)i++;const dx=p[i][0]-p[i-1][0],dy=p[i][1]-p[i-1][1],l=Math.hypot(dx,dy)||1;return [dx/l,dy/l,i];};
  return ss.map((s,k)=>{
    let i=1;while(i<p.length-1&&cum[i]<s)i++;
    const l=cum[i]-cum[i-1]||1,u=clamp((s-cum[i-1])/l,0,1),x=p[i-1][0]+(p[i][0]-p[i-1][0])*u,y=p[i-1][1]+(p[i][1]-p[i-1][1])*u;
    // касательная: среднее соседних сегментов на вершинах, иначе направление сегмента
    let tx,ty,mit=1;
    const a=segDir(s-1e-3),b=segDir(s+1e-3);
    if(a[2]!==b[2]&&k>0&&k<ss.length-1){tx=a[0]+b[0];ty=a[1]+b[1];const l2=Math.hypot(tx,ty)||1;tx/=l2;ty/=l2;mit=1/Math.max(.55,tx*a[0]+ty*a[1]);}
    else{const d=k===0?b:a;tx=d[0];ty=d[1];}
    if(k===0&&e.tgs&&s0<.5){tx=e.tgs[0];ty=e.tgs[1];}
    if(k===ss.length-1&&e.tge&&s1>e.L-.5){tx=e.tge[0];ty=e.tge[1];}
    return {x,y,tx,ty,s,mit};
  });
}
const off=(st,o)=>[st.x-st.ty*o*st.mit,st.y+st.tx*o*st.mit]; // + влево в системе (x,y); для правой стороны хода см. lanePt
// ---------- основной расчёт ----------
function planRoads(){
  const G=MAPDATA.G;
  const {ends,kind}=smoothGraph();
  const plates=[];
  for(let ni=0;ni<G.n.length;ni++)if(kind[ni]==='plate')plates.push(planPlate(ni,ends[ni]));
  // установить срезы на рёбрах и ужать, если ребро короче суммы срезов
  for(const pl of plates)for(const o of pl.list){const e=G.e[o.ei],v=Math.min(o.s,Math.max(0,o.D-10));if(o.end===0)e.sa=v;else e.sb=v;}
  for(const e of G.e){
    const L=pLen(e.p);
    if(e.sa+e.sb>L-6){const k=Math.max(0,(L-6)/(e.sa+e.sb));e.sa*=k;e.sb*=k;}
  }
  for(const pl of plates)for(const o of pl.list){const e=G.e[o.ei];o.s=o.end===0?e.sa:e.sb;}
  // скруглить изгибы вдоль ребра (прямые участки у узлов защищены)
  for(const e of G.e){
    const p=roundPoly(e.p,Math.max(e.w*.9,80),e.sa+10,e.sb+10,e.w*.5*1.05);
    e.p=p;e.L=pLen(p);
  }
  RN.plates=plates;RN.kind=kind;
  // покрытие тайлов лентой (для решения «тротуарный тайл или двор»)
  const cover=new Uint8Array(MW*MH);
  const mark=(x,y,rad)=>{const x0=Math.floor((x-rad)/TS),x1=Math.floor((x+rad)/TS),y0=Math.floor((y-rad)/TS),y1=Math.floor((y+rad)/TS);
    for(let ty=Math.max(0,y0);ty<=Math.min(MH-1,y1);ty++)for(let tx=Math.max(0,x0);tx<=Math.min(MW-1,x1);tx++){const cx=(tx+.5)*TS,cy=(ty+.5)*TS;if(Math.hypot(cx-x,cy-y)<=rad)cover[ty*MW+tx]=1;}};
  for(const e of G.e){
    const rad=e.w/2+swWidth(e.w)-6,st=stations(e,e.sa,Math.max(e.sa,e.L-e.sb),10);
    for(const s of st)mark(s.x,s.y,rad);
  }
  for(const pl of plates){
    const pg=plateGeom(pl,swWidth(pl.list[0].w)).poly,c=pl.n;let R=0;for(const q of pg)R=Math.max(R,eR(q,c));
    mark(c[0],c[1],R*.8);
  }
  RN.cover=cover;
  if(typeof GADJ!=='undefined')GADJ=null;
}
// ---------- геометрия ----------
function TB(){this.p=[];this.u=[];this.i=[];this.n=0;}
TB.prototype.tri=function(a,b,c,uvs,hint){
  const ux=b[0]-a[0],uy=b[1]-a[1],uz=b[2]-a[2],vx=c[0]-a[0],vy=c[1]-a[1],vz=c[2]-a[2];
  const nx=uy*vz-uz*vy,ny=uz*vx-ux*vz,nz=ux*vy-uy*vx,h=hint||[0,1,0];
  if(nx*h[0]+ny*h[1]+nz*h[2]<0){const t=b;b=c;c=t;uvs=[uvs[0],uvs[1],uvs[4],uvs[5],uvs[2],uvs[3]];}
  this.p.push(a[0],a[1],a[2],b[0],b[1],b[2],c[0],c[1],c[2]);this.u.push(uvs[0],uvs[1],uvs[2],uvs[3],uvs[4],uvs[5]);
  this.i.push(this.n,this.n+1,this.n+2);this.n+=3;
};
TB.prototype.quad=function(a,b,c,d,uvs,hint){this.tri(a,b,c,[uvs[0],uvs[1],uvs[2],uvs[3],uvs[4],uvs[5]],hint);this.tri(a,c,d,[uvs[0],uvs[1],uvs[4],uvs[5],uvs[6],uvs[7]],hint);};
TB.prototype.mesh=function(mat,recv,order){
  if(!this.n)return null;
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(this.p,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(this.u,2));
  g.setIndex(this.i);g.computeVertexNormals();
  const m=new THREE.Mesh(g,mat);m.receiveShadow=recv!==false;if(order)m.renderOrder=order;world.add(m);return m;
};
// накопитель по чанкам: каждая ячейка — отдельный меш (отсечение по камере)
function TBS(){this.m=new Map();}
TBS.prototype._g=function(x,z){const k=Math.floor(x/CHW)+','+Math.floor(z/CHW);let t=this.m.get(k);if(!t)this.m.set(k,t=new TB());return t;};
TBS.prototype.tri=function(a,b,c,uvs,hint){this._g((a[0]+b[0]+c[0])/3,(a[2]+b[2]+c[2])/3).tri(a,b,c,uvs,hint);};
TBS.prototype.quad=function(a,b,c,d,uvs,hint){this._g((a[0]+c[0])/2,(a[2]+c[2])/2).quad(a,b,c,d,uvs,hint);};
TBS.prototype.mesh=function(mat,recv,order){for(const t of this.m.values())t.mesh(mat,recv,order);};
const gy=(x,z,l)=>hAt(x,z)+SW+l;
const landTile=(x,z)=>{const t=tileAt(Math.floor(x/TS),Math.floor(z/TS));return t!==5&&t!==6;};
function buildRoads(){
  const G=MAPDATA.G,asp=new TBS(),swk=new TBS(),cb=new TBS(),mk=new TBS();
  const U=(x,z,s)=>[x/s,z/s];
  // горизонтальная полоса между двумя рядами станций с поперечными колонками; clip — отсечь над водой
  // у воды клетки дробятся мельче, чтобы край полотна у набережной не был ступенчатым
  const nearWater=(x,z)=>{const tx=Math.floor(x/TS),ty=Math.floor(z/TS);for(let j=-1;j<=1;j++)for(let i=-1;i<=1;i++){const t=tileAt(tx+i,ty+j);if(t===5||t===6)return true;}return false;};
  const strip=(tb,st,o0,o1,lift,scale,cols,clip)=>{
    const emit=(P)=>{const V=P.map(q=>[q[0],gy(q[0],q[1],lift),q[1]]);
      tb.quad(V[0],V[1],V[2],V[3],[...U(P[0][0],P[0][1],scale),...U(P[1][0],P[1][1],scale),...U(P[2][0],P[2][1],scale),...U(P[3][0],P[3][1],scale)]);};
    for(let k=0;k<st.length-1;k++)for(let c=0;c<cols;c++){
      const a0=o0+(o1-o0)*c/cols,a1=o0+(o1-o0)*(c+1)/cols;
      const P=[off(st[k],a0),off(st[k],a1),off(st[k+1],a1),off(st[k+1],a0)];
      const cx=(P[0][0]+P[2][0])/2,cz=(P[0][1]+P[2][1])/2;
      if(!clip){emit(P);continue;}
      if(!nearWater(cx,cz)){emit(P);continue;}
      const N=4,lp=(A,B,t)=>[A[0]+(B[0]-A[0])*t,A[1]+(B[1]-A[1])*t];
      for(let i=0;i<N;i++)for(let j=0;j<N;j++){
        const L0=lp(P[0],P[3],j/N),L1=lp(P[0],P[3],(j+1)/N),R0=lp(P[1],P[2],j/N),R1=lp(P[1],P[2],(j+1)/N);
        const Q=[lp(L0,R0,i/N),lp(L0,R0,(i+1)/N),lp(L1,R1,(i+1)/N),lp(L1,R1,i/N)];
        if(landTile((Q[0][0]+Q[2][0])/2,(Q[0][1]+Q[2][1])/2))emit(Q);
      }
    }
  };
  // веер от центра узла, разбитый на мелкие треугольники (≤ ~28 ед.), чтобы полотно ложилось на рельеф
  const fan=(tb,pg,lift,scale,clip)=>{
    const c=pg.c,q=pg.poly,STEP=LITE?40:28;
    const V=(x,z)=>[x,gy(x,z,lift),z],T3=(A,B,C)=>{
      if(clip&&!landTile((A[0]+B[0]+C[0])/3,(A[1]+B[1]+C[1])/3))return;
      tb.tri(V(A[0],A[1]),V(B[0],B[1]),V(C[0],C[1]),[...U(A[0],A[1],scale),...U(B[0],B[1],scale),...U(C[0],C[1],scale)]);};
    for(let k=0;k<q.length;k++){
      const a=q[k],b=q[(k+1)%q.length];if(eR(a,b)<.01)continue;
      const n=Math.max(1,Math.ceil(Math.max(eR(c,a),eR(c,b),eR(a,b))/STEP));
      const P=(i,j)=>[c[0]+(a[0]-c[0])*i/n+(b[0]-c[0])*j/n,c[1]+(a[1]-c[1])*i/n+(b[1]-c[1])*j/n];
      for(let i=0;i<n;i++)for(let j=0;j<n-i;j++){
        T3(P(i,j),P(i+1,j),P(i,j+1));
        if(i+j<n-1)T3(P(i+1,j),P(i+1,j+1),P(i,j+1));
      }
    }
  };
  // бордюрная лента между внутренним (m=0) и внешним (m=CW) контуром
  let acc=0;
  const curb=(inner,outer)=>{
    for(let k=0;k<inner.length-1;k++){
      const i0=inner[k],i1=inner[k+1],o0=outer[k],o1=outer[k+1],l=eR(i0,i1);if(l<.01)continue;
      const Y=(p,v)=>[p[0],gy(p[0],p[1],v),p[1]],top=RD.CURB_H+RD.ASPH;
      const hin=[i0[0]-o0[0],0,i0[1]-o0[1]],hout=[-hin[0],0,-hin[2]],u0=acc/22,u1=(acc+l)/22;acc+=l;
      cb.quad(Y(i0,RD.ASPH),Y(i1,RD.ASPH),Y(i1,top),Y(i0,top),[u0,0,u1,0,u1,.1,u0,.1],hin);
      cb.quad(Y(i0,top),Y(i1,top),Y(o1,top),Y(o0,top),[u0,.1,u1,.1,u1,.2,u0,.2],[0,1,0]);
      cb.quad(Y(o0,top),Y(o1,top),Y(o1,RD.WALK),Y(o0,RD.WALK),[u0,0,u1,0,u1,.1,u0,.1],hout);
    }
  };
  // --- рёбра ---
  for(const e of G.e){
    const s1=e.L-e.sb;if(s1-e.sa<2)continue;
    const st=stations(e,e.sa,s1,LITE?32:RD.STEP),h=e.w/2,sw=swWidth(e.w);
    strip(swk,st,-(h+sw),h+sw,RD.WALK,40,Math.ceil((h+sw)*2/36),true);
    strip(asp,st,-h,h,RD.ASPH,96,Math.ceil(h*2/32),true);
    for(const side of [-1,1]){
      const inner=st.map(q=>off(q,side*h)),outer=st.map(q=>off(q,side*(h+RD.CW)));
      // над водой бордюр не строим (мост, набережная — своя ограда)
      let run=[];const flush=()=>{if(run.length>1)curb(run.map(i=>inner[i]),run.map(i=>outer[i]));run=[];};
      for(let i=0;i<st.length;i++){if(landTile(inner[i][0],inner[i][1])&&tileAt(Math.floor(inner[i][0]/TS),Math.floor(inner[i][1]/TS))!==5)run.push(i);else flush();}
      flush();
    }
  }
  // --- перекрёстки ---
  for(const pl of RN.plates){
    if(pl.list.length<2)continue;
    const sw=swWidth(pl.list[0].w);
    fan(swk,plateGeom(pl,sw),RD.WALK,40,true);
    fan(asp,plateGeom(pl,0),RD.ASPH,96,true);
    const g0=plateGeom(pl,0),g1=plateGeom(pl,RD.CW);
    for(let i=0;i<g0.chains.length;i++){
      const A=g0.chains[i],B=g1.chains[i];
      if(A.some(q=>!landTile(q[0],q[1])))continue;
      curb(A,B);
    }
  }
  buildRoadMarkings(mk);
  const M=RN.mats||(RN.mats={
    asp:pbrMat(PBR.asphalt,{color:0xd8d8dc,polygonOffset:true,polygonOffsetFactor:-3,polygonOffsetUnits:-3}),
    swk:pbrMat(PBR.paving,{color:0xd0ccc4,polygonOffset:true,polygonOffsetFactor:-1.5,polygonOffsetUnits:-1.5}),
    cb:pbrMat(PBR.curb,{normalMap:null,roughness:1,metalness:0})
  });
  swk.mesh(M.swk,true);asp.mesh(M.asp,true);cb.mesh(M.cb,true);
  const mm=mk.mesh(new THREE.MeshBasicMaterial({vertexColors:false,color:0xe6e2d6,polygonOffset:true,polygonOffsetFactor:-5,polygonOffsetUnits:-5,transparent:true,opacity:.86,depthWrite:false}),false,2);
  void mm;
}
// ---------- разметка: осевая, кромки, зебры, стоп-линии по тем же лентам ----------
function buildRoadMarkings(mk){
  const G=MAPDATA.G,ML=RD.ASPH+.25;
  RN.zebras=[];RN.stops=[];
  const twin=new Map();G.e.forEach((e,i)=>{const k=Math.min(e.a,e.b)+'-'+Math.max(e.a,e.b),b=twin.get(k);if(b===undefined||G.e[b].w<e.w)twin.set(k,i);});
  const band=(st,o,wid)=>{ // сплошная полоса вдоль станций
    for(let k=0;k<st.length-1;k++){
      const P=[off(st[k],o-wid/2),off(st[k],o+wid/2),off(st[k+1],o+wid/2),off(st[k+1],o-wid/2)];
      const V=P.map(q=>[q[0],gy(q[0],q[1],ML),q[1]]);mk.quad(V[0],V[1],V[2],V[3],[0,0,1,0,1,1,0,1]);
    }
  };
  const rect=(x,y,tx,ty,len,wid)=>{ // прямоугольник от (x,y) вдоль (tx,ty) длиной len, шириной wid
    const nx=-ty*wid/2,ny=tx*wid/2,P=[[x-nx,y-ny],[x-nx+tx*len,y-ny+ty*len],[x+nx+tx*len,y+ny+ty*len],[x+nx,y+ny]];
    const V=P.map(q=>[q[0],gy(q[0],q[1],ML),q[1]]);mk.quad(V[0],V[1],V[2],V[3],[0,0,1,0,1,1,0,1]);
  };
  for(let ei=0;ei<G.e.length;ei++){
    const e=G.e[ei],h=e.w/2,s1=e.L-e.sb;if(s1-e.sa<50)continue;
    if(twin.get(Math.min(e.a,e.b)+'-'+Math.max(e.a,e.b))!==ei&&e.a!==e.b)continue; // параллельные рёбра между теми же узлами: разметка у одного
    // зебры и стоп-линии у перекрёстков (узлы степени ≥3)
    let from=e.sa>0?e.sa+6:0,to=e.sb>0?s1-6:e.L; // на стыках без перекрёстка линии идут насквозь
    for(const end of [0,1]){
      const nd=end===0?e.a:e.b;
      const pl=RN.plates.find(q=>q.ni===nd);if(!pl||pl.list.length<3)continue;
      const sEnd=end===0?e.sa:e.sb;if(e.L-e.sa-e.sb<90)continue;
      // расстояния от конца ребра: зебра 14 ед., затем стоп-линия
      const z0=sEnd+8,z1=z0+14,sl=z1+5;
      const sc=(d)=>end===0?d:e.L-d;
      const A=polyAt(e.p,sc(z0+7));                       // центр зебры, A.dx/dy — вдоль ребра
      const tx=A.dx*(end===0?1:-1),ty=A.dy*(end===0?1:-1); // единичный вектор «от перекрёстка»
      for(let k=-h+9;k<h-8;k+=10)rect(A.x-A.dy*k-tx*7,A.y+A.dx*k-ty*7,tx,ty,14,5);
      // стоп-линия на полосе подъезжающего: правая сторона относительно хода к перекрёстку (−u)
      const B=polyAt(e.p,sc(sl)),bx=B.dx*(end===0?1:-1),by=B.dy*(end===0?1:-1);
      const rx=by,ry=-bx;
      rect(B.x+rx*3,B.y+ry*3,rx,ry,h-5,3.6);
      e.z[end]={s0:z0,s1:z1,stop:sl,h,ax:-A.dy,ay:A.dx};
      RN.zebras.push({x:A.x,y:A.y,ax:-A.dy,ay:A.dx,rx:tx,ry:ty,len:2*h-14,wid:14,edge:ei,end,node:nd});
      RN.stops.push({x:B.x+rx*h/2,y:B.y+ry*h/2,hx:-bx,hy:-by,edge:ei,end,node:nd});
      if(end===0)from=Math.max(from,sl+8);else to=Math.min(to,e.L-(sl+8));
    }
    if(to-from<30)continue;
    const st=stations(e,from,to,12);
    if(e.w>=128){band(st,-2.4,1.4);band(st,2.4,1.4);band(st,-(h-6),1.6);band(st,h-6,1.6);}
    else for(let s=from;s<to-20;s+=46){band(stations(e,s,Math.min(to,s+22),8),0,2.2);}
  }
}
