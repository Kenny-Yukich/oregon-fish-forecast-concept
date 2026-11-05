/* The hero's one shader: only the river in the supplied illustration moves.
   A mask of the river is built once on the CPU from the artwork's own blue, closed so the painted
   foam lines count as water, then the shader redraws that area as flowing water with the same flat
   foam style. A pointer or touch sends a ripple through the water. The static image underneath stays
   in place, so a failed load, a lost context or reduced motion simply shows the original artwork. */
import * as THREE from '../vendor/three.module.min.js';

const VERT = `
varying vec2 vUv;
void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`;

const FRAG = `
precision highp float;
varying vec2 vUv;
uniform sampler2D uTex;
uniform sampler2D uMask;
uniform float uTime;
uniform vec2 uScale;
uniform vec2 uOffset;
uniform vec2 uPointer;
uniform float uPointerAmt;
uniform float uAspect;
uniform vec3 uWater;
uniform vec3 uWaterDeep;
uniform vec3 uFoam;
uniform vec3 uPaper;

vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec2 mod289(vec2 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec3 permute(vec3 x) { return mod289(((x * 34.0) + 1.0) * x); }
float snoise(vec2 v) {
  const vec4 C = vec4(0.211324865405187, 0.366025403784439, -0.577350269189626, 0.024390243902439);
  vec2 i = floor(v + dot(v, C.yy));
  vec2 x0 = v - i + dot(i, C.xx);
  vec2 i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
  vec4 x12 = x0.xyxy + C.xxzz;
  x12.xy -= i1;
  i = mod289(i);
  vec3 p = permute(permute(i.y + vec3(0.0, i1.y, 1.0)) + i.x + vec3(0.0, i1.x, 1.0));
  vec3 m = max(0.5 - vec3(dot(x0, x0), dot(x12.xy, x12.xy), dot(x12.zw, x12.zw)), 0.0);
  m = m * m; m = m * m;
  vec3 x = 2.0 * fract(p * C.www) - 1.0;
  vec3 h = abs(x) - 0.5;
  vec3 ox = floor(x + 0.5);
  vec3 a0 = x - ox;
  m *= 1.79284291400159 - 0.85373472095314 * (a0 * a0 + h * h);
  vec3 g;
  g.x = a0.x * x0.x + h.x * x0.y;
  g.yz = a0.yz * x12.xz + h.yz * x12.yw;
  return 130.0 * dot(m, g);
}

void main() {
  vec2 uv = (vUv - 0.5) * uScale + 0.5 + uOffset;
  vec4 texel = texture2D(uTex, uv);
  vec4 base = vec4(mix(uPaper, texel.rgb, texel.a), 1.0);
  float m = texture2D(uMask, uv).r;
  if (m < 0.003) { gl_FragColor = base; return; }

  vec2 p = uv * vec2(uAspect, 1.0);
  vec2 pu = ((uPointer - 0.5) * uScale + 0.5 + uOffset) * vec2(uAspect, 1.0);
  float dist = length(p - pu);
  float ripple = sin(dist * 70.0 - uTime * 4.0) * exp(-dist * 7.0) * uPointerAmt;

  vec2 q = p + vec2(ripple * 0.004, ripple * 0.012);
  float warp = snoise(q * vec2(1.6, 3.2) + vec2(-uTime * 0.05, 0.0));
  vec2 sp = vec2(q.x * 4.2 - uTime * 0.16, q.y * 24.0 + warp * 1.8);
  float foam = smoothstep(0.56, 0.6, snoise(sp));
  float shade = smoothstep(-0.2, 0.8, snoise(q * vec2(2.4, 5.0) + vec2(-uTime * 0.09, 3.0)));

  vec3 water = mix(uWater, uWaterDeep, shade * 0.38);
  water = mix(water, uFoam, foam * 0.94);
  water += ripple * 0.06;
  gl_FragColor = vec4(mix(base.rgb, water, m), 1.0);
}`;

