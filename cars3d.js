'use strict';
// ===== Высокополигональные машины: лофт кузова из сечений =====
const STY={
  sedan:{belt:11,cabA:-.20,cabB:.13,rkF:.07,rkR:.05,ch:8.5,lights:'round',chrome:1,n:3.4},
  sport:{belt:11,cabA:-.33,cabB:.13,rkF:.14,rkR:.17,ch:8.5,lights:'wedge',n:3},
  moskvich:{belt:11,cabA:-.23,cabB:.14,rkF:.05,rkR:.02,ch:9,lights:'round',chrome:1,n:3.6},
  volga:{belt:11.5,cabA:-.20,cabB:.09,rkF:.09,rkR:.07,ch:8,lights:'volga',chrome:1,strip:1,n:4},
  taxi:{belt:11.5,cabA:-.20,cabB:.09,rkF:.09,rkR:.07,ch:8,lights:'volga',chrome:1,strip:1,taxi:1,n:4},
  chaika:{belt:12,cabA:-.26,cabB:.03,rkF:.10,rkR:.06,ch:8,lights:'chaika',chrome:1,strip:1,fins:1,n:4.4},
  van:{belt:13,cabA:-.46,cabB:.17,rkF:.04,rkR:0,ch:9.5,lights:'round',n:5},
  cop:{belt:11,cabA:-.20,cabB:.13,rkF:.07,rkR:.05,ch:8.5,lights:'round',chrome:1,cop:1,n:3.4}
};
const sgn=v=>v<0?-1:1;
function plerp(pts,u){for(let i=1;i<pts.length;i++)if(u<=pts[i][0]){const a=pts[i-1],b=pts[i],t=(u-a[0])/(b[0]-a[0]||1);const s=t*t*(3-2*t);return a[1]+(b[1]-a[1])*s;}return pts[pts.length-1][1];}
// сборка кольцевого лофта: st = [{x,yb,yt,w,tk(tumblehome)}]
function loftGeo(st,R,n,roofFn){
  const pos=[],uv=[],idx=[],idxR=[];
  st.forEach((s,i)=>{
    const ym=(s.yb+s.yt)/2,hh=(s.yt-s.yb)/2;
    for(let k=0;k<=R;k++){
      const th=2*Math.PI*(k%R)/R,cs=Math.cos(th),sn=Math.sin(th);
      const e=2/n,zc=sgn(cs)*Math.pow(Math.abs(cs),e),yc=sgn(sn)*Math.pow(Math.abs(sn),e);
      const tk=1-(s.tk||0)*Math.max(0,yc);
      pos.push(s.x,ym+hh*yc,s.w*zc*tk);uv.push(i/(st.length-1),k/R);
    }
  });
  for(let i=0;i<st.length-1;i++)for(let k=0;k<R;k++){
    const a=i*(R+1)+k,b=a+1,c=a+R+1,d=c+1;
    const roof=roofFn&&roofFn(i,k,st,R);
    (roof?idxR:idx).push(a,c,b,b,c,d);
  }
  const g=new THREE.BufferGeometry();
  g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));
  g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));
  g.setIndex(idx.concat(idxR));g.addGroup(0,idx.length,0);if(idxR.length)g.addGroup(idx.length,idxR.length,1);
  g.computeVertexNormals();return g;
}
const geoCache={};
function carGeos(type,L,W){
  if(geoCache[type])return geoCache[type];
  const S=STY[type]||STY.sedan,B=S.belt,yb=4.3;
  // кузов: профиль крыши кузова по длине (u: 0 зад → 1 перед)
  const hood=type==='van'?[[0,B+1],[.05,B+3],[.12,B+4],[.78,B+4],[.88,B+1],[.97,B-1],[1,B-3]]:
    [[0,B-3.2],[.04,B-1.6],[.14,B-.3],[.2,B],[.7,B],[.9,B-1.1],[.97,B-2.4],[1,B-3.6]];
  const st=[],N=64;
  for(let i=0;i<=N;i++){
    const u=i/N,e=Math.min(u,1-u),s=Math.sqrt(Math.min(1,e/.055));
    const yt=plerp(hood,u),bot=yb+(1-s)*2.2+(u>.9?(u-.9)*8:0);
    st.push({x:(u-.5)*L,yb:bot,yt:Math.max(yt,bot+1),w:W/2*(.35+.65*s)*(u>.93?1-(u-.93)*1.6:1),tk:.1});
  }
  const body=loftGeo(st,36,S.n);
  // салон/стёкла
  const x1=S.cabA*L,x2=S.cabB*L,t1=x1+S.rkR*L,t2=x2-S.rkF*L,top=B+S.ch;
  const bp=[x1,t1-.01,t1+(t2-t1)*.33,t1+(t2-t1)*.66,t2,x2];
  const xs=[];for(let i=0;i<=22;i++)xs.push(x1+(x2-x1)*i/22);bp.forEach(v=>xs.push(v));
  xs.sort((a,b)=>a-b);const uq=xs.filter((v,i)=>i===0||v-xs[i-1]>.05);
  const cab=uq.map(x=>{
    let y;if(x<t1)y=B+(top-B)*Math.pow(Math.max(0,(x-x1)/Math.max(t1-x1,.5)),.7);else if(x>t2)y=top-(top-B)*Math.pow(Math.max(0,(x-t2)/Math.max(x2-t2,.5)),1.3);else y=top+Math.sin((x-t1)/(t2-t1)*Math.PI)*.5;
    return {x,yb:B-1.2,yt:Math.max(y,B-.4),w:W/2-1.7,tk:.18};
  });
  const cabin=loftGeo(cab,28,3,(i,k,s,R)=>{const xm=(s[i].x+s[i+1].x)/2;return xm>t1-.5&&xm<t2+.5&&k>=4&&k<=10;});
  const r={body,cabin,x1,x2,t1,t2,top,B};geoCache[type]=r;return r;
}
// номерные знаки
const plateTex=[];
function platesInit(){
  if(plateTex.length)return;
  const L='АВЕКМНОРСТУХ';
  for(let n=0;n<4;n++){
    const c=document.createElement('canvas');c.width=256;c.height=64;const g=c.getContext('2d');
    g.fillStyle='#f4f2ea';g.fillRect(0,0,256,64);g.strokeStyle='#111';g.lineWidth=4;g.strokeRect(3,3,250,58);
    g.fillStyle='#111';g.font='bold 40px Arial';g.textAlign='center';g.textBaseline='middle';
    g.fillText(L[(n*3)%12]+' '+(100+n*217%900)+' '+L[(n*5+2)%12]+L[(n*7+1)%12],118,34);
    g.font='bold 20px Arial';g.fillText('77',232,26);g.font='10px Arial';g.fillText('RUS',232,46);
    const t=new THREE.CanvasTexture(c);t.anisotropy=4;plateTex.push(t);
  }
}
const lathePts=(arr)=>arr.map(p=>new THREE.Vector2(p[0],p[1]));
const TIRE_G=new THREE.LatheGeometry(lathePts([[3.2,-2],[4.4,-2.1],[5.1,-1.7],[5.4,-1],[5.5,-.2],[5.5,.2],[5.4,1],[5.1,1.7],[4.4,2.1],[3.2,2],[3.2,-2]]),28);
const RIM_G=new THREE.LatheGeometry(lathePts([[0,2],[1.2,2],[1.6,1.7],[3.3,1.5],[3.5,1.1],[3.5,-1],[3.3,-1.8],[0,-1.8]]),24);
const DISC_G=new THREE.CylinderGeometry(2.6,2.6,.5,20);
const BOLT_G=new THREE.CylinderGeometry(.28,.28,.5,6);
const ARCH_G=new THREE.RingGeometry(5.65,6.7,28);
let TIRE_M,DARK_M,CHR_M,PLASTIC_M;
function matsInit(){
  if(TIRE_M)return;
  TIRE_M=new THREE.MeshStandardMaterial({color:0x151515,roughness:.92,metalness:0});
  DARK_M=new THREE.MeshStandardMaterial({color:0x0e0e10,roughness:.8,metalness:.1});
  CHR_M=new THREE.MeshStandardMaterial({color:0xd8dde0,roughness:.18,metalness:1});
  PLASTIC_M=new THREE.MeshStandardMaterial({color:0x1a1a1c,roughness:.6,metalness:.05});
}
const mesh=(g,m,x,y,z,sh)=>{const o=new THREE.Mesh(g,m);o.position.set(x,y,z);if(sh!==false)o.castShadow=true;return o;};
function makeCar(c){
  matsInit();platesInit();
  const S=STY[c.type]||STY.sedan,L=c.len,W=c.wid,B=S.belt;
  const G=carGeos(c.type,L,W);
  const g=new THREE.Group(),tilt=new THREE.Group();g.add(tilt);
  const bodyM=new THREE.MeshPhysicalMaterial({color:c.col,metalness:.55,roughness:.32,clearcoat:1,clearcoatRoughness:.06,envMapIntensity:1.2});
  const roofM=new THREE.MeshPhysicalMaterial({color:c.roof,metalness:.55,roughness:.32,clearcoat:1,clearcoatRoughness:.06,envMapIntensity:1.2});
  const glassM=new THREE.MeshPhysicalMaterial({color:0x0a1218,metalness:.1,roughness:.04,transparent:true,opacity:.5,envMapIntensity:2,clearcoat:1});
  const body=new THREE.Mesh(G.body,bodyM);body.castShadow=true;body.receiveShadow=true;tilt.add(body);
  const cab=new THREE.Mesh(G.cabin,[glassM,roofM]);cab.castShadow=true;tilt.add(cab);
  const chromeM=S.chrome?CHR_M:bodyM;
  const hlM=new THREE.MeshStandardMaterial({color:0xfff4d0,emissive:0xffe8a0,emissiveIntensity:1.6,roughness:.1,metalness:.3});
  const tlM=new THREE.MeshStandardMaterial({color:0x8a1010,emissive:0xff1010,emissiveIntensity:.8,roughness:.3});
  const plM=[new THREE.MeshStandardMaterial({map:plateTex[c.id%4|0],roughness:.5}),new THREE.MeshStandardMaterial({map:plateTex[(c.id+1)%4|0],roughness:.5})];
  const x1=G.x1,x2=G.x2,t1=G.t1,t2=G.t2,top=G.top;
  // интерьер
  const seatM=new THREE.MeshStandardMaterial({color:S.cop?0x20242a:0x4a3a2c,roughness:.9});
  const zl=-W*.21,zr=W*.21;
  for(const z of [zl,zr]){
    tilt.add(mesh(new THREE.BoxGeometry(3.4,2.4,W*.36),seatM,(x1+x2)/2-1,B-2,z,false));
    const bk=mesh(new THREE.BoxGeometry(1.6,6,W*.34),seatM,(x1+x2)/2-3.6,B+1,z,false);bk.rotation.z=-.15;tilt.add(bk);
  }
  tilt.add(mesh(new THREE.BoxGeometry(3,2.4,W*.8),seatM,x1+3,B-2,0,false));
  tilt.add(mesh(new THREE.BoxGeometry(1.6,5.5,W*.8),seatM,x1+1.4,B+.8,0,false));
  tilt.add(mesh(new THREE.BoxGeometry(5,2.2,W-5),DARK_M,x2-5,B+.2,0,false));
  const wheel=new THREE.Mesh(new THREE.TorusGeometry(2.1,.28,8,18),DARK_M);wheel.position.set(x2-8.2,B+2,zl);wheel.rotation.y=Math.PI/2;wheel.rotation.x=.45;tilt.add(wheel);
  // водитель
  const drv=new THREE.Group();
  const dcol=S.cop?0x1a2f6a:0x5a4a3a;
  drv.add(mesh(new THREE.BoxGeometry(3,5.5,5.5),new THREE.MeshStandardMaterial({color:dcol,roughness:.9}),0,0,0,false));
  drv.add(mesh(new THREE.SphereGeometry(2.1,12,10),new THREE.MeshStandardMaterial({color:0xd9aa88,roughness:.7}),0,4.5,0,false));
  if(S.cop)drv.add(mesh(new THREE.CylinderGeometry(2.1,2.3,1.2,12),new THREE.MeshStandardMaterial({color:0x0b1740}),0,5.9,0,false));
  drv.position.set((x1+x2)/2-2.2,B+2.6,zl);tilt.add(drv);g.userData.drv=drv;
  // бампера (капсулы)
  for(const sx of [-1,1]){
    const bm=new THREE.Mesh(new THREE.CylinderGeometry(1.1,1.1,W-1.6,14),chromeM);bm.rotation.x=Math.PI/2;bm.position.set(sx*(L/2-.3),5.8,0);bm.castShadow=true;tilt.add(bm);
    for(const sz of [-1,1]){const cp=mesh(new THREE.SphereGeometry(1.1,10,8),chromeM,sx*(L/2-.3),5.8,sz*(W/2-.8));tilt.add(cp);}
    const pl=new THREE.Mesh(new THREE.PlaneGeometry(9,2.3),plM[sx>0?0:1]);pl.position.set(sx*(L/2+.1),7.4,0);pl.rotation.y=sx>0?Math.PI/2:-Math.PI/2;tilt.add(pl);
  }
  // фары: оправа + линза + отражатель
  const hy=B-2.3,zz=W/2-4.1,hx=L/2-.5;
  const mkHead=(sz)=>{
    if(S.lights==='wedge'){tilt.add(mesh(new THREE.BoxGeometry(2,1.8,5.8),hlM,hx,hy+.2,sz*(W/2-4),false));return;}
    const r=S.lights==='round'?2.2:2.5;
    const rim=new THREE.Mesh(new THREE.CylinderGeometry(r+.35,r+.35,1.2,20),CHR_M);rim.rotation.z=Math.PI/2;rim.position.set(hx,hy,sz*zz);tilt.add(rim);
    const lens=new THREE.Mesh(new THREE.SphereGeometry(r,16,10,0,Math.PI*2,0,Math.PI/2),hlM);lens.rotation.z=-Math.PI/2;lens.position.set(hx+.4,hy,sz*zz);tilt.add(lens);
    const ind=mesh(new THREE.BoxGeometry(1,1.2,2.4),new THREE.MeshStandardMaterial({color:0xe08a20,emissive:0x331a00}),hx-.1,hy-r-1.1,sz*zz,false);tilt.add(ind);
  };
  mkHead(-1);mkHead(1);
  // решётка
  const gm=S.lights;
  if(gm==='chaika'){
    tilt.add(mesh(new THREE.BoxGeometry(.8,4.6,W-10),DARK_M,L/2-.2,B-3.4,0,false));
    for(let i=0;i<9;i++)tilt.add(mesh(new THREE.BoxGeometry(1,4.4,.6),CHR_M,L/2+.2,B-3.4,-(W-13)/2+i*(W-13)/8,false));
    tilt.add(mesh(new THREE.BoxGeometry(1.2,.9,W-8),CHR_M,L/2+.1,B-.8,0,false),mesh(new THREE.BoxGeometry(1.2,.9,W-8),CHR_M,L/2+.1,B-6,0,false));
  }else if(gm==='volga'){
    tilt.add(mesh(new THREE.BoxGeometry(.7,4,W-12),DARK_M,L/2-.2,B-3.2,0,false));
    for(let i=0;i<4;i++)tilt.add(mesh(new THREE.BoxGeometry(.9,.55,W-12),CHR_M,L/2+.2,B-4.7+i*1.2,0,false));
  }else{
    tilt.add(mesh(new THREE.BoxGeometry(.6,3.2,W-12),DARK_M,L/2-.2,B-3.2,0,false));
    if(S.chrome)tilt.add(mesh(new THREE.BoxGeometry(.9,.6,W-11),CHR_M,L/2+.05,B-1.4,0,false));
    for(let i=0;i<5;i++)tilt.add(mesh(new THREE.BoxGeometry(.5,3,.25),CHR_M,L/2-.1,B-3.2,-(W-14)/2+i*(W-14)/4,false));
  }
  // задние фонари и выхлоп
  for(const sz of [-1,1]){
    tilt.add(mesh(new THREE.BoxGeometry(1,2.6,4.8),tlM,-L/2+.5,B-2.3,sz*(W/2-3),false));
    tilt.add(mesh(new THREE.BoxGeometry(.8,.8,1.6),new THREE.MeshStandardMaterial({color:0xf0e0c0,emissive:0x222222}),-L/2+.3,B-4.2,sz*(W/2-3),false));
  }
  const ex=new THREE.Mesh(new THREE.CylinderGeometry(.6,.6,3,10),CHR_M);ex.rotation.z=Math.PI/2;ex.position.set(-L/2-1,3.4,W/2-5);tilt.add(ex);
  // боковые зеркала и ручки, швы дверей
  for(const sz of [-1,1]){
    tilt.add(mesh(new THREE.BoxGeometry(1.4,2.2,2.6),bodyM,x2-4.5,B+1.4,sz*(W/2+.5),false));
    for(const dx of [x1+(x2-x1)*.15,x1+(x2-x1)*.65]){
      tilt.add(mesh(new THREE.BoxGeometry(.12,B-5.6,.2),DARK_M,dx,(B+4.8)/2-.2,sz*(W/2+.02),false));
      tilt.add(mesh(new THREE.BoxGeometry(2.2,.35,.4),CHR_M,dx+3.2,B-1.1,sz*(W/2+.15),false));
    }
  }
  // боковой хром, плавники
  if(S.strip)for(const sz of [-1,1])tilt.add(mesh(new THREE.BoxGeometry(L*.8,.6,.35),CHR_M,0,B-2.2,sz*(W/2+.05),false));
  if(S.fins)for(const sz of [-1,1]){
    const sh=new THREE.Shape();sh.moveTo(0,0);sh.lineTo(14,0);sh.lineTo(0,6);sh.closePath();
    const fg=new THREE.ExtrudeGeometry(sh,{depth:1.4,bevelEnabled:true,bevelSize:.3,bevelThickness:.3,bevelSegments:2});
    const f=new THREE.Mesh(fg,bodyM);f.position.set(-L/2+1,B-.6,sz*(W/2-3.2));tilt.add(f);
  }
  // колёса
  const wheels=[];
  for(const sx of [-.31,.31])for(const sz of [-1,1]){
    const wg=new THREE.Group();wg.position.set(L*sx,5.4,sz*(W/2-1.6));
    const sp=new THREE.Group();wg.add(sp);
    const tire=new THREE.Mesh(TIRE_G,TIRE_M);tire.rotation.x=Math.PI/2;tire.castShadow=true;sp.add(tire);
    const rim=new THREE.Mesh(RIM_G,CHR_M);rim.rotation.x=Math.PI/2;sp.add(rim);
    for(let b=0;b<5;b++){const a=b/5*Math.PI*2,bl=new THREE.Mesh(BOLT_G,DARK_M);bl.rotation.x=Math.PI/2;bl.position.set(Math.cos(a)*1.9,Math.sin(a)*1.9,sz*1.9);sp.add(bl);}
    const cap=mesh(new THREE.CylinderGeometry(1.1,1.1,.4,14),CHR_M,0,0,sz*2,false);cap.rotation.x=Math.PI/2;sp.add(cap);
    const disc=new THREE.Mesh(DISC_G,DARK_M);disc.rotation.x=Math.PI/2;disc.position.z=-sz*.8;sp.add(disc);
    wg.userData={sp,front:sx>0};g.add(wg);wheels.push(wg);
    const arch=new THREE.Mesh(ARCH_G,DARK_M);arch.position.set(L*sx,5.4,sz*(W/2+.12));if(sz<0)arch.rotation.y=Math.PI;tilt.add(arch);
  }
  g.userData={bodyM,roofM,glassM,chromeM:CHR_M,hlM,tlM,tilt,wheels,la:c.a,vl:0,roll:0,pit:0,dead:false};
  // подсветка тормозных
  const ry=top+.8;
  if(S.cop){
    for(const sz of [-1,1])tilt.add(mesh(new THREE.BoxGeometry(L*.8,2.6,.2),new THREE.MeshStandardMaterial({color:0x1f4aa8,roughness:.4}),0,B-3.4,sz*(W/2+.12),false));
    const m1=new THREE.MeshStandardMaterial({color:0xff2020,emissive:0xff0000,emissiveIntensity:2,transparent:true,opacity:.92}),m2=new THREE.MeshStandardMaterial({color:0x2050ff,emissive:0x1030ff,emissiveIntensity:2,transparent:true,opacity:.92});
    tilt.add(mesh(new THREE.BoxGeometry(3,2.2,W/2-3),DARK_M,(t1+t2)/2,ry+.8,0,false));
    tilt.add(mesh(new THREE.BoxGeometry(2.6,1.6,W/2-3.4),m1,(t1+t2)/2,ry+1.8,-W/4+.5,false),mesh(new THREE.BoxGeometry(2.6,1.6,W/2-3.4),m2,(t1+t2)/2,ry+1.8,W/4-.5,false));
    g.userData.m1=m1;g.userData.m2=m2;
  }
  if(S.taxi){
    for(const sz of [-1,1])for(let i=0;i<10;i++)tilt.add(mesh(new THREE.BoxGeometry(3.2,2.2,.3),new THREE.MeshStandardMaterial({color:i%2?0x111111:0xf4f4f4,roughness:.5}),-L*.34+i*3.4,B-2.2,sz*(W/2+.15),false));
    tilt.add(mesh(new THREE.BoxGeometry(6,2.6,3.6),new THREE.MeshStandardMaterial({color:0x3adf5a,emissive:0x1faa3a,emissiveIntensity:1.2}),(t1+t2)/2,ry+1.2,0,false));
  }
  return g;
}
function updCar(m,c){
  const u=m.userData,fa=Math.cos(c.a),fb=Math.sin(c.a);
  const vl=c.vx*fa+c.vy*fb;
  m.position.set(c.x,carY(c.x,c.y),c.y);m.rotation.y=-c.a;
  const da=angDiff(u.la,c.a);u.la=c.a;
  const acc=vl-u.vl;u.vl=vl;
  u.pit+=(clamp(-acc*.9,-.07,.07)-u.pit)*.15;
  u.roll+=(clamp(da*vl*.9,-.09,.09)-u.roll)*.12;
  u.tilt.rotation.z=u.pit;u.tilt.rotation.x=u.roll;
  const steer=clamp(da*Math.sign(vl||1)*9,-.5,.5);
  for(const w of u.wheels){
    w.userData.sp.rotation.z-=vl/5.4;
    if(w.userData.front)w.rotation.y=-steer;
  }
  if(c.dead&&!u.dead){
    u.dead=true;u.bodyM.color.set(0x1d1a17);u.roofM.color.set(0x14110f);u.bodyM.metalness=.2;u.bodyM.roughness=.8;u.bodyM.clearcoat=0;u.roofM.clearcoat=0;u.glassM.opacity=.9;
    u.hlM.emissiveIntensity=0;u.tlM.emissiveIntensity=0;if(u.m1){u.m1.emissiveIntensity=0;u.m2.emissiveIntensity=0;}
  }
  if(!c.dead){
    u.tlM.emissiveIntensity=(c.braking?2.2:.6);
    if(u.m1){const f=(Math.floor(c.flash/4)%2===0);u.m1.emissiveIntensity=f?3:.1;u.m2.emissiveIntensity=f?.1:3;}
  }
}
