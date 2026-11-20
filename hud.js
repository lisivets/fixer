'use strict';
// ===== Отрисовка кадра и интерфейса =====
const FONT='"Russo One",Impact,sans-serif';
let state='title',over=false,tm=0;
function drawWorld(){
  const g=ctx;g.setTransform(1,0,0,1,0,0);g.fillStyle='#0d0f0d';g.fillRect(0,0,VW,VH);
  const sx=(Math.random()-.5)*shake,sy=(Math.random()-.5)*shake;
  g.setTransform(SC,0,0,SC,VW/2-cam.x*SC+sx,VH/2-cam.y*SC+sy);
  const vw=VW/SC,vh=VH/SC,x0=clamp(cam.x-vw/2-10,0,WW),y0=clamp(cam.y-vh/2-10,0,WH);
  const x1=clamp(cam.x+vw/2+10,0,WW),y1=clamp(cam.y+vh/2+10,0,WH);
  {const K=4/TS;g.drawImage(MAP,x0*K,y0*K,(x1-x0)*K,(y1-y0)*K,x0,y0,x1-x0,y1-y0);}
  const vis=o=>Math.abs(o.x-cam.x)<vw/2+60&&Math.abs(o.y-cam.y)<vh/2+60;
  for(const c of cars)if(c.dead&&vis(c))drawCar(c);
  for(const k of picks)if(vis(k))drawPick(k,tm);
  for(const p of peds)if(!p.dead&&vis(p))drawPed(p);
  if(!P.car&&!P.dead)drawPlayer();
  for(const c of cars)if(!c.dead&&vis(c))drawCar(c);
  g.fillStyle='#ffe9a0';
  for(const b of bullets){
    if(b.rocket){g.fillStyle='#ccc';g.fillRect(b.x-4,b.y-2,8,4);g.fillStyle='#ff8a2a';g.fillRect(b.x-7,b.y-1.5,3,3);}
    else{g.strokeStyle='#ffe9a0';g.lineWidth=2;g.beginPath();g.moveTo(b.x,b.y);g.lineTo(b.x-b.vx*.8,b.y-b.vy*.8);g.stroke();}
  }
  for(const p of parts){
    const a=p.l/p.m;
    if(p.k==='s'){g.fillStyle=`rgba(${p.c},${.45*a})`;g.beginPath();g.arc(p.x,p.y,p.s,0,7);g.fill();}
  }
  g.globalCompositeOperation='lighter';
  for(const p of parts){
    const a=p.l/p.m;
    if(p.k==='f'){
      const gr=g.createRadialGradient(p.x,p.y,0,p.x,p.y,p.s*1.6);
      gr.addColorStop(0,`rgba(255,220,120,${.9*a})`);gr.addColorStop(.5,`rgba(${p.c},${.55*a})`);gr.addColorStop(1,'rgba(255,60,0,0)');
      g.fillStyle=gr;g.beginPath();g.arc(p.x,p.y,p.s*1.6,0,7);g.fill();
    }else if(p.k==='k'){g.fillStyle=`rgba(${p.c},${a})`;g.fillRect(p.x,p.y,2,2);}
  }
  g.globalCompositeOperation='source-over';
  // общий тон и виньетка
  g.setTransform(1,0,0,1,0,0);
  g.globalCompositeOperation='multiply';g.fillStyle='rgb(170,190,175)';g.fillRect(0,0,VW,VH);
  g.globalCompositeOperation='source-over';
  const v=g.createRadialGradient(VW/2,VH/2,Math.min(VW,VH)*.35,VW/2,VH/2,Math.hypot(VW,VH)*.6);
  v.addColorStop(0,'rgba(0,0,0,0)');v.addColorStop(1,'rgba(0,0,0,.55)');g.fillStyle=v;g.fillRect(0,0,VW,VH);
}
function txt(s,x,y,size,col,align,stroke){
  size=Math.max(size,12);
  ctx.font=`${size}px ${FONT}`;ctx.textAlign=align||'left';ctx.textBaseline='alphabetic';
  ctx.lineWidth=Math.max(2,size/9);ctx.strokeStyle=stroke||'rgba(0,0,0,.8)';ctx.lineJoin='round';
  ctx.strokeText(s,x,y);ctx.fillStyle=col;ctx.fillText(s,x,y);
}
function bar(x,y,w,h,f,col,icon){
  ctx.fillStyle='rgba(0,0,0,.6)';rr(x,y,w,h,h/2);ctx.fill();
  ctx.fillStyle=col;if(f>0){rr(x+2,y+2,Math.max(h-4,(w-4)*clamp(f,0,1)),h-4,(h-4)/2);ctx.fill();}
  ctx.strokeStyle='rgba(255,255,255,.5)';ctx.lineWidth=2;rr(x,y,w,h,h/2);ctx.stroke();
  ctx.fillStyle='rgba(20,20,30,.85)';rr(x-h-6,y-3,h+6,h+6,6);ctx.fill();
  ctx.fillStyle=col;ctx.font=`${h}px ${FONT}`;ctx.textAlign='center';ctx.fillText(icon,x-h/2-3,y+h-2);
}
function drawHUD(){
  const hs=HS(),g=ctx;
  // индикаторы слева
  const bw=150*hs,bh=20*hs,bx=60*hs;
  bar(bx,22*hs,bw,bh,P.hp/100,'#3fc04a','+');
  bar(bx,22*hs+bh+16*hs,bw,bh,P.armor/100,'#4a7ae0','Б');
  if(P.car)bar(bx,22*hs+(bh+16*hs)*2,bw,bh,P.car.hp/P.car.t.hp,'#e0a030','М');
  // деньги, жизни, розыск, оружие справа
  const rx=VW-24*hs;
  txt(Math.floor(P.money)+' $',rx,54*hs,46*hs,'#d8c878','right');
  if(P.car)txt(P.car.t.name,VW/2,VH-36*hs,26*hs,'#f2d03a','center');
  g.font=`${30*hs}px sans-serif`;g.textAlign='right';
  for(let i=0;i<5;i++){g.fillStyle=i<P.lives?'#e23030':'rgba(80,20,20,.5)';g.fillText('♥',rx-i*34*hs,92*hs);}
  const L=Math.min(5,Math.floor(P.heat));
  for(let i=0;i<5;i++){g.fillStyle=i<L?((tm>>3)%2&&L>=3?'#ff4040':'#f2d03a'):'rgba(255,255,255,.18)';g.fillText('★',rx-i*34*hs,128*hs);}
  if(P.heat>=1){
    const lab=P.seen?'РОЗЫСК':'ПОИСК';g.textAlign='right';txt(lab,rx-5*34*hs-8*hs,128*hs,18*hs,P.seen?((tm>>3)%2?'#ff4040':'#ffb0b0'):'#9fb4ff','right');
  }
  {let y=210*hs;for(let i=MSGS.length-1;i>=0;i--){const m=MSGS[i];m.t--;if(m.t<=0){MSGS.splice(i,1);continue;}ctx.globalAlpha=Math.min(1,m.t/40);txt(m.text,rx,y,18*hs,m.col,'right');y+=24*hs;}ctx.globalAlpha=1;}
  const W=WEAPONS[P.w],am=P.ammo[P.w];
  txt(W.n+(am===Infinity?'':'  '+Math.floor(am)),rx,160*hs,20*hs,'#9fd49a','right');
  drawWeaponBar(hs);
  // миникарта
  const ms=MOBILE?Math.min(VH*.3,120):170*hs,mx=MOBILE?VW/2-ms/2:20*hs,my=MOBILE?8:VH-ms-20*hs,R=1500;
  g.save();rr(mx,my,ms,ms,8);g.clip();
  g.fillStyle='#000';g.fillRect(mx,my,ms,ms);
  const sx=clamp(P.x-R/2,0,WW-R),sy=clamp(P.y-R/2,0,WH-R);
  {const K=4/TS;g.globalAlpha=.85;g.drawImage(MAP,sx*K,sy*K,R*K,R*K,mx,my,ms,ms);g.globalAlpha=1;}
  const k=ms/R,M=(o)=>[mx+(o.x-sx)*k,my+(o.y-sy)*k];
  for(const c of cars){if(c.dead)continue;const [x,y]=M(c);if(x<mx||y<my||x>mx+ms||y>my+ms)continue;
    g.fillStyle=c.type==='cop'?((c.flash>>2)%2?'#ff3030':'#3060ff'):'#cfcfcf';g.fillRect(x-2,y-2,5,5);}
  for(const p of peds)if(p.kind==='cop'&&!p.dead){const [x,y]=M(p);g.fillStyle='#4070ff';g.fillRect(x-1.5,y-1.5,3,3);}
  for(const q of picks){if(q.type!=='cash')continue;const [x,y]=M(q);g.fillStyle='#5fe06a';g.fillRect(x-1,y-1,3,3);}
  const [px,py]=M(P);g.translate(px,py);g.rotate(P.a);g.fillStyle='#fff';g.beginPath();g.moveTo(6,0);g.lineTo(-4,4);g.lineTo(-4,-4);g.fill();
  g.restore();
  g.strokeStyle='rgba(255,255,255,.6)';g.lineWidth=2;rr(mx,my,ms,ms,8);g.stroke();
}
// ---- значки оружия (общие для HUD и находок над предметами) ----
function drawWIcon(g,id,x,y,s,col){
  g.save();g.translate(x,y);g.scale(s/32,s/32);g.fillStyle=col;g.strokeStyle=col;g.lineWidth=3;g.lineCap='round';g.lineJoin='round';
  const R=(a,b,c,d)=>g.fillRect(a,b,c,d);
  if(id==='fist'){for(let i=0;i<4;i++)R(-12+i*6.5,-6,5,12);R(-12,6,24,5);}
  else if(id==='club'){g.beginPath();g.moveTo(-13,12);g.lineTo(9,-10);g.lineWidth=6;g.stroke();g.beginPath();g.moveTo(9,-10);g.lineTo(13,-14);g.lineWidth=10;g.stroke();}
  else if(id==='knife'){g.beginPath();g.moveTo(-14,10);g.lineTo(6,-10);g.lineTo(12,-12);g.lineTo(8,-4);g.closePath();g.fill();R(-16,8,8,4);}
  else if(id==='pistol'){R(-14,-8,26,8);R(-2,0,8,14);R(6,-2,6,3);}
  else if(id==='smg'){R(-16,-7,32,8);R(-4,1,7,14);R(-12,1,5,6);R(12,-4,6,3);}
  else if(id==='bazooka'){R(-17,-6,34,10);R(-4,4,6,11);R(12,-11,5,5);}
  else if(id==='flame'){R(-16,-4,20,7);R(-16,3,10,11);g.beginPath();g.moveTo(4,-5);g.lineTo(17,-10);g.lineTo(13,-1);g.lineTo(17,8);g.lineTo(4,4);g.closePath();g.fill();}
  else if(id==='saw'){R(-14,-6,16,14);R(2,-2,15,5);for(let i=0;i<5;i++){g.beginPath();g.moveTo(3+i*3,-2);g.lineTo(4.5+i*3,-6);g.lineTo(6+i*3,-2);g.fill();}}
  else if(id==='armor'){g.beginPath();g.moveTo(0,-14);g.lineTo(13,-9);g.lineTo(11,4);g.lineTo(0,14);g.lineTo(-11,4);g.lineTo(-13,-9);g.closePath();g.fill();}
  g.restore();
}
// полоса оружия: 8 ячеек с номером и значком; цифры 1–8 / колесо / Q E
function drawWeaponBar(hs){
  const n=WEAPONS.length,sz=Math.round(46*hs),gap=Math.round(6*hs),w0=n*sz+(n-1)*gap,x0=Math.round(VW/2-w0/2),y0=VH-sz-Math.round(14*hs)-(P.car?Math.round(34*hs):0);
  for(let i=0;i<n;i++){
    const x=x0+i*(sz+gap),has=P.has[i]&&P.ammo[i]>0,cur=i===P.w;
    ctx.fillStyle=cur?'rgba(60,50,10,.85)':'rgba(10,12,14,.65)';rr(x,y0,sz,sz,6);ctx.fill();
    ctx.strokeStyle=cur?'#f2d03a':has?'rgba(255,255,255,.45)':'rgba(255,255,255,.12)';ctx.lineWidth=cur?3:1.5;rr(x,y0,sz,sz,6);ctx.stroke();
    if(has)drawWIcon(ctx,WEAPONS[i].id,x+sz/2,y0+sz/2-2,sz*.62,cur?'#f2d03a':'#e8e8e8');
    else if(P.has[i])drawWIcon(ctx,WEAPONS[i].id,x+sz/2,y0+sz/2-2,sz*.62,'rgba(255,90,70,.5)');
    ctx.font=`${Math.max(10,Math.round(11*hs))}px ${FONT}`;ctx.textAlign='left';ctx.fillStyle=has?'#cfd8c8':'rgba(255,255,255,.3)';ctx.fillText(String(i+1),x+4,y0+Math.max(11,12*hs));
    const am=P.ammo[i];if(has&&am!==Infinity&&WEAPONS[i].kind!=='melee'||(has&&WEAPONS[i].id==='saw')){ctx.textAlign='right';ctx.fillText(String(Math.floor(am)),x+sz-4,y0+sz-4);}
  }
}
function drawOverlays(){
  if(MOBILE&&VH>VW){ctx.fillStyle='rgba(0,0,0,.9)';ctx.fillRect(0,0,VW,VH);txt('Поверните телефон горизонтально',VW/2,VH/2,Math.min(VW/14,34),'#f2d03a','center');return;}
  const cx=VW/2,cy=VH/2,hs=HS();
  if(over){ctx.fillStyle='rgba(0,0,0,.6)';ctx.fillRect(0,0,VW,VH);txt('ИГРА ОКОНЧЕНА',cx,cy,80*hs,'#e23030','center');txt('Счёт: '+Math.floor(P.money)+' $   ·   Enter — заново',cx,cy+50*hs,26*hs,'#fff','center');return;}
  if(state==='play'&&!P.car&&!P.dead&&!over){ctx.strokeStyle='rgba(255,255,255,.85)';ctx.lineWidth=2;ctx.beginPath();ctx.arc(cx,cy,7,0,7);ctx.moveTo(cx-14,cy);ctx.lineTo(cx-4,cy);ctx.moveTo(cx+4,cy);ctx.lineTo(cx+14,cy);ctx.stroke();}
  if(P.busted>0){ctx.fillStyle='rgba(10,20,60,.55)';ctx.fillRect(0,0,VW,VH);txt('ЗАДЕРЖАН',cx,cy,90*hs,'#7ab0ff','center');return;}
  if(P.dead>0){txt('ВЫ УБИТЫ',cx,cy,90*hs,'#e23030','center');return;}
  if(state==='title'){
    ctx.fillStyle='rgba(0,0,0,.62)';ctx.fillRect(0,0,VW,VH);
    txt('FIXER',cx,cy-150*hs,60*hs,'#f2d03a','center');
    const L=MOBILE?['Левый палец — стик: ходьба и руль','Правый палец — вращать голову во все стороны · кнопка 1-е/3-е — вид','Кнопки: ОГОНЬ, ВХОД/ВЫХОД, ОРУЖИЕ, РУЧНИК, ГУДОК','','','',]:['WASD — ходьба и руль · Shift — бег','Мышь (клик захватывает курсор) — свободный поворот головы и камеры по горизонтали и вертикали','C — вид от первого лица / от третьего','Пробел / ЛКМ — огонь (в машине пробел — ручник)','F или Enter — сесть / выйти · H — сигнал','1–8, колесо мыши или Q / E — смена оружия','Собирай $, жги резину на лимузинах, не попадайся полиции','','Нажми любую клавишу, чтобы начать'];
    if(MOBILE)L.push('Коснись экрана, чтобы начать');
    const gap=Math.max(34*hs,20);L.forEach((s,i)=>txt(s,cx,cy-80*hs+i*gap,i===L.length-1?28*hs:22*hs,i===L.length-1?'#9fd49a':'#e8e8e8','center'));
  }
}
