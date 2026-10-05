/* =========================================================
   THINK / VALUE — WebGL scene (Three.js)
   - GLSL displaced "thinking core" (noise amplitude = 推論の深さ)
   - 3D particle field morphing between formations per chapter
   - Orbit rings, bloom post-processing, mouse parallax
   ========================================================= */
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

const canvas = document.getElementById('webgl');
const isMobile = matchMedia('(max-width: 760px)').matches;
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

let renderer;
try {
  renderer = new THREE.WebGLRenderer({ canvas, antialias: !isMobile, alpha: false, powerPreference: 'high-performance' });
} catch (e) {
  canvas.style.display = 'none';
  window.dispatchEvent(new CustomEvent('webgl:ready', { detail: { ok: false } }));
  throw e;
}
renderer.setPixelRatio(Math.min(devicePixelRatio, isMobile ? 1.5 : 2));
renderer.setSize(innerWidth, innerHeight);
renderer.setClearColor(0x05060d, 1);

const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(0x05060d, 0.045);
const camera = new THREE.PerspectiveCamera(45, innerWidth / innerHeight, 0.1, 100);
camera.position.set(0, 0, 9);

/* ---------- shared GLSL noise ---------- */
const NOISE = /* glsl */`
vec3 mod289(vec3 x){return x-floor(x*(1./289.))*289.;}
vec4 mod289(vec4 x){return x-floor(x*(1./289.))*289.;}
vec4 permute(vec4 x){return mod289(((x*34.)+1.)*x);}
vec4 taylorInvSqrt(vec4 r){return 1.79284291400159-.85373472095314*r;}
float snoise(vec3 v){
  const vec2 C=vec2(1./6.,1./3.);const vec4 D=vec4(0.,.5,1.,2.);
  vec3 i=floor(v+dot(v,C.yyy));vec3 x0=v-i+dot(i,C.xxx);
  vec3 g=step(x0.yzx,x0.xyz);vec3 l=1.-g;vec3 i1=min(g.xyz,l.zxy);vec3 i2=max(g.xyz,l.zxy);
  vec3 x1=x0-i1+C.xxx;vec3 x2=x0-i2+C.yyy;vec3 x3=x0-D.yyy;
  i=mod289(i);
  vec4 p=permute(permute(permute(i.z+vec4(0.,i1.z,i2.z,1.))+i.y+vec4(0.,i1.y,i2.y,1.))+i.x+vec4(0.,i1.x,i2.x,1.));
  float n_=.142857142857;vec3 ns=n_*D.wyz-D.xzx;
  vec4 j=p-49.*floor(p*ns.z*ns.z);vec4 x_=floor(j*ns.z);vec4 y_=floor(j-7.*x_);
  vec4 x=x_*ns.x+ns.yyyy;vec4 y=y_*ns.x+ns.yyyy;vec4 h=1.-abs(x)-abs(y);
  vec4 b0=vec4(x.xy,y.xy);vec4 b1=vec4(x.zw,y.zw);
  vec4 s0=floor(b0)*2.+1.;vec4 s1=floor(b1)*2.+1.;vec4 sh=-step(h,vec4(0.));
  vec4 a0=b0.xzyw+s0.xzyw*sh.xxyy;vec4 a1=b1.xzyw+s1.xzyw*sh.zzww;
  vec3 p0=vec3(a0.xy,h.x);vec3 p1=vec3(a0.zw,h.y);vec3 p2=vec3(a1.xy,h.z);vec3 p3=vec3(a1.zw,h.w);
  vec4 norm=taylorInvSqrt(vec4(dot(p0,p0),dot(p1,p1),dot(p2,p2),dot(p3,p3)));
  p0*=norm.x;p1*=norm.y;p2*=norm.z;p3*=norm.w;
  vec4 m=max(.6-vec4(dot(x0,x0),dot(x1,x1),dot(x2,x2),dot(x3,x3)),0.);m=m*m;
  return 42.*dot(m*m,vec4(dot(p0,x0),dot(p1,x1),dot(p2,x2),dot(p3,x3)));
}`;

