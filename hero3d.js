'use strict';
// ===== Герой: детальная модель в реальных пропорциях (1 ед ≈ 8 см, рост ≈ 22.5) =====
// Всё строится параметрическими поверхностями grid(): голова с лицевым рельефом, пиджак с лацканами,
// рубашка с воротником, цепочка со звеньями, кисти с пальцами, туфли со шнуровкой.
// Рига совместима с updPed(): legs[{hip,kn}], arms[{sh,el,hand}], head.
const TAU=Math.PI*2,gs=(x,m,s)=>Math.exp(-(x-m)*(x-m)/(2*s*s)),lerpf=(a,b,t)=>a+(b-a)*t;
const HRES=!LITE;
function cTex(w,h,fn,rx,ry){const c=document.createElement('canvas');c.width=w;c.height=h;const g=c.getContext('2d');fn(g,w,h);const t=new THREE.CanvasTexture(c);t.anisotropy=4;t.wrapS=t.wrapT=THREE.RepeatWrapping;if(rx)t.repeat.set(rx,ry||rx);return t;}
// Catmull-Rom по таблице [ключ, v1, v2, ...] → массив значений
function spl(tab,y){
  const n=tab.length;if(y<=tab[0][0])return tab[0].slice(1);if(y>=tab[n-1][0])return tab[n-1].slice(1);
  let k=0;while(k<n-2&&y>tab[k+1][0])k++;
  const t=(y-tab[k][0])/(tab[k+1][0]-tab[k][0]),t2=t*t,t3=t2*t;
  const p0=tab[Math.max(k-1,0)],p1=tab[k],p2=tab[k+1],p3=tab[Math.min(k+2,n-1)];
  return p1.slice(1).map((_,i0)=>{const i=i0+1;return .5*(2*p1[i]+(-p0[i]+p2[i])*t+(2*p0[i]-5*p1[i]+4*p2[i]-p3[i])*t2+(-p0[i]+3*p1[i]-3*p2[i]+p3[i])*t3);});
}
const sp2=(v,e)=>Math.sign(v)*Math.pow(Math.abs(v),2/e);
const se=(phi,rx,rz,e,ox)=>[(ox||0)+sp2(Math.cos(phi),e)*rx,sp2(Math.sin(phi),e)*rz]; // суперэллипс: e>2 — квадратнее
// Сетка по функции P(u,v)→[x,y,z,tu,tv]; wrap — склейка нормалей шва; orient — центр, от которого нормали смотрят наружу
function grid(nu,nv,P,opt){
  opt=opt||{};const pos=[],uv=[],idx=[];
  for(let j=0;j<=nv;j++)for(let i=0;i<=nu;i++){const p=P(i/nu,j/nv);pos.push(p[0],p[1],p[2]);uv.push(p[3],p[4]);}
  for(let j=0;j<nv;j++)for(let i=0;i<nu;i++){const a=j*(nu+1)+i,b=a+1,c=a+nu+1,d=c+1;idx.push(a,c,b,b,c,d);}
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));g.setIndex(idx);g.computeVertexNormals();
  if(opt.orient){const c=opt.orient,p=g.attributes.position,n=g.attributes.normal;let s=0;for(let i=0;i<p.count;i++)s+=(p.getX(i)-c[0])*n.getX(i)+(p.getY(i)-c[1])*n.getY(i)+(p.getZ(i)-c[2])*n.getZ(i);
    if(s<0){const ix=g.index.array;for(let i=0;i<ix.length;i+=3){const t=ix[i+1];ix[i+1]=ix[i+2];ix[i+2]=t;}g.computeVertexNormals();}}
  if(opt.wrap){const n=g.attributes.normal;for(let j=0;j<=nv;j++){const a=j*(nu+1),b=a+nu;const x=n.getX(a)+n.getX(b),y=n.getY(a)+n.getY(b),z=n.getZ(a)+n.getZ(b),l=Math.hypot(x,y,z)||1;n.setXYZ(a,x/l,y/l,z/l);n.setXYZ(b,x/l,y/l,z/l);}}
  return g;
}
function mergeG(list){
  const pos=[],nor=[],uv=[],idx=[];let off=0;
  for(const g of list){const p=g.attributes.position,n=g.attributes.normal,u=g.attributes.uv;
    for(let i=0;i<p.count;i++){pos.push(p.getX(i),p.getY(i),p.getZ(i));nor.push(n.getX(i),n.getY(i),n.getZ(i));uv.push(u?u.getX(i):0,u?u.getY(i):0);}
    for(const k of g.index.array)idx.push(k+off);off+=p.count;}
  const m=new THREE.BufferGeometry();m.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));m.setAttribute('normal',new THREE.Float32BufferAttribute(nor,3));m.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));m.setIndex(idx);return m;
}
const hmesh=(g,m,x,y,z)=>{const o=new THREE.Mesh(g,m);o.position.set(x||0,y||0,z||0);o.castShadow=true;return o;};

