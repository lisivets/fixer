'use strict';
// ===== Мир: рельеф, дороги, тротуары, набережная, вода, лес, разметка, фонари, следы =====
const SW=1.8; // высота тротуара над дорогой
let world=null,WATER=null;
const LAMPS=[];
const CH=32;                     // тайлов в чанке (1024 ед.)
const CHW=CH*TS;
function pbrMat(set,o){
  return new THREE.MeshStandardMaterial(Object.assign({map:set.map,normalMap:set.normalMap,roughnessMap:set.orm,metalnessMap:set.orm,roughness:1,metalness:1,envMapIntensity:.6},o||{}));
}
// накопитель геометрии
function GB(){this.p=[];this.u=[];this.c=[];this.i=[];this.n=0;}
GB.prototype.q=function(a,b,c,d,uv,col){
  this.p.push(a[0],a[1],a[2],b[0],b[1],b[2],c[0],c[1],c[2],d[0],d[1],d[2]);
  this.u.push(uv[0],uv[1],uv[2],uv[3],uv[4],uv[5],uv[6],uv[7]);
  const k=col||[1,1,1];for(let j=0;j<4;j++)this.c.push(k[0],k[1],k[2]);
  const n=this.n;this.i.push(n,n+2,n+1,n,n+3,n+2);this.n+=4;
};
GB.prototype.w=function(a,b,c,d,uv,col){ // вертикальная грань (обход против q)
  this.p.push(a[0],a[1],a[2],b[0],b[1],b[2],c[0],c[1],c[2],d[0],d[1],d[2]);
  this.u.push(uv[0],uv[1],uv[2],uv[3],uv[4],uv[5],uv[6],uv[7]);
  const k=col||[1,1,1];for(let j=0;j<4;j++)this.c.push(k[0],k[1],k[2]);
  const n=this.n;this.i.push(n,n+1,n+2,n,n+2,n+3);this.n+=4;
};
GB.prototype.mesh=function(mat,cast,recv){
  if(!this.n)return null;
  const g=new THREE.BufferGeometry();
  g.setAttribute('position',new THREE.Float32BufferAttribute(this.p,3));
  g.setAttribute('uv',new THREE.Float32BufferAttribute(this.u,2));
  g.setAttribute('color',new THREE.Float32BufferAttribute(this.c,3));
  g.setIndex(this.i);g.computeVertexNormals();
  const m=new THREE.Mesh(g,mat);m.castShadow=!!cast;m.receiveShadow=recv!==false;world.add(m);return m;
};
// высоты в углах тайлов
let HC=null;
const hc=(tx,ty)=>HC[ty*(MW+1)+tx];
function cornerHeights(){HC=new Float32Array((MW+1)*(MH+1));for(let y=0;y<=MH;y++)for(let x=0;x<=MW;x++)HC[y*(MW+1)+x]=hAt(x*TS,y*TS);}
const lev=t=>t===0?0:SW;
// вертикальная грань вдоль ребра тайла; n=(nx,nz) наружу; y0/y1 — функции высоты по точке (x,z)
function wall(gb,tx,ty,nx,nz,y0,y1,col,vs){
  const x0=tx*TS,z0=ty*TS,x1=x0+TS,z1=z0+TS;
  let a,b;
  if(nz<0)a=[x1,z0],b=[x0,z0];else if(nz>0)a=[x0,z1],b=[x1,z1];else if(nx<0)a=[x0,z0],b=[x0,z1];else a=[x1,z1],b=[x1,z0];
  const ya0=y0(a[0],a[1]),yb0=y0(b[0],b[1]),ya1=y1(a[0],a[1]),yb1=y1(b[0],b[1]);
  gb.w([a[0],ya0,a[1]],[b[0],yb0,b[1]],[b[0],yb1,b[1]],[a[0],ya1,a[1]],[0,0,TS/vs,0,TS/vs,Math.max(ya1-ya0,yb1-yb0)/vs,0,Math.max(ya1-ya0,yb1-yb0)/vs],col);
}
// параллелепипед (парапет): вершины на высоте y..y+h, толщина по нормали
function slab(gb,x0,z0,x1,z1,y,h,col){
  const t=[[x0,y+h,z0],[x1,y+h,z0],[x1,y+h,z1],[x0,y+h,z1]];
  gb.q(t[0],t[1],t[2],t[3],[0,0,1,0,1,1,0,1],col);
  gb.w([x1,y,z0],[x0,y,z0],[x0,y+h,z0],[x1,y+h,z0],[0,0,1,0,1,1,0,1],col);
  gb.w([x0,y,z1],[x1,y,z1],[x1,y+h,z1],[x0,y+h,z1],[0,0,1,0,1,1,0,1],col);
  gb.w([x0,y,z0],[x0,y,z1],[x0,y+h,z1],[x0,y+h,z0],[0,0,1,0,1,1,0,1],col);
  gb.w([x1,y,z1],[x1,y,z0],[x1,y+h,z0],[x1,y+h,z1],[0,0,1,0,1,1,0,1],col);
}
function addInst(geo,mat,mats,shadow){
  const m=new THREE.InstancedMesh(geo,mat,mats.length);
  mats.forEach((M,i)=>m.setMatrixAt(i,M));m.castShadow=!!shadow;m.receiveShadow=true;world.add(m);return m;
}
const _m=new THREE.Matrix4(),_q=new THREE.Quaternion(),_s=new THREE.Vector3(),_p=new THREE.Vector3(),_e=new THREE.Euler();
function mat4(x,y,z,sx,sy,sz,ry){_e.set(0,ry||0,0);_q.setFromEuler(_e);_p.set(x,y,z);_s.set(sx,sy,sz);return new THREE.Matrix4().compose(_p,_q,_s);}