/* ---------- Core (the "thinking" orb) ---------- */
const coreUniforms = {
  uTime: { value: 0 }, uAmp: { value: 0.25 }, uFreq: { value: 1.2 },
  uColA: { value: new THREE.Color('#5ef2ff') }, uColB: { value: new THREE.Color('#b56cff') },
  uColC: { value: new THREE.Color('#ff5ec8') }, uPulse: { value: 0 }
};
const coreMat = new THREE.ShaderMaterial({
  uniforms: coreUniforms,
  vertexShader: NOISE + /* glsl */`
    uniform float uTime,uAmp,uFreq,uPulse;
    varying float vN; varying vec3 vNormal; varying vec3 vView;
    void main(){
      vec3 p=position;
      float n=snoise(p*uFreq+vec3(uTime*.25));
      float n2=snoise(p*uFreq*2.7-vec3(uTime*.4))*.35;
      float d=(n+n2)*uAmp+uPulse*.15*sin(uTime*6.+p.y*4.);
      p+=normal*d; vN=n;
      vec4 mv=modelViewMatrix*vec4(p,1.);
      vNormal=normalize(normalMatrix*normal); vView=normalize(-mv.xyz);
      gl_Position=projectionMatrix*mv;
    }`,
  fragmentShader: /* glsl */`
    uniform vec3 uColA,uColB,uColC; uniform float uTime;
    varying float vN; varying vec3 vNormal; varying vec3 vView;
    void main(){
      float fres=pow(1.-max(dot(vNormal,vView),0.),2.2);
      vec3 c=mix(uColA,uColB,smoothstep(-.6,.6,vN));
      c=mix(c,uColC,smoothstep(.35,.9,vN));
      float bands=.5+.5*sin(vN*18.-uTime*1.5);
      c*=.35+.65*bands*.6+fres*1.6;
      gl_FragColor=vec4(c,1.);
    }`
});
const core = new THREE.Mesh(new THREE.IcosahedronGeometry(1.35, isMobile ? 48 : 96), coreMat);
const coreGroup = new THREE.Group();
coreGroup.add(core);

const shell = new THREE.LineSegments(
  new THREE.WireframeGeometry(new THREE.IcosahedronGeometry(2.05, 2)),
  new THREE.LineBasicMaterial({ color: 0x8f9cff, transparent: true, opacity: 0.16 })
);
coreGroup.add(shell);

/* orbit rings */
const rings = [];
const ringCols = [0x5ef2ff, 0xb56cff, 0xff5ec8];
for (let i = 0; i < 3; i++) {
  const r = new THREE.Mesh(
    new THREE.TorusGeometry(2.6 + i * 0.55, 0.008 + i * 0.002, 8, 220),
    new THREE.MeshBasicMaterial({ color: ringCols[i], transparent: true, opacity: 0.55 })
  );
  r.rotation.set(Math.PI / 2 + i * 0.35, i * 0.6, 0);
  // satellite
  const sat = new THREE.Mesh(new THREE.SphereGeometry(0.06, 16, 16), new THREE.MeshBasicMaterial({ color: ringCols[i] }));
  sat.position.x = 2.6 + i * 0.55;
  r.add(sat);
  rings.push(r);
  coreGroup.add(r);
}
scene.add(coreGroup);

