'use strict';
// ===== Детальные люди: пешеходы, милиция, ОМОН, игрок (голова вращается свободно) =====
const fabTex=(()=>{const c=document.createElement('canvas');c.width=c.height=64;const g=c.getContext('2d');const im=g.createImageData(64,64);
  for(let i=0;i<4096;i++){const v=150+((i*7919)%97)/97*105|0;im.data[i*4]=im.data[i*4+1]=im.data[i*4+2]=v;im.data[i*4+3]=255;}
  g.putImageData(im,0,0);const t=new THREE.CanvasTexture(c);t.wrapS=t.wrapT=THREE.RepeatWrapping;t.repeat.set(6,6);return t;})();
const PM={};
const HI=!LITE;
const NT={n:8,c:.7},NL={n:8,c:.42},NH={n:8,c:.62}; // грани: торс/голова, конечности
// ===== Лофт: кольца-сечения снизу вверх, гладкое затенение, UV: u — по кругу (перед = 0.5), v — по высоте =====
function loftG(rings,N){
  let PTS=null;
  if(typeof N==='object'){const c=N.c;PTS=[[-1,-c],[-c,-1],[c,-1],[1,-c],[1,c],[c,1],[-c,1],[-1,c]];N=8;} // прямоугольник со срезанными углами
  const pos=[],uv=[],idx=[],y0=rings[0].y,y1=rings[rings.length-1].y,dy=(y1-y0)||1;
  rings.forEach(r=>{for(let k=0;k<=N;k++){let cx,cz;if(PTS){[cx,cz]=PTS[k%N];}else{const a=Math.PI+2*Math.PI*(k+.5)/N;cx=Math.cos(a);cz=Math.sin(a);}pos.push((r.ox||0)+cx*r.rx,r.y,(r.oz||0)+cz*r.rz);uv.push(k/N,(r.y-y0)/dy);}});
  for(let i=0;i<rings.length-1;i++)for(let k=0;k<N;k++){const a=i*(N+1)+k,b=a+1,c=a+N+1,d=c+1;idx.push(a,c,b,b,c,d);}
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));g.setIndex(idx);
  g.computeVertexNormals();
  const n=g.attributes.normal;for(let i=0;i<rings.length;i++){const p=i*(N+1),q=p+N;const x=(n.getX(p)+n.getX(q))/2,y=(n.getY(p)+n.getY(q))/2,z=(n.getZ(p)+n.getZ(q))/2;n.setXYZ(p,x,y,z);n.setXYZ(q,x,y,z);}
  return g;
}
const R=(y,rx,rz,ox,oz)=>({y,rx,rz:rz==null?rx:rz,ox:ox||0,oz:oz||0});
function lm(rings,N,mat,x,y,z){const m=new THREE.Mesh(loftG(rings,N),mat);m.position.set(x||0,y||0,z||0);m.castShadow=true;return m;}
function paintTex(w,h,fn){const c=document.createElement('canvas');c.width=w;c.height=h;const g=c.getContext('2d');fn(g,w,h);const t=new THREE.CanvasTexture(c);t.anisotropy=4;return t;}
const MS=(o)=>new THREE.MeshStandardMaterial(Object.assign({roughness:.8,metalness:0},o));
const sh=(h,k)=>{const c=new THREE.Color(h);c.multiplyScalar(k);return '#'+c.getHexString();};
function vgrad(g,w,h,top,bot){const gr=g.createLinearGradient(0,0,0,h);gr.addColorStop(0,top);gr.addColorStop(1,bot);g.fillStyle=gr;g.fillRect(0,0,w,h);}
function sideShade(g,w,h,a){const gr=g.createLinearGradient(0,0,w,0);gr.addColorStop(0,`rgba(0,0,0,${a})`);gr.addColorStop(.3,'rgba(0,0,0,0)');gr.addColorStop(.7,'rgba(0,0,0,0)');gr.addColorStop(1,`rgba(0,0,0,${a})`);g.fillStyle=gr;g.fillRect(0,0,w,h);}
function folds(g,w,h,col,n,y0,y1,len){g.strokeStyle=col;for(let i=0;i<n;i++){g.lineWidth=1+Math.random()*2.2;g.beginPath();const x=Math.random()*w,y=y0+Math.random()*(y1-y0);g.moveTo(x,y);g.quadraticCurveTo(x+rnd(-8,8),y+len*.5,x+rnd(-len,len)*.6,y+rnd(-4,4)+len*.3);g.stroke();}}
function blotch(g,w,h,col,n,r0,r1){for(let i=0;i<n;i++){const x=Math.random()*w,y=Math.random()*h,r=r0+Math.random()*(r1-r0);const gr=g.createRadialGradient(x,y,0,x,y,r);gr.addColorStop(0,col);gr.addColorStop(1,'rgba(0,0,0,0)');g.fillStyle=gr;g.fillRect(x-r,y-r,r*2,r*2);}}
// ---- текстуры одежды (рисованный свет и складки) ----
function torsoMat(sp){
  const key='T'+sp.coat+sp.coatKind+sp.inner+sp.kind;if(PM[key])return PM[key];
  const c=sp.coat,leather=sp.coatKind==='leather';
  const t=paintTex(256,256,(g,w,h)=>{
    vgrad(g,w,h,sh(c,1.35),sh(c,.75));
    if(leather){blotch(g,w,h,'rgba(150,155,170,.14)',50,6,18);blotch(g,w,h,'rgba(0,0,0,.45)',30,6,18);}
    else blotch(g,w,h,sh(c,1.25)+'55',30,10,26);
    folds(g,w,h,'rgba(0,0,0,.45)',leather?26:16,h*.45,h*.85,30);
    folds(g,w,h,'rgba(255,255,255,.05)',10,h*.2,h*.7,24);
    sideShade(g,w,h,.45);
    g.fillStyle=sh(c,.55);g.fillRect(0,0,3,h);g.fillRect(w*.25-1,0,2,h);g.fillRect(w*.75-1,0,2,h); // швы
    // V-вырез и лацканы
    g.fillStyle='#'+new THREE.Color(sp.inner||0x0c0c0e).getHexString();
    g.beginPath();g.moveTo(w*.44,0);g.lineTo(w*.56,0);g.lineTo(w*.5,h*.38);g.closePath();g.fill();
    g.strokeStyle=leather?'rgba(170,175,190,.28)':sh(c,1.4);g.lineWidth=2;
    g.beginPath();g.moveTo(w*.42,0);g.lineTo(w*.5,h*.4);g.lineTo(w*.58,0);g.stroke();
    g.strokeStyle='rgba(0,0,0,.7)';g.lineWidth=2;g.beginPath();g.moveTo(w*.5,h*.38);g.lineTo(w*.5,h);g.stroke();
    if(!leather){g.fillStyle=sh(c,.45);for(let i=0;i<4;i++){g.beginPath();g.arc(w*.515,h*(.45+i*.13),3,0,7);g.fill();}}
    // клапаны карманов
    for(const u of [.37,.63]){g.fillStyle=sh(c,.6);g.fillRect(w*u-16,h*.74,32,12);g.fillStyle=leather?'rgba(170,175,190,.35)':sh(c,1.5);g.fillRect(w*u-16,h*.74,32,2);}
    if(sp.kind==='cop'){g.fillStyle='#8a1a1a';for(const u of [.25,.75])g.fillRect(w*u-10,2,20,10);g.fillStyle='#d8c030';g.fillRect(w*.36-4,h*.3,8,10);}
    if(sp.kind==='omon'){g.fillStyle='#d8d8d0';g.font='bold 22px Arial';g.textAlign='center';g.fillText('ОМОН',w*1.0-w*0.0,h*.4);g.fillText('ОМОН',0,h*.4);}
  });
  return PM[key]=MS({map:t,roughness:leather?.42:.9,metalness:leather?.08:0,envMapIntensity:leather?.6:.2});
}
function sleeveMat(sp){
  const key='S'+sp.coat+sp.coatKind;if(PM[key])return PM[key];
  const c=sp.coat,leather=sp.coatKind==='leather';
  const t=paintTex(128,128,(g,w,h)=>{
    vgrad(g,w,h,sh(c,1.3),sh(c,.8));
    if(leather)blotch(g,w,h,'rgba(150,155,170,.3)',30,4,12);
    folds(g,w,h,'rgba(0,0,0,.5)',12,h*.35,h*.65,14);sideShade(g,w,h,.4);
    g.fillStyle=sh(c,.5);g.fillRect(0,h*.9,w,h*.1);g.fillRect(0,0,2,h);
  });
  return PM[key]=MS({map:t,roughness:leather?.42:.9,envMapIntensity:leather?.6:.2,side:THREE.DoubleSide});
}
function pantsMat(col){
  const key='P'+col;if(PM[key])return PM[key];
  const c='#'+new THREE.Color(col).getHexString();
  const t=paintTex(128,128,(g,w,h)=>{
    vgrad(g,w,h,sh(c,.95),sh(c,.65));blotch(g,w,h,sh(c,1.3)+'44',16,8,20);
    folds(g,w,h,'rgba(0,0,0,.45)',14,h*.55,h*.95,12);sideShade(g,w,h,.4);
    g.strokeStyle=sh(c,1.45);g.lineWidth=2;g.beginPath();g.moveTo(w*.5,0);g.lineTo(w*.5,h);g.stroke(); // стрелка
    g.fillStyle=sh(c,.55);g.fillRect(0,h*.94,w,h*.06);
  });
  return PM[key]=MS({map:t,roughness:.9});
}
function headMat(sp){
  const key='H'+sp.skin+sp.hair+sp.hairStyle+(sp.stub?1:0);if(PM[key])return PM[key];
  const sk=sp.skin,hc=sp.hair;
  const t=paintTex(256,256,(g,w,h)=>{
    g.fillStyle=sk;g.fillRect(0,0,w,h);
    blotch(g,w,h,sh(sk,.8)+'55',14,10,30);
    // тени: скулы, под подбородком, бока
    sideShade(g,w,h,.35);
    const jaw=g.createLinearGradient(0,h*.72,0,h);jaw.addColorStop(0,'rgba(0,0,0,0)');jaw.addColorStop(1,'rgba(60,30,20,.45)');g.fillStyle=jaw;g.fillRect(0,h*.72,w,h*.28);
    if(sp.stub){g.fillStyle='rgba(40,28,22,.28)';g.beginPath();g.ellipse(w*.5,h*.8,30,18,0,0,7);g.fill();}
    const cx=w*.5;
    // брови, глаза, нос, рот
    g.fillStyle=sh(hc,.9);g.fillRect(cx-26,h*.40,18,4);g.fillRect(cx+8,h*.40,18,4);
    g.fillStyle='#ece6dc';g.fillRect(cx-24,h*.445,14,6);g.fillRect(cx+10,h*.445,14,6);
    g.fillStyle=pick(['#3a4a5a','#3a2a1a','#2a4a3a']);g.fillRect(cx-19,h*.445,6,6);g.fillRect(cx+15,h*.445,6,6);
    g.fillStyle='rgba(0,0,0,.55)';g.fillRect(cx-25,h*.44,16,2);g.fillRect(cx+9,h*.44,16,2);
    g.fillStyle=sh(sk,.7);g.fillRect(cx-3,h*.47,6,h*.12);g.fillRect(cx-7,h*.585,14,3);
    g.fillStyle=sh(sk,.55);g.fillRect(cx-11,h*.68,22,3);g.fillStyle=sh(sk,1.15);g.fillRect(cx-9,h*.70,18,2);
    // волосы: сверху и на затылке
    g.fillStyle=hc;
    if(sp.hairStyle!=='bald'){
      g.beginPath();g.moveTo(0,0);g.lineTo(w,0);g.lineTo(w,h*.62);
      g.bezierCurveTo(w*.78,h*.58,w*.7,h*.3,w*.6,h*.22);g.lineTo(w*.4,h*.22);
      g.bezierCurveTo(w*.3,h*.3,w*.22,h*.58,0,h*.62);g.closePath();g.fill();
      g.strokeStyle=sh(hc,1.8);g.globalAlpha=.35;for(let i=0;i<40;i++){g.lineWidth=1;g.beginPath();const x=Math.random()*w;g.moveTo(x,h*.22);g.lineTo(x+rnd(-10,10),0);g.stroke();}g.globalAlpha=1;
    }
  });
  return PM[key]=MS({map:t,roughness:.7});
}
const plainM=(c,r,m)=>{const k='p'+c+'_'+r+'_'+m;return PM[k]||(PM[k]=MS({color:c,roughness:r==null?.85:r,metalness:m||0}));};
function shoeMat(col){const key='Sh'+col;if(PM[key])return PM[key];const c='#'+new THREE.Color(col).getHexString();
  const t=paintTex(64,64,(g,w,h)=>{vgrad(g,w,h,sh(c,1.2),sh(c,.6));blotch(g,w,h,'rgba(255,255,255,.08)',6,4,10);g.fillStyle='rgba(0,0,0,.4)';g.fillRect(w*.55,0,w*.3,h*.5);});
  return PM[key]=MS({map:t,roughness:.35,metalness:.1});}
