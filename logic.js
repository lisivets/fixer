'use strict';
// ===== ИИ, физика, спавн =====
const cam={x:0,y:0};
const START={x:24.5*TS,y:22.5*TS};
const minSpawn=()=>680;
const DV=[[1,0],[0,1],[-1,0],[0,-1]];

function laneSpawn(maxTry){
  for(let i=0;i<maxTry;i++){
    const a=rnd(0,6.28),d=rnd(minSpawn(),minSpawn()+450);
    const tx=Math.floor((P.x+Math.cos(a)*d)/TS),ty=Math.floor((P.y+Math.sin(a)*d)/TS);
    if(tx<4||ty<4||tx>MW-5||ty>MH-5)continue;
    const mx=tx%10,my=ty%10;let dir;
    if(my<2&&mx>=2)dir=my===1?0:2;else if(mx<2&&my>=2)dir=mx===0?1:3;else continue;
    const x=(tx+.5)*TS,y=(ty+.5)*TS;
    if(cars.some(c=>Math.hypot(c.x-x,c.y-y)<80))continue;
    return {x,y,dir};
  }
  return null;
}
function spawnTraffic(){
  const s=laneSpawn(12);if(!s)return;
  const r=Math.random(),type=r<.07?'taxi':r<.14?'van':r<.17?'chaika':r<.3?'volga':r<.46?'moskvich':r<.62?'sport':'sedan';
  const c=new Car(type,s.x,s.y,s.dir*Math.PI/2);
  c.ai='traffic';c.dir=s.dir;
  const sp=c.t.max*.5;c.vx=DV[s.dir][0]*sp;c.vy=DV[s.dir][1]*sp;
  cars.push(c);
}
function spawnCop(){
  const s=laneSpawn(12);if(!s)return;
  const c=new Car('cop',s.x,s.y,s.dir*Math.PI/2);c.ai='cop';c.dir=s.dir;cars.push(c);
}
function spawnPed(kind){
  for(let i=0;i<12;i++){
    const a=rnd(0,6.28),d=rnd(minSpawn(),minSpawn()+600);
    const x=P.x+Math.cos(a)*d,y=P.y+Math.sin(a)*d;
    if(tileAt(Math.floor(x/TS),Math.floor(y/TS))!==1)continue;
    peds.push(new Ped(x,y,kind));return;
  }
}
function spawnPick(){
  for(let i=0;i<12;i++){
    const a=rnd(0,6.28),d=rnd(250,1300);
    const x=P.x+Math.cos(a)*d,y=P.y+Math.sin(a)*d;
    if(tileAt(Math.floor(x/TS),Math.floor(y/TS))!==1)continue;
    const r=Math.random();
    picks.push({x,y,type:r<.55?'cash':r<.7?'ammo':r<.85?'hp':'armor',v:ri(50,250),t:99999});return;
  }
}

