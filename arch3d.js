'use strict';
// ===== Архитектура высокой детализации =====
let AM=null;
function initArch(){
  AM={
    plaster:pbrMat(PBR.plaster,{color:0xeadfc6}),stone:pbrMat(PBR.curb,{color:0xb8b0a0}),concrete:pbrMat(PBR.plaster,{color:0x9aa0a0}),
    snow:pbrMat(PBR.snow,{roughness:.9}),brick:pbrMat(PBR.brick,{color:0xd8c0b0}),
    metalRed:pbrMat(PBR.metal,{color:0x9a4a3c}),patina:pbrMat(PBR.metal,{color:0x6f9a86,metalness:.5}),dark:new THREE.MeshStandardMaterial({color:0x2a2c30,roughness:.5,metalness:.7}),
    gold:new THREE.MeshStandardMaterial({color:0xd8a820,roughness:.25,metalness:1,envMapIntensity:1.5}),
    star:new THREE.MeshBasicMaterial({color:new THREE.Color(4,3,1)}),ruby:new THREE.MeshBasicMaterial({color:new THREE.Color(4,.25,.2)}),
    fac:{}
  };
  AM.wood=pbrMat(PBR.wood,{color:0xe0c8a8});AM.tin=pbrMat(PBR.tin,{color:0xc8ccd0});AM.tinRoof=pbrMat(PBR.tin,{color:0x9a6a52});
  AM.slate=pbrMat(PBR.tin,{color:0x5c6a62});AM.white=new THREE.MeshStandardMaterial({color:0xe8e8e0,roughness:.6});
  AM.pitch=new THREE.MeshStandardMaterial({color:0xdfe6e8,roughness:.9});AM.plasterC={};
}
function facMat(kind,tint){
  const set=kind==='cathedral'?brickFacade():facadeSet(kind),k=kind+tint;
  if(AM.fac[k])return AM.fac[k];
  return AM.fac[k]=new THREE.MeshStandardMaterial({map:set.map,normalMap:set.normalMap,roughnessMap:set.orm,metalnessMap:set.orm,emissiveMap:set.emissive,emissive:0xffffff,emissiveIntensity:1.5,roughness:1,metalness:1,color:new THREE.Color(tint),envMapIntensity:.8,normalScale:new THREE.Vector2(1.1,1.1)});
}
function plain(w,h,d,mat,x,y,z,sh){const m=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),mat);m.position.set(x,y,z);m.castShadow=sh!==false;m.receiveShadow=true;world.add(m);return m;}
function facadeBox(kind,tint,cx,cz,w,d,h,y0){
  const g=new THREE.BoxGeometry(w,h,d),uv=g.attributes.uv,off=Math.floor(Math.random()*4)/4;
  for(let i=0;i<24;i++){
    const f=Math.floor(i/4);let u=uv.getX(i),v=uv.getY(i);
    if(f===0||f===1){u=u*d/128+off;v=v*h/124;}
    else if(f===2||f===3){u=u*w/60;v=v*d/60;}
    else{u=u*w/128+off;v=v*h/124;}
    uv.setXY(i,u,v);
  }
  const fm=facMat(kind,tint),m=new THREE.Mesh(g,[fm,fm,AM.snow,AM.snow,fm,fm]);
  m.position.set(cx,y0+h/2,cz);m.castShadow=m.receiveShadow=true;world.add(m);return m;
}
function cornice(cx,cz,w,d,y,over,hgt,mat){
  plain(w+over*2,hgt,d+over*2,mat||AM.plaster,cx,y+hgt/2,cz);
  plain(w+over*2+2,2,d+over*2+2,AM.snow,cx,y+hgt+1,cz,false);
}
function roofClutter(cx,cz,w,d,y,big){
  plain(w-4,2.4,d-4,AM.snow,cx,y+1.2,cz,false);
  for(const [sx,sz,lw,ld] of [[0,-1,w,2],[0,1,w,2],[-1,0,2,d],[1,0,2,d]])plain(lw,5,ld,AM.concrete,cx+sx*(w/2-1),y+2.5,cz+sz*(d/2-1),false);
  const n=ri(2,5);
  for(let i=0;i<n;i++){
    const x=cx+rnd(-w*.35,w*.35),z=cz+rnd(-d*.35,d*.35),r=Math.random();
    if(r<.35){plain(rnd(10,20),rnd(6,10),rnd(8,14),AM.concrete,x,y+6,z);plain(rnd(8,16),1.6,rnd(6,12),AM.snow,x,y+11,z,false);}
    else if(r<.6){const c=new THREE.Mesh(new THREE.CylinderGeometry(2.2,2.4,rnd(12,22),12),AM.brick);c.position.set(x,y+8,z);c.castShadow=true;world.add(c);}
    else if(r<.8){const dish=new THREE.Mesh(new THREE.SphereGeometry(5,16,8,0,Math.PI*2,0,Math.PI/2.4),AM.concrete);dish.rotation.x=-.9;dish.position.set(x,y+7,z);dish.castShadow=true;world.add(dish);plain(1,6,1,AM.dark,x,y+3,z);}
    else{plain(.8,rnd(22,36),.8,AM.dark,x,y+14,z);plain(7,.6,.6,AM.dark,x,y+rnd(18,26),z);}
  }
}
function gableRoof(cx,cz,w,d,y,rh,mat){
  const lng=Math.max(w,d)+8,sh=Math.min(w,d)+8,s=new THREE.Shape();
  s.moveTo(-sh/2,0);s.lineTo(sh/2,0);s.lineTo(0,rh);s.closePath();
  const g=new THREE.ExtrudeGeometry(s,{depth:lng,bevelEnabled:false});g.translate(0,0,-lng/2);
  if(w>d)g.rotateY(Math.PI/2);
  const m=new THREE.Mesh(g,mat);m.position.set(cx,y,cz);m.castShadow=true;m.receiveShadow=true;world.add(m);
  const sn=new THREE.Mesh(g.clone(),AM.snow);sn.scale.set(.985,.985,1);sn.position.set(cx,y+1.2,cz);world.add(sn);
}
function lathe(pts,seg,mat,x,y,z){
  const m=new THREE.Mesh(new THREE.LatheGeometry(pts.map(p=>new THREE.Vector2(p[0],p[1])),seg),mat);m.position.set(x,y,z);m.castShadow=true;m.receiveShadow=true;world.add(m);return m;
}
function starMesh(x,y,z,s,mat){
  const sh=new THREE.Shape();
  for(let i=0;i<10;i++){const a=Math.PI/2+i*Math.PI/5,r=i%2?s*.42:s;i?sh.lineTo(Math.cos(a)*r,Math.sin(a)*r):sh.moveTo(Math.cos(a)*r,Math.sin(a)*r);}
  const g=new THREE.ExtrudeGeometry(sh,{depth:s*.3,bevelEnabled:true,bevelThickness:s*.06,bevelSize:s*.06,bevelSegments:2});g.translate(0,0,-s*.15);
  const m=new THREE.Mesh(g,mat);m.position.set(x,y,z);world.add(m);return m;
}
function spireTall(cx,y,cz,r,h){
  const p=[[r,0],[r*.96,h*.08],[r*.86,h*.2],[r*.7,h*.38],[r*.5,h*.58],[r*.32,h*.78],[r*.14,h*.92],[.01,h]];
  lathe(p,28,AM.patina,cx,y,cz);
  for(const f of [.2,.38,.58]){const t=new THREE.Mesh(new THREE.TorusGeometry(r*(1-f*.9)+1,1,8,28),AM.gold);t.rotation.x=Math.PI/2;t.position.set(cx,y+h*f,cz);world.add(t);}
  starMesh(cx,y+h+7,cz,9,AM.star);
}
function spire(b){
  const cx=b.x+b.w/2,cz=b.y+b.h/2,w=b.w,d=b.h,H=b.hgt,tint='#f2e9d4';
  plain(w+8,16,d+8,AM.stone,cx,8,cz);
  facadeBox('spire',tint,cx,cz,w,d,H,16);
  cornice(cx,cz,w,d,16+H,4,8);
  for(const sx of [-1,1])for(const sz of [-1,1]){
    const x=cx+sx*(w/2-22),z=cz+sz*(d/2-22);
    facadeBox('spire',tint,x,z,36,36,80,16+H+8);cornice(x,z,36,36,16+H+88,3,5);
    spireTall(x,16+H+93,z,17,60);
  }
  let y=16+H+8,k=.72,hh=250;
  for(let i=0;i<3;i++){
    facadeBox('spire',tint,cx,cz,w*k,d*k,hh,y);y+=hh;cornice(cx,cz,w*k,d*k,y,3,7);y+=7;k*=.68;hh*=.72;
  }
  spireTall(cx,y,cz,w*k*1.55,270);
}
const DOMEC=[['#c8342a','#f2ede0'],['#2a8a4a','#e8c63a'],['#2a5ac0','#e8c63a'],['#d8a820','#f0d060'],['#c8342a','#2a8a4a'],['#7a3a9a','#e8c63a']];
const domeMats=[];
function domeMat(i){
  if(domeMats[i])return domeMats[i];
  const [a,b]=DOMEC[i%6],c=document.createElement('canvas');c.width=c.height=128;const g=c.getContext('2d');
  g.fillStyle=a;g.fillRect(0,0,128,128);g.fillStyle=b;
  for(let k=-128;k<256;k+=32){g.beginPath();g.moveTo(k,0);g.lineTo(k+16,0);g.lineTo(k+144,128);g.lineTo(k+128,128);g.fill();}
  const t=canvasToTex(c,true);t.repeat.set(4,1);
  return domeMats[i]=new THREE.MeshPhysicalMaterial({map:t,roughness:.28,metalness:.55,clearcoat:.8,clearcoatRoughness:.12,envMapIntensity:1.3});
}
function onion(x,y,z,r,h,mat){
  const p=[];
  for(let i=0;i<=24;i++){const t=i/24,rad=r*(Math.sin(Math.PI*Math.pow(t,.62))*(1+.35*Math.sin(t*Math.PI))*(t<.04?.55+t*11:1));p.push([Math.max(.01,rad),t*h]);}
  lathe(p,36,mat,x,y,z);
  plain(1.3,h*.4,1.3,AM.gold,x,y+h+h*.18,z,false);plain(h*.2,1.1,1.1,AM.gold,x,y+h+h*.24,z,false);
}
function cathedral(b){
  const cx=b.x+b.w/2,cz=b.y+b.h/2,tint='#e8d0c0';
  plain(b.w-24,14,b.h-24,AM.stone,cx,7,cz);
  facadeBox('cathedral',tint,cx,cz,60,60,180,14);
  plain(66,6,66,AM.plaster,cx,14+180+3,cz);
  lathe([[46,0],[40,12],[30,42],[20,78],[9,104],[.5,122]],16,AM.patina,cx,14+186,cz);
  onion(cx,14+186+118,cz,11,26,AM.gold);
  for(let k=0;k<8;k++){
    const a=k*Math.PI/4,x=cx+Math.cos(a)*100,z=cz+Math.sin(a)*100,hh=70+(k%3)*20;
    facadeBox('cathedral',tint,x,z,44,44,hh,14);
    const dr=new THREE.Mesh(new THREE.CylinderGeometry(15,16,18,20),AM.plaster);dr.position.set(x,14+hh+9,z);dr.castShadow=true;world.add(dr);
    onion(x,14+hh+18,z,22,42,domeMat(k));
  }
  // зубчатая стена
  facadeBox('cathedral','#ffd0c0',cx,b.y+7,b.w,14,48,0);
  const n=Math.floor(b.w/16),mg=new THREE.BoxGeometry(10,12,8),mi=new THREE.InstancedMesh(mg,AM.brick,n),nt=new THREE.InstancedMesh(new THREE.BoxGeometry(2,6,8),AM.brick,n),M=new THREE.Matrix4();
  for(let i=0;i<n;i++){M.makeTranslation(b.x+8+i*16,54,b.y+7);mi.setMatrixAt(i,M);}
  mi.castShadow=true;world.add(mi);
  const tx=b.x+b.w-28,tz=b.y+28;
  facadeBox('cathedral','#ffd0c0',tx,tz,42,42,160,0);cornice(tx,tz,42,42,160,3,6,AM.stone);
  facadeBox('cathedral','#ffd0c0',tx,tz,26,26,50,166);
  lathe([[19,0],[18,10],[10,60],[.5,100]],4,AM.patina,tx,216,tz).rotation.y=Math.PI/4;
  starMesh(tx,316,tz,9,AM.ruby);
}
function placeBuilding(b){
  if(!AM)initArch();
  if(KINDFN[b.kind])return KINDFN[b.kind](b);
  const cx=b.x+b.w/2,cz=b.y+b.h/2;
  if(b.kind==='spire')return spire(b);
  if(b.kind==='cathedral')return cathedral(b);
  const tint=b.col;
  plain(b.w+3,12,b.h+3,AM.stone,cx,6,cz);
  if(b.kind==='slab5'){
    facadeBox('slab5',tint,cx,cz,b.w,b.h,b.hgt,12);
    gableRoof(cx,cz,b.w,b.h,12+b.hgt,34,AM.metalRed);
    for(let i=0;i<3;i++)plain(rnd(10,16),rnd(12,18),8,AM.dark,cx+rnd(-b.w*.3,b.w*.3),12+b.hgt+30,cz+rnd(-b.h*.2,b.h*.2));
    return;
  }
  if(b.kind==='slab9'){
    facadeBox('slab9',tint,cx,cz,b.w,b.h,b.hgt,12);
    roofClutter(cx,cz,b.w,b.h,12+b.hgt,true);
    plain(Math.min(40,b.w*.3),24,Math.min(30,b.h*.3),AM.concrete,cx+b.w*.2,12+b.hgt+14,cz);
    return;
  }
  facadeBox('classic',tint,cx,cz,b.w,b.h,b.hgt,12);
  cornice(cx,cz,b.w,b.h,12+b.hgt,4,10);
  if(b.w>120&&b.h>120){
    facadeBox('classic',tint,cx,cz,b.w*.55,b.h*.55,90,12+b.hgt+10);cornice(cx,cz,b.w*.55,b.h*.55,12+b.hgt+100,3,6);
    gableRoof(cx,cz,b.w*.55,b.h*.55,12+b.hgt+106,26,AM.metalRed);
  }else roofClutter(cx,cz,b.w,b.h,12+b.hgt+10,false);
}

