'use strict';
// ===== Базовые константы и утилиты =====
const TS=48,MW=60,MH=60,WW=MW*TS,WH=MH*TS;
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
// 0 дорога, 1 тротуар, 2 здание (твёрдое), 3 парк
const T=new Uint8Array(MW*MH);
const BLK=[];
const tileAt=(tx,ty)=>(tx<0||ty<0||tx>=MW||ty>=MH)?2:T[ty*MW+tx];
const solidAt=(px,py)=>tileAt(Math.floor(px/TS),Math.floor(py/TS))===2;
function mkBlock(bx,by){
  const sp=((bx===1||bx===4)&&(by===1||by===4))?'vysotka':(bx===3&&by===2)?'basil':null;
  const kind=sp||pick(['stalin','stalin','panel9','panel9','khrush','khrush','khrush']);
  const cols={stalin:['#d9b872','#e3d2a2','#dba890','#cfa760'],panel9:['#c9ccc8','#d4d2c6','#bfc6c8'],khrush:['#d8d3bf','#cfd2c6','#dcd0b4'],vysotka:['#d9c9a2'],basil:['#a8412a']};
  return {park:!sp&&Math.random()<.15,kind,col:pick(cols[kind])};
}
function genMap(){
  for(let by=0;by<6;by++){BLK[by]=[];for(let bx=0;bx<6;bx++)BLK[by][bx]=mkBlock(bx,by);}
  for(let y=0;y<MH;y++)for(let x=0;x<MW;x++){
    const mx=x%10,my=y%10;let t;
    if(mx<2||my<2)t=0;
    else if(mx===2||mx===9||my===2||my===9)t=1;
    else t=BLK[(y/10)|0][(x/10)|0].park?3:2;
    T[y*MW+x]=t;
  }
}
// выталкивание круга из твёрдых тайлов
function circleTilePush(x,y,r){
  let px=0,py=0,touched=false;
  const x0=Math.floor((x-r)/TS),x1=Math.floor((x+r)/TS),y0=Math.floor((y-r)/TS),y1=Math.floor((y+r)/TS);
  for(let ty=y0;ty<=y1;ty++)for(let tx=x0;tx<=x1;tx++){
    if(tileAt(tx,ty)!==2)continue;
    const cx=clamp(x,tx*TS,tx*TS+TS),cy=clamp(y,ty*TS,ty*TS+TS);
    let dx=x-cx,dy=y-cy,d=Math.hypot(dx,dy);
    if(d<r){
      if(d<.001){dx=x-(tx*TS+TS/2);dy=y-(ty*TS+TS/2);d=Math.hypot(dx,dy)||1;}
      const o=r-d;px+=dx/d*o;py+=dy/d*o;touched=true;
    }
  }
  return touched?{x:px,y:py}:null;
}
