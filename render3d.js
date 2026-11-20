'use strict';
// ===== 3D: сущности, частицы, камера =====
let camYaw=-1.57;
const carMap=new Map(),pedMap=new Map(),pickMap=new Map(),bulMap=new Map();
const lam=c=>new THREE.MeshLambertMaterial({color:c});
const bas=c=>new THREE.MeshBasicMaterial({color:c});
const box=(w,h,d,m,x,y,z,sh)=>{const o=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),m);o.position.set(x,y,z);if(sh)o.castShadow=true;return o;};

const pickGeo=new THREE.BoxGeometry(9,9,9),pickCol={cash:0x3fbf55,ammo:0xd0a020,hp:0xf0f0f0,armor:0x3a6af0,weapon:0xd06a20};
const iconTex={};
function pickIcon(k){ // значок над находкой (оружие / броня)
  const id=k.type==='armor'?'armor':WEAPONS[k.w].id;
  if(!iconTex[id]){
    const c=document.createElement('canvas');c.width=c.height=96;const g=c.getContext('2d');
    g.fillStyle='rgba(12,14,16,.85)';g.beginPath();g.arc(48,48,44,0,7);g.fill();
    g.strokeStyle=k.type==='armor'?'#6a9aff':'#f2a040';g.lineWidth=5;g.stroke();
    drawWIcon(g,id,48,48,52,k.type==='armor'?'#9fc0ff':'#ffd9a0');
    iconTex[id]=new THREE.CanvasTexture(c);
  }
  const s=new THREE.Sprite(new THREE.SpriteMaterial({map:iconTex[id],transparent:true,depthWrite:false,fog:false}));
  s.scale.set(17,17,1);s.position.y=24;return s;
}
function makePick(k){
  const m=new THREE.Mesh(pickGeo,bas(pickCol[k.type]));m.castShadow=false;
  if(k.cache){m.scale.set(.8,.8,.8);m.add(pickIcon(k));}
  return m;
}
const bulGeo=new THREE.BoxGeometry(9,1.6,1.6),bulM=bas(0xffe9a0),rocM=lam(0xbbbbbb);
function makeBul(b){return b.rocket?box(12,3.5,3.5,rocM,0,0,0):new THREE.Mesh(bulGeo,bulM);}

// частицы: пулы спрайтов
const sprTex=(()=>{const c=document.createElement('canvas');c.width=c.height=64;const g=c.getContext('2d');
  const gr=g.createRadialGradient(32,32,0,32,32,32);gr.addColorStop(0,'rgba(255,255,255,1)');gr.addColorStop(.5,'rgba(255,255,255,.5)');gr.addColorStop(1,'rgba(255,255,255,0)');
  g.fillStyle=gr;g.fillRect(0,0,64,64);return new THREE.CanvasTexture(c);})();
function pool(n,color,add){
  const a=[];for(let i=0;i<n;i++){
    const s=new THREE.Sprite(new THREE.SpriteMaterial({map:sprTex,color,transparent:true,depthWrite:false,blending:add?THREE.AdditiveBlending:THREE.NormalBlending}));
    s.visible=false;scene.add(s);a.push(s);
  }return a;
}
const poolF=pool(260,0xff9a30,true),poolS=pool(180,0x3a3a3a,false),poolK=pool(90,0xffe090,true);