// River mask from the artwork's own colors, at half resolution.
function buildMask(img) {
  const w = 640, h = Math.round(w * img.naturalHeight / img.naturalWidth);
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const g = c.getContext('2d', {willReadFrequently: true});
  g.drawImage(img, 0, 0, w, h);
  const px = g.getImageData(0, 0, w, h).data;
  let m = new Float32Array(w * h);
  let sr = 0, sg = 0, sb = 0, count = 0, dr = 0, dg = 0, db = 0, dark = 0;
  for (let i = 0; i < w * h; i++) {
    const r = px[i * 4] / 255, gg = px[i * 4 + 1] / 255, b = px[i * 4 + 2] / 255;
    if (b > 0.6 && b - r > 0.3 && gg > 0.33 && gg < 0.8 && r < 0.45) {
      m[i] = 1; sr += r; sg += gg; sb += b; count++;
      if (gg < 0.47) { dr += r; dg += gg; db += b; dark++; }
    }
  }
  if (count < 500) return null;
  // Keep only the largest connected blue region (the river), dropping anti-aliased specks on rocks and peaks.
  {
    const label = new Int32Array(w * h), stack = new Int32Array(w * h);
    let best = 0, bestSize = 0, next = 0;
    for (let s = 0; s < w * h; s++) {
      if (!m[s] || label[s]) continue;
      next++; let size = 0, top = 0;
      stack[top++] = s; label[s] = next;
      while (top) {
        const i = stack[--top]; size++;
        const x = i % w, y = (i - x) / w;
        const nb = [x > 0 ? i - 1 : -1, x < w - 1 ? i + 1 : -1, y > 0 ? i - w : -1, y < h - 1 ? i + w : -1];
        for (const j of nb) if (j >= 0 && m[j] && !label[j]) { label[j] = next; stack[top++] = j; }
      }
      if (size > bestSize) { bestSize = size; best = next; }
    }
    for (let i = 0; i < w * h; i++) m[i] = label[i] === best ? 1 : 0;
  }
  // Morphological closing (dilate then erode), separable, so thin foam lines inside the river count as water.
  const pass = (src, horizontal, radius, op) => {
    const out = new Float32Array(w * h);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      let v = op === 'max' ? 0 : 1;
      for (let k = -radius; k <= radius; k++) {
        const xx = horizontal ? x + k : x, yy = horizontal ? y : y + k;
        if (xx < 0 || yy < 0 || xx >= w || yy >= h) continue;
        const s = src[yy * w + xx];
        v = op === 'max' ? Math.max(v, s) : Math.min(v, s);
      }
      out[y * w + x] = v;
    }
    return out;
  };
  const R = 4;
  m = pass(pass(m, true, R, 'max'), false, R, 'max');
  m = pass(pass(m, true, R, 'min'), false, R, 'min');
  // Closing may only claim foam: river blue, light paint or the artwork's transparent holes. Rocks and trees stay put.
  for (let i = 0; i < w * h; i++) {
    if (!m[i]) continue;
    const r = px[i * 4] / 255, gg = px[i * 4 + 1] / 255, b = px[i * 4 + 2] / 255, a = px[i * 4 + 3] / 255;
    const blue = b > 0.55 && b - r > 0.25 && gg > 0.3;
    const light = a < 0.5 || (r > 0.78 && gg > 0.78 && b > 0.7);
    if (!blue && !light) m[i] = 0;
  }
  const allowed = new Uint8Array(w * h);
  for (let i = 0; i < w * h; i++) {
    const r = px[i * 4] / 255, gg = px[i * 4 + 1] / 255, b = px[i * 4 + 2] / 255, a = px[i * 4 + 3] / 255;
    allowed[i] = (b > 0.55 && b - r > 0.25 && gg > 0.3) || a < 0.5 || (r > 0.78 && gg > 0.78 && b > 0.7) ? 1 : 0;
  }
  // Two-pixel box blur for a soft painted edge.
  const data = new Uint8Array(w * h * 4);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    let s = 0, n = 0;
    for (let j = -2; j <= 2; j++) for (let i = -2; i <= 2; i++) {
      const xx = x + i, yy = y + j;
      if (xx < 0 || yy < 0 || xx >= w || yy >= h) continue;
      s += m[yy * w + xx]; n++;
    }
    // Texture rows run bottom-up to match the image texture's flipY.
    const o = ((h - 1 - y) * w + x) * 4, v = allowed[y * w + x] ? Math.round(255 * Math.min(1, Math.max(0, (s / n - 0.15) / 0.7))) : 0;
    data[o] = data[o + 1] = data[o + 2] = v; data[o + 3] = 255;
  }
  const water = [sr / count, sg / count, sb / count];
  const deep = dark > 50 ? [dr / dark, dg / dark, db / dark] : water.map(v => v * 0.82);
  return {data, w, h, water, deep};
}

// The artwork has a transparent background, so the shader composites it over the frame's own paper color.
function paperOf(el) {
  const c = document.createElement('canvas'); c.width = c.height = 1;
  const g = c.getContext('2d');
  g.fillStyle = getComputedStyle(el).backgroundColor; g.fillRect(0, 0, 1, 1);
  const [r, gg, b] = g.getImageData(0, 0, 1, 1).data;
  return [r / 255, gg / 255, b / 255];
}