// ---------- ГОЛОВА: профиль + лицевой рельеф ----------
const HH=2.95; // высота головы (подбородок → макушка)
const HTAB=[ // y, перёд, затылок, полуширина, квадратность
  [0,.30,.30,.22,2],[.10,.80,.55,.50,2.2],[.30,1.02,.70,.72,2.3],[.60,1.06,.90,.86,2.4],[.95,1.10,1.02,.93,2.4],
  [1.30,1.10,1.12,.97,2.4],[1.65,1.08,1.18,.98,2.4],[2.0,1.04,1.22,.97,2.3],[2.35,.95,1.22,.92,2.2],
  [2.65,.74,1.10,.78,2.1],[2.85,.42,.75,.48,2],[2.95,.02,.02,.02,2]];
const NOSE=[[.80,0],[.90,.10],[.97,.26],[1.05,.31],[1.2,.26],[1.4,.17],[1.6,.09],[1.8,.03],[1.95,0]];
function headPt(phi,y){
  const t=spl(HTAB,y),F=t[0],B=t[1],W=t[2]*(1.08+.06*gs(y,.6,.4)),e=t[3],rx=(F+B)/2,cx=(F-B)/2;
  const q=se(phi,rx,W,e,cx),a=Math.abs(phi);
  let D=0;
  D+=.10*gs(y,1.86,.13)*gs(a,0,.55);                         // надбровные дуги
  D-=.12*gs(y,1.60,.11)*gs(a,.42,.17);                       // глазницы
  D+=.05*gs(y,2.08,.28)*gs(a,0,.6);                          // лоб
  const np=spl(NOSE,y)[0];D+=np*gs(a,0,.075+.035*Math.min(1,Math.max(0,(1.7-y)/.7))); // спинка и кончик носа
  D+=.06*gs(y,1.03,.07)*gs(a,.19,.05);                       // крылья носа
  D-=.06*gs(y,.86,.06)*gs(a,0,.10);                          // под носом
  D+=.07*gs(y,.72,.06)*gs(a,0,.20);                          // верхняя губа
  D+=.08*gs(y,.56,.07)*gs(a,0,.22);                          // нижняя губа
  D-=.07*gs(y,.645,.022)*gs(a,0,.26);                        // линия рта
  D-=.05*gs(y,.40,.05)*gs(a,0,.25);                          // подгубная складка
  D+=.14*gs(y,.22,.14)*gs(a,0,.30);                          // подбородок
  D+=.10*gs(y,1.35,.16)*gs(a,.75,.30);                       // скулы
  D-=.06*gs(y,.85,.20)*gs(a,1.2,.30);                        // щёки/линия челюсти
  const l=Math.hypot(q[0]-cx,q[1])||1;
  return [q[0]+(q[0]-cx)/l*D,y,q[1]+q[1]/l*D,cx];
}
function headGeo(){return grid(HRES?64:36,HRES?110:44,(u,v)=>{const p=headPt((u-.5)*TAU,v*HH);return [p[0],p[1],p[2],u,v];},{wrap:true,orient:[0,1.5,0]});}
// волосы: оболочка над линией роста, объём на макушке/спереди
const HL=[[0,2.48],[.3,2.56],[.65,2.42],[.95,2.12],[1.25,1.98],[1.5,1.95],[1.85,1.8],[2.3,1.45],[3.1416,1.2]];
function hairGeo(){
  return grid(HRES?56:36,HRES?22:14,(u,s)=>{
    const phi=(u-.5)*TAU,a=Math.abs(phi),h0=spl(HL,a)[0],y=lerpf(h0,HH-.03,s),p=headPt(phi,y);
    const side=1-.65*Math.min(1,Math.max(0,(a-.9)/.6)),th=(.045+.12*Math.sin(Math.min(1,s*1.4)*Math.PI*.5))*(1+.9*gs(a,0,.9)*s)*side;
    const c=Math.cos(phi),sn=Math.sin(phi);
    return [p[0]+c*th*(1-.3*s)-.1*s*s,y+th*s*.9+.1*gs(a,0,.7)*s*s,p[2]+sn*th*(1-.3*s),u,s];
  },{wrap:true,orient:[0,1.5,0]});
}
// ---------- текстуры ----------
function skinFaceTex(skin){
  const W=HRES?1024:512,H=W/2,px=(phi)=>(phi/TAU+.5)*W,py=(y)=>(1-y/HH)*H,sx=W/1024;
  return cTex(W,H,(g)=>{
    g.fillStyle=skin;g.fillRect(0,0,W,H);
    for(let i=0;i<90;i++){const x=Math.random()*W,y=Math.random()*H,r=(8+Math.random()*26)*sx;const gr=g.createRadialGradient(x,y,0,x,y,r);gr.addColorStop(0,Math.random()<.5?'rgba(120,70,50,.10)':'rgba(255,220,190,.07)');gr.addColorStop(1,'rgba(0,0,0,0)');g.fillStyle=gr;g.fillRect(x-r,y-r,r*2,r*2);}
    // скальп под волосами
    g.fillStyle='rgba(24,16,12,.97)';for(let x=0;x<W;x++){const a=Math.abs((x/W-.5)*TAU);g.fillRect(x,0,1.5,py(spl(HL,a)[0]-.03));}
    // затылок и бока темнее
    const sg=g.createLinearGradient(0,0,W,0);sg.addColorStop(0,'rgba(0,0,0,.5)');sg.addColorStop(.25,'rgba(0,0,0,.08)');sg.addColorStop(.5,'rgba(0,0,0,0)');sg.addColorStop(.75,'rgba(0,0,0,.08)');sg.addColorStop(1,'rgba(0,0,0,.5)');g.fillStyle=sg;g.fillRect(0,0,W,H);
    const jaw=g.createLinearGradient(0,py(.7),0,py(0));jaw.addColorStop(0,'rgba(70,35,25,0)');jaw.addColorStop(1,'rgba(70,35,25,.55)');g.fillStyle=jaw;g.fillRect(0,py(.7),W,py(0)-py(.7));
    // щёки: лёгкий румянец и тени под скулами
    for(const s of [-1,1]){
      let x=px(s*.78),y=py(1.3),r=60*sx;let gr=g.createRadialGradient(x,y,0,x,y,r);gr.addColorStop(0,'rgba(190,100,80,.16)');gr.addColorStop(1,'rgba(0,0,0,0)');g.fillStyle=gr;g.fillRect(x-r,y-r,r*2,r*2);
      x=px(s*1.0);y=py(.95);gr=g.createRadialGradient(x,y,0,x,y,r);gr.addColorStop(0,'rgba(80,40,30,.22)');gr.addColorStop(1,'rgba(0,0,0,0)');g.fillStyle=gr;g.fillRect(x-r,y-r,r*2,r*2);
    }
    // еле заметная щетина по нижней части лица
    g.fillStyle='rgba(30,20,16,.10)';for(let i=0;i<1400;i++){const phi=(Math.random()-.5)*2.2,y=Math.random()*1.0;g.fillRect(px(phi),py(y),1.2*sx,1.2*sx);}
    // глаза
    for(const s of [-1,1]){
      const ex=px(s*.42),ey=py(1.60),ew=40*sx,eh=16*sx;
      let gr=g.createRadialGradient(ex,ey+eh*.4,0,ex,ey+eh*.4,ew*1.5);gr.addColorStop(0,'rgba(80,45,35,.30)');gr.addColorStop(1,'rgba(0,0,0,0)');g.fillStyle=gr;g.fillRect(ex-ew*1.6,ey-eh*1.5,ew*3.2,eh*4); // тень под глазом
      g.save();g.beginPath();g.moveTo(ex-ew,ey+eh*.15);g.quadraticCurveTo(ex,ey-eh*1.25,ex+ew,ey+eh*.15);g.quadraticCurveTo(ex,ey+eh*1.0,ex-ew,ey+eh*.15);g.closePath();g.clip();
      g.fillStyle='#e8dfd3';g.fillRect(ex-ew,ey-eh*1.3,ew*2,eh*2.6);
      const sh=g.createLinearGradient(0,ey-eh,0,ey+eh);sh.addColorStop(0,'rgba(60,35,30,.5)');sh.addColorStop(.5,'rgba(60,35,30,0)');g.fillStyle=sh;g.fillRect(ex-ew,ey-eh*1.3,ew*2,eh*2.6);
      g.fillStyle='#4a3322';g.beginPath();g.arc(ex+s*.0,ey-eh*.05,eh*.95,0,7);g.fill();
      g.fillStyle='#2a1b12';g.beginPath();g.arc(ex,ey-eh*.05,eh*.62,0,7);g.fill();g.fillStyle='#050505';g.beginPath();g.arc(ex,ey-eh*.05,eh*.34,0,7);g.fill();
      g.fillStyle='rgba(255,255,255,.85)';g.beginPath();g.arc(ex-eh*.3,ey-eh*.35,eh*.2,0,7);g.fill();
      g.restore();
      g.strokeStyle='rgba(20,12,10,.95)';g.lineWidth=2.4*sx;g.beginPath();g.moveTo(ex-ew,ey+eh*.15);g.quadraticCurveTo(ex,ey-eh*1.3,ex+ew,ey+eh*.15);g.stroke(); // верхнее веко
      g.strokeStyle='rgba(90,50,40,.55)';g.lineWidth=1.4*sx;g.beginPath();g.moveTo(ex-ew*.9,ey+eh*.2);g.quadraticCurveTo(ex,ey+eh*1.05,ex+ew*.9,ey+eh*.2);g.stroke(); // нижнее
      g.strokeStyle='rgba(70,40,30,.5)';g.lineWidth=1.6*sx;g.beginPath();g.moveTo(ex-ew,ey-eh*.5);g.quadraticCurveTo(ex,ey-eh*2.2,ex+ew,ey-eh*.6);g.stroke(); // складка века
      g.fillStyle='rgba(190,100,95,.55)';g.beginPath();g.ellipse(ex-s*ew*.95,ey+eh*.25,3.2*sx,2.6*sx,0,0,7);g.fill(); // слёзный бугорок
      // брови: плотные штрихи
      g.strokeStyle='rgba(28,18,12,.85)';
      for(let i=0;i<420;i++){const t=Math.random(),bx=px(s*(.10+.66*t)),by=py(1.80+.06*Math.sin(Math.min(1,t*1.15)*Math.PI*.8)-.04*t*t)+(Math.random()-.5)*15*sx*(1-t*.55);
        g.lineWidth=(1.4+Math.random()*1.0)*sx;g.beginPath();g.moveTo(bx,by);g.lineTo(bx+s*(5+Math.random()*4)*sx,by-(1.5-t*3)*sx*(1+Math.random()));g.stroke();}
    }
    // нос: ноздри, тени по бокам, блик на кончике
    for(const s of [-1,1]){
      let x=px(s*.13),y=py(.96);g.fillStyle='rgba(50,22,16,.8)';g.beginPath();g.ellipse(x,y,8*sx,4.6*sx,s*.4,0,7);g.fill();
      x=px(s*.24);y=py(1.25);const gr=g.createRadialGradient(x,y,0,x,y,34*sx);gr.addColorStop(0,'rgba(90,50,40,.22)');gr.addColorStop(1,'rgba(0,0,0,0)');g.fillStyle=gr;g.fillRect(x-40*sx,y-50*sx,80*sx,100*sx);
    }
    // губы
    const mx=px(0),my=py(.645);
    g.fillStyle='#9a5a50';g.beginPath();g.moveTo(mx-42*sx,my);g.quadraticCurveTo(mx-16*sx,my-18*sx,mx,my-13*sx);g.quadraticCurveTo(mx+16*sx,my-18*sx,mx+42*sx,my);g.lineTo(mx-42*sx,my);g.fill();
    g.fillStyle='#a96a61';g.beginPath();g.moveTo(mx-40*sx,my);g.quadraticCurveTo(mx,my+32*sx,mx+40*sx,my);g.closePath();g.fill();
    g.strokeStyle='rgba(55,25,22,.9)';g.lineWidth=2*sx;g.beginPath();g.moveTo(mx-46*sx,my-2*sx);g.quadraticCurveTo(mx,my+4*sx,mx+46*sx,my-2*sx);g.stroke();
    g.fillStyle='rgba(255,230,220,.18)';g.beginPath();g.ellipse(mx,my+9*sx,9*sx,2.6*sx,0,0,7);g.fill();
    // морщины на лбу
    g.strokeStyle='rgba(90,50,40,.12)';g.lineWidth=1.4*sx;for(let i=0;i<3;i++){g.beginPath();g.moveTo(px(-.4),py(2.05+i*.1));g.quadraticCurveTo(px(0),py(2.03+i*.1)-3*sx,px(.4),py(2.05+i*.1));g.stroke();}
  });
}
function hairTex(col){
  return cTex(512,256,(g,W,H)=>{
    g.fillStyle=col;g.fillRect(0,0,W,H);
    for(let i=0;i<1400;i++){const x=Math.random()*W,y0=Math.random()*H,l=14+Math.random()*50;g.strokeStyle=Math.random()<.7?'rgba(70,52,40,.35)':'rgba(8,5,4,.5)';g.lineWidth=.7+Math.random()*1.2;g.beginPath();g.moveTo(x,y0);g.lineTo(x+(Math.random()-.5)*5,y0+l);g.stroke();}
    const sg=g.createLinearGradient(0,0,0,H);sg.addColorStop(0,'rgba(0,0,0,.45)');sg.addColorStop(.5,'rgba(255,230,200,.07)');sg.addColorStop(1,'rgba(0,0,0,.2)');g.fillStyle=sg;g.fillRect(0,0,W,H);
    // рваная кромка линии роста (альфа через очистку)
    g.globalCompositeOperation='destination-out';for(let i=0;i<260;i++){g.fillStyle='rgba(0,0,0,'+Math.random()+')';g.fillRect(Math.random()*W,H-Math.random()*H*.1,1.5+Math.random()*3,3+Math.random()*10);}
    g.globalCompositeOperation='source-over';
  },1,1);
}
function woolTex(col,rep){
  return cTex(256,256,(g,W,H)=>{
    g.fillStyle=col;g.fillRect(0,0,W,H);
    const im=g.getImageData(0,0,W,H);for(let i=0;i<W*H;i++){const v=(Math.random()-.5)*26;im.data[i*4]+=v;im.data[i*4+1]+=v;im.data[i*4+2]+=v;}g.putImageData(im,0,0);
    g.strokeStyle='rgba(255,255,255,.06)';g.lineWidth=1;for(let i=-H;i<W;i+=3){g.beginPath();g.moveTo(i,0);g.lineTo(i+H,H);g.stroke();}
    g.strokeStyle='rgba(0,0,0,.18)';for(let i=-H;i<W;i+=6){g.beginPath();g.moveTo(i+1,0);g.lineTo(i+H+1,H);g.stroke();}
  },rep||4,rep||4);
}
function shirtTex(){
  return cTex(256,256,(g,W,H)=>{
    g.fillStyle='#d9d4c8';g.fillRect(0,0,W,H);
    const im=g.getImageData(0,0,W,H);for(let i=0;i<W*H;i++){const v=(Math.random()-.5)*10;im.data[i*4]+=v;im.data[i*4+1]+=v;im.data[i*4+2]+=v;}g.putImageData(im,0,0);
    for(let i=0;i<14;i++){g.strokeStyle='rgba(120,110,95,.12)';g.lineWidth=2+Math.random()*3;g.beginPath();const x=Math.random()*W,y=Math.random()*H;g.moveTo(x,y);g.quadraticCurveTo(x+20,y+30,x+Math.random()*50-25,y+70);g.stroke();}
    g.fillStyle='rgba(120,110,95,.35)';g.fillRect(W*.5-1,0,2,H);g.fillStyle='#f6f3ea';for(let i=0;i<8;i++){g.beginPath();g.arc(W*.5,H*(.04+i*.12),2.6,0,7);g.fill();g.strokeStyle='rgba(90,80,70,.5)';g.lineWidth=1;g.stroke();}
  });
}
// ---------- ПИДЖАК ----------
const JT=[ // y, rx, rz, ox, квадратность, половина зазора переда (рад)
  [8.6,1.78,2.32,-.05,2.8,.13],[9.6,1.82,2.45,-.05,2.8,.10],[10.8,1.74,2.34,-.05,2.7,.07],[11.9,1.62,2.18,-.02,2.6,.03],[12.9,1.60,2.16,0,2.6,.015],
  [13.9,1.66,2.28,.02,2.5,.09],[15.0,1.78,2.48,.04,2.5,.17],[16.2,1.84,2.66,.04,2.5,.24],[17.3,1.76,2.84,0,2.4,.33],
  [18.0,1.50,2.88,-.1,2.3,.46],[18.5,1.2,2.5,-.12,2.2,.7],[18.85,1.02,1.6,-.16,2.1,1.0],[19.1,.98,1.3,-.18,2.0,1.2]];
