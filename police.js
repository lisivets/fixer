'use strict';
// ===== Полиция: свидетели, розыск, погоня, поиск, блокпосты, спецотряд, вертолёт, задержание =====
const MSGS=[];
function pushMsg(t,col){MSGS.push({t:260,text:t,col:col||'#fff'});if(MSGS.length>5)MSGS.shift();}
let calls=[],heli=null,heliCool=0,riotCool=0,blockCool=0,arrestT=0,searching=false;
P.seen=false;P.lastX=0;P.lastY=0;P.busted=0;P.moving=false;P.fast=false;
const copCars=()=>cars.filter(c=>c.type==='cop'&&!c.dead&&!c.burn);
function los(x1,y1,x2,y2){const d=Math.hypot(x2-x1,y2-y1),n=Math.ceil(d/14);for(let i=1;i<n;i++){const t=i/n;if(solidAt(x1+(x2-x1)*t,y1+(y2-y1)*t))return false;}return true;}
// преступление: kind, место, тяжесть, минимальный розыск
function crime(kind,x,y,sev,minH){
  if(P.dead||P.busted>0)return;
  minH=minH||1;
  let copSaw=false;
  for(const c of copCars())if(Math.hypot(c.x-x,c.y-y)<480&&los(c.x,c.y,x,y)){copSaw=true;break;}
  if(!copSaw)for(const p of peds)if(p.kind==='cop'&&!p.dead&&Math.hypot(p.x-x,p.y-y)<420&&los(p.x,p.y,x,y)){copSaw=true;break;}
  if(heli)copSaw=true;
  if(copSaw){
    const was=P.heat;P.heat=Math.max(P.heat+sev,minH);P.lastX=P.x;P.lastY=P.y;P.seen=true;
    if(was<1)pushMsg('Полиция заметила преступление!','#ff6a5a');
    return;
  }
  // свидетели-горожане звонят в полицию
  let w=0;
  for(const p of peds)if(p.kind==='civ'&&!p.dead&&Math.hypot(p.x-x,p.y-y)<280&&los(p.x,p.y,x,y)){
    w++;if(p.flee<=0){p.flee=200;p.a=Math.atan2(p.y-y,p.x-x)+rnd(-.5,.5);}
    if(w>=2)break;
  }
  if(w&&sev>=.3&&calls.length<5)calls.push({t:ri(150,260),x,y,sev,min:minH});
}
function policeUpdate(){
  if(P.busted>0)return;
  const L=Math.floor(P.heat);
  // звонки свидетелей
  for(let i=calls.length-1;i>=0;i--){
    const c=calls[i];c.t--;
    if(c.t<=0){
      calls.splice(i,1);
      if(P.heat<1)pushMsg('Свидетель вызвал полицию','#ffcf5a');
      P.heat=Math.max(P.heat+c.sev*.6,c.min);P.lastX=c.x;P.lastY=c.y;
      // ближайшая патрульная едет на место
      let b=null,bd=1e9;for(const k of copCars()){const d=Math.hypot(k.x-c.x,k.y-c.y);if(d<bd){bd=d;b=k;}}
      if(b)b.ai='cop';
    }
  }
  // видимость игрока полицией
  if(tm%6===0){
    let seen=false;const tgt=P.car||P;
    if(heli&&Math.hypot(heli.x-P.x,heli.y-P.y)<900)seen=true;
    if(!seen)for(const c of copCars())if(Math.hypot(c.x-tgt.x,c.y-tgt.y)<520&&los(c.x,c.y,tgt.x,tgt.y)){seen=true;break;}
    if(!seen)for(const p of peds)if(p.kind==='cop'&&!p.dead&&Math.hypot(p.x-tgt.x,p.y-tgt.y)<460&&los(p.x,p.y,tgt.x,tgt.y)){seen=true;break;}
    P.seen=seen;if(seen){P.lastX=tgt.x;P.lastY=tgt.y;}
  }
  searching=P.heat>=1&&!P.seen;
  // сирены / режимы патруля
  for(const c of cars){
    if(c.type!=='cop')continue;
    if(P.heat<1&&c.ai==='cop'){c.ai='traffic';}
    if(P.heat<1&&c.ai==='block'){c.ai='traffic';}
    c.siren=(c.ai==='cop'||c.ai==='block')&&!c.dead;
    // патруль замечает розыск: переключение в погоню
    if(P.heat>=1&&c.ai==='traffic'&&P.seen&&Math.hypot(c.x-P.x,c.y-P.y)<520)c.ai='cop';
  }
  // спецотряд
  riotCool--;
  if(L>=4&&riotCool<=0&&!cars.some(c=>c.riot)){
    const s=laneSpawn(12);
    if(s){const c=new Car('van',s.x,s.y,s.a);c.col='#2c3a2a';c.roof='#33442f';c.ai='cop';c.riot=4;c.siren=true;cars.push(c);pushMsg('Выезжает спецотряд!','#ff6a5a');}
    riotCool=900;
  }
  for(const c of cars)if(c.riot&&!c.dead){
    const d=Math.hypot(c.x-P.x,c.y-P.y);
    if(d<200&&c.speed<5.5&&los(c.x,c.y,P.x,P.y)){
      for(let i=0;i<c.riot;i++){const p=new Ped(c.x+Math.cos(c.a+1.57)*(c.wid/2+8)+rnd(-8,8),c.y+Math.sin(c.a+1.57)*(c.wid/2+8)+rnd(-8,8),'cop');p.riot=true;p.hp=90;peds.push(p);}
      c.riot=0;pushMsg('Спецотряд высаживается!','#ff6a5a');
    }
  }
  // блокпосты
  blockCool--;
  if(L>=3&&blockCool<=0&&!cars.some(c=>c.ai==='block')){
    const ref=P.car||P,hd=P.car?Math.atan2(P.car.vy,P.car.vx):P.a;
    if(!P.car||P.car.speed>2){
      for(let k=0;k<10;k++){
        const a=hd+rnd(-.5,.5),d=rnd(560,760),x=ref.x+Math.cos(a)*d,y=ref.y+Math.sin(a)*d;
        if(tileAt(Math.floor(x/TS),Math.floor(y/TS))!==0)continue;
        const ang=hd+Math.PI/2;
        for(const o of [-1,1]){
          const c=new Car('cop',x+Math.cos(ang)*o*24,y+Math.sin(ang)*o*24,ang+o*.25);c.ai='block';c.siren=true;cars.push(c);
          const p=new Ped(x+Math.cos(hd)*34+Math.cos(ang)*o*10,y+Math.sin(hd)*34+Math.sin(ang)*o*10,'cop');p.hold=true;peds.push(p);
        }
        pushMsg('Впереди блокпост!','#ffcf5a');break;
      }
    }
    blockCool=1200;
  }
  // вертолёт
  heliCool--;
  if(L>=5&&!heli&&heliCool<=0){heli={x:P.x+700,y:P.y+700,a:0,hp:220,rot:0,t:0,cd:60,z:150};pushMsg('Вертолёт в воздухе!','#ff6a5a');}
  if(heli){
    heli.t++;heli.rot+=.8;
    const dx=P.x-heli.x,dy=P.y-heli.y,d=Math.hypot(dx,dy),want=Math.atan2(dy,dx)+(d<220?1.4:0);
    heli.a+=angDiff(heli.a,want)*.04;
    const sp=d>260?3.4:2.2;heli.x+=Math.cos(heli.a)*sp;heli.y+=Math.sin(heli.a)*sp;
    heli.cd--;
    if(heli.cd<=0&&d<420&&!P.dead){heli.cd=ri(30,50);const a=Math.atan2(P.y-heli.y,P.x-heli.x)+rnd(-.18,.18);bullets.push({x:heli.x,y:heli.y,vx:Math.cos(a)*11,vy:Math.sin(a)*11,l:46,dmg:6,owner:'cop',rocket:false,air:1});snd('smg');}
    for(const b of bullets)if(b.owner==='player'&&!b.dead&&Math.hypot(b.x-heli.x,b.y-heli.y)<22&&!b.rocket){heli.hp-=b.dmg*.35;b.dead=true;}
    if(heli.hp<=0){explode(heli.x,heli.y,60,50,'player');pushMsg('Вертолёт сбит!','#7ae07a');heli=null;heliCool=1500;P.heat=Math.max(P.heat,4.2);}
  }
  if(L<5&&heli&&P.heat<1){heli=null;}
  arrest();
  sirens();
}
function heliHit(x,y,r,by){if(heli&&by==='player'&&Math.hypot(heli.x-x,heli.y-y)<r+30)heli.hp-=140;}
// задержание
function arrest(){
  if(P.heat<1||P.dead)return;
  const tgt=P.car||P;let near=0;
  for(const p of peds)if(p.kind==='cop'&&!p.dead&&Math.hypot(p.x-tgt.x,p.y-tgt.y)<(P.car?P.car.wid+8:22))near++;
  const slow=!P.car||P.car.speed<1.2;
  if(near>=1&&slow)arrestT+=near>=2?1.6:1;else arrestT=Math.max(0,arrestT-2);
  if(arrestT>150){
    arrestT=0;P.busted=200;
    const lost=Math.floor(P.money*.5);P.money-=lost;
    pushMsg('Вас задержали. Штраф и конфискация оружия: -'+lost+' $','#7ab0ff');
    if(P.car){const c=P.car;P.car=null;c.ai=null;const i=cars.indexOf(c);if(i>=0)cars.splice(i,1);}
  }
}
function finishArrest(){
  resetPlayer(false);P.ammo[1]=Math.min(P.ammo[1],0);P.ammo[2]=0;P.w=0;
  for(let i=peds.length-1;i>=0;i--)if(peds[i].kind==='cop')peds.splice(i,1);
  for(const c of cars)if(c.type==='cop'){c.ai='traffic';c.siren=false;}
  calls=[];heli=null;P.heat=0;P.seen=false;camYaw=-1.57;
}
// сирены (WebAudio)
let sirO=null,sirG=null;
function sirens(){
  if(!AC)return;
  try{
    if(!sirO){sirO=AC.createOscillator();sirG=AC.createGain();sirO.type='sawtooth';const f=AC.createBiquadFilter();f.type='lowpass';f.frequency.value=1800;sirG.gain.value=0;sirO.connect(f).connect(sirG).connect(AC.destination);sirO.start();}
    let nd=1e9;for(const c of cars)if(c.siren){const d=Math.hypot(c.x-P.x,c.y-P.y);if(d<nd)nd=d;}
    if(heli){const d=Math.hypot(heli.x-P.x,heli.y-P.y);if(d<nd)nd=d;}
    const vol=clamp(1-nd/1100,0,1);
    sirG.gain.value=vol*vol*.06;
    sirO.frequency.value=(tm%120<60)?700+Math.sin((tm%60)/60*Math.PI)*400:1100-Math.sin((tm%60)/60*Math.PI)*400;
  }catch(e){}
}
// ИИ полицейского на ногах
function copFootAI(p,tgt){
  const heat=P.heat,d=Math.hypot(tgt.x-p.x,tgt.y-p.y);
  const sees=d<460&&los(p.x,p.y,tgt.x,tgt.y);
  if(heat<1){ // патруль: прогулка
    p.t--;if(p.t<=0){p.a+=rnd(-1.2,1.2);p.t=ri(80,240);}return {move:.5,stop:false};
  }
  if(p.hold){ // блокпост: стоит и стреляет
    if(sees){p.a=Math.atan2(tgt.y-p.y,tgt.x-p.x);if(heat>=2&&d<300)copShoot(p,d);}
    return {move:0,stop:true};
  }
  let gx=tgt.x,gy=tgt.y;
  if(!sees){gx=P.lastX;gy=P.lastY;}
  p.a=Math.atan2(gy-p.y,gx-p.x);
  if(sees&&heat>=2&&d<300)copShoot(p,d);
  if(!sees&&Math.hypot(gx-p.x,gy-p.y)<40){p.t--;if(p.t<=0){p.a+=rnd(-2,2);p.t=ri(40,90);}return {move:.8,stop:false};}
  // на 1 звезде пытаются задержать (подходят вплотную), выше — держат дистанцию стрельбы
  const keep=heat>=2?90:6;
  return {move:d>keep?1:0,stop:d<=keep};
}
function copShoot(p,d){
  p.cd--;if(p.cd>0)return;p.cd=p.riot?ri(14,24):ri(28,48);
  const a=p.a+rnd(-.12,.12);
  bullets.push({x:p.x+Math.cos(a)*8,y:p.y+Math.sin(a)*8,vx:Math.cos(a)*11,vy:Math.sin(a)*11,l:42,dmg:p.riot?9:7,owner:'cop',rocket:false});snd(p.riot?'smg':'shot');
}
