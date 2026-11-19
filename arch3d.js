'use strict';
// ===== Московская архитектура высокой детализации =====
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
}
function facMat(kind,tint){
  const set=kind==='basil'?brickFacade():facadeSet(kind),k=kind+tint;
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
function vysotka(b){
  const cx=b.x+b.w/2,cz=b.y+b.h/2,w=b.w,d=b.h,H=b.hgt,tint='#f2e9d4';
  plain(w+8,16,d+8,AM.stone,cx,8,cz);
  facadeBox('vysotka',tint,cx,cz,w,d,H,16);
  cornice(cx,cz,w,d,16+H,4,8);
  for(const sx of [-1,1])for(const sz of [-1,1]){
    const x=cx+sx*(w/2-22),z=cz+sz*(d/2-22);
    facadeBox('vysotka',tint,x,z,36,36,80,16+H+8);cornice(x,z,36,36,16+H+88,3,5);
    spireTall(x,16+H+93,z,17,60);
  }
  let y=16+H+8,k=.72,hh=250;
  for(let i=0;i<3;i++){
    facadeBox('vysotka',tint,cx,cz,w*k,d*k,hh,y);y+=hh;cornice(cx,cz,w*k,d*k,y,3,7);y+=7;k*=.68;hh*=.72;
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
function basil(b){
  const cx=b.x+b.w/2,cz=b.y+b.h/2,tint='#e8d0c0';
  plain(b.w-24,14,b.h-24,AM.stone,cx,7,cz);
  facadeBox('basil',tint,cx,cz,60,60,180,14);
  plain(66,6,66,AM.plaster,cx,14+180+3,cz);
  lathe([[46,0],[40,12],[30,42],[20,78],[9,104],[.5,122]],16,AM.patina,cx,14+186,cz);
  onion(cx,14+186+118,cz,11,26,AM.gold);
  for(let k=0;k<8;k++){
    const a=k*Math.PI/4,x=cx+Math.cos(a)*100,z=cz+Math.sin(a)*100,hh=70+(k%3)*20;
    facadeBox('basil',tint,x,z,44,44,hh,14);
    const dr=new THREE.Mesh(new THREE.CylinderGeometry(15,16,18,20),AM.plaster);dr.position.set(x,14+hh+9,z);dr.castShadow=true;world.add(dr);
    onion(x,14+hh+18,z,22,42,domeMat(k));
  }
  // кремлёвская стена с ласточкиными зубцами
  facadeBox('basil','#ffd0c0',cx,b.y+7,b.w,14,48,0);
  const n=Math.floor(b.w/16),mg=new THREE.BoxGeometry(10,12,8),mi=new THREE.InstancedMesh(mg,AM.brick,n),nt=new THREE.InstancedMesh(new THREE.BoxGeometry(2,6,8),AM.brick,n),M=new THREE.Matrix4();
  for(let i=0;i<n;i++){M.makeTranslation(b.x+8+i*16,54,b.y+7);mi.setMatrixAt(i,M);}
  mi.castShadow=true;world.add(mi);
  const tx=b.x+b.w-28,tz=b.y+28;
  facadeBox('basil','#ffd0c0',tx,tz,42,42,160,0);cornice(tx,tz,42,42,160,3,6,AM.stone);
  facadeBox('basil','#ffd0c0',tx,tz,26,26,50,166);
  lathe([[19,0],[18,10],[10,60],[.5,100]],4,AM.patina,tx,216,tz).rotation.y=Math.PI/4;
  starMesh(tx,316,tz,9,AM.ruby);
}
function placeBuilding(b){
  if(!AM)initArch();
  const cx=b.x+b.w/2,cz=b.y+b.h/2;
  if(b.kind==='vysotka')return vysotka(b);
  if(b.kind==='basil')return basil(b);
  const tint=b.col;
  plain(b.w+3,12,b.h+3,AM.stone,cx,6,cz);
  if(b.kind==='khrush'){
    facadeBox('khrush',tint,cx,cz,b.w,b.h,b.hgt,12);
    gableRoof(cx,cz,b.w,b.h,12+b.hgt,34,AM.metalRed);
    for(let i=0;i<3;i++)plain(rnd(10,16),rnd(12,18),8,AM.dark,cx+rnd(-b.w*.3,b.w*.3),12+b.hgt+30,cz+rnd(-b.h*.2,b.h*.2));
    return;
  }
  if(b.kind==='panel9'){
    facadeBox('panel9',tint,cx,cz,b.w,b.h,b.hgt,12);
    roofClutter(cx,cz,b.w,b.h,12+b.hgt,true);
    plain(Math.min(40,b.w*.3),24,Math.min(30,b.h*.3),AM.concrete,cx+b.w*.2,12+b.hgt+14,cz);
    return;
  }
  facadeBox('stalin',tint,cx,cz,b.w,b.h,b.hgt,12);
  cornice(cx,cz,b.w,b.h,12+b.hgt,4,10);
  if(b.w>120&&b.h>120){
    facadeBox('stalin',tint,cx,cz,b.w*.55,b.h*.55,90,12+b.hgt+10);cornice(cx,cz,b.w*.55,b.h*.55,12+b.hgt+100,3,6);
    gableRoof(cx,cz,b.w*.55,b.h*.55,12+b.hgt+106,26,AM.metalRed);
  }else roofClutter(cx,cz,b.w,b.h,12+b.hgt+10,false);
}