export function mountRiver(figure) {
  const frame = figure.querySelector('.plate-frame');
  const img = figure.querySelector('.plate-img');
  let renderer, material, geometry, tex, maskTex, raf = 0, visible = true, alive = true;
  const cleanups = [];
  const on = (el, type, fn, opts) => { el.addEventListener(type, fn, opts); cleanups.push(() => el.removeEventListener(type, fn, opts)); };

  const destroy = () => {
    alive = false;
    cancelAnimationFrame(raf);
    cleanups.forEach(fn => fn());
    figure.classList.remove('live');
    geometry?.dispose(); material?.dispose(); tex?.dispose(); maskTex?.dispose();
    if (renderer) { renderer.dispose(); renderer.domElement.remove(); }
  };

  const start = async () => {
    if (!img.complete) await new Promise((res, rej) => { img.addEventListener('load', res, {once: true}); img.addEventListener('error', rej, {once: true}); });
    await img.decode?.().catch(() => {});
    if (!alive) return;
    const mask = buildMask(img);
    if (!mask || !alive) return;

    renderer = new THREE.WebGLRenderer({antialias: false, alpha: false, powerPreference: 'low-power'});
    renderer.outputColorSpace = THREE.LinearSRGBColorSpace;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
    const canvas = renderer.domElement;
    canvas.setAttribute('aria-hidden', 'true');
    frame.appendChild(canvas);

    // Upload from a canvas of explicit size; some GPUs reject a direct WebP image upload.
    const src = document.createElement('canvas');
    src.width = img.naturalWidth; src.height = img.naturalHeight;
    src.getContext('2d').drawImage(img, 0, 0);
    tex = new THREE.CanvasTexture(src);
    tex.colorSpace = THREE.NoColorSpace;
    tex.minFilter = THREE.LinearFilter; tex.generateMipmaps = false;
    tex.needsUpdate = true;
    maskTex = new THREE.DataTexture(mask.data, mask.w, mask.h, THREE.RGBAFormat);
    maskTex.minFilter = maskTex.magFilter = THREE.LinearFilter;
    maskTex.needsUpdate = true;

    const uniforms = {
      uTex: {value: tex}, uMask: {value: maskTex}, uTime: {value: 0},
      uScale: {value: new THREE.Vector2(1, 1)}, uOffset: {value: new THREE.Vector2(0, 0)},
      uPointer: {value: new THREE.Vector2(0.5, 0.3)}, uPointerAmt: {value: 0},
      uAspect: {value: img.naturalWidth / img.naturalHeight},
      uWater: {value: new THREE.Vector3(...mask.water)}, uWaterDeep: {value: new THREE.Vector3(...mask.deep)},
      uFoam: {value: new THREE.Vector3(0.965, 0.955, 0.91)},
      uPaper: {value: new THREE.Vector3(...paperOf(frame))}
    };
    material = new THREE.ShaderMaterial({vertexShader: VERT, fragmentShader: FRAG, uniforms, depthTest: false, depthWrite: false});
    geometry = new THREE.PlaneGeometry(2, 2);
    const scene = new THREE.Scene(), camera = new THREE.Camera();
    scene.add(new THREE.Mesh(geometry, material));

    // Match the image's object-fit: cover and object-position: 50% 62%.
    const resize = () => {
      const r = frame.getBoundingClientRect();
      if (!r.width || !r.height) return;
      renderer.setSize(r.width, r.height, false);
      const ca = r.width / r.height, ia = uniforms.uAspect.value;
      const sx = ca < ia ? ca / ia : 1, sy = ca > ia ? ia / ca : 1;
      uniforms.uScale.value.set(sx, sy);
      uniforms.uOffset.value.set(0, (1 - sy) * (0.5 - 0.62));
    };
    resize();
    const ro = new ResizeObserver(resize); ro.observe(frame); cleanups.push(() => ro.disconnect());

    // Pointer input is sampled once per frame, never per event.
    let target = 0, pending = null;
    const point = e => {
      const r = frame.getBoundingClientRect();
      pending = [(e.clientX - r.left) / r.width, 1 - (e.clientY - r.top) / r.height];
      target = 1;
    };
    on(frame, 'pointermove', point, {passive: true});
    on(frame, 'pointerdown', point, {passive: true});
    on(frame, 'pointerleave', () => { target = 0; });
    on(window, 'blur', () => { target = 0; });

    const io = new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; if (visible) loop(); }, {rootMargin: '80px'});
    io.observe(frame); cleanups.push(() => io.disconnect());
    on(document, 'visibilitychange', () => { if (!document.hidden) loop(); });
    on(canvas, 'webglcontextlost', e => { e.preventDefault(); cancelAnimationFrame(raf); raf = 0; figure.classList.remove('live'); });
    on(canvas, 'webglcontextrestored', () => { tex.needsUpdate = true; maskTex.needsUpdate = true; loop(); });

    let last = performance.now(), time = 0, shown = false;
    function frameTick(now) {
      raf = 0;
      if (!alive || !visible || document.hidden) return;
      const dt = Math.min(0.05, (now - last) / 1000); last = now;
      time += dt;
      if (pending) { uniforms.uPointer.value.set(pending[0], pending[1]); pending = null; }
      uniforms.uPointerAmt.value += (target - uniforms.uPointerAmt.value) * Math.min(1, dt * 3);
      target *= 0.985;
      uniforms.uTime.value = time;
      renderer.render(scene, camera);
      if (!shown) { shown = true; figure.classList.add('live'); }
      raf = requestAnimationFrame(frameTick);
    }
    function loop() { if (!raf && alive && visible && !document.hidden) { last = performance.now(); raf = requestAnimationFrame(frameTick); } }
    loop();
  };

  start().catch(() => destroy());
  return destroy;
}
