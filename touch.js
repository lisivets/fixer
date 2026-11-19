'use strict';
// ===== Управление с телефона: стик, кнопки, камера пальцем =====
const MOBILE=(typeof matchMedia==='function'&&matchMedia('(pointer:coarse)').matches)||('ontouchstart' in window);
const LITE=window.__LITE||MOBILE||/iPhone|iPad|Android/i.test(navigator.userAgent);
const TQ=LITE?.5:1;
const TOUCH={on:false,stick:null,look:null,held:{}};
const HS=()=>clamp(VH/900,MOBILE?.45:.7,1.3);
const T_R=()=>Math.min(VH*.11,58);
function tButtons(){
  const R=T_R(),car=!!(typeof P!=='undefined'&&P.car);
  return [
    {id:'a',x:VW-R*1.9,y:VH-R*1.9,r:R*1.15,label:car?'РУЧНИК':'ОГОНЬ',col:car?'#e0a030':'#e23030'},
    {id:'b',x:VW-R*4.4,y:VH-R*1.2,r:R*.8,label:car?'ВЫХОД':'ВХОД',col:'#4a7ae0'},
    {id:'c',x:VW-R*3.3,y:VH-R*3.3,r:R*.7,label:car?'ГУДОК':'ОРУЖИЕ',col:'#3a9a48'},
    {id:'d',x:VW-R*1.5,y:VH-R*4.2,r:R*.55,label:fpv?'3-е':'1-е',col:'#8a5ac8'}
  ];
}
function pressBtn(id,down){
  if(id==='a'){
    if(P.car)keys.Space=down;else{mouse.down=down;if(down)mouse.click=true;}
    if(!down){keys.Space=false;mouse.down=false;}
  }else if(id==='b'){if(down)pressed.KeyF=true;}
  else if(id==='d'){if(down)pressed.KeyC=true;}
  else if(id==='c'){if(down){if(P.car)pressed.KeyH=true;else pressed.KeyE=true;}}
}
function stickKeys(){
  const s=TOUCH.stick,R=Math.min(VH*.16,80);
  let vx=0,vy=0;
  if(s){vx=(s.x-s.ox)/R;vy=(s.y-s.oy)/R;const m=Math.hypot(vx,vy);if(m>1){vx/=m;vy/=m;}s.vx=vx;s.vy=vy;}
  const dz=.28;
  keys.KeyW=vy<-dz;keys.KeyS=vy>dz;keys.KeyA=vx<-dz;keys.KeyD=vx>dz;
  keys.ShiftLeft=Math.hypot(vx,vy)>.92;
}
function tStart(e){
  TOUCH.on=true;e.preventDefault();
  for(const t of e.changedTouches){
    const x=t.clientX,y=t.clientY;
    if(state==='title'||over){pressed.Enter=true;continue;}
    let hit=null;
    for(const b of tButtons())if(Math.hypot(x-b.x,y-b.y)<b.r*1.15){hit=b;break;}
    if(hit){TOUCH.held[t.identifier]=hit.id;pressBtn(hit.id,true);continue;}
    if(x<VW*.5&&!TOUCH.stick)TOUCH.stick={id:t.identifier,ox:x,oy:y,x,y,vx:0,vy:0};
    else if(!TOUCH.look)TOUCH.look={id:t.identifier,lx:x,ly:y};
  }
  stickKeys();
}
function tMove(e){
  e.preventDefault();
  for(const t of e.changedTouches){
    const s=TOUCH.stick,l=TOUCH.look;
    if(s&&t.identifier===s.id){s.x=t.clientX;s.y=t.clientY;}
    else if(l&&t.identifier===l.id){const dx=t.clientX-l.lx,dy=t.clientY-l.ly;l.lx=t.clientX;l.ly=t.clientY;camYaw+=dx*.0065;camPitch=clamp(camPitch-dy*.0055,-1.05,1.2);lookIdle=0;}
  }
  stickKeys();
}
function tEnd(e){
  e.preventDefault();
  for(const t of e.changedTouches){
    if(TOUCH.stick&&t.identifier===TOUCH.stick.id)TOUCH.stick=null;
    if(TOUCH.look&&t.identifier===TOUCH.look.id)TOUCH.look=null;
    if(TOUCH.held[t.identifier]){pressBtn(TOUCH.held[t.identifier],false);delete TOUCH.held[t.identifier];}
  }
  stickKeys();
}
const tOpt={passive:false};
document.addEventListener('touchstart',tStart,tOpt);
document.addEventListener('touchmove',tMove,tOpt);
document.addEventListener('touchend',tEnd,tOpt);
document.addEventListener('touchcancel',tEnd,tOpt);
document.addEventListener('contextmenu',e=>e.preventDefault());

function drawTouch(){
  if(!TOUCH.on)return;
  const g=ctx,R=T_R(),sr=Math.min(VH*.16,80);
  const s=TOUCH.stick,ox=s?s.ox:VW*.14,oy=s?s.oy:VH*.72;
  g.lineWidth=3;g.strokeStyle=`rgba(255,255,255,${s?.55:.25})`;g.fillStyle=`rgba(255,255,255,${s?.12:.06})`;
  g.beginPath();g.arc(ox,oy,sr,0,7);g.fill();g.stroke();
  g.fillStyle=`rgba(255,255,255,${s?.55:.22})`;g.beginPath();g.arc(ox+(s?s.vx*sr:0),oy+(s?s.vy*sr:0),sr*.38,0,7);g.fill();
  const held=Object.values(TOUCH.held);
  for(const b of tButtons()){
    const on=held.includes(b.id);
    g.fillStyle=b.col;g.globalAlpha=on?.8:.42;g.beginPath();g.arc(b.x,b.y,b.r,0,7);g.fill();
    g.globalAlpha=.85;g.lineWidth=3;g.strokeStyle='#fff';g.stroke();g.globalAlpha=1;
    g.font=`${Math.max(11,b.r*.4)}px ${FONT}`;g.textAlign='center';g.textBaseline='middle';g.fillStyle='#fff';
    g.fillText(b.label,b.x,b.y);g.textBaseline='alphabetic';
  }
}
