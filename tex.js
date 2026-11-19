'use strict';
// ===== Процедурные PBR-текстуры (цвет, нормали, шероховатость/металл, свечение) =====
const NTAB=new Float32Array(65536);for(let i=0;i<65536;i++)NTAB[i]=Math.random();
function vnp(x,y,P){ // периодический value-noise
  const xi=Math.floor(x),yi=Math.floor(y),fx=x-xi,fy=y-yi;
  const x0=((xi%P)+P)%P,y0=((yi%P)+P)%P,x1=(x0+1)%P,y1=(y0+1)%P;
  const u=fx*fx*(3-2*fx),v=fy*fy*(3-2*fy);
  const a=NTAB[(x0*7919+y0*104729)&65535],b=NTAB[(x1*7919+y0*104729)&65535],c=NTAB[(x0*7919+y1*104729)&65535],d=NTAB[(x1*7919+y1*104729)&65535];
  return a+(b-a)*u+(c-a)*v+(a-b-c+d)*u*v;
}
function fbmp(u,v,P,o){let s=0,a=.5,p=P,n=0;for(let i=0;i<o;i++){s+=vnp(u*p,v*p,p)*a;n+=a;p*=2;a*=.5;}return s/n;}
const sstep=(a,b,x)=>{const t=Math.min(1,Math.max(0,(x-a)/(b-a)));return t*t*(3-2*t);};
function normalFrom(hh,w,h,str){
  const out=new Uint8ClampedArray(w*h*4);
  for(let j=0;j<h;j++){
    const jm=((j-1+h)%h)*w,jp=((j+1)%h)*w,jj=j*w;
    for(let i=0;i<w;i++){
      const im=(i-1+w)%w,ip=(i+1)%w;
      const dx=(hh[jj+ip]-hh[jj+im])*.5*str,dy=(hh[jm+i]-hh[jp+i])*.5*str;
      const l=Math.hypot(dx,dy,1),k=(jj+i)*4;
      out[k]=(-dx/l*.5+.5)*255;out[k+1]=(-dy/l*.5+.5)*255;out[k+2]=(1/l*.5+.5)*255;out[k+3]=255;
    }
  }
  return out;
}
function imgTex(data,w,h,srgb,wrap){
  const c=document.createElement('canvas');c.width=w;c.height=h;
  c.getContext('2d').putImageData(new ImageData(data,w,h),0,0);
  const t=new THREE.CanvasTexture(c);t.wrapS=t.wrapT=wrap===false?THREE.ClampToEdgeWrapping:THREE.RepeatWrapping;
  t.anisotropy=8;if(srgb)t.encoding=THREE.sRGBEncoding;return t;
}
function canvasToTex(c,srgb){const t=new THREE.CanvasTexture(c);t.wrapS=t.wrapT=THREE.RepeatWrapping;t.anisotropy=8;if(srgb)t.encoding=THREE.sRGBEncoding;return t;}
// бесшовная плитка из функции пикселя
function genTile(S,fn,nStr){
  const col=new Uint8ClampedArray(S*S*4),orm=new Uint8ClampedArray(S*S*4),hh=new Float32Array(S*S),o={};
  for(let j=0;j<S;j++)for(let i=0;i<S;i++){
    fn(i/S,j/S,o,i,j);const k=j*S+i,k4=k*4;
    col[k4]=o.r;col[k4+1]=o.g;col[k4+2]=o.b;col[k4+3]=255;
    orm[k4]=255;orm[k4+1]=o.ro*255;orm[k4+2]=(o.me||0)*255;orm[k4+3]=255;hh[k]=o.h;
  }
  return {map:imgTex(col,S,S,true),normalMap:imgTex(normalFrom(hh,S,S,nStr),S,S,false),orm:imgTex(orm,S,S,false)};
}
const PBR={};
function buildGroundTextures(){
  // асфальт: зерно, мокрые пятна, трещины
  PBR.asphalt=genTile(512*TQ,(u,v,o)=>{
    const n1=fbmp(u,v,8,4),gr=Math.random()*.55+vnp(u*128,v*128,128)*.45;
    const wet=sstep(.62,.8,fbmp(u+.31,v+.17,5,3));
    const crack=1-Math.abs(fbmp(u,v,9,3)-.5)*2,cr=crack>.972?(crack-.972)*30:0;
    const b=40+n1*26+(gr-.5)*46-cr*30-wet*8;
    o.r=b;o.g=b+1;o.b=b+5;o.h=gr*.55+n1*.35-cr*.6;o.ro=.88-wet*.52-(gr>.8?.12:0);o.me=0;
  },4);
  // тротуарная плитка
  PBR.paving=genTile(512*TQ,(u,v,o,i,j)=>{
    const sx=i%128,sy=j%128,e=Math.min(sx,sy,127-sx,127-sy),id=((i>>7)*5+(j>>7)*11)%7;
    const n=fbmp(u,v,10,4),gr=Math.random();
    const gro=e<3,slab=sstep(2,6,e);
    const base=gro?58:(146+id*3+(n-.5)*40+(gr-.5)*14);
    o.r=base+3;o.g=base+1;o.b=base-4;o.h=gro?.05:(.55+n*.2+slab*.2);o.ro=gro?.95:(.7+n*.15);o.me=0;
  },5);
  // снег
  PBR.snow=genTile(512*TQ,(u,v,o)=>{
    const n=fbmp(u,v,8,5),sp=Math.random()>.994?40:0,b=226+n*24+sp;
    o.r=b-6;o.g=b-2;o.b=b+4;o.h=n*.8+Math.random()*.06;o.ro=.5+n*.3-(sp?.3:0);o.me=0;
  },3);
  // гранитный бордюр
  PBR.curb=genTile(256*TQ,(u,v,o)=>{
    const n=fbmp(u,v,8,3),s=Math.random(),b=118+n*30+(s>.9?40:s<.1?-40:0);
    o.r=b;o.g=b;o.b=b+3;o.h=n*.5+s*.2;o.ro=.55+n*.2;o.me=0;
  },3);
  // кирпич
  PBR.brick=genTile(512*TQ,(u,v,o,i,j)=>{
    const row=Math.floor(j/32),off=(row%2)*32,bi=Math.floor((i+off)/64),bx=(i+off)%64,by=j%32;
    const e=Math.min(bx,63-bx,by,31-by),mortar=e<2;
    const id=((bi*13+row*29)%17)/17,n=fbmp(u,v,16,3);
    const r=140+id*50+(n-.5)*30,g=56+id*18+(n-.5)*14,b=40+id*10+(n-.5)*10;
    o.r=mortar?176:r;o.g=mortar?168:g;o.b=mortar?150:b;o.h=mortar?.08:(.6+n*.25+Math.min(e,4)*.04);o.ro=mortar?.95:.82;o.me=0;
  },4);
  // штукатурка/бетон
  PBR.plaster=genTile(512*TQ,(u,v,o)=>{
    const n=fbmp(u,v,6,5),st=sstep(.55,.8,fbmp(u+.2,v,4,3)),b=222+(n-.5)*34-st*22;
    o.r=b;o.g=b-2;o.b=b-8;o.h=n*.6+Math.random()*.1;o.ro=.88;o.me=0;
  },2);
  // ржавый/окрашенный металл
  PBR.metal=genTile(256*TQ,(u,v,o)=>{
    const n=fbmp(u,v,8,4),r=sstep(.6,.85,fbmp(u+.5,v,5,3));
    const b=120+n*40;o.r=b+r*60;o.g=b-r*10;o.b=b-r*40;o.h=n*.4;o.ro=.5+r*.35;o.me=.8-r*.6;
  },2);
  // вода
  PBR.water=genTile(256*TQ,(u,v,o)=>{
    const n=fbmp(u,v,6,4),m=fbmp(u+.3,v+.7,12,3),b=26+n*22;
    o.r=b*.5;o.g=b*.82;o.b=b*1.15+16;o.h=n*.7+m*.3;o.ro=.12;o.me=.1;
  },6);
  // брёвна
  PBR.wood=genTile(512*TQ,(u,v,o)=>{
    const row=Math.floor(v*16),py=(v*16)%1,rr=Math.sin(py*Math.PI),g=fbmp(u*2,v*8+row*.3,8,3),id=((row*17)%7)/7,b=84+id*30+g*36;
    o.r=b*1.12;o.g=b*.74;o.b=b*.46;o.h=.25+rr*.65+g*.1;o.ro=.85;o.me=0;
  },5);
  // профнастил
  PBR.tin=genTile(256*TQ,(u,v,o)=>{
    const rib=Math.sin(u*Math.PI*16),n=fbmp(u,v,8,4),r=sstep(.55,.85,fbmp(u+.4,v,5,3)),b=128+n*36+rib*14;
    o.r=b+r*50;o.g=b-r*8+4;o.b=b-r*30+8;o.h=.5+rib*.5;o.ro=.55+r*.3;o.me=.7-r*.4;
  },4);
}
// ---------- Фасады: четыре слоя рисуются одновременно ----------
function Layers(w,h){
  this.w=w;this.h=h;
  this.w=w*TQ;this.h=h*TQ;
  const mk=()=>{const c=document.createElement('canvas');c.width=w*TQ;c.height=h*TQ;return c;};
  this.cv=[mk(),mk(),mk(),mk()];this.cx=this.cv.map(c=>{const g=c.getContext('2d');g.scale(TQ,TQ);return g;});
  this.cx[3].fillStyle='#000';this.cx[3].fillRect(0,0,w,h);
}
Layers.prototype.st=function(s){ // стиль -> строки заливки для 4 слоёв
  return [s.c||null,s.h!==undefined?`rgb(${s.h},${s.h},${s.h})`:null,s.r!==undefined?`rgb(255,${s.r},${s.m||0})`:null,s.e||null];
};
Layers.prototype.rect=function(x,y,w,h,s){const f=this.st(s);for(let k=0;k<4;k++)if(f[k]){this.cx[k].fillStyle=f[k];this.cx[k].fillRect(x,y,w,h);}};
Layers.prototype.shape=function(fn,s){const f=this.st(s);for(let k=0;k<4;k++)if(f[k]){const g=this.cx[k];g.fillStyle=f[k];g.beginPath();fn(g);g.fill();}};
Layers.prototype.finish=function(grime,nStr){
  const w=this.w,h=this.h,cd=this.cx[0].getImageData(0,0,w,h),od=this.cx[2].getImageData(0,0,w,h),hd=this.cx[1].getImageData(0,0,w,h);
  const hh=new Float32Array(w*h);
  for(let j=0;j<h;j++)for(let i=0;i<w;i++){
    const k=j*w+i,k4=k*4,u=i/w,v=j/h;
    const d=.78+.42*fbmp(u,v,8,3),streak=vnp(u*64,v*2.5,64),dirt=d*(1-grime*sstep(.55,.8,streak)*.5),sp=(Math.random()-.5)*14;
    cd.data[k4]=cd.data[k4]*dirt+sp;cd.data[k4+1]=cd.data[k4+1]*dirt+sp;cd.data[k4+2]=cd.data[k4+2]*dirt+sp;
    od.data[k4+1]=Math.min(255,od.data[k4+1]+(Math.random()-.5)*26+(1-d)*30);
    hh[k]=hd.data[k4]/255+(Math.random()-.5)*.03;
  }
  return {map:imgTex(cd.data,w,h,true),normalMap:imgTex(normalFrom(hh,w,h,nStr),w,h,false),orm:imgTex(od.data,w,h,false),emissive:canvasToTex(this.cv[3],true)};
};
const FAC={};
function facadeSet(kind){
  if(FAC[kind])return FAC[kind];
  const W=1024,L=new Layers(W,W);
  const wallC={slab5:'#e6e0d2',slab9:'#d6d8d4',classic:'#ebdfc4',spire:'#e9dfc6'}[kind];
  const wall={c:wallC,h:128,r:218,m:0},lit=()=>Math.random()<.27;
  const glassS={c:'#0b1117',h:38,r:14,m:0};
  function win(x,y,w,h,frame,mull){
    L.rect(x-9,y-9,w+18,h+18,{c:frame,h:178,r:140});
    L.rect(x,y,w,h,glassS);
    if(lit()){
      L.rect(x+3,y+3,w-6,h-6,{e:pick(['#ffcf7a','#ffe2a0','#ffbd62','#cfe2ff','#ffd9a8'])});
      if(Math.random()<.6)L.rect(x+3,y+3,w-6,h*.45,{e:pick(['#a8522a','#7a6a3a','#5a7a5a','#8a3a5a'])});
    }
    L.rect(x+w/2-3,y,6,h,{c:frame,h:184,r:140});
    if(mull)L.rect(x,y+h*.34-3,w,6,{c:frame,h:184,r:140});
    L.rect(x-14,y+h+9,w+28,10,{c:'#cfc8b8',h:200,r:170}); // подоконник
  }
  if(kind==='slab5'||kind==='slab9'){
    for(let k=1;k<4;k++){L.rect(k*256-2,0,4,W,{c:'#8a8a82',h:60,r:230});L.rect(0,k*256-2,W,4,{c:'#8a8a82',h:60,r:230});}
    L.rect(0,0,4,W,{c:'#8a8a82',h:60,r:230});L.rect(0,0,W,4,{c:'#8a8a82',h:60,r:230});
    for(let b=0;b<4;b++)for(let f=0;f<4;f++){
      const x=b*256,y=f*256;
      if(kind==='slab5'){win(x+70,y+54,116,138,'#f4f1e8',true);}
      else{
        win(x+82,y+60,92,120,'#e9eceb',true);
        if(b%2){L.rect(x+14,y+176,228,66,{c:'#46688a',h:160,r:40,m:30});L.rect(x+14,y+176,228,8,{c:'#2b3946',h:200,r:120});if(lit())L.rect(x+22,y+190,212,44,{e:'#ffcf8a'});}
      }
    }
  }else if(kind==='classic'){
    for(let b=0;b<4;b++)for(let f=0;f<4;f++){
      const x=b*256,y=f*256;
      L.rect(x+44,y+24,168,200,{c:'#f3ead2',h:150,r:200});
      L.shape(g=>g.arc(x+128,y+64,60,Math.PI,0),{c:'#f3ead2',h:156,r:200});
      win(x+82,y+66,92,134,'#fff8e8',true);
    }
    for(let f=0;f<4;f++)L.rect(0,f*256+250,W,6,{c:'#cdbf9c',h:190,r:190});
  }else{ // spire
    for(let b=0;b<4;b++){L.rect(b*256+8,0,26,W,{c:'#f6edd2',h:200,r:200});L.rect(b*256+222,0,26,W,{c:'#f6edd2',h:200,r:200});}
    for(let b=0;b<4;b++)for(let f=0;f<4;f++)win(b*256+80,f*256+58,96,150,'#f8f0da',true);
    for(let f=0;f<4;f++)L.rect(0,f*256+240,W,12,{c:'#cdbf9c',h:190,r:190});
  }
  return FAC[kind]=L.finish(kind==='spire'?.35:.7,3);
}
function brickFacade(){ // стена и храм: кирпич + белокаменные арки
  if(FAC.cathedral)return FAC.cathedral;
  const W=1024,L=new Layers(W,W);
  L.rect(0,0,W,W,{c:'#a5432a',h:130,r:215});
  for(let row=0;row<32;row++)for(let c=0;c<17;c++){
    const x=c*64-(row%2)*32,y=row*32,t=Math.random();
    L.rect(x+2,y+2,60,28,{c:`rgb(${150+t*50|0},${58+t*22|0},${40+t*12|0})`,h:150+t*40|0,r:210});
    L.rect(x,y,64,2,{c:'#b4a894',h:40,r:240});L.rect(x,y,2,32,{c:'#b4a894',h:40,r:240});
  }
  for(let b=0;b<3;b++)for(let f=0;f<2;f++){
    const x=b*320+80,y=f*500+120;
    L.rect(x-10,y-10,100,200,{c:'#efe6d2',h:190,r:180});
    L.shape(g=>g.arc(x+40,y,50,Math.PI,0),{c:'#efe6d2',h:195,r:180});
    L.rect(x,y,80,170,{c:'#0b1117',h:40,r:20});
    L.shape(g=>g.arc(x+40,y,40,Math.PI,0),{c:'#0b1117',h:40,r:20});
    if(Math.random()<.4)L.rect(x+6,y+10,68,150,{e:'#ffb85a'});
  }
  return FAC.cathedral=L.finish(.6,3);
}
