'use strict';
// ===== Мир: дороги, тротуары, бордюры, снег, разметка, реквизит, ели, фонари =====
const SW=1.8; // высота тротуара
let world=null,DEC=null,DG=null,decalTex=null;
const LAMPS=[];
function pbrMat(set,o){
  return new THREE.MeshStandardMaterial(Object.assign({map:set.map,normalMap:set.normalMap,roughnessMap:set.orm,metalnessMap:set.orm,roughness:1,metalness:1,envMapIntensity:.6},o||{}));
}
function tileGeo(pred,y,uv,decal){
  const pos=[],uvs=[],idx=[];let n=0;
  for(let ty=0;ty<MH;ty++)for(let tx=0;tx<MW;tx++){
    if(!pred(T[ty*MW+tx]))continue;
    const x0=tx*TS,z0=ty*TS,x1=x0+TS,z1=z0+TS;
    pos.push(x0,y,z0,x1,y,z0,x1,y,z1,x0,y,z1);
    if(decal)uvs.push(x0/WW,1-z0/WH,x1/WW,1-z0/WH,x1/WW,1-z1/WH,x0/WW,1-z1/WH);
    else uvs.push(x0/uv,z0/uv,x1/uv,z0/uv,x1/uv,z1/uv,x0/uv,z1/uv);
    idx.push(n,n+2,n+1,n,n+3,n+2);n+=4;
  }
  const g=new THREE.BufferGeometry();
  g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uvs,2));
  g.setIndex(idx);g.computeVertexNormals();return g;
}
function curbGeo(){
  const pos=[],nor=[],uvs=[],idx=[];let n=0;
  const face=(ax,az,bx,bz,nx,nz)=>{
    pos.push(ax,0,az,bx,0,bz,bx,SW,bz,ax,SW,az);
    for(let i=0;i<4;i++)nor.push(nx,0,nz);
    const l=Math.hypot(bx-ax,bz-az)/22;uvs.push(0,0,l,0,l,SW/22,0,SW/22);
    idx.push(n,n+1,n+2,n,n+2,n+3);n+=4;
  };
  for(let ty=0;ty<MH;ty++)for(let tx=0;tx<MW;tx++){
    if(T[ty*MW+tx]!==1)continue;
    const x0=tx*TS,z0=ty*TS,x1=x0+TS,z1=z0+TS;
    if(tileAt(tx,ty-1)===0)face(x1,z0,x0,z0,0,-1);
    if(tileAt(tx,ty+1)===0)face(x0,z1,x1,z1,0,1);
    if(tileAt(tx-1,ty)===0)face(x0,z0,x0,z1,-1,0);
    if(tileAt(tx+1,ty)===0)face(x1,z1,x1,z0,1,0);
  }
  const g=new THREE.BufferGeometry();
  g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));g.setAttribute('normal',new THREE.Float32BufferAttribute(nor,3));
  g.setAttribute('uv',new THREE.Float32BufferAttribute(uvs,2));g.setIndex(idx);return g;
}
// разметка, зебры, стоп-линии — на прозрачный холст декалей (с износом краски)
function renderDecals(){
  const DS=LITE?.5:1;DEC=document.createElement('canvas');DEC.width=WW*DS;DEC.height=WH*DS;DG=DEC.getContext('2d');DG.scale(DS,DS);
  const paint=(x,y,w,h,col)=>{DG.fillStyle=col;DG.globalAlpha=rnd(.72,.95);DG.fillRect(x,y,w,h);DG.globalAlpha=1;};
  const Y='#e8c84a',Wt='#e8e8e0';
  for(let ty=0;ty<MH;ty++)for(let tx=0;tx<MW;tx++){
    if(T[ty*MW+tx]!==0)continue;
    const mx=tx%10,my=ty%10,x=tx*TS,y=ty*TS;
    if(mx<2&&my<2)continue;
    if(my<2){
      if(my===0)for(let k=0;k<2;k++)paint(x+k*24+3,y+TS-1.5,18,3,Wt);
      if(mx===2||mx===9){for(let i=0;i<6;i++)paint(x+4,y+3+i*8,TS-8,4,Wt);}
      if(mx===3||mx===8)paint(x+(mx===3?2:TS-6),y+2,4,TS-4,Wt); // стоп-линия
    }else{
      if(mx===0)for(let k=0;k<2;k++)paint(x+TS-1.5,y+k*24+3,3,18,Wt);
      if(my===2||my===9){for(let i=0;i<6;i++)paint(x+3+i*8,y+4,4,TS-8,Wt);}
      if(my===3||my===8)paint(x+2,y+(my===3?2:TS-6),TS-4,4,Wt);
    }
  }
  decalTex=new THREE.CanvasTexture(DEC);decalTex.anisotropy=8;decalTex.encoding=THREE.sRGBEncoding;
}
function addInst(geo,mat,mats,shadow){
  const m=new THREE.InstancedMesh(geo,mat,mats.length);
  mats.forEach((M,i)=>m.setMatrixAt(i,M));m.castShadow=!!shadow;m.receiveShadow=true;world.add(m);return m;
}
const _m=new THREE.Matrix4(),_q=new THREE.Quaternion(),_s=new THREE.Vector3(),_p=new THREE.Vector3(),_e=new THREE.Euler();
function mat4(x,y,z,sx,sy,sz,ry){_e.set(0,ry||0,0);_q.setFromEuler(_e);_p.set(x,y,z);_s.set(sx,sy,sz);return new THREE.Matrix4().compose(_p,_q,_s);}