const JY0=8.6,JY1=19.1;
function jPt(phi,y,off){const t=spl(JT,y),s=se(phi,t[0]+(off||0),t[1]+(off||0),t[3],t[2]);return [s[0],y,s[1]];}
function jacketHalf(side){
  return grid(HRES?24:16,HRES?52:36,(u,v)=>{const y=JY0+v*(JY1-JY0),gp=spl(JT,y)[4],phi=gp+(Math.PI-gp)*u,p=jPt(phi,y);return [p[0],p[1],p[2]*side,u*2,v*3];},{orient:[0,14,0]});
}
const LW=[[0,0],[.2,.18],[.45,.5],[.7,.80],[.85,.72],[1,.38]];
function lapelGeo(side){
  return grid(6,30,(u,v)=>{
    const y=12.9+v*5.5,t=spl(JT,y),gp=t[4],dphi=spl(LW,v)[0]/(t[1]*.9),i=Math.round(u*6);
    const phi=i===0?gp:gp+dphi*(i-1)/5,off=i===0?0:lerpf(.09,.03,(i-1)/5);
    const p=jPt(phi,y,off);return [p[0],p[1],p[2]*side,u,v];
  },{orient:[0,14,0]});
}
function surfFlap(side,p0,p1,y0,y1,off){ // накладка на поверхность пиджака (клапан кармана, прорезь)
  return grid(14,4,(u,v)=>{const p=jPt(lerpf(p0,p1,u),lerpf(y0,y1,v),off);return [p[0],p[1],p[2]*side,u,v];},{orient:[0,14,0]});
}
// ---------- рубашка и воротник ----------
const ST=[[11.5,1.48,2.05,0,2.4],[12.9,1.50,2.05,0,2.4],[14.5,1.62,2.30,.02,2.4],[16.0,1.68,2.46,.02,2.4],[17.4,1.60,2.62,0,2.3],[18.2,1.38,2.5,-.1,2.2],[18.7,1.12,1.6,-.12,2.1],[19.1,1.02,1.08,-.1,2.0]];
function shirtGeo(){
  return grid(HRES?40:28,HRES?26:18,(u,v)=>{const y=11.5+v*7.6,t=spl(ST,y),s=se((u-.5)*TAU,t[0],t[1],t[3],t[2]);return [s[0],y,s[1],u,v];},{wrap:true,orient:[0,15,0]});
}
function collarLeaf(side){
  return grid(16,4,(u,v)=>{
    const phi=lerpf(2.55,.52,u),c=Math.cos(phi),s=Math.sin(phi);
    const yf=19.5-.7*u*u,rx=.92,rz=.92;
    const fx=-.12+c*rx,fz=s*rz;
    const Lr=.6+.6*u,Ld=.6+1.0*u,spread=.3*u*u;
    const ex=fx+c*Lr,ey=yf-Ld,ez=fz+s*Lr+spread;
    const w=Math.sin(Math.PI*v)*.12*(1-u*.4)+.16*v*u;
    return [lerpf(fx,ex,v)+.2*v*u,lerpf(yf,ey,v)+w,(lerpf(fz,ez,v))*side,u,v];
  });
}
// ---------- золотая цепочка с крестом ----------
function chainGroup(){
  const GM=MS({color:0xd8aa3c,roughness:.3,metalness:.6,emissive:0x2a1a04}),grp=new THREE.Group();
  const pts=[];const N=90;
  for(let i=0;i<=N;i++){const phi=lerpf(-2.5,2.5,i/N),f=gs(phi,0,.72);
    pts.push(new THREE.Vector3(Math.cos(phi)*(1.02+.78*f)-.1*(1-f),18.82-1.95*f,Math.sin(phi)*(1.0+.42*f)));}
  const curve=new THREE.CatmullRomCurve3(pts),len=curve.getLength(),n=Math.round(len/.17),links=[];
  const lg=new THREE.TorusGeometry(.12,.034,5,8);
  for(let i=0;i<n;i++){
    const t=(i+.5)/n,p=curve.getPointAt(t),tg=curve.getTangentAt(t);
    const up=Math.abs(tg.y)>.95?new THREE.Vector3(1,0,0):new THREE.Vector3(0,1,0),bz=new THREE.Vector3().crossVectors(tg,up).normalize(),ny=new THREE.Vector3().crossVectors(bz,tg);
    const q=new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(tg,ny,bz)); // ось X звена — вдоль цепи
    const g=lg.clone();g.scale(1.3,.8,1);g.applyMatrix4(new THREE.Matrix4().makeRotationX(i%2?Math.PI/2:0));
    g.applyMatrix4(new THREE.Matrix4().compose(p,q,new THREE.Vector3(1,1,1)));links.push(g);
  }
  grp.add(hmesh(mergeG(links),GM));
  // крест на нижней точке дуги
  const sh=new THREE.Shape();const a=.075,b=.42,c=.25,d=.16;
  sh.moveTo(-a,b);sh.lineTo(a,b);sh.lineTo(a,d+.05);sh.lineTo(c,d+.05);sh.lineTo(c,d-.05);sh.lineTo(a,d-.05);sh.lineTo(a,-b);sh.lineTo(-a,-b);sh.lineTo(-a,d-.05);sh.lineTo(-c,d-.05);sh.lineTo(-c,d+.05);sh.lineTo(-a,d+.05);sh.closePath();
  const cg=new THREE.ExtrudeGeometry(sh,{depth:.07,bevelEnabled:true,bevelThickness:.02,bevelSize:.02,bevelSegments:1});cg.translate(0,0,-.035);cg.rotateY(Math.PI/2); // лицом вперёд (+x)
  const bot=curve.getPointAt(.5);grp.add(hmesh(cg,GM,bot.x+.06,bot.y-.5,0));
  return grp;
}
// ---------- кисть ----------
function handGeo(side,skin){
  const parts=[];
  parts.push(loftG([R(.15,.40,.26),R(-.2,.50,.30),R(-.95,.60,.27),R(-1.08,.52,.20)],{n:8,c:.5}));
  const seg=(M,len,r)=>{const g=loftG([R(0,r,r),R(-len*.5,r*.96,r*.96),R(-len,r*.84,r*.84),R(-len-.04,.04,.04)],6);g.applyMatrix4(M);return g;};
  const chain=(base,lens,rads,curls,tilt)=>{
    let M=new THREE.Matrix4().makeTranslation(base[0],base[1],base[2]);
    if(tilt)M.multiply(new THREE.Matrix4().makeRotationZ(tilt));
    for(let i=0;i<lens.length;i++){M=M.clone().multiply(new THREE.Matrix4().makeRotationX(curls[i]*side));parts.push(seg(M,lens[i],rads[i]));M=M.clone().multiply(new THREE.Matrix4().makeTranslation(0,-lens[i],0));}
  };
  const fx=[.40,.14,-.12,-.36],fl=[.36,.39,.35,.28],fr=[.125,.125,.115,.10];
  for(let i=0;i<4;i++)chain([fx[i],-1.0,-side*.04],[fl[i]*.9,fl[i]*.72,fl[i]*.58],[fr[i],fr[i]*.93,fr[i]*.86],[.32+i*.04,.62,.5]);
  chain([.50,-.42,-side*.1],[.42,.34],[.15,.13],[.22,.32],.5);
  return mergeG(parts);
}
// ---------- туфли ----------
const SHT=[[-.62,.0,-.78,.30,2.2],[-.5,.45,-.78,.52,2.4],[-.2,.58,-.78,.58,2.6],[.4,.48,-.78,.6,2.6],[1.0,.0,-.78,.66,2.8],[1.7,-.2,-.78,.72,3],[2.4,-.36,-.78,.72,3.2],[2.95,-.44,-.78,.68,3.4],[3.08,-.50,-.78,.52,3.2],[3.14,-.62,-.78,.2,2.5]];
function shoeGeo(table,sc){
  const l0=-.62,l1=3.14;
  return grid(18,36,(u,v)=>{const l=lerpf(l0,l1,v),t=spl(table,l),top=t[0],bot=t[1],w=t[2]*(sc||1),cy=(top+bot)/2,ry=(top-bot)/2,s=se(u*TAU,ry,w,t[3]);return [l,cy+s[0],s[1],u,v];},{wrap:true,orient:[1.2,-.4,0]});
}
const SOLT=[[-.62,-.74,-1.0,.30,2.2],[-.5,-.74,-1.0,.54,2.4],[.4,-.74,-1.0,.62,2.6],[1.0,-.76,-.97,.68,2.8],[2.4,-.76,-.95,.74,3.2],[2.95,-.76,-.95,.70,3.4],[3.1,-.76,-.95,.52,3.2],[3.16,-.78,-.93,.2,2.5]];
// ---------- сборка ----------
function makeHero(){
  const root=new THREE.Group(),g=new THREE.Group();root.add(g);
  const skin='#b8855f',SK=MS({color:skin,roughness:.62});
  const jTex=woolTex('#1a191c',4),jacketM=MS({map:jTex,bumpMap:jTex,bumpScale:.4,roughness:.9,envMapIntensity:.2,side:THREE.DoubleSide});
  const lapelM=MS({color:0x201f23,roughness:.55,envMapIntensity:.4}),pTex=woolTex('#131316',5),pantsM=MS({map:pTex,bumpMap:pTex,bumpScale:.3,roughness:.9,envMapIntensity:.2});
  const shirtM=MS({map:shirtTex(),roughness:.85,side:THREE.DoubleSide}),whiteM=MS({color:0xd9d4c8,roughness:.85,side:THREE.DoubleSide});
  const leather=MS({color:0x0b0b0c,roughness:.28,metalness:.15,envMapIntensity:.8}),sole=MS({color:0x0e0d0d,roughness:.75}),metal=MS({color:0xc8c8cc,roughness:.3,metalness:.8});
  const black=MS({color:0x050505,roughness:.6});
  // шея и голова
  const neckG=grid(14,8,(u,v)=>{const y=lerpf(17.5,19.9,v),k=(y-17.5)/2.4,r=lerpf(.86,.70,Math.min(1,k*1.2)),s=se((u-.5)*TAU,r,r*1.02,2.2,-.08+k*.14);return [s[0],y,s[1],u,v];},{wrap:true,orient:[0,18,0]});
  g.add(hmesh(neckG,SK));
  const head=new THREE.Group();head.position.set(.12,19.0,0);g.add(head);
  const hm=hmesh(headGeo(),MS({map:skinFaceTex(skin),roughness:.58}),0,.55,0);head.add(hm);
  head.add(hmesh(hairGeo(),MS({map:hairTex('#1a110d'),roughness:.45,alphaTest:.5,side:THREE.DoubleSide}),0,.55,0));
  for(const z of [-1,1]){ // уши
    const ear=loftG([R(-.42,.04,.03),R(-.26,.2,.10),R(0,.26,.13),R(.3,.22,.11),R(.46,.05,.04)],8);
    const e=hmesh(ear,SK,-.22,.55+1.55,z*.98);e.rotation.x=-z*.28;e.scale.set(1,1,1);head.add(e);
  }
  // торс: рубашка, брюки (таз), ремень
  g.add(hmesh(shirtGeo(),shirtM));
  const pelv=grid(HRES?32:22,12,(u,v)=>{const y=lerpf(10.0,12.95,v),t=spl([[10,1.28,1.7,0,2.3],[10.8,1.5,1.95,0,2.4],[11.8,1.52,2.05,0,2.4],[12.95,1.52,2.07,0,2.4]],y),s=se((u-.5)*TAU,t[0],t[1],t[3],t[2]);return [s[0],y,s[1],u,v];},{wrap:true,orient:[0,11,0]});
  g.add(hmesh(pelv,pantsM));
  const belt=grid(32,2,(u,v)=>{const s=se((u-.5)*TAU,1.56,2.1,2.4,0);return [s[0],lerpf(12.5,13.0,v),s[1],u,v];},{wrap:true,orient:[0,12.7,0]});
  g.add(hmesh(belt,MS({color:0x0a0a0a,roughness:.4,side:THREE.DoubleSide})));
  const bk=hmesh(new THREE.BoxGeometry(.1,.46,.62),metal,1.6,12.75,0);g.add(bk);g.add(hmesh(new THREE.BoxGeometry(.12,.3,.44),black,1.62,12.75,0));
  // цепочка
  g.add(chainGroup());
  // воротник рубашки
  g.add(hmesh(grid(24,3,(u,v)=>{const sx=se((u-.5)*TAU,.9,.92,2.2,-.1+v*.1);return [sx[0],lerpf(18.85,19.5,v),sx[1],u,v];},{wrap:true,orient:[0,19,0]}),whiteM));
  for(const s of [-1,1])g.add(hmesh(collarLeaf(s),whiteM));
  // пиджак: половины, лацканы, клапаны, пуговицы
  for(const s of [-1,1]){
    g.add(hmesh(jacketHalf(s),jacketM));
    g.add(hmesh(lapelGeo(s),lapelM));
    g.add(hmesh(surfFlap(s,.40,.86,9.85,10.45,.06),jacketM));
    g.add(hmesh(surfFlap(s,.40,.86,10.45,10.55,.045),black));
  }
  g.add(hmesh(surfFlap(-1,.85,1.2,15.1,15.28,.07),black)); // нагрудный карман
  for(const y of [12.9,11.75]){const bt=hmesh(new THREE.CylinderGeometry(.11,.11,.05,10),black,spl(JT,y)[0]+spl(JT,y)[2]+.06,y,.0);bt.rotation.z=Math.PI/2;g.add(bt);}
  // ноги
  const legs=[];
  for(const z of [-1.0,1.0]){
    const hip=new THREE.Group();hip.position.set(0,11.0,z);
    const th=grid(HRES?26:18,12,(u,v)=>{const y=lerpf(1.2,-4.9,v),t=spl([[-4.9,1.22,1.2],[-2.5,1.38,1.3],[0,1.5,1.42],[1.2,1.55,1.5]],y),s=se((u-.5)*TAU,t[0],t[1],2.2);return [s[0],y,s[1],u,v];},{wrap:true,orient:[0,-2,0]});
    hip.add(hmesh(th,pantsM));
    const kn=new THREE.Group();kn.position.set(0,-4.9,0);hip.add(kn);
    const sn=grid(HRES?26:18,12,(u,v)=>{const y=lerpf(0,-5.45,v),t=spl([[-5.45,1.23,1.2],[-4,1.2,1.18],[-2,1.2,1.18],[0,1.22,1.2]],y),s=se((u-.5)*TAU,t[0],t[1],2.2);return [s[0],y,s[1],u,v];},{wrap:true,orient:[0,-2.5,0]});
    kn.add(hmesh(sn,pantsM));
    const shoe=new THREE.Group();shoe.position.set(.0,-5.1,0);kn.add(shoe);
    shoe.add(hmesh(shoeGeo(SHT),leather));shoe.add(hmesh(shoeGeo(SOLT,1.02),sole));shoe.scale.set(1.12,1.18,1.12);
    for(const l of [.55,.85,1.15,1.45]){const top=spl(SHT,l)[0],w=spl(SHT,l)[2];const lc=hmesh(new THREE.BoxGeometry(.07,.035,w*1.5),MS({color:0x1c1c1e,roughness:.7}),l,top+.01,0);lc.rotation.z=-.3;shoe.add(lc);}
    g.add(hip);legs.push({hip,kn});
  }
  // руки
  const arms=[];
  for(const z of [-2.78,2.78]){
    const side=Math.sign(z);
    const s=new THREE.Group();s.position.set(-.05,18.05,z);s.rotation.x=-side*.05;
    s.add(hmesh(grid(HRES?20:14,10,(u,v)=>{const y=lerpf(.58,-3.8,v),t=spl([[-3.8,.80,.82],[-3,.84,.86],[-1.5,.92,.95],[0,.98,1.02],[.35,.80,.84],[.5,.5,.52],[.58,.02,.02]],y),sx=se((u-.5)*TAU,t[0],t[1],2.2);return [sx[0],y,sx[1],u,v];},{wrap:true,orient:[0,-1.5,0]}),jacketM));
    const el=new THREE.Group();el.position.set(0,-3.8,0);s.add(el);
    el.add(hmesh(grid(HRES?20:14,8,(u,v)=>{const y=lerpf(.2,-3.4,v),t=spl([[-3.4,.66,.68],[-1.7,.74,.76],[-.5,.80,.82],[.2,.82,.84]],y),sx=se((u-.5)*TAU,t[0],t[1],2.2);return [sx[0],y,sx[1],u,v];},{wrap:true,orient:[0,-1.5,0]}),jacketM));
    const cuff=grid(16,2,(u,v)=>{const y=lerpf(-3.15,-3.75,v),sx=se((u-.5)*TAU,.63,.65,2.2);return [sx[0],y,sx[1],u,v];},{wrap:true,orient:[0,-3.5,0]});
    el.add(hmesh(cuff,whiteM));
    for(let i=0;i<3;i++){const b=hmesh(new THREE.CylinderGeometry(.06,.06,.04,8),black,.0,-2.55-i*.2,0);b.position.x=.0;b.position.z=side*(.62);b.rotation.x=Math.PI/2;el.add(b);}
    const hand=new THREE.Group();hand.position.set(0,-3.7,0);el.add(hand);
    hand.add(hmesh(handGeo(side),SK));
    s.userData.side=side;g.add(s);arms.push({sh:s,el,hand});
  }
  const wep=buildWeapons(arms[1].hand,.85,-Math.PI/2);wep[3].visible=true;   // индексы — по таблице WEAPONS (3 — пистолет)
  root.userData={legs,arms,head,wep,kind:'pl',g,skirt:null,ph:rnd(0,6),cs:0,hy:0,hp:0,aim:0,omon:false,hero:true};
  return root;
}
const playerMesh=makeHero();
scene.add(playerMesh);