function syncMap(list,map,make,upd,skip){
  const seen=new Set();
  for(const o of list){
    if(skip&&skip(o))continue;
    let m=map.get(o);if(!m){m=make(o);scene.add(m);map.set(o,m);}
    const d=Math.abs(o.x-cam3.position.x)+Math.abs(o.y-cam3.position.z);
    m.visible=d<1500;if(m.visible)upd(m,o);seen.add(o);
  }
  for(const [o,m] of map)if(!seen.has(o)){scene.remove(m);map.delete(o);}
}
function syncParts(){
  let f=0,s=0,k=0;
  for(const p of parts){
    const a=p.l/p.m,r=1-a;
    if(p.k==='f'&&f<poolF.length){const o=poolF[f++];o.visible=true;o.position.set(p.x,hAt(p.x,p.y)+8+r*30,p.y);o.scale.setScalar(p.s*2.6);o.material.opacity=.9*a;}
    else if(p.k==='s'&&s<poolS.length){const o=poolS[s++];o.visible=true;o.position.set(p.x,hAt(p.x,p.y)+10+r*60,p.y);o.scale.setScalar(p.s*3.2);o.material.opacity=.5*a;}
    else if(p.k==='k'&&k<poolK.length){const o=poolK[k++];o.visible=true;o.position.set(p.x,hAt(p.x,p.y)+10+r*6,p.y);o.scale.setScalar(4);o.material.opacity=a;}
  }
  for(let i=f;i<poolF.length;i++)poolF[i].visible=false;
  for(let i=s;i<poolS.length;i++)poolS[i].visible=false;
  for(let i=k;i<poolK.length;i++)poolK[i].visible=false;
}
let camPitch=-.32,lookIdle=0,fpv=false;
function carY(x,y){const t=tileAt(Math.floor(x/TS),Math.floor(y/TS));return hAt(x,y)+SW+(t===0?.9:0);} // .9 — полотно дороги над землёй (RD.ASPH)
function updateCam(){
  const car=P.car;
  if(mouse.dx||mouse.dy){lookIdle=0;}
  if(document.pointerLockElement){camYaw+=mouse.dx*.0026;camPitch=clamp(camPitch-mouse.dy*.0026,-1.2,1.3);}
  mouse.dx=0;mouse.dy=0;
  if(keys.ArrowUp&&!car&&false){}
  lookIdle++;
  if(car){
    if(lookIdle>110){camYaw+=angDiff(camYaw,car.a)*.07;camPitch+=((fpv?0:-.3)-camPitch)*.05;}
  }
  const base=carY(P.x,P.y),sh=shake*.8;
  let ex,ey,ez;
  if(fpv){
    if(car){const f=(car.len*.5-car.len*.5)+ -2.2+(STY[car.type]?(STY[car.type].cabA+STY[car.type].cabB)*car.len/2:0);
      const lat=-car.wid*.21;ex=car.x+Math.cos(car.a)*f-Math.sin(car.a)*lat;ez=car.y+Math.sin(car.a)*f+Math.cos(car.a)*lat;ey=carY(car.x,car.y)+(STY[car.type]?STY[car.type].belt:11)+7;}
    else{ex=P.x+Math.cos(camYaw)*2;ez=P.y+Math.sin(camYaw)*2;ey=base+16.8;}
    const cp=Math.cos(camPitch);
    cam3.position.set(ex+rnd(-sh,sh)*.4,ey+rnd(-sh,sh)*.4,ez+rnd(-sh,sh)*.4);
    cam3.lookAt(ex+Math.cos(camYaw)*cp*50,ey+Math.sin(camPitch)*50,ez+Math.sin(camYaw)*cp*50);
  }else{
    const dist=car?85+car.speed*3.4:62,ty=base+(car?9:14),tx=P.x,tz=P.y;
    const cp=Math.cos(camPitch),spn=Math.sin(camPitch);
    let d=dist;
    const px=k=>tx-Math.cos(camYaw)*cp*k,pz=k=>tz-Math.sin(camYaw)*cp*k;
    while(d>14&&solidAt(px(d),pz(d)))d-=5;
    let cx=px(d),cy=ty-spn*d,cz=pz(d);
    cy=Math.max(cy,hAt(cx,cz)+SW+4);
    cam3.position.set(cx+rnd(-sh,sh),cy+rnd(-sh,sh),cz+rnd(-sh,sh));
    cam3.lookAt(tx,ty,tz);
  }
  const fov=(fpv?74:62)+(car?Math.min(18,car.speed*1.9):(P.moving&&P.fast?7:P.moving?2:0));
  if(Math.abs(cam3.fov-fov)>.1){cam3.fov+=(fov-cam3.fov)*.06;cam3.updateProjectionMatrix();}
}
let hurtV=0,dimV=0;
const HEAD_ON=()=>{if(P.car)return;};
function draw3D(){
  if(window.WATER&&WATER.material.normalMap)WATER.material.normalMap.offset.set(tm*.0004,tm*.0002);
  updateCam();
  {const q=.4,tx=Math.round(P.x/q)*q,tz=Math.round(P.y/q)*q;sun.target.position.set(tx,0,tz);sun.position.set(tx+SUNDIR.x*1500,SUNDIR.y*1500,tz+SUNDIR.z*1500);}
  boomLight*=.9;boom.intensity=boomLight*3;boom.position.set(boomX,40,boomY);
  syncMap(cars,carMap,makeCar,(m,c)=>updCar(m,c));
  syncMap(peds,pedMap,makePed,(m,p)=>updPed(m,Object.assign(p,{aim:p.kind==='cop'&&p.cd>0&&P.heat>=2?1:0})),p=>p.dead);
  syncMap(picks,pickMap,makePick,(m,k)=>{m.position.set(k.x,carY(k.x,k.y)+12+Math.sin(tm/18+k.x)*2,k.y);m.rotation.y=tm*.04;});
  syncMap(bullets,bulMap,makeBul,(m,b)=>{m.position.set(b.x,carY(b.x,b.y)+11,b.y);m.rotation.y=-Math.atan2(b.vy,b.vx);});
  playerMesh.visible=!P.car&&!P.dead&&!fpv&&!(P.busted>0&&false);
  if(!P.car&&!P.dead){
    updPed(playerMesh,{x:P.x,y:P.y,a:P.a,step:P.moved*3,moving:P.moving,fast:P.fast,aim:P.cd>0?1:0,w:P.w,head:{yaw:clamp(angDiff(P.a,camYaw),-1.9,1.9),pitch:clamp(-camPitch,-.8,.8)}});
    playerMesh.visible=!fpv;
  }
  for(const [id,m] of carMap){if(m.userData.drv)m.userData.drv.visible=!(fpv&&P.car&&carMap.get(P.car)===m);}
  // фары игрока / ближайших машин, фонари
  const hc=P.car;
  for(const [L,sz] of [[headL,-.7],[headR,.7]]){
    if(hc&&!hc.dead){const f=hc.len/2,z=sz*(hc.wid/2-4);const wx=hc.x+Math.cos(hc.a)*f-Math.sin(hc.a)*z,wz=hc.y+Math.sin(hc.a)*f+Math.cos(hc.a)*z;
      L.intensity=1.6;L.position.set(wx,9,wz);L.target.position.set(wx+Math.cos(hc.a)*140,0,wz+Math.sin(hc.a)*140);}
    else L.intensity=0;
  }
  {const cl=LAMPS.slice().sort((a,b)=>(a.x-P.x)**2+(a.y-P.y)**2-((b.x-P.x)**2+(b.y-P.y)**2));
   if(tm%10===0){window.__lampSel=cl.slice(0,lampPool.length);}
   const sel=window.__lampSel||[];lampPool.forEach((l,i)=>{const q=sel[i];if(q){l.position.set(q.x,q.y,q.z);l.intensity=.9;}else l.intensity=0;});}
  if(typeof drawHeli==='function')drawHeli();
  syncParts();updateSnow();
  hurtV=P.hp<35&&!P.dead?(35-P.hp)/35:0;dimV=P.dead>0?1:0;
  renderFrame(tm/60,hurtV,dimV);
}

