'use strict';
// ===== Предрендер карты в один большой канвас =====
let MAP,MG,MAPDIRTY=false,FLAT=true;
const BUILDS=[],TREES=[];
const HG={khrush:()=>rnd(135,165),panel9:()=>rnd(260,340),stalin:()=>rnd(230,310),vysotka:()=>340,basil:()=>60};
function renderMap(){
  BUILDS.length=0;TREES.length=0;
  MAP=document.createElement('canvas');MAP.width=WW;MAP.height=WH;
  const g=MG=MAP.getContext('2d');
  // тайлы
  for(let ty=0;ty<MH;ty++)for(let tx=0;tx<MW;tx++){
    const t=T[ty*MW+tx],x=tx*TS,y=ty*TS,n=ri(-3,3);
    if(t===0){
      g.fillStyle=`rgb(${44+n},${50+n},${56+n})`;g.fillRect(x,y,TS,TS);
      g.fillStyle='rgba(0,0,0,.12)';
      for(let i=0;i<6;i++)g.fillRect(x+rnd(0,TS),y+rnd(0,TS),2,2);
    }else if(t===1){
      const bk=BLK[(ty/10)|0][(tx/10)|0];g.fillStyle=bk.kind==='basil'?`rgb(${150+n},${72+n},${54+n})`:`rgb(${150+n},${146+n},${140+n})`;g.fillRect(x,y,TS,TS);
      g.strokeStyle='rgba(0,0,0,.16)';g.strokeRect(x+.5,y+.5,TS-1,TS-1);
      g.fillStyle='rgba(0,0,0,.35)';
      if(tileAt(tx,ty-1)===0)g.fillRect(x,y,TS,3);
      if(tileAt(tx,ty+1)===0)g.fillRect(x,y+TS-3,TS,3);
      if(tileAt(tx-1,ty)===0)g.fillRect(x,y,3,TS);
      if(tileAt(tx+1,ty)===0)g.fillRect(x+TS-3,y,3,TS);
    }else if(t===3){
      g.fillStyle=`rgb(${206+n},${214+n},${214+n})`;g.fillRect(x,y,TS,TS);
      g.fillStyle='rgba(110,130,120,.25)';
      for(let i=0;i<8;i++)g.fillRect(x+rnd(0,TS),y+rnd(0,TS),3,3);
    }else{g.fillStyle='#2b2620';g.fillRect(x,y,TS,TS);}
  }
  // дорожная разметка и зебры
  for(let ty=0;ty<MH;ty++)for(let tx=0;tx<MW;tx++){
    if(T[ty*MW+tx]!==0)continue;
    const mx=tx%10,my=ty%10,x=tx*TS,y=ty*TS;
    const inter=mx<2&&my<2;
    if(inter)continue;
    g.fillStyle='rgba(235,225,150,.8)';
    if(my<2){ // горизонтальная дорога
      if(my===0)g.fillRect(x+8,y+TS-2,TS-16,4);
      if(mx===2||mx===9){g.fillStyle='rgba(230,230,220,.75)';for(let i=0;i<6;i++)g.fillRect(x+6,y+4+i*8,TS-12,4);}
    }else{
      if(mx===0)g.fillRect(x+TS-2,y+8,4,TS-16);
      if(my===2||my===9){g.fillStyle='rgba(230,230,220,.75)';for(let i=0;i<6;i++)g.fillRect(x+4+i*8,y+6,4,TS-12);}
    }
  }
  // тени зданий
  for(let by=0;by<6;by++)for(let bx=0;bx<6;bx++){
    const b=BLK[by][bx];if(b.park)continue;
    if(!FLAT)g.fillStyle='rgba(0,0,0,.32)';if(!FLAT)g.fillRect((bx*10+3)*TS+14,(by*10+3)*TS+14,6*TS,6*TS);
  }
  // крыши и парки
  for(let by=0;by<6;by++)for(let bx=0;bx<6;bx++){
    const b=BLK[by][bx],X=(bx*10+3)*TS,Y=(by*10+3)*TS,S=6*TS;
    if(b.park){
      for(let i=0;i<11;i++){
        const x=X+rnd(16,S-16),y=Y+rnd(16,S-16),r=rnd(14,22);
        TREES.push({x,y,r});if(FLAT)continue;
        g.fillStyle='rgba(0,0,0,.3)';g.beginPath();g.arc(x+8,y+9,r,0,7);g.fill();
        g.fillStyle='#2f5a24';g.beginPath();g.arc(x,y,r,0,7);g.fill();
        g.fillStyle='#4c8338';g.beginPath();g.arc(x-r*.25,y-r*.25,r*.55,0,7);g.fill();
      }
      continue;
    }
    const m=(b.kind==='vysotka'||b.kind==='basil')?0:Math.random(),subs=[];
    if(m<.3)subs.push([0,0,S,S]);
    else if(m<.55){const w=ri(150,S-150);subs.push([0,0,w-4,S],[w+4,0,S-w-4,S]);}
    else if(m<.8){const h=ri(150,S-150);subs.push([0,0,S,h-4],[0,h+4,S,S-h-4]);}
    else{const h=S/2;subs.push([0,0,h-4,h-4],[h+4,0,h-4,h-4],[0,h+4,h-4,h-4],[h+4,h+4,h-4,h-4]);}
    for(const [sx,sy,sw,sh] of subs){
      const x=X+sx,y=Y+sy;
      BUILDS.push({x,y,w:sw,h:sh,col:b.col,kind:b.kind,hgt:HG[b.kind]()});if(FLAT)continue;
      g.fillStyle=shade(b.col,rnd(.85,1.15));g.fillRect(x,y,sw,sh);
      g.fillStyle='rgba(255,255,255,.12)';g.fillRect(x,y,sw,4);g.fillRect(x,y,4,sh);
      g.fillStyle='rgba(0,0,0,.35)';g.fillRect(x,y+sh-4,sw,4);g.fillRect(x+sw-4,y,4,sh);
      g.strokeStyle='rgba(0,0,0,.18)';g.strokeRect(x+10,y+10,sw-20,sh-20);
      const k=ri(2,4);
      for(let i=0;i<k;i++){
        const w=rnd(24,44),h=rnd(18,34),px=x+rnd(16,Math.max(17,sw-w-16)),py=y+rnd(16,Math.max(17,sh-h-16));
        g.fillStyle='rgba(0,0,0,.3)';g.fillRect(px+4,py+4,w,h);
        g.fillStyle=pick(['#9aa0a0','#787f80','#6a7a8a','#8f8a7a']);g.fillRect(px,py,w,h);
        g.fillStyle='rgba(0,0,0,.25)';g.fillRect(px+3,py+3,w-6,h-6);
      }
    }
  }
}
// постоянные следы на асфальте
function blood(x,y){MAPDIRTY=true;if(!DG)return;for(let i=0;i<9;i++){DG.fillStyle=`rgba(${95+ri(0,40)},8,8,${rnd(.45,.85)})`;DG.beginPath();DG.ellipse(x+rnd(-10,10),y+rnd(-10,10),rnd(1.2,5),rnd(1,4),rnd(0,3),0,7);DG.fill();}}
function scorch(x,y,r){MAPDIRTY=true;if(!DG)return;const gr=DG.createRadialGradient(x,y,2,x,y,r);gr.addColorStop(0,'rgba(0,0,0,.7)');gr.addColorStop(1,'rgba(0,0,0,0)');DG.fillStyle=gr;DG.beginPath();DG.arc(x,y,r,0,7);DG.fill();}
