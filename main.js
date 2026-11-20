'use strict';
// ===== Игрок, цикл, запуск =====
function resetPlayer(full){
  Object.assign(P,{x:START.x,y:START.y,a:0,hp:100,armor:0,car:null,heat:0,dead:0,cd:0,w:0,ammo:[Infinity,full?90:30,full?5:0]});
  for(let i=cars.length-1;i>=0;i--)if(cars[i].ai==='cop')cars.splice(i,1);
  for(let i=peds.length-1;i>=0;i--)if(peds[i].kind==='cop')peds.splice(i,1);
  bullets.length=0;
}
function newGame(){
  cars.length=peds.length=bullets.length=parts.length=picks.length=0;
  cam3.far=LITE?2500:3600;cam3.updateProjectionMatrix();genMap();renderMap();build3D();camYaw=0;camPitch=-.32;P.money=0;P.lives=5;over=false;resetPlayer(true);
  const c=new Car('sport',START.x+46,START.y+4,0);cars.push(c);
  for(let i=0;i<(LITE?24:40);i++){spawnTraffic();}
  for(let i=0;i<(LITE?34:60);i++)spawnPed();
  for(let i=0;i<24;i++)spawnPick();
  cam.x=P.x;cam.y=P.y;
}
const heliAlive=()=>typeof heli!=='undefined'&&!!heli;
function killPlayer(){
  if(P.dead)return;
  P.dead=170;P.lives--;blood(P.x,P.y);snd('hit');
  if(P.car){P.car.ai=null;P.car=null;}
}
function toggleCar(){
  if(P.car){
    const c=P.car;if(c.speed>4)return;
    for(const sg of [1,-1]){
      const x=c.x+Math.cos(c.a-1.5708)*sg*(c.wid/2+12),y=c.y+Math.sin(c.a-1.5708)*sg*(c.wid/2+12);
      if(!solidAt(x,y)){P.x=x;P.y=y;break;}
    }
    c.ai=null;P.car=null;camYaw=c.a;return;
  }
  let best=null,bd=1e9;
  for(const c of cars){if(c.dead||c.burn)continue;const d=Math.hypot(c.x-P.x,c.y-P.y);if(d<c.len/2+30&&d<bd){best=c;bd=d;}}
  if(!best)return;
  if(best.ai&&best.speed>4.5){pushMsg('Машина едет слишком быстро','#ffcf5a');return;}
  if(best.ai){ // водитель выходит: 35% — замирает на секунду-другую, остальные сразу бегут
    const dr=new Ped(best.x+Math.cos(best.a+1.57)*(best.wid/2+10),best.y+Math.sin(best.a+1.57)*(best.wid/2+10),'civ');
    if(Math.random()<.35){dr.cow=70;dr.flee=0;}else dr.flee=200;
    dr.a=best.a+1.57;peds.push(dr);
    crime(best.type==='cop'?'copcar':'theft',best.x,best.y,best.type==='cop'?1.2:.4,best.type==='cop'?2:1);
  }
  best.ai=null;P.car=best;best.vx*=.3;best.vy*=.3;camYaw=best.a;
}
function playerUpdate(){
  if(over){if(pressed.Enter)newGame();return;}
  if(P.busted>0){P.busted--;if(P.busted===0)finishArrest();return;}
  if(P.dead>0){
    P.dead--;
    if(P.dead===0){if(P.lives<=0)over=true;else resetPlayer(false);}
    return;
  }
  if(P.hp<=0){killPlayer();return;}
  if(pressed.Digit1)P.w=0;
  if(pressed.Digit2&&P.ammo[1]>0)P.w=1;
  if(pressed.Digit3&&P.ammo[2]>0)P.w=2;
  if(pressed.KeyQ||pressed.KeyE){
    const d=pressed.KeyE?1:2;
    for(let i=1;i<=3;i++){const n=(P.w+d*i)%3;if(n===0||P.ammo[n]>0){P.w=n;break;}}
  }
  if(P.ammo[P.w]<=0)P.w=0;
  P.cd--;
  const up=keys.ArrowUp||keys.KeyW,dn=keys.ArrowDown||keys.KeyS,lf=keys.ArrowLeft||keys.KeyA,rt=keys.ArrowRight||keys.KeyD;
  if(P.car){
    const c=P.car;
    c.drive(up?1:dn?-1:0,(rt?1:0)-(lf?1:0),false,keys.Space);
    if(pressed.KeyH)snd('honk');
  }else{
    const ay=((keys.ArrowRight?1:0)-(keys.ArrowLeft?1:0)),ap=((keys.ArrowUp&&keys.ShiftLeft?1:0));
    if(ay){camYaw+=ay*.05;lookIdle=0;}
    const fw=((keys.KeyW||keys.ArrowUp)?1:0)-((keys.KeyS||keys.ArrowDown)?1:0),st=(keys.KeyD?1:0)-(keys.KeyA?1:0);
    let dx=Math.cos(camYaw)*fw+Math.cos(camYaw+1.5708)*st,dy=Math.sin(camYaw)*fw+Math.sin(camYaw+1.5708)*st;
    const m=Math.hypot(dx,dy),spd=(keys.ShiftLeft||keys.ShiftRight)?3.6:2.1;
    P.moving=!!m;P.fast=!!(m&&(keys.ShiftLeft||keys.ShiftRight));
    const firing=P.cd>0;
    if(m||firing)P.a+=angDiff(P.a,camYaw)*.3;
    else{const dd=angDiff(P.a,camYaw);if(Math.abs(dd)>1.9)P.a=camYaw-Math.sign(dd)*1.9;}
    if(m){dx/=m;dy/=m;P.x+=dx*spd;P.y+=dy*spd;P.moved+=spd*.14;}
    const push=circleTilePush(P.x,P.y,6);if(push){P.x+=push.x;P.y+=push.y;}
    P.x=clamp(P.x,10,WW-10);P.y=clamp(P.y,10,WH-10);
    const W=WEAPONS[P.w];
    const want=W.auto?(keys.Space||mouse.down):(pressed.Space||mouse.click);
    if(want&&P.cd<=0&&P.ammo[P.w]>0){
      P.a=camYaw;P.cd=W.rate;P.ammo[P.w]--;snd(W.snd);crime('shoot',P.x,P.y,.15,1);
      fireBullet(P.x+Math.cos(P.a)*11,P.y+Math.sin(P.a)*11,P.a+(W.auto?rnd(-.05,.05):0),P.w,'player');
      alertPeds(P.x,P.y,320);shake=Math.max(shake,W.rocket?5:1);
      part(P.x+Math.cos(P.a)*13,P.y+Math.sin(P.a)*13,Math.cos(P.a)*2,Math.sin(P.a)*2,6,2,'255,220,120','k');
    }
  }
  if(pressed.KeyF||pressed.Enter)toggleCar();
}
function updatePicks(){
  const ref=P.car||P,r=P.car?32:20;
  for(let i=picks.length-1;i>=0;i--){
    const k=picks[i];k.t--;
    const d=Math.hypot(k.x-ref.x,k.y-ref.y);
    if(!P.dead&&d<r){
      if(k.type==='cash')P.money+=k.v;
      else if(k.type==='ammo'){P.ammo[1]+=40;P.ammo[2]+=2;}
      else if(k.type==='hp')P.hp=Math.min(100,P.hp+50);
      else P.armor=100;
      snd('pickup');picks.splice(i,1);
    }else if(k.t<=0||d>2200)picks.splice(i,1);
  }
}
function manage(){
  const far=minSpawn()+500,L=Math.min(5,Math.floor(P.heat));
  let traffic=0,cops=0,civ=0,fcops=0;
  for(let i=cars.length-1;i>=0;i--){
    const c=cars[i];if(c===P.car)continue;
    const d=Math.hypot(c.x-P.x,c.y-P.y),off=d>minSpawn();
    if(c.ai==='traffic')traffic++;if(c.ai==='cop'&&!c.dead)cops++;
    if((c.ai!=='cop'&&d>1800)||(c.ai==='traffic'&&c.off>=9999&&off)||(c.ai==='cop'&&off&&(L===0||d>1500))||(c.dead&&c.fire<=0&&off&&d>900))cars.splice(i,1);
  }
  for(let i=peds.length-1;i>=0;i--){
    const p=peds[i],d=Math.hypot(p.x-P.x,p.y-P.y);
    if(p.dead||d>1800||(p.kind==='cop'&&L===0&&d>minSpawn())){peds.splice(i,1);continue;}
    if(p.kind==='civ')civ++;else fcops++;
  }
  if(traffic<(LITE?20:30))spawnTraffic();
  if(L===0&&copCars().length<2){spawnCop();const k=cars[cars.length-1];if(k&&k.type==='cop'){k.ai='traffic';}}
  if(civ<(LITE?32:55))spawnPed();
  if(picks.length<24)spawnPick();
  if(L>0&&cops<Math.min(L+1,5))spawnCop();
  if(L>=2&&!P.car&&fcops<Math.min(L,4))spawnPed('cop');
  // затухание розыска
  if(P.heat>0){
    if(!P.seen&&!heliAlive())P.heat=Math.max(0,P.heat-.0013*20);
    P.heat=Math.min(5.99,P.heat);
  }
}
function step(playing){
  tm++;
  if(playing&&mouse.click&&!MOBILE&&!document.pointerLockElement){try{const r=GLC.requestPointerLock();if(r&&r.catch)r.catch(()=>{});}catch(e){}}
  if(playing)playerUpdate();
  for(const c of cars)updateCar(c,tm);
  carCars();
  if(P.car){P.x=P.car.x;P.y=P.car.y;P.a=P.car.a;}
  trafficUpdate();updatePeds();playerCarHit();policeUpdate();updateBullets(tm);updateParts();
  if(playing)updatePicks();
  if(tm%20===0)manage();
  const lead=P.car?12:0,tx=P.x+(P.car?P.car.vx*lead:0),ty=P.y+(P.car?P.car.vy*lead:0);
  cam.x+=(tx-cam.x)*.1;cam.y+=(ty-cam.y)*.1;
  shake*=.9;if(shake<.2)shake=0;
  for(const k in pressed)delete pressed[k];
  if(pressed.KeyC||pressed.KeyV)fpv=!fpv;
  mouse.click=false;
}
let last=0,acc=0;
function frame(now){
  acc+=Math.min(100,now-last);last=now;
  while(acc>=16.667){
    if(state==='title'&&(Object.keys(pressed).length||mouse.click)){state='play';for(const k in pressed)delete pressed[k];mouse.click=false;snd('pickup');}
    step(state==='play');acc-=16.667;
  }
  draw3D();ctx.clearRect(0,0,VW,VH);
  if(state==='play'){drawHUD();drawTouch();}
  drawOverlays();
  requestAnimationFrame(frame);
}
function boot(){buildGroundTextures();newGame();last=performance.now();requestAnimationFrame(frame);}
ctx.fillStyle='#0d0f0d';ctx.fillRect(0,0,VW,VH);txt('Строим город…',VW/2,VH/2,34,'#f2d03a','center');
setTimeout(boot,80);