/* ---------- Particle field with formations ---------- */
const COUNT = isMobile ? 5000 : 12000;
const F = 5; // number of formations
const formations = Array.from({ length: F }, () => new Float32Array(COUNT * 3));
const seeds = new Float32Array(COUNT);
const rnd = (a, b) => a + Math.random() * (b - a);
for (let i = 0; i < COUNT; i++) {
  const i3 = i * 3; seeds[i] = Math.random();
  // 0: nebula cloud (sphere volume)
  {
    const r = Math.cbrt(Math.random()) * 9 + 2.5, t = Math.random() * Math.PI * 2, p = Math.acos(rnd(-1, 1));
    formations[0].set([r * Math.sin(p) * Math.cos(t), r * Math.sin(p) * Math.sin(t) * 0.7, r * Math.cos(p) - 2], i3);
  }
  // 1: two routes (FAST straight stream / THINK spiral stream)
  {
    const u = Math.random(); const x = -7 + u * 14;
    if (i % 2 === 0) formations[1].set([x, 2.2 + rnd(-.15, .15), rnd(-.3, .3) - 1], i3);
    else { const a = u * Math.PI * 10; formations[1].set([x, -2.0 + Math.sin(a) * 0.9, Math.cos(a) * 0.9 - 1], i3); }
  }
  // 2: galaxy disk (orbit / performance)
  {
    const arm = i % 4, r = Math.pow(Math.random(), 0.6) * 8 + 1.6, a = arm * Math.PI / 2 + r * 0.55 + rnd(-.25, .25);
    formations[2].set([Math.cos(a) * r, rnd(-.18, .18) * (9 - r) * 0.15, Math.sin(a) * r - 1], i3);
  }
  // 3: stacked layers (tiers / formula)
  {
    const layer = i % 4, s = 7 - layer * 1.1;
    formations[3].set([rnd(-s, s), -3 + layer * 1.6 + rnd(-.05, .05), rnd(-s, s) * 0.5 - 2], i3);
  }
  // 4: double helix → convergence (conclusion / trust)
  {
    const u = Math.random(), a = u * Math.PI * 8, side = i % 2 ? 0 : Math.PI, rr = 1.8 + rnd(-.12, .12);
    formations[4].set([Math.cos(a + side) * rr, -7 + u * 14, Math.sin(a + side) * rr - 1], i3);
  }
}
const pGeo = new THREE.BufferGeometry();
pGeo.setAttribute('position', new THREE.BufferAttribute(formations[0].slice(), 3));
pGeo.setAttribute('aFrom', new THREE.BufferAttribute(formations[0].slice(), 3));
pGeo.setAttribute('aTo', new THREE.BufferAttribute(formations[0].slice(), 3));
pGeo.setAttribute('aSeed', new THREE.BufferAttribute(seeds, 1));

const pUniforms = {
  uTime: { value: 0 }, uMix: { value: 1 }, uSize: { value: isMobile ? 26 : 34 },
  uPR: { value: renderer.getPixelRatio() }, uColA: { value: new THREE.Color('#5ef2ff') },
  uColB: { value: new THREE.Color('#b56cff') }, uTurb: { value: 0.3 }
};
const pMat = new THREE.ShaderMaterial({
  uniforms: pUniforms, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  vertexShader: NOISE + /* glsl */`
    uniform float uTime,uMix,uSize,uPR,uTurb;
    attribute vec3 aFrom,aTo; attribute float aSeed;
    varying float vSeed; varying float vAlpha;
    void main(){
      float d=clamp((uMix-aSeed*.35)/(1.-.35),0.,1.);
      d=d<.5?4.*d*d*d:1.-pow(-2.*d+2.,3.)/2.;
      vec3 p=mix(aFrom,aTo,d);
      float mid=sin(d*3.14159);
      p+=vec3(snoise(p*.25+uTime*.1),snoise(p*.25+11.+uTime*.1),snoise(p*.25+23.))*(uTurb+mid*1.4);
      vec4 mv=modelViewMatrix*vec4(p,1.);
      gl_PointSize=uSize*uPR*(.35+aSeed*.9)/-mv.z;
      gl_Position=projectionMatrix*mv;
      vSeed=aSeed; vAlpha=smoothstep(26.,4.,-mv.z);
    }`,
  fragmentShader: /* glsl */`
    uniform vec3 uColA,uColB; uniform float uTime;
    varying float vSeed; varying float vAlpha;
    void main(){
      vec2 uv=gl_PointCoord-.5; float r=length(uv);
      float a=smoothstep(.5,0.,r); a*=a;
      float tw=.6+.4*sin(uTime*2.+vSeed*40.);
      vec3 c=mix(uColA,uColB,vSeed);
      gl_FragColor=vec4(c,a*vAlpha*tw*.9);
    }`
});
const points = new THREE.Points(pGeo, pMat);
scene.add(points);

/* background star dust */
{
  const n = 2500, g = new THREE.BufferGeometry(), a = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) a.set([rnd(-40, 40), rnd(-25, 25), rnd(-40, -10)], i * 3);
  g.setAttribute('position', new THREE.BufferAttribute(a, 3));
  scene.add(new THREE.Points(g, new THREE.PointsMaterial({ color: 0x8890c8, size: 0.05, transparent: true, opacity: 0.6, depthWrite: false })));
}

/* ---------- Post processing ---------- */
const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
const bloom = new UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), 1.1, 0.7, 0.12);
composer.addPass(bloom);
composer.addPass(new OutputPass());

