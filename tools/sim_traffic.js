// Прогон трафика без рендера и подсчёт нарушений: проезд на красный, стоянка на своей зебре, непропуск пешеходов, пешеходы на проезжей части вне зебр.
// Запуск: python3 -m http.server 8777 (из корня), затем node tools/sim_traffic.js <номер сцены> <кадров>. Нужен playwright; three.js — локальной копией (_three) или CDN.
// Цель: redViol, zebraStopped, zebraNoYield, pedOffZebra = 0 за длинный прогон (9000 кадров).
const {chromium}=require('playwright');
(async()=>{const idx=+process.argv[2]||0,frames=+process.argv[3]||6000;
const b=await chromium.launch({args:['--use-gl=swiftshader','--enable-unsafe-swiftshader']});
const p=await b.newPage();await p.addInitScript(()=>{window.__LITE=true;});
const errs=[];p.on('pageerror',e=>errs.push(e.message));
await p.goto('http://localhost:8777/index.html');
await p.waitForFunction(()=>typeof TL!=='undefined'&&TL.ready&&cars.length>0,null,{timeout:120000});
const r=await p.evaluate(([idx,frames])=>{
  state='play';window.__step=step;step=function(){};
  const zs=RN.zebras.filter(z=>z.len>100);const z0=zs[(idx*37)%zs.length];
  // игрок на тротуаре рядом (не на зебре), чтобы вокруг был трафик и пешеходы
  let spot=null;for(let r=240;r<420&&!spot;r+=20)for(let k=0;k<16;k++){const a=k*Math.PI/8,x=z0.x+Math.cos(a)*r,y=z0.y+Math.sin(a)*r;if(tileAt(Math.floor(x/TS),Math.floor(y/TS))===1&&zebraAt(x,y)<0){spot=[x,y];break;}}
  P.x=spot[0];P.y=spot[1];P.hp=1e9;P.car=null;
  const S={frames,z:[Math.round(z0.x),Math.round(z0.y)],pass:{g:0,y:0,r:0},redViol:0,redLate:0,zebraStopped:0,zebraNoYield:0,pedOffZebra:0,crossings:0,samples:[]};
  const info=new Map(),pm=new Map(),zst=new Map();
  for(let f=0;f<frames;f++){
    __step(true);P.hp=1e9;P.x=spot[0];P.y=spot[1];
    for(const c of cars){
      if(c.ai!=='traffic'||c.dead||c.edge===undefined)continue;
      const L=lightAhead(c,c.edge);if(!L){info.delete(c.id);continue;}
      const vf=c.vx*Math.cos(c.a)+c.vy*Math.sin(c.a);let q=info.get(c.id);
      if(!q||q.edge!==c.edge){q={edge:c.edge,d:L.d,red:null};info.set(c.id,q);}
      if(L.c==='r'&&L.d>0&&!q.red)q.red={d:L.d,v:vf,f};     // первый кадр красного, пока машина ещё до линии
      if(L.c!=='r')q.red=null;
      if(q.d>-8&&L.d<=-8){
        S.pass[L.c]++;
        if(L.c==='r'){
          const el=TL.G+TL.Y+2*TL.AR-L.left;
          if(q.red&&q.red.d>1.8*Math.max(q.red.v,0)+4){S.redViol++;S.samples.length<6&&S.samples.push({f,type:c.type,sp:+c.speed.toFixed(2),red0:q.red,el});}
          if(el>40)S.redLate++;
        }
      }
      q.d=L.d;
    }
    const onZ=new Set();
    for(const z of RN.zebras){
      for(const c of cars){
        if(c.dead||c.ai==='cop'||c.edge===undefined)continue;
        // только зебры своего подъезда/выезда: z.edge — текущее или следующее ребро машины
        if(!((z.edge===c.edge&&z.end===(c.ed>0?1:0))||(c.nxt&&z.edge===c.nxt[0]&&z.end===(c.nxt[1]>0?0:1))))continue;
        const dx=c.x-z.x,dy=c.y-z.y;if(Math.abs(dx)>90||Math.abs(dy)>90)continue;
        const ar=Math.abs(dx*z.rx+dy*z.ry),aa=Math.abs(dx*z.ax+dy*z.ay);
        if(ar<z.wid/2+c.len/2*.6&&aa<z.len/2){
          const L=lightAhead(c,c.edge);
          if(c.speed<.3&&c.ai==='traffic'&&!(L&&L.d>-12&&L.d<30)){
            onZ.add(c.id);const k=(zst.get(c.id)||0)+1;zst.set(c.id,k);
            if(k===120){S.zebraStopped++;S.samples.length<14&&S.samples.push({f,zs:'stopped120',type:c.type,edge:c.edge,nxt:c.nxt,zedge:z.edge,L:L&&[Math.round(L.d),L.c],g:leadGap(c,220,false)});}
          }
          if(c.speed>.5&&z.occ>0){
            let hit=false;for(const q of peds){if(q.dead||tileAt(Math.floor(q.x/TS),Math.floor(q.y/TS))!==0)continue;if(zebraAt(q.x,q.y)<0)continue;const qa=Math.abs((q.x-c.x)*(-Math.sin(c.a))+(q.y-c.y)*Math.cos(c.a));if(qa<c.wid/2+10)hit=true;}
            if(hit){if(!S.nydbg){S.nydbg={f,car:{x:Math.round(c.x),y:Math.round(c.y),a:+c.a.toFixed(2),edge:c.edge,ed:c.ed,s:Math.round(c.s),sp:+c.speed.toFixed(2),nxt:c.nxt,dbg:c._dbg},zebra:{zi:RN.zebras.indexOf(z),edge:z.edge,end:z.end,occ:z.occ,x:Math.round(z.x),y:Math.round(z.y),rx:+z.rx.toFixed(2),ry:+z.ry.toFixed(2),ax:+z.ax.toFixed(2),ay:+z.ay.toFixed(2),wid:z.wid,len:Math.round(z.len)},ar:Math.round(ar),aa:Math.round(aa),peds:peds.filter(q=>!q.dead&&zebraAt(q.x,q.y)>=0).map(q=>({m:q.mode,x:Math.round(q.x),y:Math.round(q.y),t:tileAt(Math.floor(q.x/TS),Math.floor(q.y/TS))})),gap:leadGap(c,220,false)};}S.zebraNoYield++;S.samples.length<14&&S.samples.push({f,zs:'noyield',type:c.type,sp:+c.speed.toFixed(2),L:L&&[Math.round(L.d),L.c],occ:z.occ});}
          }
        }
      }
    }
    for(const id of [...zst.keys()])if(!onZ.has(id))zst.delete(id);
    for(const q of peds){
      if(q.dead||q.kind!=='civ')continue;
      const t=tileAt(Math.floor(q.x/TS),Math.floor(q.y/TS));
      if(t===0&&zebraAt(q.x,q.y)<0&&!(q.flee>0)&&q.mode!=='ret'&&!(q.prevFlee>0))S.pedOffZebra++;
      q.prevFlee=q.flee;
      const pv=pm.get(q);if(q.mode==='cross'&&pv!=='cross')S.crossings++;pm.set(q,q.mode);
    }
  }
  S.cars=cars.filter(c=>c.ai==='traffic').length;S.civ=peds.filter(q=>q.kind==='civ'&&!q.dead).length;return S;},[idx,frames]);
console.log(JSON.stringify(r));console.log(errs.slice(0,3).join('\n')||'no errors');await b.close();})();
