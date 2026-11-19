'use strict';
// ===== Данные карты: участки зданий, деревья, миникарта =====
let MAP,MG,MAPDIRTY=false,FLAT=true;
const BUILDS=[],TREES=[];
const KN=['slab5','slab9','classic','spire','cathedral','slab12','works','depot','cabin','villa','arena','silo','mast'];
const HG={slab5:()=>rnd(135,165),slab9:()=>rnd(260,340),classic:()=>rnd(230,310),spire:()=>340,cathedral:()=>60,slab12:()=>rnd(330,420),
  works:()=>rnd(90,130),depot:()=>rnd(70,100),cabin:()=>rnd(46,60),villa:()=>rnd(64,84),arena:()=>40,silo:()=>rnd(120,200),mast:()=>520};
const BCOLS={slab5:['#d8d3bf','#cfd2c6','#dcd0b4'],slab9:['#c9ccc8','#d4d2c6','#bfc6c8'],classic:['#d9b872','#e3d2a2','#dba890','#cfa760'],spire:['#d9c9a2'],
  cathedral:['#a8412a'],slab12:['#bfc4c2','#cdc8b8','#b8bcc4','#d0c4a8'],works:['#b9a898','#a8a39a','#c2b0a0','#9c8a7a'],depot:['#8a949c','#9aa2a2','#7f8a90'],
  cabin:['#9a7a52','#8a6a44','#a8865a'],villa:['#c9a98a','#d8c8a8','#b89a80'],arena:['#cfcac0'],silo:['#aeb2b2'],mast:['#e8e8e8']};
function renderMap(){
  BUILDS.length=0;TREES.length=0;
  for(const b of MAPDATA.B){
    const kind=KN[b[4]];
    BUILDS.push({x:b[0]*TS,y:b[1]*TS,w:b[2]*TS,h:b[3]*TS,kind,hgt:HG[kind](),col:pick(BCOLS[kind]),plot:{x:b[5]*TS,y:b[6]*TS,w:b[7]*TS,h:b[8]*TS},zone:b[9]});
  }
  // деревья: лес плотный, парки редкие
  const dens=LITE?.4:1;
  for(let ty=0;ty<MH;ty++)for(let tx=0;tx<MW;tx++){
    const t=T[ty*MW+tx];
    if(t!==4&&t!==8)continue;
    const p=t===4?.85:.22;
    for(let k=0;k<(t===4?2:1);k++){
      if(Math.random()>p*dens*(k?.3:1))continue;
      const x=(tx+Math.random())*TS,y=(ty+Math.random())*TS;
      TREES.push({x,y,r:t===4?rnd(12,20):rnd(13,22)});
    }
  }
  // миникарта: исходное изображение карты (1 пиксель = TS/4 ед. мира)
  MAP=document.createElement('canvas');MAP.width=MW*4;MAP.height=MH*4;MG=MAP.getContext('2d');
  MG.fillStyle='#0d1118';MG.fillRect(0,0,MAP.width,MAP.height);
  const im=new Image();im.onload=()=>MG.drawImage(im,0,0,MAP.width,MAP.height);im.src='assets/map.png';
}