const GCOL={3:[1,1,1],4:[.8,.86,.84],7:[.95,.9,.74],8:[.86,.93,.86]};
function buildTerrain(){
  cornerHeights();
  const M={
    road:pbrMat(PBR.asphalt,{color:0xd8d8dc}),walk:pbrMat(PBR.paving,{color:0xd0ccc4}),
    ground:pbrMat(PBR.snow,{roughness:.9,vertexColors:true}),curb:pbrMat(PBR.curb,{normalMap:null,roughness:1,metalness:0}),
    cliff:new THREE.MeshStandardMaterial({color:0x1a1f25,roughness:1}),
    water:new THREE.MeshStandardMaterial({color:0x6c8ea8,map:PBR.water.map,normalMap:PBR.water.normalMap,roughness:.1,metalness:.25,envMapIntensity:1.9})
  };
  for(const k of ['map','normalMap'])M.water[k].repeat.set(1,1);
  WATER={material:M.water};
  const qy=(tx,ty,l)=>[[tx,ty],[tx+1,ty],[tx+1,ty+1],[tx,ty+1]].map(([x,y])=>[x*TS,hc(x,y)+l,y*TS]);
  for(let cy=0;cy<MH;cy+=CH)for(let cx=0;cx<MW;cx+=CH){
    const R=new GB(),Wk=new GB(),Gr=new GB(),Cb=new GB(),Cl=new GB(),Wa=new GB(),Pa=new GB();
    for(let ty=cy;ty<Math.min(MH,cy+CH);ty++)for(let tx=cx;tx<Math.min(MW,cx+CH);tx++){
      const t=T[ty*MW+tx];if(t===6)continue;
      const x0=tx*TS,z0=ty*TS;
      if(t===5){const y=WL;Wa.q([x0,y,z0],[x0+TS,y,z0],[x0+TS,y,z0+TS],[x0,y,z0+TS],[x0/160,z0/160,(x0+TS)/160,z0/160,(x0+TS)/160,(z0+TS)/160,x0/160,(z0+TS)/160]);continue;}
      const q=qy(tx,ty,lev(t)),uvq=(s)=>[x0/s,z0/s,(x0+TS)/s,z0/s,(x0+TS)/s,(z0+TS)/s,x0/s,(z0+TS)/s];
      if(t===0)R.q(q[0],q[1],q[2],q[3],uvq(96));
      else if(t===1)Wk.q(q[0],q[1],q[2],q[3],uvq(40));
      else Gr.q(q[0],q[1],q[2],q[3],uvq(70),GCOL[t]||[1,1,1]); // t===2 (под зданием) тоже получает землю
      for(const [dx,dz] of [[0,-1],[0,1],[-1,0],[1,0]]){
        const nt=tileAt(tx+dx,ty+dz);
        const top=(x,z)=>hAt(x,z)+lev(t);
        if(t!==0&&nt===0)wall(Cb,tx,ty,dx,dz,(x,z)=>hAt(x,z),top,22,[1,1,1]);
        else if(nt===5){
          wall(Cb,tx,ty,dx,dz,()=>WL,top,22,[.8,.8,.8]);
          if(t===0||t===1){ // парапет набережной и моста
            const px=tx*TS,pz=ty*TS,th=3,y=hAt(px+TS/2,pz+TS/2)+lev(t);
            const ex0=dx<0?px:dx>0?px+TS-th:px,ex1=dx<0?px+th:dx>0?px+TS:px+TS;
            const ez0=dz<0?pz:dz>0?pz+TS-th:pz,ez1=dz<0?pz+th:dz>0?pz+TS:pz+TS;
            slab(Pa,ex0,ez0,ex1,ez1,y,8,[.85,.85,.85]);
          }
        }else if(nt===6)wall(Cl,tx,ty,dx,dz,()=>WL-60,top,60,[1,1,1]);
      }
    }
    const a=R.mesh(M.road,false,true);const b=Wk.mesh(M.walk,false,true);const c=Gr.mesh(M.ground,false,true);
    Cb.mesh(M.curb,false,true);Pa.mesh(M.curb,true,true);Cl.mesh(M.cliff,false,false);Wa.mesh(M.water,false,true);
  }
  // тёмная плоскость под всем миром (за краем карты)
  const dark=new THREE.Mesh(new THREE.PlaneGeometry(WW+6000,WH+6000),new THREE.MeshBasicMaterial({color:0x07090c}));
  dark.rotation.x=-Math.PI/2;dark.position.set(WW/2,WL-60,WH/2);world.add(dark);
}
// ---------- Разметка по графу дорог ----------
function polyLen(p){let L=0;for(let i=1;i<p.length;i++)L+=Math.hypot(p[i][0]-p[i-1][0],p[i][1]-p[i-1][1]);return L;}
function polyAt(p,s){ // точка и направление на расстоянии s
  for(let i=1;i<p.length;i++){
    const dx=p[i][0]-p[i-1][0],dy=p[i][1]-p[i-1][1],l=Math.hypot(dx,dy);
    if(s<=l||i===p.length-1){const t=l?clamp(s/l,0,1):0;return {x:p[i-1][0]+dx*t,y:p[i-1][1]+dy*t,dx:dx/(l||1),dy:dy/(l||1)};}
    s-=l;
  }
}
function buildMarkings(){
  const mk=new GB(),deg=new Array(MAPDATA.G.n.length).fill(0);
  for(const e of MAPDATA.G.e){deg[e.a]++;deg[e.b]++;}
  const strip=(x,z,dx,dz,len,wid,col)=>{ // прямоугольник вдоль (dx,dz)
    const nx=-dz*wid/2,nz=dx*wid/2,ex=dx*len,ez=dz*len;
    const P=[[x-nx,z-nz],[x-nx+ex,z-nz+ez],[x+nx+ex,z+nz+ez],[x+nx,z+nz]].map(([a,b])=>[a,hAt(a,b)+.2,b]);
    mk.q(P[0],P[1],P[2],P[3],[0,0,1,0,1,1,0,1],col);
  };
  const W=[.9,.9,.86],Y=[.93,.78,.25];
  for(const e of MAPDATA.G.e){
    const L=polyLen(e.p),hw=e.w/2;
    if(L<hw*2+60)continue;
    const s0=hw+10,s1=L-hw-10;
    // осевая: широкие дороги — сплошная жёлтая двойная; узкие — пунктир
    for(let s=s0;s<s1-4;s+=e.w>=128?14:46){
      const a=polyAt(e.p,s);
      if(e.w>=128){strip(a.x-a.dy*2.4,a.y+a.dx*2.4,a.dx,a.dy,15,1.4,Y);strip(a.x+a.dy*2.4,a.y-a.dx*2.4,a.dx,a.dy,15,1.4,Y);}
      else strip(a.x,a.y,a.dx,a.dy,22,2.2,W);
    }
    if(e.w>=128)for(const side of [-1,1])for(let s=s0;s<s1-4;s+=14){
      const a=polyAt(e.p,s),o=side*(hw-5);strip(a.x-a.dy*o,a.y+a.dx*o,a.dx,a.dy,15,1.6,W);
    }
    // зебры у перекрёстков
    for(const [end,node] of [[0,e.a],[1,e.b]]){
      if(deg[node]<3||L<hw*2+160)continue;
      const s=end?L-hw-22:hw+22,a=polyAt(e.p,s);
      for(let k=-hw+8;k<hw-6;k+=10)strip(a.x-a.dy*k,a.y+a.dx*k,a.dx,a.dy,12,5,W);
    }
  }
  const m=new THREE.Mesh((()=>{const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(mk.p,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(mk.u,2));g.setAttribute('color',new THREE.Float32BufferAttribute(mk.c,3));g.setIndex(mk.i);g.computeVertexNormals();return g;})(),
    new THREE.MeshBasicMaterial({vertexColors:true,polygonOffset:true,polygonOffsetFactor:-2,polygonOffsetUnits:-2,transparent:true,opacity:.82,depthWrite:false}));
  m.renderOrder=2;world.add(m);
}
// ---------- Деревья (хвойные, чанками) ----------
function firGeo(){
  const parts=[],add=(g,y)=>{g.translate(0,y,0);parts.push(g);};
  add(new THREE.ConeGeometry(1,1.3,8,1),.9);
  add(new THREE.ConeGeometry(.78,1.15,8,1),1.55);
  add(new THREE.ConeGeometry(.56,1,8,1),2.15);
  const pos=[],nor=[],idx=[];let off=0;
  for(const g of parts){const gg=g.index?g:g;const p=g.attributes.position,n=g.attributes.normal;for(let i=0;i<p.count;i++){pos.push(p.getX(i),p.getY(i),p.getZ(i));nor.push(n.getX(i),n.getY(i),n.getZ(i));}
    for(let i=0;i<g.index.count;i++)idx.push(g.index.getX(i)+off);off+=p.count;}
  const G=new THREE.BufferGeometry();G.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));G.setAttribute('normal',new THREE.Float32BufferAttribute(nor,3));G.setIndex(idx);
  G.boundingSphere=new THREE.Sphere(new THREE.Vector3(),CHW);return G;
}
function buildTrees(){
  if(!TREES.length)return;
  const fg=firGeo(),bg=new THREE.CylinderGeometry(.12,.16,1.1,6);bg.translate(0,.55,0);bg.boundingSphere=new THREE.Sphere(new THREE.Vector3(),CHW);
  const fm=new THREE.MeshStandardMaterial({color:0xffffff,roughness:.92,envMapIntensity:.4}),bm=new THREE.MeshStandardMaterial({color:0x4a3322,roughness:.95});
  const by=new Map();
  for(const t of TREES){const k=((t.x/CHW)|0)+','+((t.y/CHW)|0);(by.get(k)||by.set(k,[]).get(k)).push(t);}
  const M=new THREE.Matrix4(),col=new THREE.Color();
  for(const [k,list] of by){
    const [kx,ky]=k.split(',').map(Number),ox=(kx+.5)*CHW,oz=(ky+.5)*CHW;
    const fo=new THREE.InstancedMesh(fg,fm,list.length),ba=new THREE.InstancedMesh(bg,bm,list.length);
    list.forEach((t,i)=>{
      const s=t.r*rnd(1.9,2.6),y=hAt(t.x,t.y)+SW;
      M.compose(_p.set(t.x-ox,y,t.y-oz),_q.setFromEuler(_e.set(0,rnd(0,6),0)),_s.set(t.r*1.05,s,t.r*1.05));fo.setMatrixAt(i,M);
      M.compose(_p.set(t.x-ox,y,t.y-oz),_q,_s.set(t.r*.55,s*.8,t.r*.55));ba.setMatrixAt(i,M);
      const g=.6+Math.random()*.25;col.setRGB(g*.55+.28,g*.75+.3,g*.62+.3);fo.setColorAt(i,col);
    });
    fo.position.set(ox,0,oz);ba.position.set(ox,0,oz);fo.castShadow=true;fo.receiveShadow=true;ba.castShadow=true;
    world.add(fo,ba);
  }
}
// ---------- Фонари вдоль дорог ----------
function buildProps(){
  const pts=[];
  for(const e of MAPDATA.G.e){
    if(e.w<96)continue;
    const L=polyLen(e.p),hw=e.w/2;let side=1;
    for(let s=90;s<L-90;s+=190){
      const a=polyAt(e.p,s),off=hw+9,x=a.x-a.dy*off*side,z=a.y+a.dx*off*side;
      const ax=a.dy*side,az=-a.dx*side;      // от фонаря к оси дороги
      side=-side;
      if(tileAt(Math.floor(x/TS),Math.floor(z/TS))!==1)continue;
      pts.push([x,z,Math.atan2(-az,ax)]);
    }
  }
  const metal=new THREE.MeshStandardMaterial({color:0x2a2e32,roughness:.45,metalness:.85,envMapIntensity:.9});
  const pole=[],arm=[],head=[];
  const hm=new THREE.MeshBasicMaterial({color:new THREE.Color(3.2,2.4,1.3)});
  for(const [x,z,r] of pts){
    const y=hAt(x,z)+SW;
    pole.push(mat4(x,y+24,z,1,1,1,0));arm.push(mat4(x,y+48,z,1,1,1,r));head.push(mat4(x,y+48,z,1,1,1,r));
    LAMPS.push({x:x+Math.cos(r)*14,y:y+46,z:z-Math.sin(r)*14});
  }
  addInst(new THREE.CylinderGeometry(.9,1.5,48,12),metal,pole,true);
  const ag=new THREE.BoxGeometry(18,1.4,1.4);ag.translate(9,0,0);addInst(ag,metal,arm,true);
  const hg=new THREE.BoxGeometry(9,1.6,4.2);hg.translate(15,-1.1,0);
  const hi=new THREE.InstancedMesh(hg,hm,head.length);head.forEach((M,i)=>hi.setMatrixAt(i,M));world.add(hi);
  // скамейки, урны, гидранты на тротуарах и в парках
  const bn=[],bi=[],hy=[];
  for(let i=0;i<(LITE?200:600);i++){
    const tx=ri(0,MW-1),ty=ri(0,MH-1),t=T[ty*MW+tx];if(t!==1&&t!==8)continue;
    const x=(tx+.5)*TS+rnd(-10,10),z=(ty+.5)*TS+rnd(-10,10),y=hAt(x,z)+SW,r=Math.random();
    if(r<.4)bn.push(mat4(x,y+4.5,z,1,1,1,Math.floor(rnd(0,4))*Math.PI/2));else if(r<.8)bi.push(mat4(x,y+4,z,1,1,1,0));else hy.push(mat4(x,y+3.5,z,1,1,1,0));
  }
  const wood=new THREE.MeshStandardMaterial({color:0x6a4a2e,roughness:.85}),dark=new THREE.MeshStandardMaterial({color:0x22262a,roughness:.5,metalness:.7});
  addInst(new THREE.BoxGeometry(16,1.6,5),wood,bn,true);
  addInst(new THREE.CylinderGeometry(2.6,2.2,7,14),dark,bi,true);
  addInst(new THREE.CylinderGeometry(1.4,1.8,7,12),new THREE.MeshStandardMaterial({color:0xc02a20,roughness:.5,metalness:.3}),hy,true);
}
// ---------- Следы на земле: кровь и копоть (пул декалей) ----------
let decalPool=[],decalIdx=0;
function initDecals(){
  const mk=(draw)=>{const c=document.createElement('canvas');c.width=c.height=64;draw(c.getContext('2d'));const t=new THREE.CanvasTexture(c);return t;};
  const bloodT=mk(g=>{for(let i=0;i<14;i++){g.fillStyle=`rgba(${95+ri(0,40)},8,8,${rnd(.5,.9)})`;g.beginPath();g.ellipse(32+rnd(-16,16),32+rnd(-16,16),rnd(2,8),rnd(2,7),rnd(0,3),0,7);g.fill();}});
  const scT=mk(g=>{const gr=g.createRadialGradient(32,32,2,32,32,31);gr.addColorStop(0,'rgba(0,0,0,.75)');gr.addColorStop(1,'rgba(0,0,0,0)');g.fillStyle=gr;g.fillRect(0,0,64,64);});
  const geo=new THREE.PlaneGeometry(1,1);geo.rotateX(-Math.PI/2);
  decalPool=[];
  for(let i=0;i<120;i++){
    const m=new THREE.Mesh(geo,new THREE.MeshBasicMaterial({map:bloodT,transparent:true,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-4,polygonOffsetUnits:-4}));
    m.visible=false;m.renderOrder=3;m.userData={b:bloodT,s:scT};world.add(m);decalPool.push(m);
  }
}
function putDecal(x,y,size,kind){
  if(!decalPool.length)return;
  const m=decalPool[decalIdx++%decalPool.length];
  m.material.map=m.userData[kind];m.material.needsUpdate=true;
  m.position.set(x,carY(x,y)+.25,y);m.scale.set(size,1,size);m.rotation.y=rnd(0,6);m.visible=true;
}
function blood(x,y){putDecal(x,y,rnd(14,26),'b');}
function scorch(x,y,r){putDecal(x,y,r*2,'s');}

function build3D(){
  if(world)scene.remove(world);
  world=new THREE.Group();scene.add(world);LAMPS.length=0;
  buildTerrain();buildMarkings();
  initDecals();
  placeBuildings();
  buildTrees();buildProps();
}