function build3D(){
  if(world)scene.remove(world);
  world=new THREE.Group();scene.add(world);LAMPS.length=0;
  renderDecals();
  // основание и поверхности
  const base=new THREE.Mesh(new THREE.PlaneGeometry(WW+800,WH+800),new THREE.MeshStandardMaterial({color:0x3a342e,roughness:1}));
  base.rotation.x=-Math.PI/2;base.position.set(WW/2,-.3,WH/2);base.receiveShadow=true;world.add(base);
  const road=new THREE.Mesh(tileGeo(t=>t===0,0,96),pbrMat(PBR.asphalt,{color:0xd8d8dc}));road.receiveShadow=true;world.add(road);
  const walk=new THREE.Mesh(tileGeo(t=>t===1||t===3&&false,SW,40),pbrMat(PBR.paving,{color:0xd0ccc4}));walk.receiveShadow=true;world.add(walk);
  const park=new THREE.Mesh(tileGeo(t=>t===3,SW,70),pbrMat(PBR.snow,{roughness:.9}));park.receiveShadow=true;world.add(park);
  const curb=new THREE.Mesh(curbGeo(),pbrMat(PBR.curb));curb.receiveShadow=true;curb.castShadow=true;world.add(curb);
  // декали (разметка/кровь/копоть) на уровне дороги и тротуара
  const dm=()=>new THREE.MeshBasicMaterial({map:decalTex,transparent:true,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-2,polygonOffsetUnits:-2,fog:true});
  const d1=new THREE.Mesh(tileGeo(t=>t===0,.12,0,true),dm()),d2=new THREE.Mesh(tileGeo(t=>t===1||t===3,SW+.12,0,true),dm());
  d1.renderOrder=d2.renderOrder=2;world.add(d1,d2);
  for(const b of BUILDS)placeBuilding(b);
  // лужи на дороге: зеркальные пятна
  const pg=new THREE.CircleGeometry(1,24),pmat=new THREE.MeshStandardMaterial({color:0x0b0d10,roughness:.04,metalness:0,transparent:true,opacity:.85,envMapIntensity:1.4,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-3,polygonOffsetUnits:-3});
  const pud=[];
  for(let i=0;i<260;i++){
    const tx=ri(0,MW-1),ty=ri(0,MH-1);if(T[ty*MW+tx]!==0)continue;
    pud.push(mat4((tx+rnd(.1,.9))*TS,.18,(ty+rnd(.1,.9))*TS,rnd(6,16),1,rnd(4,9),rnd(0,3)).multiply(new THREE.Matrix4().makeRotationX(-Math.PI/2)));
  }
  const pm=addInst(pg,pmat,pud,false);pm.renderOrder=3;
  // люки
  const mh=[];for(let i=0;i<90;i++){const tx=ri(0,MW-1),ty=ri(0,MH-1);if(T[ty*MW+tx]!==0)continue;mh.push(mat4((tx+.5)*TS+rnd(-10,10),.14,(ty+.5)*TS+rnd(-10,10),1,1,1,0));}
  addInst(new THREE.CylinderGeometry(5,5,.4,20),pbrMat(PBR.metal,{color:0x9a9a9a}),mh,false);
  // сугробы вдоль бордюров
  const dr=[],dg=new THREE.IcosahedronGeometry(1,2);
  for(let ty=0;ty<MH;ty++)for(let tx=0;tx<MW;tx++){
    if(T[ty*MW+tx]!==1)continue;
    for(const [dx,dz,ex,ez] of [[0,-1,1,0],[0,1,1,0],[-1,0,0,1],[1,0,0,1]]){
      if(tileAt(tx+dx,ty+dz)!==0||Math.random()>.55)continue;
      const cx=(tx+.5)*TS+dx*(TS/2-2.5)+ex*rnd(-18,18),cz=(ty+.5)*TS+dz*(TS/2-2.5)+ez*rnd(-18,18);
      dr.push(mat4(cx,SW+.2,cz,ex?rnd(6,13):rnd(2.5,4.5),rnd(1.5,3),ez?rnd(6,13):rnd(2.5,4.5),0));
    }
  }
  addInst(dg,pbrMat(PBR.snow,{roughness:.85}),dr,true);
  buildTrees();buildProps();
}
function buildTrees(){
  const n=TREES.length;if(!n)return;
  const bark=new THREE.InstancedMesh(new THREE.CylinderGeometry(1.4,2.4,18,10),new THREE.MeshStandardMaterial({color:0x4a3322,roughness:.95}),n);
  const tiers=[];const M=new THREE.Matrix4(),S=new THREE.Matrix4();
  const tg=new THREE.ConeGeometry(1,1.5,18,4,true);
  const mat=new THREE.MeshStandardMaterial({color:0x2b5b3c,roughness:.92,side:THREE.DoubleSide,envMapIntensity:.4});
  for(let k=0;k<6;k++)tiers.push(new THREE.InstancedMesh(tg,mat,n));
  const col=new THREE.Color();
  TREES.forEach((t,i)=>{
    M.makeTranslation(t.x,SW+9,t.y);bark.setMatrixAt(i,M);
    const h=t.r*rnd(2.6,3.4),rot=rnd(0,6);
    tiers.forEach((tr,k)=>{
      const f=k/5,r=t.r*(1.15-f*.85),hh=h*.34;
      M.makeTranslation(t.x,SW+8+f*h*.9+hh*.4,t.y);S.makeScale(r,hh/1.5*1.5,r);M.multiply(S);
      M.multiply(new THREE.Matrix4().makeRotationY(rot+k));tr.setMatrixAt(i,M);
    });
    col.setRGB(.9+rnd(-.1,.1),.9+rnd(-.1,.1),.9+rnd(-.1,.1));
  });
  bark.castShadow=true;world.add(bark);
  tiers.forEach(tr=>{tr.castShadow=true;tr.receiveShadow=true;world.add(tr);});
  // снежные шапки
  const cap=new THREE.InstancedMesh(new THREE.ConeGeometry(1,.7,14),new THREE.MeshStandardMaterial({color:0xf2f5fa,roughness:.8}),n);
  TREES.forEach((t,i)=>{const h=t.r*3;M.makeTranslation(t.x,SW+8+h*.95,t.y);S.makeScale(t.r*.28,t.r*.7,t.r*.28);M.multiply(S);cap.setMatrixAt(i,M);});
  world.add(cap);
}
function buildProps(){
  // фонари: опора, вылет, плафон со свечением
  const pts=[];
  for(let by=0;by<6;by++)for(let bx=0;bx<6;bx++)for(let k=0;k<4;k++){
    pts.push([(bx*10+2.5+k*2.2)*TS,(by*10+2.25)*TS,0],[(bx*10+2.5+k*2.2)*TS,(by*10+9.75)*TS,Math.PI],[(bx*10+2.25)*TS,(by*10+2.5+k*2.2)*TS,-Math.PI/2],[(bx*10+9.75)*TS,(by*10+2.5+k*2.2)*TS,Math.PI/2]);
  }
  const metal=new THREE.MeshStandardMaterial({color:0x2a2e32,roughness:.45,metalness:.85,envMapIntensity:.9});
  const pole=[],arm=[],head=[],glow=[];
  const hm=new THREE.MeshBasicMaterial({color:new THREE.Color(3.2,2.4,1.3)});
  for(const [x,z,r] of pts){
    pole.push(mat4(x,SW+24,z,1,1,1,0));
    const ox=Math.sin(r)*0,oz=0;
    arm.push(mat4(x,SW+48,z,1,1,1,r));head.push(mat4(x,SW+48,z,1,1,1,r));
    LAMPS.push({x:x+Math.cos(r)*14,y:SW+46,z:z-Math.sin(r)*14});
  }
  addInst(new THREE.CylinderGeometry(.9,1.5,48,12),metal,pole,true);
  const ag=new THREE.BoxGeometry(18,1.4,1.4);ag.translate(9,0,0);
  addInst(ag,metal,arm,true);
  const hg=new THREE.BoxGeometry(9,1.6,4.2);hg.translate(15,-1.1,0);
  const hi=new THREE.InstancedMesh(hg,hm,head.length);head.forEach((M,i)=>hi.setMatrixAt(i,M));world.add(hi);
  // скамейки, урны, гидранты
  const bn=[],bi=[],hy=[];
  for(let i=0;i<150;i++){
    const tx=ri(0,MW-1),ty=ri(0,MH-1);if(T[ty*MW+tx]!==1)continue;
    const x=(tx+.5)*TS+rnd(-12,12),z=(ty+.5)*TS+rnd(-12,12),r=Math.random();
    if(r<.4)bn.push(mat4(x,SW+4.5,z,1,1,1,Math.floor(rnd(0,4))*Math.PI/2));else if(r<.8)bi.push(mat4(x,SW+4,z,1,1,1,0));else hy.push(mat4(x,SW+3.5,z,1,1,1,0));
  }
  const wood=new THREE.MeshStandardMaterial({color:0x6a4a2e,roughness:.85}),dark=new THREE.MeshStandardMaterial({color:0x22262a,roughness:.5,metalness:.7});
  const benchG=new THREE.BoxGeometry(16,1.6,5);addInst(benchG,wood,bn.map(M=>M.clone().multiply(new THREE.Matrix4().makeTranslation(0,0,0))),true);
  addInst(new THREE.CylinderGeometry(2.6,2.2,7,14),dark,bi,true);
  addInst(new THREE.CylinderGeometry(1.4,1.8,7,12),new THREE.MeshStandardMaterial({color:0xc02a20,roughness:.5,metalness:.3}),hy,true);
}
