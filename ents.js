'use strict';
// ===== Сущности =====
const cars=[],peds=[],bullets=[],parts=[],picks=[];
let shake=0,boomLight=0,boomX=0,boomY=0;
const P={x:0,y:0,a:0,hp:100,armor:0,car:null,w:0,ammo:[Infinity,90,5],money:0,lives:5,heat:0,cd:0,dead:0,moved:0};
const WEAPONS=[
  {n:'ПИСТОЛЕТ',rate:18,dmg:25,spd:14,auto:false,snd:'shot'},
  {n:'ПИСТОЛЕТ-ПУЛЕМЁТ',rate:5,dmg:12,spd:15,auto:true,snd:'smg'},
  {n:'РАКЕТНИЦА',rate:55,dmg:0,spd:8,auto:false,snd:'rocket',rocket:true}
];
const CT={
  sedan:{name:'ЖИГУЛИ ВАЗ-2101',len:42,wid:20,hp:90,acc:.15,max:6.8,grip:.82,mass:1,cols:['#d8c9a0','#a8321e','#e8e4d8','#3f7a6a','#d0a43a','#5a7ea8']},
  sport:{name:'ЛАДА ВАЗ-2112',len:43,wid:20,hp:85,acc:.22,max:9,grip:.85,mass:1,cols:['#e8e8e8','#9aa0a6','#233a6a','#7a1f2a']},
  moskvich:{name:'МОСКВИЧ-412',len:44,wid:20.5,hp:95,acc:.15,max:6.9,grip:.82,mass:1,cols:['#7fb0c8','#e0d4a8','#8a2a30','#c9c4b0']},
  volga:{name:'ВОЛГА ГАЗ-24',len:50,wid:23,hp:125,acc:.15,max:7.3,grip:.82,mass:1.25,cols:['#15171a','#e8e8e0','#c9d8c0','#6a1c24']},
  chaika:{name:'ЧАЙКА ГАЗ-13',len:57,wid:25,hp:190,acc:.14,max:7.8,grip:.8,mass:1.9,cols:['#14161a']},
  van:{name:'УАЗ-452 «БУХАНКА»',len:46,wid:22,hp:140,acc:.12,max:5.6,grip:.8,mass:1.5,cols:['#4f6b3a','#d86a1e','#c8c2a8']},
  taxi:{name:'ТАКСИ ВОЛГА',len:50,wid:23,hp:125,acc:.15,max:7.3,grip:.82,mass:1.25,cols:['#e8b81c']},
  cop:{name:'МИЛИЦИЯ ВАЗ-2106',len:43,wid:20,hp:130,acc:.22,max:8.6,grip:.85,mass:1.1,cols:['#eceae2']}
};
let CID=0;
class Car{
  constructor(type,x,y,a){
    const t=CT[type];
    Object.assign(this,{id:++CID,braking:false,siren:false,type,t,x,y,a,vx:0,vy:0,hp:t.hp,col:pick(t.cols),len:t.len,wid:t.wid,ai:null,dead:false,burn:0,fire:0,dir:0,stuck:0,off:0,lastInter:-1,flash:rnd(0,6),blocked:0,rev:0});
    this.roof=shade(this.col,1.18);
  }
  get speed(){return Math.hypot(this.vx,this.vy);}
  drive(thr,str,brake,hb){
    const t=this.t;let fx=Math.cos(this.a),fy=Math.sin(this.a);
    let vf=this.vx*fx+this.vy*fy,vl=-this.vx*fy+this.vy*fx;
    if(thr>0){if(vf<t.max)vf+=t.acc*thr;}
    else if(thr<0){vf+=vf>.3?-t.acc*1.7:-t.acc*.6;if(vf<-t.max*.45)vf=-t.max*.45;}
    this.braking=!!brake||(thr<0&&vf>.3);
    if(brake)vf*=.9;
    vf*=.985;vl*=hb?.965:t.grip;
    const sp=clamp(Math.abs(vf)/3,0,1);
    this.a+=str*.055*sp*(vf<0?-1:1)*(hb?1.5:1);
    fx=Math.cos(this.a);fy=Math.sin(this.a);
    this.vx=fx*vf-fy*vl;this.vy=fy*vf+fx*vl;
  }
  circles(){
    const fx=Math.cos(this.a),fy=Math.sin(this.a),o=this.len*.3,r=this.wid/2+1;
    return [[this.x+fx*o,this.y+fy*o,r],[this.x,this.y,r],[this.x-fx*o,this.y-fy*o,r]];
  }
  damage(n,by){
    if(this.dead||n<=0)return;
    this.hp-=n;
    if(this.type==='cop'&&by==='player'){crime('copcar',this.x,this.y,.6,1.2);}
    if(this.hp<=0&&!this.burn){this.burn=170;if(this.type==='cop'&&by==='player')crime('copdead',this.x,this.y,.8,1.5);}
  }
}
class Ped{
  constructor(x,y,kind){
    Object.assign(this,{x,y,kind:kind||'civ',a:rnd(0,6.28),hp:kind==='cop'?60:20,col:pick(['#c0392b','#2e86c1','#d4ac0d','#7d3c98','#1e8449','#e67e22','#aab7b8','#ecf0f1']),flee:0,t:ri(60,300),dead:false,cd:ri(30,90),step:rnd(0,6)});
    this.skin=pick(['#e0b090','#c68a60','#8d5a3b','#f0cfa8']);
  }
}
function part(x,y,vx,vy,life,size,col,kind){parts.push({x,y,vx,vy,l:life,m:life,s:size,c:col,k:kind});}
function killPed(p,by){
  if(p.dead)return;p.dead=true;blood(p.x,p.y);snd('hit');
  if(by==='player'){crime(p.kind==='cop'?'killcop':'kill',p.x,p.y,p.kind==='cop'?1.2:.5,p.kind==='cop'?2:1);if(p.kind==='civ'){P.money+=ri(5,25);}}
  if(Math.random()<.35)picks.push({x:p.x,y:p.y,type:'cash',v:ri(20,120),t:1800});
}
function hurtPlayer(n){
  if(P.dead||P.car)return;
  if(P.armor>0){const a=Math.min(P.armor,n);P.armor-=a;n-=a;}
  P.hp-=n;snd('hit');shake=Math.max(shake,4);
}
function explode(x,y,r,dmg,by){
  snd('boom');shake=Math.max(shake,16);boomLight=1;boomX=x;boomY=y;scorch(x,y,r*.9);
  for(let i=0;i<26;i++){const a=rnd(0,6.28),s=rnd(.4,4);part(x,y,Math.cos(a)*s,Math.sin(a)*s,rnd(25,55),rnd(10,22),'255,150,40','f');}
  for(let i=0;i<12;i++){const a=rnd(0,6.28),s=rnd(.3,2);part(x,y,Math.cos(a)*s,Math.sin(a)*s,rnd(50,90),rnd(14,26),'40,40,40','s');}
  for(let i=0;i<10;i++){const a=rnd(0,6.28),s=rnd(3,8);part(x,y,Math.cos(a)*s,Math.sin(a)*s,rnd(15,30),2,'255,220,120','k');}
  for(const c of cars){
    const d=Math.hypot(c.x-x,c.y-y);
    if(d<r+24){const f=1-d/(r+24),a=Math.atan2(c.y-y,c.x-x);c.damage(dmg*f,by);if(!c.dead){c.vx+=Math.cos(a)*5*f;c.vy+=Math.sin(a)*5*f;}}
  }
  for(const p of peds)if(!p.dead&&Math.hypot(p.x-x,p.y-y)<r)killPed(p,by);
  if(typeof heliHit==='function')heliHit(x,y,r,by);
  if(!P.car&&!P.dead){const d=Math.hypot(P.x-x,P.y-y);if(d<r)hurtPlayer(dmg*(1-d/r)*.8);}
}
// ===== Отрисовка сущностей =====
function drawCar(c){
  const g=ctx;g.save();g.translate(c.x,c.y);g.rotate(c.a);
  const L=c.len,W=c.wid;
  g.fillStyle='rgba(0,0,0,.3)';rr(-L/2+3,-W/2+4,L,W,6);g.fill();
  if(c.dead){
    g.fillStyle='#1f1b17';rr(-L/2,-W/2,L,W,5);g.fill();
    g.fillStyle='#2e2823';rr(-L*.22,-W/2+3,L*.42,W-6,3);g.fill();
    g.restore();return;
  }
  g.fillStyle=c.col;rr(-L/2,-W/2,L,W,5);g.fill();
  g.strokeStyle='rgba(0,0,0,.45)';g.lineWidth=1.5;g.stroke();
  if(c.type==='van'){g.fillStyle='rgba(0,0,0,.12)';g.fillRect(-L/2+3,-W/2+3,L*.5,W-6);}
  g.fillStyle=c.roof;rr(-L*.22,-W/2+3,L*.42,W-6,4);g.fill();
  g.fillStyle='#16222e';rr(L*.2,-W/2+3,L*.12,W-6,2);g.fill();
  g.fillStyle='#1c2a37';rr(-L*.38,-W/2+3.5,L*.1,W-7,2);g.fill();
  g.fillStyle='#ffe9a0';g.fillRect(L/2-3,-W/2+2,3,4);g.fillRect(L/2-3,W/2-6,3,4);
  g.fillStyle='#b01818';g.fillRect(-L/2,-W/2+2,2.5,4);g.fillRect(-L/2,W/2-6,2.5,4);
  if(c.type==='cop'){
    g.fillStyle='#1a3a8a';g.fillRect(-L*.45,-1.5,L*.9,3);
    const f=(Math.floor((c.flash)/4)%2===0);
    g.fillStyle=f?'#ff2a2a':'#2a5aff';g.fillRect(-3,-W/2+3,5,W/2-3);
    g.fillStyle=f?'#2a5aff':'#ff2a2a';g.fillRect(-3,0,5,W/2-3);
  }
  if(c.type==='taxi'){g.fillStyle='#222';g.fillRect(-4,-4,8,8);g.fillStyle='#fff';g.fillRect(-2,-2,4,4);}
  if(c.burn){g.fillStyle='rgba(0,0,0,.4)';rr(-L/2,-W/2,L,W,5);g.fill();}
  g.restore();
}
function drawPed(p){
  const g=ctx;g.save();g.translate(p.x,p.y);g.rotate(p.a);
  g.fillStyle='rgba(0,0,0,.28)';g.beginPath();g.ellipse(2,3,6,5,0,0,7);g.fill();
  const sw=Math.sin(p.step)*2.5;
  g.fillStyle=p.kind==='cop'?'#1a2f6a':p.col;
  g.beginPath();g.ellipse(0,0,4.5,6.5,0,0,7);g.fill();
  g.fillStyle=p.skin;g.fillRect(sw-1,-6.5,3,2.5);g.fillRect(-sw-1,4,3,2.5);
  g.beginPath();g.arc(0,0,3.3,0,7);g.fill();
  g.fillStyle=p.kind==='cop'?'#0b1740':'#2a1c10';g.beginPath();g.arc(-.5,0,2.6,0,7);g.fill();
  if(p.kind==='cop'){g.fillStyle='#222';g.fillRect(3,3,8,2.5);}
  g.restore();
}
function drawPlayer(){
  const g=ctx;g.save();g.translate(P.x,P.y);g.rotate(P.a);
  g.fillStyle='rgba(0,0,0,.3)';g.beginPath();g.ellipse(2,3,7,6,0,0,7);g.fill();
  g.fillStyle='#e8d040';g.beginPath();g.ellipse(0,0,5,7.5,0,0,7);g.fill();
  g.fillStyle='#e0b090';g.fillRect(Math.sin(P.moved)*2.5-1,-7,3,3);g.fillRect(-Math.sin(P.moved)*2.5-1,4,3,3);
  g.beginPath();g.arc(0,0,3.6,0,7);g.fill();
  g.fillStyle='#2a1c10';g.beginPath();g.arc(-.5,0,2.9,0,7);g.fill();
  g.fillStyle='#222';g.fillRect(3,3,P.w===0?7:10,2.5);
  g.restore();
}
function drawPick(k,tm){
  const g=ctx,b=Math.sin(tm/18+k.x)*1.5;
  g.save();g.translate(k.x,k.y+b);
  g.fillStyle='rgba(0,0,0,.25)';g.beginPath();g.ellipse(2,8,8,4,0,0,7);g.fill();
  if(k.type==='cash'){g.fillStyle='#3a9a48';g.fillRect(-8,-5,16,10);g.fillStyle='#bfe8b0';g.font='bold 10px sans-serif';g.textAlign='center';g.fillText('$',0,4);}
  else if(k.type==='ammo'){g.fillStyle='#c9a227';g.fillRect(-7,-6,14,12);g.fillStyle='#3a2a08';g.fillRect(-4,-2,8,4);}
  else if(k.type==='hp'){g.fillStyle='#e8e8e8';g.fillRect(-7,-7,14,14);g.fillStyle='#d02828';g.fillRect(-2,-5,4,10);g.fillRect(-5,-2,10,4);}
  else{g.fillStyle='#2a5ac0';g.fillRect(-7,-7,14,14);g.fillStyle='#cfe0ff';g.fillRect(-3,-4,6,8);}
  g.restore();
}