// снегопад
const SN=1400,snowPos=new Float32Array(SN*3);
for(let i=0;i<SN;i++){snowPos[i*3]=rnd(-420,420);snowPos[i*3+1]=rnd(0,320);snowPos[i*3+2]=rnd(-420,420);}
const snowGeo=new THREE.BufferGeometry();snowGeo.setAttribute('position',new THREE.BufferAttribute(snowPos,3));
const snowTex=(()=>{const c=document.createElement('canvas');c.width=c.height=32;const g=c.getContext('2d');const r=g.createRadialGradient(16,16,0,16,16,15);r.addColorStop(0,'rgba(255,255,255,1)');r.addColorStop(1,'rgba(255,255,255,0)');g.fillStyle=r;g.fillRect(0,0,32,32);return new THREE.CanvasTexture(c);})();
const snow=new THREE.Points(snowGeo,new THREE.PointsMaterial({size:3.2,map:snowTex,transparent:true,opacity:.85,depthWrite:false,color:0xffffff,fog:true}));
snow.frustumCulled=false;scene.add(snow);
function updateSnow(){
  const cx=cam3.position.x,cz=cam3.position.z;
  for(let i=0;i<SN;i++){
    let x=snowPos[i*3],y=snowPos[i*3+1],z=snowPos[i*3+2];
    y-=.8+(i%5)*.12;x+=Math.sin(tm*.02+i)*.25;
    if(y<0)y+=320;
    if(x-cx>420)x-=840;else if(x-cx<-420)x+=840;
    if(z-cz>420)z-=840;else if(z-cz<-420)z+=840;
    snowPos[i*3]=x;snowPos[i*3+1]=y;snowPos[i*3+2]=z;
  }
  snowGeo.attributes.position.needsUpdate=true;
}
