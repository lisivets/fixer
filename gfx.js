'use strict';
// ===== Графическое ядро: HDR, карта окружения, тени, bloom, цветокоррекция =====
const GLC=document.getElementById('g');
const HQ=(()=>{if(LITE)return false;try{const c=document.createElement('canvas').getContext('webgl2');return !!(c&&c.getExtension('EXT_color_buffer_float')&&typeof THREE.EffectComposer==='function'&&typeof THREE.UnrealBloomPass==='function');}catch(e){return false;}})();
const gl=new THREE.WebGLRenderer({canvas:GLC,antialias:!HQ,powerPreference:'high-performance'});
const PR=Math.min(window.devicePixelRatio||1,LITE?1.25:2);
gl.setPixelRatio(PR);
gl.shadowMap.enabled=true;gl.shadowMap.type=THREE.PCFSoftShadowMap;
if(!HQ){gl.outputEncoding=THREE.sRGBEncoding;gl.toneMapping=THREE.ACESFilmicToneMapping;gl.toneMappingExposure=1.1;}
const scene=new THREE.Scene();
const cam3=new THREE.PerspectiveCamera(62,1,1.5,4200);
const SUNDIR=new THREE.Vector3(.55,.34,.38).normalize();
const FOGC=new THREE.Color(0.80,0.74,0.67);
scene.fog=new THREE.FogExp2(FOGC,.00052);

// --- небо: процедурный купол с облаками ---
function skyCanvas(){
  const W=1024,H=512,c=document.createElement('canvas');c.width=W;c.height=H;const g=c.getContext('2d');
  const gr=g.createLinearGradient(0,0,0,H);
  gr.addColorStop(0,'#3d5a86');gr.addColorStop(.32,'#7d94b4');gr.addColorStop(.47,'#d8c4a6');gr.addColorStop(.5,'#cdbba2');gr.addColorStop(.56,'#6f655c');gr.addColorStop(1,'#4a443f');
  g.fillStyle=gr;g.fillRect(0,0,W,H);
  const id=g.getImageData(0,0,W,H),d=id.data;
  for(let j=0;j<H*.52;j++)for(let i=0;i<W;i++){
    const u=i/W,v=j/H,n=fbmp(u,v*1.6,4,5),cl=sstep(.48,.72,n),k=(j*W+i)*4,h=1-j/(H*.52);
    const lit=.55+.45*Math.min(1,h*1.6);
    d[k]=d[k]*(1-cl*.65)+250*lit*cl*.65;d[k+1]=d[k+1]*(1-cl*.65)+238*lit*cl*.65;d[k+2]=d[k+2]*(1-cl*.65)+226*lit*cl*.65;
  }
  g.putImageData(id,0,0);
  const t=new THREE.CanvasTexture(c);t.encoding=THREE.sRGBEncoding;t.wrapS=THREE.RepeatWrapping;return t;
}
const skyTex=skyCanvas();
const skyDome=new THREE.Mesh(new THREE.SphereGeometry(3800,48,32),new THREE.MeshBasicMaterial({map:skyTex,side:THREE.BackSide,fog:false,depthWrite:false}));
skyDome.renderOrder=-10;scene.add(skyDome);
const sunSpr=(()=>{
  const c=document.createElement('canvas');c.width=c.height=128;const g=c.getContext('2d');
  const r=g.createRadialGradient(64,64,0,64,64,64);r.addColorStop(0,'rgba(255,244,214,1)');r.addColorStop(.12,'rgba(255,220,160,.9)');r.addColorStop(.4,'rgba(255,190,120,.25)');r.addColorStop(1,'rgba(255,170,90,0)');
  g.fillStyle=r;g.fillRect(0,0,128,128);
  const s=new THREE.Sprite(new THREE.SpriteMaterial({map:new THREE.CanvasTexture(c),blending:THREE.AdditiveBlending,depthWrite:false,fog:false,transparent:true}));
  s.scale.set(1100,1100,1);s.renderOrder=-9;scene.add(s);return s;
})();
// карта окружения (IBL) из того же неба + солнце
(function(){
  const es=new THREE.Scene();
  es.add(new THREE.Mesh(new THREE.SphereGeometry(100,32,16),new THREE.MeshBasicMaterial({map:skyTex,side:THREE.BackSide,color:new THREE.Color(1.05,1.05,1.05)})));
  const sn=new THREE.Mesh(new THREE.SphereGeometry(7,12,8),new THREE.MeshBasicMaterial({color:new THREE.Color(14,10,6)}));
  sn.position.copy(SUNDIR).multiplyScalar(90);es.add(sn);
  const pm=new THREE.PMREMGenerator(gl);scene.environment=pm.fromScene(es,.02).texture;pm.dispose();
})();