// --- ИИ трафика ---
function blockedAhead(c,range){
  const cs=Math.cos(c.a),sn=Math.sin(c.a);
  const test=(x,y,w)=>{const dx=x-c.x,dy=y-c.y,f=dx*cs+dy*sn,l=Math.abs(-dx*sn+dy*cs);return f>c.len/2&&f<range&&l<w;};
  for(const o of cars)if(o!==c&&test(o.x,o.y,c.wid/2+12))return true;
  for(const p of peds)if(!p.dead&&test(p.x,p.y,c.wid/2+8))return true;
  if(P.car!==c&&!P.car&&!P.dead&&test(P.x,P.y,c.wid/2+8))return true;
  return false;
}
function aiTraffic(c){
  const tx=Math.floor(c.x/TS),ty=Math.floor(c.y/TS),ix=Math.floor(tx/10),iy=Math.floor(ty/10);
  const inter=tx%10<2&&ty%10<2&&tx>=0&&ty>=0;
  if(inter){
    const id=iy*10+ix;
    if(id!==c.lastInter){
      c.lastInter=id;
      const ok=[ix<5,iy<5,ix>0,iy>0];
      const opts=[c.dir,(c.dir+1)%4,(c.dir+3)%4].filter(d=>ok[d]);
      c.dir=(Math.random()<.55&&ok[c.dir])?c.dir:pick(opts.length?opts:[(c.dir+2)%4]);
    }
  }else c.lastInter=-1;
  if(tileAt(tx,ty)!==0){c.off++;}else c.off=0;
  const bx=Math.floor(ty/10)*10,by=Math.floor(tx/10)*10;
  let dx=DV[c.dir][0],dy=DV[c.dir][1];
  if(c.dir===0)dy+=clamp(((bx+1.5)*TS-c.y)/50,-.8,.8);
  else if(c.dir===2)dy+=clamp(((bx+.5)*TS-c.y)/50,-.8,.8);
  else if(c.dir===1)dx+=clamp(((by+.5)*TS-c.x)/50,-.8,.8);
  else dx+=clamp(((by+1.5)*TS-c.x)/50,-.8,.8);
  const want=Math.atan2(dy,dx),str=clamp(angDiff(c.a,want)*2,-1,1);
  const blk=blockedAhead(c,95);
  c.blocked=blk?c.blocked+1:0;
  if(c.blocked===150&&Math.random()<.5)snd('honk');
  const vf=c.vx*Math.cos(c.a)+c.vy*Math.sin(c.a);
  if(blk)c.drive(0,str,true,false);
  else c.drive(vf<c.t.max*.5?1:0,str,false,false);
}
function aiCop(c){
  if(P.heat<1||P.dead){c.drive(0,0,true,false);return;}
  const tgt=P.car||P;
  const tx=P.seen?tgt.x:P.lastX,ty=P.seen?tgt.y:P.lastY;
  const dx=tx-c.x,dy=ty-c.y,d=Math.hypot(dx,dy);
  let want=Math.atan2(dy,dx);
  const cs=Math.cos(c.a),sn=Math.sin(c.a);
  const probe=(ang)=>solidAt(c.x+Math.cos(ang)*65,c.y+Math.sin(ang)*65);
  let brake=false;
  if(probe(c.a)||probe(c.a-.5)||probe(c.a+.5)){
    const l=probe(c.a-.6),r=probe(c.a+.6);
    want=c.a+(l&&!r?1.2:!l&&r?-1.2:1.2);brake=c.speed>4;
  }
  let thr=1;
  if(c.rev>0){c.rev--;c.drive(-1,-clamp(angDiff(c.a,want),-1,1),false,false);return;}
  if(c.speed<.4){c.stuck++;if(c.stuck>50){c.rev=50;c.stuck=0;}}else c.stuck=0;
  if(!P.seen&&d<150){ // поиск: медленно кружит у места, где видели
    c.srch=(c.srch||0)+1;want=c.a+Math.sin(c.srch*.03)*1.1;thr=c.speed<3?.6:0;
  }else if(d<90&&c.speed>5)thr=0;
  c.drive(thr,clamp(angDiff(c.a,want)*2,-1,1),brake,false);
  c.flash+=1;
}