// ===== Новые типы построек =====
function wbox(w,h,d,mat,x,y,z,tile,sh){ // коробка с UV в мировом масштабе
  const g=new THREE.BoxGeometry(w,h,d),uv=g.attributes.uv;
  for(let i=0;i<24;i++){const f=i>>2;let u=uv.getX(i),v=uv.getY(i);
    if(f<2){u*=d/tile;v*=h/tile;}else if(f<4){u*=w/tile;v*=d/tile;}else{u*=w/tile;v*=h/tile;}uv.setXY(i,u,v);}
  const m=new THREE.Mesh(g,mat);m.position.set(x,y,z);m.castShadow=sh!==false;m.receiveShadow=true;world.add(m);return m;
}
function plasterMat(col){return AM.plasterC[col]||(AM.plasterC[col]=pbrMat(PBR.plaster,{color:new THREE.Color(col)}));}
function fence(pl){
  const x0=pl.x+4,z0=pl.y+4,x1=pl.x+pl.w-4,z1=pl.y+pl.h-4,W=x1-x0,D=z1-z0,mx=(x0+x1)/2,mz=(z0+z1)/2;
  const rail=(x,z,w,d,y)=>plain(w,2,d,AM.wood,x,y,z,false);
  for(const y of [9,17]){
    rail(mx,z0,W,1.4,y);rail(x0,mz,1.4,D,y);rail(x1,mz,1.4,D,y);
    const gl=(W-26)/2;rail(x0+gl/2,z1,gl,1.4,y);rail(x1-gl/2,z1,gl,1.4,y);
  }
  for(let x=x0;x<=x1+1;x+=22){plain(2,22,2,AM.wood,x,11,z0,false);if(Math.abs(x-mx)>16)plain(2,22,2,AM.wood,x,11,z1,false);}
  for(let z=z0;z<=z1+1;z+=22){plain(2,22,2,AM.wood,x0,11,z,false);plain(2,22,2,AM.wood,x1,11,z,false);}
}
function windowsRow(cx,cz,w,d,y,n,sx,sz){ // тёмные окна с белой рамой на двух длинных сторонах
  for(let i=0;i<n;i++){
    const t=(i+.5)/n-.5;
    for(const s of [-1,1]){
      plain(8,10,.8,AM.white,cx+t*w*.8,y,cz+s*(d/2+.3),false);plain(6,8,1,AM.dark,cx+t*w*.8,y,cz+s*(d/2+.5),false);
    }
  }
}
function cabin(b){
  const cx=b.x+b.w/2,cz=b.y+b.h/2,w=b.w-6,d=b.h-6,H=b.hgt;
  plain(w+4,6,d+4,AM.stone,cx,3,cz);
  wbox(w,H*.58,d,AM.wood,cx,6+H*.29,cz,40);
  gableRoof(cx,cz,w,d,6+H*.58,H*.42,AM.tinRoof);
  windowsRow(cx,cz,w,d,6+H*.3,2);
  plain(14,2,10,AM.wood,cx+w*.2,7,cz+d/2+5,false);                 // крыльцо
  plain(5,H*.5,5,AM.brick,cx-w*.22,6+H*.58+H*.28,cz-d*.1);         // труба
  fence(b.plot);
}
function villa(b){
  const cx=b.x+b.w/2,cz=b.y+b.h/2,w=b.w-6,d=b.h-6,H=b.hgt;
  const wall=Math.random()<.5?AM.brick:plasterMat(pick(['#d8c8a8','#c9b49a','#bfae94','#d6cbb4']));
  plain(w+4,6,d+4,AM.stone,cx,3,cz);
  wbox(w,H*.62,d,wall,cx,6+H*.31,cz,56);
  gableRoof(cx,cz,w,d,6+H*.62,H*.4,Math.random()<.5?AM.metalRed:AM.slate);
  windowsRow(cx,cz,w,d,6+H*.32,2);
  wbox(w*.4,H*.4,d*.45,wall,cx+w*.45,6+H*.2,cz+d*.3,56);            // гараж
  plain(w*.3,H*.28,.8,AM.tin,cx+w*.45,6+H*.15,cz+d*.3+d*.225+.4,false);
  plain(5,H*.5,5,AM.brick,cx-w*.25,6+H*.62+H*.25,cz);
  fence(b.plot);
}
function works(b){
  const cx=b.x+b.w/2,cz=b.y+b.h/2,w=b.w-10,d=b.h-10,H=b.hgt;
  plain(b.w,3,b.h,AM.concrete,cx,1.5,cz);
  wbox(w,H,d,AM.brick,cx,3+H/2,cz,64);
  for(const s of [-1,1]){plain(w-20,9,.8,AM.dark,cx,3+H*.62,cz+s*(d/2+.4),false);plain(.8,9,d-20,AM.dark,cx+s*(w/2+.4),3+H*.62,cz,false);}
  // шеды — пилообразная крыша
  const tw=40,th=24,n=Math.floor((w-6)/tw),sh=new THREE.Shape();
  sh.moveTo(0,0);sh.lineTo(tw,0);sh.lineTo(tw,th);sh.closePath();
  for(let i=0;i<n;i++){
    const g=new THREE.ExtrudeGeometry(sh,{depth:d-4,bevelEnabled:false});g.translate(0,0,-(d-4)/2);
    const m=new THREE.Mesh(g,AM.tin);m.position.set(cx-w/2+3+i*tw,3+H,cz);m.castShadow=m.receiveShadow=true;world.add(m);
    plain(1,th*.7,d-10,AM.dark,cx-w/2+3+(i+1)*tw+.6,3+H+th*.4,cz,false);
  }
  // трубы
  const nc=1+(b.w>380?1:0);
  for(let i=0;i<nc;i++){
    const x=cx+(i?1:-1)*w*.28,z=cz-d*.25,h=rnd(150,230);
    const c=new THREE.Mesh(new THREE.CylinderGeometry(5.5,8.5,h,14),AM.brick);c.position.set(x,3+H+h/2-4,z);c.castShadow=true;world.add(c);
    const r=new THREE.Mesh(new THREE.CylinderGeometry(6.2,6.2,4,14),AM.white);r.position.set(x,3+H+h*.9,z);world.add(r);
    const r2=r.clone();r2.material=AM.metalRed;r2.position.y=3+H+h*.72;world.add(r2);
  }
  // труба-коллектор вдоль стены и пристройка
  const pp=new THREE.Mesh(new THREE.CylinderGeometry(3,3,w*.7,8),AM.metalRed);pp.rotation.z=Math.PI/2;pp.position.set(cx,3+H*.8,cz+d/2+6);pp.castShadow=true;world.add(pp);
  wbox(w*.3,H*.5,20,AM.concrete,cx-w*.3,3+H*.25,cz+d/2+12,60);
}
function depot(b){
  const cx=b.x+b.w/2,cz=b.y+b.h/2,w=b.w-8,d=b.h-8,H=b.hgt;
  plain(b.w,2,b.h,AM.concrete,cx,1,cz);
  wbox(w,H,d,AM.tin,cx,2+H/2,cz,40);
  gableRoof(cx,cz,w,d,2+H,16,AM.tin);
  const n=Math.max(1,Math.floor(w/50));
  for(let i=0;i<n;i++)plain(30,H*.72,.8,AM.dark,cx+((i+.5)/n-.5)*w*.85,2+H*.36,cz+d/2+.4,false);
  for(let i=0;i<ri(1,3);i++){const bx=cx+rnd(-w/2,w/2),bz=cz+d/2+rnd(10,14);wbox(24,12,10,AM.metalRed,bx,8,bz,40);if(Math.random()<.5)wbox(24,12,10,AM.slate,bx,20,bz,40);}
}
function silo(b){
  const cx=b.x+b.w/2,cz=b.y+b.h/2,H=b.hgt,n=b.w>=96?2:1;
  plain(b.w,3,b.h,AM.concrete,cx,1.5,cz);
  for(let i=0;i<n;i++){
    const x=cx+(n>1?(i?1:-1)*b.w*.22:0),r=Math.min(b.w,b.h)*(n>1?.2:.34);
    const c=new THREE.Mesh(new THREE.CylinderGeometry(r,r,H,20),AM.tin);c.position.set(x,3+H/2,cz);c.castShadow=c.receiveShadow=true;world.add(c);
    const t=new THREE.Mesh(new THREE.ConeGeometry(r*1.02,r*.5,20),AM.concrete);t.position.set(x,3+H+r*.25,cz);t.castShadow=true;world.add(t);
    plain(1.5,H,1.5,AM.dark,x+r+1,3+H/2,cz,false);
  }
  if(n>1)plain(b.w*.4,3,3,AM.metalRed,cx,3+H*.6,cz);
}
function slab12(b){
  const cx=b.x+b.w/2,cz=b.y+b.h/2;
  facadeBox('slab9',b.col,cx,cz,b.w,b.h,b.hgt,12);
  roofClutter(cx,cz,b.w,b.h,12+b.hgt,true);
  for(const s of [-1,1])plain(Math.min(30,b.w*.25),26,Math.min(26,b.h*.2),AM.concrete,cx+s*b.w*.28,12+b.hgt+15,cz,false);
}
function arena(b){
  const cx=b.x+b.w/2,cz=b.y+b.h/2,rx=b.w/2-10,rz=b.h/2-10;
  const ring=(ax,az,bx,bz,depth,y,mat)=>{
    const sh=new THREE.Shape();sh.absellipse(0,0,ax,az,0,Math.PI*2,false,0);
    const h=new THREE.Path();h.absellipse(0,0,bx,bz,0,Math.PI*2,true,0);sh.holes.push(h);
    const g=new THREE.ExtrudeGeometry(sh,{depth,bevelEnabled:false,curveSegments:36});g.rotateX(-Math.PI/2);
    const m=new THREE.Mesh(g,mat);m.position.set(cx,y,cz);m.castShadow=m.receiveShadow=true;world.add(m);
  };
  ring(rx,rz,rx-26,rz-22,30,0,AM.concrete);
  ring(rx-26,rz-22,rx-58,rz-48,18,0,AM.stone);
  ring(rx-58,rz-48,rx-84,rz-70,8,0,AM.concrete);
  const pg=new THREE.EllipseCurve(0,0,rx-84,rz-70,0,Math.PI*2),pts=pg.getPoints(48).map(p=>new THREE.Vector2(p.x,p.y));
  const pitch=new THREE.Mesh(new THREE.ShapeGeometry(new THREE.Shape(pts)),AM.pitch);pitch.rotation.x=-Math.PI/2;pitch.position.set(cx,2,cz);pitch.receiveShadow=true;world.add(pitch);
  for(const sx of [-1,1])for(const sz of [-1,1]){
    const x=cx+sx*(rx*.78),z=cz+sz*(rz*.8);
    plain(3,130,3,AM.dark,x,65,z);plain(16,10,4,AM.star,x,132,z,false);
  }
}
function mast(b){
  const cx=b.x+b.w/2,cz=b.y+b.h/2;
  plain(b.w-10,10,b.h-10,AM.stone,cx,5,cz);
  let y=10,r=14;
  for(let i=0;i<8;i++){
    const h=46,m=new THREE.Mesh(new THREE.CylinderGeometry(r*.82,r,h,12),i%2?AM.white:AM.metalRed);m.position.set(cx,y+h/2,cz);m.castShadow=true;world.add(m);y+=h;r*=.82;
    if(i===3){const p=new THREE.Mesh(new THREE.CylinderGeometry(34,22,12,18),AM.concrete);p.position.set(cx,y+6,cz);p.castShadow=true;world.add(p);y+=12;}
    if(i===5){const p=new THREE.Mesh(new THREE.CylinderGeometry(20,13,9,16),AM.concrete);p.position.set(cx,y+4,cz);world.add(p);y+=9;}
  }
  const a=new THREE.Mesh(new THREE.CylinderGeometry(.9,2.2,130,8),AM.dark);a.position.set(cx,y+65,cz);world.add(a);
  plain(3,3,3,AM.ruby,cx,y+132,cz,false);
}
const KINDFN={cabin,villa,works,depot,silo,slab12,arena,mast};
// ===== Размещение с объединением геометрии по чанкам =====
const BK=new Map();
function bakeGroup(grp,cx,cz){
  grp.updateMatrixWorld(true);
  const ck=((cx/1024)|0)+','+((cz/1024)|0),nm=new THREE.Matrix3(),v=new THREE.Vector3();
  grp.traverse(o=>{
    if(!o.isMesh||o.isInstancedMesh)return;
    const g=o.geometry,pos=g.attributes.position,uv=g.attributes.uv,idx=g.index;
    if(!g.attributes.normal)g.computeVertexNormals();
    const nor=g.attributes.normal,mats=Array.isArray(o.material)?o.material:[o.material];
    nm.getNormalMatrix(o.matrixWorld);
    const groups=g.groups&&g.groups.length?g.groups:[{start:0,count:idx?idx.count:pos.count,materialIndex:0}];
    for(const gr of groups){
      const mat=Array.isArray(o.material)?mats[gr.materialIndex]:mats[0];if(!mat)continue;
      const key=ck+'|'+mat.uuid+'|'+(o.castShadow?1:0);
      let B=BK.get(key);if(!B){B={mat,cast:o.castShadow,p:[],n:[],u:[],i:[],c:0};BK.set(key,B);}
      const map=new Map();
      for(let k=gr.start;k<gr.start+gr.count;k++){
        const vi=idx?idx.getX(k):k;let ni=map.get(vi);
        if(ni===undefined){
          ni=B.c++;map.set(vi,ni);
          v.fromBufferAttribute(pos,vi).applyMatrix4(o.matrixWorld);B.p.push(v.x,v.y,v.z);
          v.fromBufferAttribute(nor,vi).applyMatrix3(nm).normalize();B.n.push(v.x,v.y,v.z);
          B.u.push(uv?uv.getX(vi):0,uv?uv.getY(vi):0);
        }
        B.i.push(ni);
      }
    }
    g.dispose();
  });
}
function flushBake(){
  for(const B of BK.values()){
    const g=new THREE.BufferGeometry();
    g.setAttribute('position',new THREE.Float32BufferAttribute(B.p,3));g.setAttribute('normal',new THREE.Float32BufferAttribute(B.n,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(B.u,2));
    g.setIndex(new THREE.BufferAttribute(new Uint32Array(B.i),1));
    const m=new THREE.Mesh(g,B.mat);m.castShadow=!!B.cast;m.receiveShadow=true;world.add(m);
  }
  BK.clear();
}
function placeBuildings(){
  if(!AM)initArch();
  const real=world;
  for(const b of BUILDS){
    const cx=b.x+b.w/2,cz=b.y+b.h/2;let mx=-1e9,mn=1e9;
    for(const [x,z] of [[b.x,b.y],[b.x+b.w,b.y],[b.x,b.y+b.h],[b.x+b.w,b.y+b.h],[cx,cz]]){const h=hAt(x,z);mx=Math.max(mx,h);mn=Math.min(mn,h);}
    const y0=mx+SW,tmp=new THREE.Group();tmp.position.set(0,y0,0);
    world=tmp;
    if(y0-mn>3){const e=y0-mn+6;plain(b.w+3,e,b.h+3,AM.stone,cx,-e/2+1,cz);}
    placeBuilding(b);
    world=real;
    bakeGroup(tmp,cx,cz);
    for(const o of tmp.children.slice())if(o.isInstancedMesh){o.position.y+=y0;real.add(o);}
  }
  flushBake();
}