// ---- сборка человека ----
function makeHuman(sp){
  const root=new THREE.Group(),g=new THREE.Group();root.add(g);
  const TM=torsoMat(sp),SM=sleeveMat(sp),PMt=pantsMat(sp.pants),HM=headMat(sp),SK=plainM(new THREE.Color(sp.skin),.7);
  const SH=shoeMat(sp.shoe||0x0b0b0c),SOLE=plainM(sp.sole||0x3a3a3c,.8);
  // таз и ноги
  g.add(lm([R(7.6,1.55,2.55),R(8.6,1.8,2.8),R(9.4,1.82,2.82)],NT,PMt));
  const legs=[];
  for(const z of [-1.35,1.35]){
    const hip=new THREE.Group();hip.position.set(0,8.9,z);
    hip.add(lm([R(-4.0,1.05,1.1),R(-3.0,1.15,1.2),R(-1.5,1.35,1.4),R(0,1.65,1.7),R(.5,1.3,1.3)],NL,PMt));
    const kn=new THREE.Group();kn.position.set(0,-4.0,0);hip.add(kn);
    kn.add(lm([R(-3.95,.6,.6),R(-3.9,1.45,1.5),R(-3.0,1.3,1.35),R(-1.5,1.15,1.2),R(0,1.2,1.25)],NL,PMt));
    // ботинок: лофт вдоль оси, повёрнут носком вперёд
    const sg=loftG([R(-1.3,.05,.6,-.2),R(-1.2,.9,.95,-.45),R(-.2,1.25,1.05,-.62),R(1.1,1.05,1.05,-.52),R(2.2,.75,.95,-.38),R(2.9,.45,.75,-.25),R(3.05,.05,.3,-.2)],NL);
    sg.scale(.82,.85,.8);sg.rotateZ(-Math.PI/2);const shoe=new THREE.Mesh(sg,SH);shoe.position.set(.2,-4.85,0);shoe.castShadow=true;kn.add(shoe);
    const so=loftG([R(-1.35,.05,.7,-.05),R(-1.25,.14,1.0,-.1),R(2.9,.14,.85,-.1),R(3.1,.05,.4,-.05)],NL);so.scale(.82,1,.8);so.rotateZ(-Math.PI/2);
    const sole=new THREE.Mesh(so,SOLE);sole.position.set(.2,-4.95,0);kn.add(sole);
    g.add(hip);legs.push({hip,kn});
  }
  // торс: грудь, покатые плечи
  const bot=sp.len===0?8.9:8.3;
  g.add(lm([R(bot,1.95,2.95),R(9.3,1.9,2.88),R(10.3,1.82,2.78),R(11.8,2.0,2.95,.12),R(13.3,2.2,3.1,.22),R(14.7,2.2,3.45,.15),R(15.6,2.0,3.75),R(16.3,1.55,3.1),R(16.9,1.0,1.7),R(17.2,.75,.85)],NT,TM));
  if(sp.len===0)g.add(lm([R(8.7,1.98,2.98),R(9.3,1.98,2.98)],NT,plainM(new THREE.Color(sh(sp.coat,.5)),.6)));
  // полы пальто
  let skirt=null;
  if(sp.len>=1){
    const L=sp.len===2?5.6:3.0;
    skirt=new THREE.Group();skirt.position.set(0,9.6,0);g.add(skirt);
    const SKM=PM['K'+sp.coat+sp.coatKind]||(PM['K'+sp.coat+sp.coatKind]=Object.assign(TM.clone(),{side:THREE.DoubleSide}));
    skirt.add(lm([R(-L,2.75,3.6,.05),R(-L*.5,2.35,3.3,.05),R(0,2.0,3.0,.05)],NT,SKM));
  }
  // воротник
  if(sp.collar!==false)g.add(lm([R(16.5,1.25,1.75,-.15),R(17.1,1.15,1.55,-.2),R(17.7,1.05,1.4,-.3)],NT,SM));
  if(sp.belt)g.add(lm([R(9.9,1.9,2.88),R(10.5,1.88,2.86)],NT,plainM(0x151515,.4)));
  if(sp.belt){const bk=new THREE.Mesh(new THREE.BoxGeometry(.3,.6,.9),plainM(0xb8a040,.3,.8));bk.position.set(1.95,10.2,0);g.add(bk);}
  if(sp.belt&&sp.gun){g.add(lm([R(-1,.4,.55),R(0,.5,.65),R(.6,.5,.65)],6,plainM(0x111111,.5),.2,10,3.05));}
  if(sp.vest)g.add(lm([R(10.4,2.15,3.05),R(13.2,2.5,3.35,.2),R(15.3,2.25,3.55),R(15.9,1.7,3.0)],NT,plainM(0x141614,.85)));
  if(sp.scarf)g.add(lm([R(16.1,1.3,1.7),R(16.7,1.25,1.6),R(17.2,1.0,1.2)],NT,plainM(new THREE.Color(sp.scarf),.95)));
  if(sp.bag){const b=lm([R(10.5,.8,1.8),R(12.2,1.0,2.0),R(14.6,.9,1.9),R(14.9,.4,1.2)],6,plainM(0x3a3f2a,.9),-2.4,0,0);g.add(b);}
  // руки
  const arms=[];
  for(const z of [-3.35,3.35]){
    const s=new THREE.Group();s.position.set(0,15.55,z);s.rotation.x=-Math.sign(z)*.05;
    s.add(lm([R(-3.9,.95,.95),R(-2.2,1.08,1.05),R(-.6,1.25,1.2),R(.2,1.3,1.3),R(.7,.6,.8)],NL,SM));
    const el=new THREE.Group();el.position.set(0,-3.8,0);s.add(el);
    el.add(lm([R(-3.6,.58,.62),R(-3.55,.82,.86),R(-3.0,.8,.84),R(-1.5,.82,.85),R(0,.88,.88),R(.3,.6,.6)],NL,SM));
    const hand=new THREE.Group();hand.position.set(0,-3.65,0);hand.scale.setScalar(1.3);el.add(hand);
    const HMt=sp.glove?plainM(0x15151a,.6):SK;
    hand.add(lm([R(-1.95,.05,.05,.05),R(-1.7,.42,.6,.05),R(-1.1,.6,.78,.05),R(-.4,.58,.72),R(0,.45,.55),R(.1,.3,.4)],NL,HMt));
    const th=lm([R(-1.0,.05,.05),R(-.9,.22,.22),R(-.3,.28,.28),R(0,.2,.2)],6,HMt,.45,-.3,z>0?-.45:.45);th.rotation.z=.5;hand.add(th);
    g.add(s);arms.push({sh:s,el,hand});
  }
  // шея и голова
  g.add(lm([R(16.4,.72,.75,-.1),R(17.4,.7,.72,-.1),R(17.9,.75,.78,-.05)],NL,SK));
  const head=new THREE.Group();head.position.set(0,17.35,0);g.add(head);
  head.add(lm([R(-.3,.4,.5,.45),R(0,1.0,1.0,.3),R(.7,1.4,1.32,.1),R(1.4,1.6,1.52,0),R(2.2,1.7,1.58,-.05),R(3.0,1.65,1.52,-.1),R(3.55,1.32,1.22,-.15),R(3.95,.7,.65,-.15),R(4.1,.05,.05,-.15)],NH,HM));
  const nose=new THREE.Mesh(new THREE.ConeGeometry(.32,.8,4),SK);nose.rotation.z=-Math.PI/2;nose.rotation.x=Math.PI/4;nose.position.set(1.75,1.75,0);head.add(nose);
  for(const z of [-1,1]){const ear=lm([R(-.4,.05,.05),R(-.3,.35,.12),R(.35,.38,.14),R(.5,.05,.05)],6,SK,-.15,2.0,z*1.55);head.add(ear);}
  const HC=plainM(new THREE.Color(sp.hatCol||0x3a3a3a),.9),HR=plainM(new THREE.Color(sp.hair),.5);
  const hat=sp.hat||'none';
  if(hat==='none'&&sp.hairStyle!=='bald'){
    const cap=new THREE.Group();cap.position.set(-.1,2.6,0);cap.rotation.z=sp.hairStyle==='slick'?.32:.22;head.add(cap);
    cap.add(lm([R(0,1.82,1.7,-.25),R(.6,1.86,1.72,-.15),R(1.2,1.6,1.5,-.15),R(1.65,1.0,.95,-.2),R(1.85,.05,.05,-.25)],NT,HR));
    if(sp.hairStyle==='slick'){cap.add(lm([R(.9,.5,1.1,1.25),R(1.3,.45,1.0,1.05),R(1.5,.05,.4,.9)],6,HR));}
  }else if(hat==='ushanka'){
    head.add(lm([R(2.6,2.0,1.9,-.1),R(3.4,1.98,1.88,-.1),R(4.1,1.55,1.45,-.15),R(4.55,.8,.75,-.15),R(4.65,.05,.05,-.15)],NT,HC));
    head.add(lm([R(3.0,.3,1.95,1.85),R(3.7,.35,1.85,1.75),R(3.9,.05,1.6,1.6)],6,HC));
    for(const z of [-1,1])head.add(lm([R(.9,.7,.25),R(1.6,.85,.3),R(3.0,.9,.32)],6,HC,-.2,0,z*1.85));
  }else if(hat==='copcap'){
    head.add(lm([R(3.3,1.78,1.68,-.05),R(4.3,1.85,1.75,-.05),R(4.55,2.25,2.15,.15),R(4.8,2.2,2.1,.2),R(4.9,.05,.05,.2)],NT,HC));
    head.add(lm([R(3.65,1.82,1.72,-.05),R(3.95,1.82,1.72,-.05)],NT,plainM(0xb02020,.6)));
    const vis=new THREE.Mesh(new THREE.CylinderGeometry(1.5,1.5,.12,10,1,false,0,Math.PI),plainM(0x0b0b0b,.25));vis.rotation.y=Math.PI/2;vis.position.set(1.0,3.35,0);vis.scale.set(1,1,.7);head.add(vis);
    const kok=new THREE.Mesh(new THREE.OctahedronGeometry(.35,0),plainM(0xd8c030,.3,.8));kok.position.set(1.9,4.05,0);head.add(kok);
  }else if(hat==='helmet'){
    head.add(lm([R(1.6,2.05,1.95,-.1),R(2.8,2.1,2.0,-.1),R(3.8,1.85,1.75,-.1),R(4.5,1.2,1.15,-.1),R(4.75,.05,.05,-.1)],NT,HC));
    const v=new THREE.Mesh(new THREE.CylinderGeometry(1.9,1.9,1.3,10,1,true,-Math.PI*.35,Math.PI*.7),plainM(0x1a2a30,.12,.3));v.position.set(0,2.3,0);v.rotation.y=-Math.PI/2;head.add(v);
    head.add(lm([R(-.35,.5,.6,.4),R(.4,1.5,1.45,.15),R(1.7,1.72,1.6)],NT,plainM(0x0a0b0a,.95)));
  }
  // оружие
  const wep={};
  if(sp.gun){
    const mk=(w,h,d,col,x,y,z)=>{const m=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),MS({color:col,roughness:.4,metalness:.5}));m.position.set(x,y,z);return m;};
    const w0=new THREE.Group();w0.add(mk(3.2,.9,.7,0x1a1a1a,1.6,-.9,0),mk(.9,1.8,.7,0x222222,.3,-1.4,0));
    const w1=new THREE.Group();w1.add(mk(5.5,1.2,.8,0x181818,2.4,-.9,0),mk(.8,2.4,.7,0x111111,2.2,-2.3,0),mk(1,1.8,.7,0x222222,0,-1.4,0),mk(2.2,.5,.5,0x111111,5.2,-.7,0));
    const w2=new THREE.Group();const tb=new THREE.Mesh(new THREE.CylinderGeometry(.8,.8,7,10),MS({color:0x5a6a4a,roughness:.5}));tb.rotation.z=Math.PI/2;tb.position.set(2,-.2,0);w2.add(tb,mk(.9,1.6,.7,0x222222,1,-1.3,0));
    for(const [k,w] of [[0,w0],[1,w1],[2,w2]]){w.visible=false;arms[1].hand.add(w);wep[k]=w;}
    wep[sp.gun===2?1:0].visible=true;
  }
  if(sp.shield){const s=new THREE.Mesh(new THREE.BoxGeometry(.5,9,5.5),MS({color:0x20303a,transparent:true,opacity:.55,roughness:.1,metalness:.3}));s.position.set(3.3,9.5,-1.2);g.add(s);}
  root.scale.set(sp.w||1,sp.h||1,sp.w||1);
  root.userData={legs,arms,head,wep,kind:sp.kind,g,skirt,ph:rnd(0,6),cs:0,hy:0,hp:0,aim:0,omon:!!sp.shield};
  return root;
}
const CIV_COATS=['#2e3a4a','#4a2e2a','#3a4a3a','#5a5048','#2a2a30','#6a3a2a','#44485a','#5a4a2a','#7a6a4a','#3a3020'];
const SKINS=['#c48a64','#a8704c','#e0b08c','#8a5a3c','#d8a078'];
const HAIRS=['#2a1c12','#5a4630','#8a8a8a','#b8a070','#141010','#3a2a1a'];
function makePed(p){
  let sp;
  if(p.kind==='cop'&&p.omon)sp={kind:'omon',coat:'#24281f',coatKind:'cloth',len:0,pants:0x20231e,skin:pick(SKINS),hair:'#222222',hat:'helmet',hatCol:0x121412,belt:1,vest:1,glove:1,gun:2,shield:Math.random()<.4,shoe:0x0b0b0b,inner:0x141414,w:1.05};
  else if(p.kind==='cop')sp={kind:'cop',coat:'#3a4560',coatKind:'cloth',len:1,pants:0x1c2438,skin:pick(SKINS),hair:pick(HAIRS),hat:'copcap',hatCol:0x22304e,belt:1,gun:1,shoe:0x0b0b0b,inner:0xa8a898,stub:Math.random()<.4};
  else{const f=Math.random()<.4;sp={kind:'civ',coat:pick(CIV_COATS),coatKind:'cloth',len:f?pick([1,2]):pick([0,1,2]),pants:f?pick([0x3a3030,0x2a2a32,0x4a4036]):pick([0x2a2e3a,0x3a3a3e,0x4a4036,0x25303f,0x30384a]),skin:pick(SKINS),hair:pick(HAIRS),hairStyle:pick(['short','short','slick','bald']),hat:Math.random()<.45?'ushanka':'none',hatCol:pick([0x5a4838,0x7a746a,0x3a3a3a,0x2a2a2a]),scarf:Math.random()<.35?pick(['#a0302a','#2e4a8a','#cfcfc0','#5a6a3a']):null,bag:Math.random()<.25,shoe:pick([0x1a1512,0x0b0b0c,0x3a2414]),inner:pick([0x1a1a1e,0x6a6a60,0x3a2a2a]),stub:!f&&Math.random()<.4,h:rnd(.94,1.06),w:rnd(.92,1.12)};
    if(f){sp.hairStyle='short';sp.hair=pick(['#5a3a20','#2a1c12','#b8a070','#8a3a20']);sp.scarf=sp.scarf||pick(['#a0302a','#7a2a5a','#cfcfc0']);}}
  return makeHuman(sp);
}
function updPed(m,p,L){
  const u=m.userData;
  const d=Math.hypot(p.x-cam3.position.x,p.y-cam3.position.z);
  m.visible=d<950;if(!m.visible)return;
  m.position.set(p.x,carY(p.x,p.y),p.y);m.rotation.y=-p.a;
  const sp=p.moving===undefined?(p.step!==u.lastStep?1:0):(p.moving?1:0);
  const run=p.fast?1.35:1;
  u.cs+=((sp?1:0)-u.cs)*.2;
  u.lastStep=p.step;
  const s=Math.sin(p.step*1.5+u.ph)*.85*u.cs*run;
  u.legs[0].hip.rotation.z=s;u.legs[1].hip.rotation.z=-s;
  u.legs[0].kn.rotation.z=-Math.max(0,-s)*1.0;u.legs[1].kn.rotation.z=-Math.max(0,s)*1.0;
  const aim=p.aim||0;u.aim+=(aim-u.aim)*.3;
  u.arms[0].sh.rotation.z=u.kind==='omon'?.7:-s*.8*(1-u.aim*.0);u.arms[0].el.rotation.z=u.kind==='omon'?-1.1:-.15-Math.abs(s)*.4;
  const ra=u.arms[1];
  ra.sh.rotation.z=s*.8*(1-u.aim)+u.aim*1.45;ra.el.rotation.z=-.15*(1-u.aim)-Math.abs(s)*.4*(1-u.aim);
  if(u.skirt){u.skirt.rotation.z=-s*.3;}
  u.g.position.y=Math.abs(Math.sin(p.step*1.5+u.ph))*.35*u.cs;
  u.g.rotation.z=u.cs*.05*run;
  // голова: yaw относительно тела, pitch вверх/вниз
  if(p.head){u.hy+=(p.head.yaw-u.hy)*.35;u.hp+=(p.head.pitch-u.hp)*.35;}
  else{u.hy*=.9;u.hp*=.9;}
  u.head.rotation.y=-u.hy;u.head.rotation.z=u.hp;
  if(p.w!==undefined&&u.wep){for(const k in u.wep)u.wep[k].visible=(+k===p.w);}
}



const playerMesh=makeHuman({kind:'pl',coat:'#141418',coatKind:'leather',len:2,pants:0x0e0e12,skin:'#c48a64',hair:'#1a100c',hairStyle:'slick',hat:'none',inner:0x0c0c0e,gun:1,shoe:0x0b0b0c,stub:true,h:1.02,w:1.04});
scene.add(playerMesh);