// --- Физика столкновений ---
function carWalls(c){
  let impact=0;
  for(let it=0;it<2;it++){
    for(const [x,y,r] of c.circles()){
      const p=circleTilePush(x,y,r);
      if(p){
        c.x+=p.x;c.y+=p.y;
        const l=Math.hypot(p.x,p.y)||1,nx=p.x/l,ny=p.y/l,vn=c.vx*nx+c.vy*ny;
        if(vn<0){impact=Math.max(impact,-vn);c.vx-=1.25*vn*nx;c.vy-=1.25*vn*ny;c.vx*=.96;c.vy*=.96;}
      }
    }
  }
  c.x=clamp(c.x,20,WW-20);c.y=clamp(c.y,20,WH-20);
  if(impact>2.2){c.damage((impact-2)*7,c===P.car?'wall':'ai');if(c===P.car){snd('hit');shake=Math.max(shake,impact);}}
}
function carCars(){
  for(let i=0;i<cars.length;i++)for(let j=i+1;j<cars.length;j++){
    const a=cars[i],b=cars[j];
    if(Math.hypot(a.x-b.x,a.y-b.y)>(a.len+b.len)/2+4)continue;
    const ia=a.dead?0:1/(a.t.mass||1),ib=b.dead?0:1/(b.t.mass||1),tot=ia+ib;
    if(!tot)continue;
    let done=false;
    for(const A of a.circles()){
      for(const B of b.circles()){
        const dx=B[0]-A[0],dy=B[1]-A[1],d=Math.hypot(dx,dy),m=A[2]+B[2];
        if(d<m&&d>.001){
          const nx=dx/d,ny=dy/d,o=m-d;
          a.x-=nx*o*ia/tot;a.y-=ny*o*ia/tot;b.x+=nx*o*ib/tot;b.y+=ny*o*ib/tot;
          const rv=(b.vx-a.vx)*nx+(b.vy-a.vy)*ny;
          if(rv<0){
            const j2=-1.3*rv/tot;
            a.vx-=j2*ia*nx;a.vy-=j2*ia*ny;b.vx+=j2*ib*nx;b.vy+=j2*ib*ny;
            const imp=-rv;
            if(imp>1.5){
              const dm=(imp-1)*6;
              a.damage(dm,b===P.car?'player':'ai');b.damage(dm,a===P.car?'player':'ai');
              snd('hit');if(a===P.car||b===P.car)shake=Math.max(shake,imp);
              for(let k=0;k<4;k++)part(A[0],A[1],rnd(-3,3),rnd(-3,3),rnd(8,16),2,'255,220,120','k');
            }
          }
          done=true;break;
        }
      }
      if(done)break;
    }
  }
}
function updateCar(c,tm){
  if(c.burn>0){
    c.burn--;
    if(tm%3===0)part(c.x+rnd(-8,8),c.y+rnd(-8,8),rnd(-.3,.3),rnd(-1,-.3),rnd(25,45),rnd(8,14),'255,140,30','f');
    if(tm%4===0)part(c.x,c.y,rnd(-.4,.4),rnd(-1.2,-.4),rnd(40,70),rnd(10,18),'40,40,40','s');
    if(c.burn===0){
      c.dead=true;c.fire=900;
      explode(c.x,c.y,85,70,c.ai==='cop'?'player':'ai');
      if(P.car===c){P.car=null;P.hp=0;}
    }
  }
  if(c.dead){
    c.vx*=.9;c.vy*=.9;
    if(c.fire>0){c.fire--;if(tm%5===0)part(c.x+rnd(-10,10),c.y+rnd(-8,8),rnd(-.2,.2),rnd(-.9,-.3),rnd(20,38),rnd(7,13),'255,130,30','f');}
  }else if(c===P.car){/* управляет игрок */}
  else if(c.burn>0){c.drive(0,0,true,false);}
  else if(c.ai==='traffic')aiTraffic(c);
  else if(c.ai==='cop')aiCop(c);
  else if(c.ai==='block'){c.drive(0,0,true,false);c.flash+=1;}
  else{c.vx*=.94;c.vy*=.94;}
  c.x+=c.vx;c.y+=c.vy;
  carWalls(c);
  if(c.ai==='traffic'&&c.off>200)c.off=9999;
}
// --- Пешеходы ---
function updatePeds(){
  for(const p of peds){
    if(p.dead)continue;
    for(const c of cars){
      if(c.dead||c.speed<1.4)continue;
      const dx=p.x-c.x,dy=p.y-c.y;if(Math.abs(dx)>40||Math.abs(dy)>40)continue;
      const cs=Math.cos(c.a),sn=Math.sin(c.a),lx=dx*cs+dy*sn,ly=-dx*sn+dy*cs;
      if(Math.abs(lx)<c.len/2+3&&Math.abs(ly)<c.wid/2+3){killPed(p,c===P.car?'player':'ai');break;}
    }
    if(p.dead)continue;
    const tgt=P.car||P;
    if(p.kind==='civ'){
      if(P.car&&p.flee<=0&&P.car.speed>3&&Math.hypot(p.x-P.car.x,p.y-P.car.y)<110){p.flee=120;p.a=Math.atan2(p.y-P.car.y,p.x-P.car.x)+rnd(-.6,.6);}
      p.t--;if(p.t<=0&&p.flee<=0){p.a+=rnd(-1,1);p.t=ri(80,300);}
    }else{
      const r=copFootAI(p,tgt);p.moving=r.move>0;if(!r.move)continue;p.mv=r.move;
    }
    const sp=p.kind==='cop'?1.6*(p.mv||1):p.flee>0?2.1:.7;
    p.flee--;
    const nx=p.x+Math.cos(p.a)*sp,ny=p.y+Math.sin(p.a)*sp,tt=tileAt(Math.floor(nx/TS),Math.floor(ny/TS));
    const ok=(p.flee>0||p.kind==='cop')?tt!==2:(tt===1||tt===3);
    if(ok){p.x=nx;p.y=ny;p.step+=sp*.35;}
    else p.a+=(Math.random()<.5?1:-1)*(Math.PI/2)+rnd(-.4,.4);
  }
}
function alertPeds(x,y,r){
  for(const p of peds)if(p.kind==='civ'&&!p.dead&&p.flee<=0&&Math.hypot(p.x-x,p.y-y)<r){p.flee=150;p.a=Math.atan2(p.y-y,p.x-x)+rnd(-.5,.5);}
}
// --- Пули ---
function fireBullet(x,y,a,w,owner){
  const W=WEAPONS[w];
  bullets.push({x,y,vx:Math.cos(a)*W.spd,vy:Math.sin(a)*W.spd,l:W.rocket?110:55,dmg:W.dmg,owner,rocket:!!W.rocket});
}
function updateBullets(tm){
  for(const b of bullets){
    if(b.dead)continue;
    for(let s=0;s<2&&!b.dead;s++){
      b.x+=b.vx/2;b.y+=b.vy/2;
      if(b.rocket&&tm%2===0)part(b.x,b.y,rnd(-.3,.3),rnd(-.3,.3),rnd(12,20),5,'200,200,200','s');
      if(solidAt(b.x,b.y)){b.dead=true;break;}
      for(const c of cars){
        if(c===P.car&&b.owner==='player')continue;
        const dx=b.x-c.x,dy=b.y-c.y;if(Math.abs(dx)>40||Math.abs(dy)>40)continue;
        const cs=Math.cos(c.a),sn=Math.sin(c.a),lx=dx*cs+dy*sn,ly=-dx*sn+dy*cs;
        if(Math.abs(lx)<c.len/2&&Math.abs(ly)<c.wid/2){
          if(!b.rocket)c.damage(b.dmg*(b.owner==='cop'?.5:.6),b.owner);
          b.dead=true;part(b.x,b.y,rnd(-2,2),rnd(-2,2),10,2,'255,220,120','k');break;
        }
      }
      if(b.dead)break;
      if(b.owner==='player'){
        for(const p of peds){
          if(p.dead||Math.hypot(p.x-b.x,p.y-b.y)>8)continue;
          if(!b.rocket){p.hp-=b.dmg;if(p.hp<=0)killPed(p,'player');else{p.flee=120;}}
          if(p.kind==='civ'&&!p.dead)p.a=Math.atan2(p.y-P.y,p.x-P.x);
          b.dead=true;break;
        }
      }else if(!P.car&&!P.dead&&Math.hypot(P.x-b.x,P.y-b.y)<8){hurtPlayer(b.dmg);b.dead=true;}
    }
    b.l--;
    if(b.l<=0)b.dead=true;
    if(b.dead&&b.rocket)explode(b.x,b.y,75,95,b.owner);
  }
  for(let i=bullets.length-1;i>=0;i--)if(bullets[i].dead)bullets.splice(i,1);
}
function updateParts(){
  for(let i=parts.length-1;i>=0;i--){
    const p=parts[i];p.x+=p.vx;p.y+=p.vy;p.l--;
    if(p.k==='s'){p.vx*=.97;p.vy*=.97;p.s+=.15;}else if(p.k==='f'){p.vx*=.96;p.vy*=.96;p.s*=.97;}else p.vx*=.95;
    if(p.l<=0)parts.splice(i,1);
  }
}