// --- свет ---
const hemi=new THREE.HemisphereLight(0xcfd8ec,0x5a5048,.18);scene.add(hemi);
const sun=new THREE.DirectionalLight(0xffd9aa,HQ?2.3:1.4);
sun.castShadow=true;sun.shadow.mapSize.set(LITE?2048:4096,LITE?2048:4096);
const SH=430;Object.assign(sun.shadow.camera,{left:-SH,right:SH,top:SH,bottom:-SH,near:10,far:2600});
sun.shadow.bias=-.00035;sun.shadow.normalBias=.6;scene.add(sun,sun.target);
const boom=new THREE.PointLight(0xff9a40,0,520,2);scene.add(boom);
const lampPool=[];for(let i=0;i<8;i++){const l=new THREE.PointLight(0xffc880,0,200,2);scene.add(l);lampPool.push(l);}
const headL=new THREE.SpotLight(0xfff0d0,0,420,.5,.5,1.2),headR=new THREE.SpotLight(0xfff0d0,0,420,.5,.5,1.2);
scene.add(headL,headL.target,headR,headR.target);

// --- постобработка ---
const FINAL={uniforms:{tDiffuse:{value:null},time:{value:0},exposure:{value:.82},res:{value:new THREE.Vector2(1,1)},hurt:{value:0},dim:{value:0}},
  vertexShader:'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',
  fragmentShader:[
    'uniform sampler2D tDiffuse;uniform float time;uniform float exposure;uniform vec2 res;uniform float hurt;uniform float dim;varying vec2 vUv;',
    'vec3 aces(vec3 x){const float a=2.51;const float b=0.03;const float c=2.43;const float d=0.59;const float e=0.14;return clamp((x*(a*x+b))/(x*(c*x+d)+e),0.0,1.0);}',
    'void main(){',
    ' vec2 d=vUv-0.5;float r2=dot(d,d);',
    ' vec3 c=vec3(texture2D(tDiffuse,vUv+d*r2*0.006).r,texture2D(tDiffuse,vUv).g,texture2D(tDiffuse,vUv-d*r2*0.006).b)*exposure;',
    ' c=aces(c);',
    ' float l=dot(c,vec3(0.2126,0.7152,0.0722));',
    ' c=mix(c*vec3(0.94,0.99,1.08),c*vec3(1.08,1.0,0.90),smoothstep(0.15,0.85,l));',
    ' c=mix(vec3(l),c,1.1);',
    ' c*=1.0-smoothstep(0.35,0.95,length(d)*1.35)*0.5;',
    ' c=mix(c,vec3(0.55,0.0,0.0),hurt*smoothstep(0.25,0.95,length(d)*1.5));',
    ' c=mix(c,vec3(l*0.5),dim);',
    ' c=pow(c,vec3(1.0/2.2));',
    ' float g=fract(sin(dot(vUv*res+vec2(time,time*1.7),vec2(12.9898,78.233)))*43758.5453);',
    ' c+=(g-0.5)*0.022;',
    ' gl_FragColor=vec4(c,1.0);',
    '}'].join('\n')};
const SAN={uniforms:{tDiffuse:{value:null}},
  vertexShader:'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',
  fragmentShader:['uniform sampler2D tDiffuse;varying vec2 vUv;',
    'void main(){vec3 c=texture2D(tDiffuse,vUv).rgb;',
    ' if(!(c.r==c.r)||!(c.g==c.g)||!(c.b==c.b))c=vec3(0.0);', // NaN -> 0
    ' c=clamp(c,vec3(0.0),vec3(16.0));gl_FragColor=vec4(c,1.0);}'].join('\n')};
let composer=null,bloom=null,finalPass=null;
if(HQ){
  const rt=new THREE.WebGLMultisampleRenderTarget(innerWidth*PR,innerHeight*PR,{format:THREE.RGBAFormat,type:THREE.HalfFloatType,minFilter:THREE.LinearFilter,magFilter:THREE.LinearFilter});
  rt.samples=4;
  composer=new THREE.EffectComposer(gl,rt);
  composer.addPass(new THREE.RenderPass(scene,cam3));
  composer.addPass(new THREE.ShaderPass(SAN));
  bloom=new THREE.UnrealBloomPass(new THREE.Vector2(innerWidth,innerHeight),.5,.6,1.15);
  for(const t of [bloom.renderTargetBright,...bloom.renderTargetsHorizontal,...bloom.renderTargetsVertical]){t.texture.type=THREE.HalfFloatType;t.dispose();}
  composer.addPass(bloom);
  finalPass=new THREE.ShaderPass(FINAL);composer.addPass(finalPass);
}
function resize3(){
  gl.setSize(innerWidth,innerHeight,false);cam3.aspect=innerWidth/innerHeight;cam3.updateProjectionMatrix();
  if(composer){composer.setPixelRatio(PR);composer.setSize(innerWidth,innerHeight);finalPass.uniforms.res.value.set(innerWidth*PR,innerHeight*PR);}
}
addEventListener('resize',resize3);resize3();
function renderFrame(t,hurt,dim){
  const k=cam3.far*0.9/3800; // купол и солнце целиком внутри дальней плоскости
  skyDome.position.copy(cam3.position);skyDome.scale.setScalar(k);
  sunSpr.position.copy(cam3.position).addScaledVector(SUNDIR,3500*k);sunSpr.scale.set(1100*k,1100*k,1);
  if(composer){finalPass.uniforms.time.value=t%100;finalPass.uniforms.hurt.value=hurt||0;finalPass.uniforms.dim.value=dim||0;composer.render();}
  else gl.render(scene,cam3);
}