/* ---------- Chapter configs ---------- */
// amp = displacement (≒ 推論の深さ), form = particle formation, x = core horizontal offset
const C = (a, b, c) => [new THREE.Color(a), new THREE.Color(b), new THREE.Color(c)];
const SCENES = [
  { amp: .30, freq: 1.1, form: 0, x: 2.6, y: 0,  z: 9,  scale: 1.15, cols: C('#5ef2ff', '#b56cff', '#ff5ec8'), bloom: 1.2 }, // hero
  { amp: .18, freq: 1.0, form: 0, x: -3.2, y: 0, z: 10, scale: .9,  cols: C('#ff7a59', '#ffffff', '#5fffb0'), bloom: 1.0 }, // intro (cost/benefit)
  { amp: .22, freq: 1.4, form: 1, x: 3.2, y: 0,  z: 10, scale: .85, cols: C('#5ef2ff', '#3b82ff', '#ff5ec8'), bloom: 1.1 }, // ch1 routes
  { amp: .55, freq: 2.0, form: 0, x: -3.2, y: 0, z: 9,  scale: .95, cols: C('#5ef2ff', '#b56cff', '#ff5ec8'), bloom: 1.3 }, // ch2 deep thinking
  { amp: .32, freq: 1.3, form: 2, x: 3.2, y: .3, z: 11, scale: .9,  cols: C('#5ef2ff', '#b56cff', '#ffd66b'), bloom: 1.15 },// ch3 performance
  { amp: .2,  freq: 1.0, form: 3, x: -3.2, y: 0, z: 10, scale: .85, cols: C('#3b82ff', '#b56cff', '#ff5ec8'), bloom: 1.0 }, // ch4 tiers
  { amp: .42, freq: 3.2, form: 0, x: 3.2, y: 0,  z: 10, scale: .85, cols: C('#ff5ec8', '#b56cff', '#ffd66b'), bloom: 1.1 }, // ch5 personality drift
  { amp: .3,  freq: 1.6, form: 1, x: 0, y: -1.8, z: 12, scale: .8,  cols: C('#b56cff', '#5ef2ff', '#ff5ec8'), bloom: 1.05 },// ch6 compare
  { amp: .26, freq: 1.2, form: 3, x: 3.2, y: 0,  z: 10, scale: .85, cols: C('#5fffb0', '#ffd66b', '#ff7a59'), bloom: 1.15 },// ch7 formula
  { amp: .35, freq: 1.5, form: 2, x: -3.2, y: 0, z: 10, scale: .85, cols: C('#5ef2ff', '#ff5ec8', '#b56cff'), bloom: 1.1 }, // ch8 students
  { amp: .14, freq: .9,  form: 4, x: 3.2, y: 0,  z: 10, scale: .85, cols: C('#5ef2ff', '#b56cff', '#5fffb0'), bloom: 1.0 }, // ch9 trust
  { amp: .6,  freq: 1.4, form: 4, x: 0, y: 0,    z: 8.5, scale: 1.25, cols: C('#5fffb0', '#5ef2ff', '#ff5ec8'), bloom: 1.5 } // conclusion
];
if (isMobile) SCENES.forEach(s => { s.x = 0; s.y = s.y || 0; s.z += 3; });

let current = 0, currentForm = 0;
const target = { ...SCENES[0] };
const live = { amp: .3, freq: 1.1, x: SCENES[0].x, y: 0, z: 9, scale: 1.15, bloom: 1.2 };
const colLive = SCENES[0].cols.map(c => c.clone());

function morphTo(form) {
  if (form === currentForm) return;
  // capture the current interpolated state (same easing as the shader) so an
  // interrupted morph continues smoothly instead of jumping
  const from = pGeo.attributes.aFrom.array, to = pGeo.attributes.aTo.array, m = pUniforms.uMix.value;
  for (let i = 0; i < COUNT; i++) {
    let d = Math.min(1, Math.max(0, (m - seeds[i] * 0.35) / 0.65));
    d = d < 0.5 ? 4 * d * d * d : 1 - Math.pow(-2 * d + 2, 3) / 2;
    const i3 = i * 3;
    from[i3] += (to[i3] - from[i3]) * d;
    from[i3 + 1] += (to[i3 + 1] - from[i3 + 1]) * d;
    from[i3 + 2] += (to[i3 + 2] - from[i3 + 2]) * d;
  }
  to.set(formations[form]);
  pGeo.attributes.aFrom.needsUpdate = true;
  pGeo.attributes.aTo.needsUpdate = true;
  pUniforms.uMix.value = 0;
  currentForm = form;
}

