'use strict';
// ===== Базовые константы и утилиты =====
const TS=MAPDATA.TS,MW=MAPDATA.W,MH=MAPDATA.H,WW=MW*TS,WH=MH*TS,WL=-10; // WL: уровень воды
const cv=document.getElementById('h'),ctx=cv.getContext('2d');
let VW=0,VH=0,SC=1;
function resize(){VW=cv.width=innerWidth;VH=cv.height=innerHeight;SC=Math.max(.6,VH/700);}
addEventListener('resize',resize);resize();
const rnd=(a,b)=>a+Math.random()*(b-a);
const ri=(a,b)=>Math.floor(rnd(a,b+1));
const clamp=(v,a,b)=>v<a?a:v>b?b:v;
const pick=a=>a[Math.floor(Math.random()*a.length)];
const dist=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
const angDiff=(a,b)=>{let d=b-a;while(d>Math.PI)d-=6.2832;while(d<-Math.PI)d+=6.2832;return d;};
function rr(x,y,w,h,r){ctx.beginPath();ctx.roundRect(x,y,w,h,r);}
function shade(hex,f){const n=parseInt(hex.slice(1),16);const c=v=>clamp(Math.round(v*f),0,255);return `rgb(${c(n>>16)},${c((n>>8)&255)},${c(n&255)})`;}

// ===== Ввод =====
const keys={},pressed={};
addEventListener('keydown',e=>{if(!keys[e.code])pressed[e.code]=true;keys[e.code]=true;if(e.code.startsWith('Arrow')||e.code==='Space')e.preventDefault();});
addEventListener('keyup',e=>{keys[e.code]=false;});
addEventListener('blur',()=>{for(const k in keys)keys[k]=false;});
const mouse={x:0,y:0,down:false,click:false,dx:0,dy:0};
addEventListener('mousemove',e=>{mouse.x=e.clientX;mouse.y=e.clientY;mouse.dx+=e.movementX||0;mouse.dy+=e.movementY||0;});
addEventListener('mousedown',()=>{mouse.down=true;mouse.click=true;});
addEventListener('mouseup',()=>{mouse.down=false;});

// ===== Звук (WebAudio, без файлов) =====
let AC=null,NB=null;
function snd(kind){try{
  if(!AC){AC=new(window.AudioContext||window.webkitAudioContext)();NB=AC.createBuffer(1,AC.sampleRate,AC.sampleRate);const d=NB.getChannelData(0);for(let i=0;i<d.length;i++)d[i]=Math.random()*2-1;}
  if(AC.state==='suspended')AC.resume();
  const t=AC.currentTime;
  if(kind==='pickup'||kind==='honk'){
    const o=AC.createOscillator(),g=AC.createGain();
    o.type=kind==='honk'?'square':'triangle';
    if(kind==='pickup'){o.frequency.setValueAtTime(660,t);o.frequency.exponentialRampToValueAtTime(1320,t+.1);}else o.frequency.value=330;
    g.gain.setValueAtTime(.07,t);g.gain.exponentialRampToValueAtTime(.001,t+(kind==='honk'?.35:.15));
    o.connect(g).connect(AC.destination);o.start(t);o.stop(t+.4);return;
  }
  const P={shot:[1800,.08,.22],smg:[2400,.05,.15],boom:[260,.9,.6],hit:[500,.12,.3],rocket:[700,.3,.3]}[kind];
  const s=AC.createBufferSource();s.buffer=NB;
  const f=AC.createBiquadFilter();f.type='lowpass';f.frequency.value=P[0];
  const g=AC.createGain();g.gain.setValueAtTime(P[2],t);g.gain.exponentialRampToValueAtTime(.001,t+P[1]);
  s.connect(f).connect(g).connect(AC.destination);s.start(t);s.stop(t+P[1]+.05);
}catch(e){}}

// ===== Карта города =====
// типы: 0 дорога, 1 тротуар, 2 здание (твёрдое), 3 двор, 4 лес, 5 вода, 6 за краем карты, 7 песок, 8 парк
const T=new Uint8Array(MW*MH);
const tileAt=(tx,ty)=>(tx<0||ty<0||tx>=MW||ty>=MH)?6:T[ty*MW+tx];
const isSol=t=>t===2||t===5||t===6;
const walkable=t=>t===1||t===3||t===7||t===8;
const solidAt=(px,py)=>isSol(tileAt(Math.floor(px/TS),Math.floor(py/TS)));
function genMap(){
  const r=MAPDATA.T;let k=0;
  for(let i=0;i<r.length;i+=2){const v=r[i],n=r[i+1];T.fill(v,k,k+n);k+=n;}
}
// рельеф: сетка высот (ячейка 64 ед.), билинейная выборка
const HGW=MAPDATA.HG.w,HGH=MAPDATA.HG.h,HGC=MAPDATA.HG.cell;
const HGD=(()=>{const b=atob(MAPDATA.HG.d),a=new Int16Array(b.length>>1);for(let i=0;i<a.length;i++)a[i]=((b.charCodeAt(i*2)|(b.charCodeAt(i*2+1)<<8))<<16)>>16;return a;})();
function hAt(x,y){
  const gx=clamp(x/HGC,0,HGW-1.001),gy=clamp(y/HGC,0,HGH-1.001),x0=gx|0,y0=gy|0,fx=gx-x0,fy=gy-y0;
  const a=HGD[y0*HGW+x0],b=HGD[y0*HGW+x0+1],c=HGD[(y0+1)*HGW+x0],d=HGD[(y0+1)*HGW+x0+1];
  return a+(b-a)*fx+(c-a)*fy+(a-b-c+d)*fx*fy;
}
// выталкивание круга из твёрдых тайлов
function circleTilePush(x,y,r){
  let px=0,py=0,touched=false;
  const x0=Math.floor((x-r)/TS),x1=Math.floor((x+r)/TS),y0=Math.floor((y-r)/TS),y1=Math.floor((y+r)/TS);
  for(let ty=y0;ty<=y1;ty++)for(let tx=x0;tx<=x1;tx++){
    if(!isSol(tileAt(tx,ty)))continue;
    const cx=clamp(x,tx*TS,tx*TS+TS),cy=clamp(y,ty*TS,ty*TS+TS);
    let dx=x-cx,dy=y-cy,d=Math.hypot(dx,dy);
    if(d<r){
      if(d<.001){dx=x-(tx*TS+TS/2);dy=y-(ty*TS+TS/2);d=Math.hypot(dx,dy)||1;}
      const o=r-d;px+=dx/d*o;py+=dy/d*o;touched=true;
    }
  }
  return touched?{x:px,y:py}:null;
}