window.addEventListener('scene:change', e => {
  const i = Math.max(0, Math.min(SCENES.length - 1, e.detail.index));
  if (i === current) return;
  current = i;
  Object.assign(target, SCENES[i]);
  morphTo(SCENES[i].form);
  coreUniforms.uPulse.value = 1;
});

/* external hooks from widgets (e.g. TEST-TIME COMPUTE slider) */
let ampBoost = 0;
window.addEventListener('scene:think', e => { ampBoost = e.detail.value; });

/* ---------- Input ---------- */
const mouse = new THREE.Vector2(), mouseL = new THREE.Vector2();
addEventListener('pointermove', e => { mouse.set(e.clientX / innerWidth * 2 - 1, -(e.clientY / innerHeight) * 2 + 1); });
let scrollVel = 0, lastY = scrollY;

addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight); composer.setSize(innerWidth, innerHeight);
});

/* ---------- Loop ---------- */
const clock = new THREE.Clock();
let visible = true;
document.addEventListener('visibilitychange', () => { visible = !document.hidden; });

function tick() {
  requestAnimationFrame(tick);
  if (!visible) return;
  const dt = Math.min(clock.getDelta(), 0.05), t = clock.elapsedTime;
  const k = 1 - Math.pow(0.04, dt); // frame-rate independent lerp

  // scroll velocity
  const y = scrollY; scrollVel += ((y - lastY) - scrollVel) * 0.1; lastY = y;
  const sv = Math.min(Math.abs(scrollVel) / 40, 1);

  live.amp += ((target.amp + ampBoost * 0.6 + sv * 0.25) - live.amp) * k;
  live.freq += (target.freq - live.freq) * k;
  live.x += (target.x - live.x) * k * 0.8;
  live.y += (target.y - live.y) * k * 0.8;
  live.z += (target.z - live.z) * k * 0.8;
  live.scale += (target.scale - live.scale) * k;
  live.bloom += (target.bloom - live.bloom) * k;
  colLive.forEach((c, i) => c.lerp(target.cols[i], k));

  coreUniforms.uTime.value = t;
  coreUniforms.uAmp.value = live.amp;
  coreUniforms.uFreq.value = live.freq;
  coreUniforms.uColA.value.copy(colLive[0]);
  coreUniforms.uColB.value.copy(colLive[1]);
  coreUniforms.uColC.value.copy(colLive[2]);
  coreUniforms.uPulse.value *= 0.96;

  pUniforms.uTime.value = t;
  pUniforms.uMix.value = Math.min(1, pUniforms.uMix.value + dt * 0.45);
  pUniforms.uColA.value.copy(colLive[0]);
  pUniforms.uColB.value.copy(colLive[1]);
  pUniforms.uTurb.value = 0.18 + sv * 0.6;

  bloom.strength = live.bloom;

  mouseL.lerp(mouse, k * 0.6);
  coreGroup.position.set(live.x + mouseL.x * 0.3, live.y + mouseL.y * 0.2, 0);
  coreGroup.scale.setScalar(live.scale);
  const spin = reduced ? 0 : 1;
  core.rotation.y += dt * 0.15 * spin;
  shell.rotation.y -= dt * 0.08 * spin; shell.rotation.x += dt * 0.04 * spin;
  rings.forEach((r, i) => { r.rotation.z += dt * (0.25 + i * 0.12) * (i % 2 ? -1 : 1) * spin; });

  points.rotation.y += dt * 0.02 * spin + scrollVel * 0.00004;
  if (currentForm === 4) points.rotation.y += dt * 0.15 * spin;

  camera.position.x += (mouseL.x * 0.6 - camera.position.x) * k;
  camera.position.y += (mouseL.y * 0.4 - camera.position.y) * k;
  camera.position.z += (live.z - camera.position.z) * k;
  camera.lookAt(0, 0, 0);

  composer.render();
}
tick();
window.dispatchEvent(new CustomEvent('webgl:ready', { detail: { ok: true } }));
window.__webglReady = true;
