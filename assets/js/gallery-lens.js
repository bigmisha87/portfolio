/* Lens grid (gallery-lab.html, view 6), rebuilt after Phantom (phantom.land, Awwwards SOTD 02.06.2025).
   The numbers below are theirs, read from the scripts phantom.land ships (22.10.2026), plus their Codrops
   write-up (30.06.2025):
   - the grid is rendered flat by an 85° perspective camera, then the whole frame goes through one lens
     pass: uv = (0.88 + d·|m|²)·m, with d = −0.07 × the screen's aspect. The minus sign is the point: the
     edges magnify outward, as if the grid wrapped around you. A vignette closes the corners.
   - each cell is a card: who and what along the top, the picture whole at 70% in the middle, tags and a
     number along the bottom; cells sit at 0.998 of the lattice, so the gap draws a hairline.
   - hovering a cell washes it with a blur of its own picture (70%); holding the grid steps the camera back
     ~12%; a release glides on with inertia; the grid drifts a touch against the pointer; it arrives flat
     and curves in over a second. */
import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.169.0/build/three.module.min.js";

const LENS_CURVED = -0.045; // Phantom's is -0.07; calmer here, by request
const FOV = 85;
const ROWS_FLAT = 3.6;      // rows a flat grid shows (measured on phantom.land)
const PRESS_BACK = 1.117;   // 3.43 → 3.83 in their camera units
const MEDIA_ZOOM = 0.7;
const CELL = 0.998;
const WASH = 0.7;
const AMBIENT = 0.2;
const ABERRATION = 0.0035;    // colour fringing, none at the centre, strongest at the corners
const MAX_TEXTURES = 110;   // painted cards kept on the GPU at once; the rest are repainted when they return

const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const mod = (a, n) => ((a % n) + n) % n;
const HE = /[֐-׿]/;

const LENS_VERT = `varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`;
const LENS_FRAG = `
  uniform sampler2D tDiffuse;
  uniform vec2 distortion;
  uniform float vignetteOffset;
  uniform float vignetteDarkness;
  uniform float aberration;
  varying vec2 vUv;
  void main() {
    vec2 m = 2.0 * (vUv - 0.5);
    vec2 uv = (0.88 + distortion * dot(m, m)) * m * 0.5 + 0.5;
    vec3 color = vec3(0.0);
    if (uv.x >= 0.0 && uv.x <= 1.0 && uv.y >= 0.0 && uv.y <= 1.0) {
      // chromatic aberration: red and blue slide apart along the radius, growing toward the edges
      vec2 shift = (uv - 0.5) * aberration * dot(m, m);
      color = vec3(texture2D(tDiffuse, uv + shift).r, texture2D(tDiffuse, uv).g, texture2D(tDiffuse, uv - shift).b);
    }
    float dist = distance(vUv, vec2(0.5));
    color *= smoothstep(0.8, vignetteOffset * 0.799, (vignetteDarkness + vignetteOffset) * dist);
    gl_FragColor = vec4(color, 1.0);
    #include <colorspace_fragment>
  }`;

/* ---------- pictures, shared by every card that shows the same work ---------- */
const pictures = new Map();   // url -> promise of the loaded picture
const arrived = new Map();    // url -> the picture, once it has arrived
function picture(w) {
  const url = w.medium;
  if (!pictures.has(url)) {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.decoding = "async";
    const p = new Promise((res) => { img.onload = () => { arrived.set(url, img); res(img); }; img.onerror = () => res(null); });
    img.src = url;
    pictures.set(url, p);
  }
  return pictures.get(url);
}
// fetch every picture quietly, a few at a time, so cards that drift into view arrive complete
function preload(list, signal) {
  const queue = [...new Set(list)].filter((w) => !pictures.has(w.medium));
  const next = () => { if (signal.aborted) return; const w = queue.shift(); if (w) picture(w).then(next); };
  for (let i = 0; i < 6; i++) next();
}
// the part of the picture to show: YouTube's 480px frame is 16:9 inside 4:3 bars; a vertical video sits in its middle
function sourceRect(w, img) {
  if (!w.yt) return [0, 0, img.naturalWidth, img.naturalHeight];
  const W = img.naturalWidth, H = img.naturalHeight, ch = W * 9 / 16, cy = (H - ch) / 2;
  if (w.ratio < 1) { const cw = ch * 9 / 16; return [(W - cw) / 2, cy, cw, ch]; }
  return [0, cy, W, ch];
}

/* ---------- one card, painted on a canvas ---------- */
function fitText(c, s, max) {
  if (c.measureText(s).width <= max) return s;
  let t = s;
  while (t.length > 1 && c.measureText(t + "…").width > max) t = t.slice(0, -1);
  return t + "…";
}
function say(c, s, x, y, align, font, color, max) {
  c.font = font;
  c.direction = HE.test(s) ? "rtl" : "ltr";
  c.textAlign = align;
  c.fillStyle = color;
  c.fillText(fitText(c, s, max), x, y);
}
function paintCard(cv, w, n, img) {
  const S = cv.width, c = cv.getContext("2d"), pad = S * 0.055, top = pad + S * 0.03, base = S - pad - S * 0.012;
  c.clearRect(0, 0, S, S);
  c.textBaseline = "middle";
  // along the top: who on the right (the page reads from the right), what on the left
  const who = w.client || w.secTitle;
  say(c, who, S - pad, top, "right", `500 ${S * 0.036}px "IBM Plex Sans Hebrew", sans-serif`, "rgba(242,239,233,0.82)", S * 0.44);
  const what = HE.test(w.title) ? w.title : w.title.toUpperCase();
  say(c, what, pad, top, "left", HE.test(w.title) ? `400 ${S * 0.027}px "IBM Plex Sans Hebrew", sans-serif` : `400 ${S * 0.024}px "IBM Plex Mono", monospace`, "rgba(242,239,233,0.7)", S * 0.44);
  // along the bottom: tags as pills on the right, the number on the left
  const tags = [...new Set([w.secTitle, w.group].filter((t) => t && t !== who))].slice(0, 2);
  let x = S - pad;
  const ph = S * 0.046;
  c.font = `500 ${S * 0.022}px "IBM Plex Sans Hebrew", sans-serif`;
  for (const t of tags) {
    const tw = Math.min(c.measureText(t).width, S * 0.3), pw = tw + ph * 0.9;
    c.fillStyle = "rgba(242,239,233,0.1)";
    c.beginPath(); c.roundRect(x - pw, base - ph / 2, pw, ph, ph / 2); c.fill();
    say(c, t, x - pw / 2, base + S * 0.002, "center", `500 ${S * 0.022}px "IBM Plex Sans Hebrew", sans-serif`, "rgba(242,239,233,0.8)", S * 0.3);
    x -= pw + S * 0.012;
  }
  say(c, String(n).padStart(3, "0"), pad, base, "left", `400 ${S * 0.024}px "IBM Plex Mono", monospace`, "rgba(242,239,233,0.55)", S * 0.2);
  // the picture, whole, in the middle 70%
  const box = S * MEDIA_ZOOM, cx = S / 2, cy = S / 2 + S * 0.005;
  if (img) {
    const [sx, sy, sw, sh] = sourceRect(w, img), ar = sw / sh;
    const dw = ar >= 1 ? box : box * ar, dh = ar >= 1 ? box / ar : box;
    c.drawImage(img, sx, sy, sw, sh, cx - dw / 2, cy - dh / 2, dw, dh);
  } else {
    const ar = w.ratio, dw = ar >= 1 ? box : box * ar, dh = ar >= 1 ? box / ar : box;
    c.fillStyle = "rgba(242,239,233,0.035)"; // a faint stand-in until the picture arrives
    c.fillRect(cx - dw / 2, cy - dh / 2, dw, dh);
  }
}
// the hover wash: the picture squeezed to 4×4 pixels and stretched back, a soft field of its own colours
function washTexture(w, img) {
  const cv = document.createElement("canvas");
  cv.width = cv.height = 4;
  const [sx, sy, sw, sh] = sourceRect(w, img);
  cv.getContext("2d").drawImage(img, sx, sy, sw, sh, 0, 0, 4, 4);
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  t.minFilter = THREE.LinearFilter; t.magFilter = THREE.LinearFilter; t.generateMipmaps = false;
  return t;
}

export function mount(view, hooks) {
  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const touch = matchMedia("(hover: none), (pointer: coarse)").matches;
  const ac = new AbortController();
  const on = (el, ev, fn, o = {}) => el.addEventListener(ev, fn, { ...o, signal: ac.signal });

  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  const cvs = renderer.domElement;
  cvs.className = "ln3d";
  view.appendChild(cvs);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color("#232326"); // shows through the gaps as the hairlines between cards
  const camera = new THREE.PerspectiveCamera(FOV, 1, 0.01, 100);
  const tanHalf = Math.tan((FOV * Math.PI) / 360);
  const zRest = ROWS_FLAT / (2 * tanHalf);
  camera.position.z = zRest;
  const target = new THREE.WebGLRenderTarget(2, 2, { colorSpace: THREE.SRGBColorSpace, samples: 4 });
  const lensMat = new THREE.ShaderMaterial({
    uniforms: { tDiffuse: { value: target.texture }, distortion: { value: new THREE.Vector2() }, vignetteOffset: { value: 0.6 }, vignetteDarkness: { value: 0.6 }, aberration: { value: ABERRATION } },
    vertexShader: LENS_VERT, fragmentShader: LENS_FRAG,
  });
  const lensScene = new THREE.Scene();
  const lensCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  lensScene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), lensMat));

  const plane = new THREE.PlaneGeometry(1, 1);
  let cells = [], cols = 1, rows = 1, current = null, texCount = 0, S = 512;
  let vw = 1, vh = 1, aspect = 1;
  let ox = 0, oy = 0, vx = 0, vy = 0, dragX = 0, dragY = 0;
  let camX = 0, camY = 0, camXT = 0, camYT = 0, zT = zRest;
  let lens = 0, lensT = 0, hovered = null;

  function clear() {
    cells.forEach((c) => { scene.remove(c.bg, c.fg); c.bg.material.dispose(); c.fg.material.dispose(); dropTexture(c); if (c.wash) c.wash.dispose(); });
    cells = []; texCount = 0;
  }
  function dropTexture(c) {
    if (!c.tex) return;
    c.tex.dispose(); c.tex = null; c.cv = null;
    c.fg.material.map = null; c.fg.material.needsUpdate = true; c.fg.visible = false;
    texCount--;
  }
  function size() {
    vw = Math.max(1, view.clientWidth); vh = Math.max(1, view.clientHeight); aspect = vw / vh;
    renderer.setSize(vw, vh, false);
    const pr = renderer.getPixelRatio();
    target.setSize(Math.round(vw * pr), Math.round(vh * pr));
    camera.aspect = aspect;
    camera.updateProjectionMatrix();
    // paint the cards about as sharp as they will show
    const cellPx = (vh / ROWS_FLAT / 0.88) * pr;
    S = clamp(Math.round(cellPx / 64) * 64, 256, 640);
  }
  function setList(list) {
    current = list;
    clear();
    size();
    // enough columns and rows to cover the widest view with room to wrap
    const halfH = zRest * PRESS_BACK * tanHalf, halfW = halfH * aspect;
    cols = Math.max(Math.ceil(2 * halfW) + 3, Math.ceil(Math.sqrt(list.length * aspect)));
    rows = Math.max(Math.ceil(2 * halfH) + 3, Math.ceil(list.length / cols));
    const n = cols * rows; // a short list repeats, so the grid always fills the view
    for (let i = 0; i < n; i++) {
      const k = i % list.length, w = list[k];
      const bg = new THREE.Mesh(plane, new THREE.MeshBasicMaterial({ color: 0x000000, toneMapped: false }));
      const fg = new THREE.Mesh(plane, new THREE.MeshBasicMaterial({ transparent: true, toneMapped: false }));
      bg.scale.set(CELL, CELL, 1); fg.scale.set(CELL, CELL, 1);
      fg.visible = false;
      scene.add(bg, fg);
      cells.push({ w, n: k + 1, bx: (i % cols) - cols / 2 + 0.5, by: -(Math.floor(i / cols) - rows / 2 + 0.5), bg, fg, tex: null, cv: null, wash: null, img: null, act: 0, seen: 0 });
    }
    ox = oy = vx = vy = 0;
    lens = 0; lensT = LENS_CURVED; // arrive flat, curve in
    preload(list, ac.signal);
  }
  function paint(c) {
    if (!c.cv) {
      if (texCount >= MAX_TEXTURES) {
        // reuse the slot of the card that has been off screen the longest
        let old = null;
        for (const o of cells) if (o.tex && !o.bg.visible && (!old || o.seen < old.seen)) old = o;
        if (old) dropTexture(old); else return;
      }
      c.cv = document.createElement("canvas");
      c.cv.width = c.cv.height = S;
      c.tex = new THREE.CanvasTexture(c.cv);
      c.tex.colorSpace = THREE.SRGBColorSpace;
      c.tex.anisotropy = 4;
      c.fg.material.map = c.tex; c.fg.material.needsUpdate = true;
      texCount++;
    }
    if (!c.img && arrived.has(c.w.medium)) {
      c.img = arrived.get(c.w.medium);
      if (!c.wash) { c.wash = washTexture(c.w, c.img); c.bg.material.map = c.wash; c.bg.material.needsUpdate = true; }
    }
    paintCard(c.cv, c.w, c.n, c.img);
    c.tex.needsUpdate = true;
    c.fg.visible = true;
    if (!c.img) {
      picture(c.w).then((img) => {
        if (!img || ac.signal.aborted) return;
        // every card of this work gets the picture and its wash
        for (const o of cells) if (o.w === c.w) {
          o.img = img;
          if (!o.wash) { o.wash = washTexture(o.w, img); o.bg.material.map = o.wash; o.bg.material.needsUpdate = true; }
          if (o.cv) { paintCard(o.cv, o.w, o.n, img); o.tex.needsUpdate = true; }
        }
      });
    }
  }

  /* --- input --- */
  let down = false, lx = 0, ly = 0, travel = 0, pointerIn = false, px = 0, py = 0;
  on(cvs, "pointerdown", (e) => {
    if (e.button !== 0) return;
    down = true; lx = e.clientX; ly = e.clientY; travel = 0; vx = vy = 0;
    const b = cvs.getBoundingClientRect();
    px = e.clientX - b.left; py = e.clientY - b.top; // a tap on a phone has no hover before it
    zT = reduced ? zRest : zRest * PRESS_BACK; // step back while the grid is held
  });
  on(window, "pointermove", (e) => {
    const b = cvs.getBoundingClientRect();
    if (e.target === cvs) {
      pointerIn = true; px = e.clientX - b.left; py = e.clientY - b.top;
      if (!touch) { camXT = (px / vw - 0.5) * AMBIENT; camYT = -(py / vh - 0.5) * AMBIENT; } // drift against the pointer
    }
    if (!down) return;
    const dx = e.clientX - lx, dy = touch ? 0 : e.clientY - ly; // on a phone, an upward swipe still scrolls the page
    lx = e.clientX; ly = e.clientY; travel += Math.abs(dx) + Math.abs(dy);
    if (travel > 4) cvs.classList.add("is-dragging");
    // screen pixels to grid units at the plane, through the lens's centre magnification
    const unit = ((2 * camera.position.z * tanHalf) / vh) * 0.88;
    dragX += dx * unit; dragY -= dy * unit;
  });
  on(window, "pointerup", () => {
    if (!down) return;
    down = false; zT = zRest;
    setTimeout(() => cvs.classList.remove("is-dragging"), 0);
  });
  on(cvs, "pointerleave", () => { pointerIn = false; camXT = camYT = 0; });
  on(cvs, "click", () => {
    if (travel > 4) return;
    const c = hovered || cellAt(px, py);
    if (c) hooks.open(c.w);
  });

  // the card under the pointer: undo the lens, then the camera
  function cellAt(sx, sy) {
    const mx = (sx / vw) * 2 - 1, my = 1 - (sy / vh) * 2;
    const f = 0.88 + lens * aspect * (mx * mx + my * my);
    const halfH = camera.position.z * tanHalf;
    const wx = camera.position.x + f * mx * halfH * aspect, wy = camera.position.y + f * my * halfH;
    for (const c of cells) if (c.bg.visible && Math.abs(wx - c.bg.position.x) < 0.5 && Math.abs(wy - c.bg.position.y) < 0.5) return c;
    return null;
  }

  /* --- every frame --- */
  let raf = 0, visible = true, frameNo = 0;
  function frame() {
    raf = 0;
    if (!visible) return;
    frameNo++;
    // drag moves the grid; a release glides on and slows (their lerps: 0.8 while held, 0.1 after)
    if (down || dragX || dragY) {
      ox += dragX; oy += dragY;
      vx += (dragX - vx) * 0.8; vy += (dragY - vy) * 0.8;
      dragX = dragY = 0;
    } else {
      ox += vx; oy += vy;
      vx += -vx * 0.1; vy += -vy * 0.1;
    }
    camX += (camXT - camX) * 0.06; camY += (camYT - camY) * 0.06;
    camera.position.x = camX; camera.position.y = camY;
    camera.position.z += (zT - camera.position.z) * (reduced ? 1 : 0.12);
    lens += (lensT - lens) * (reduced ? 1 : 0.05);
    lensMat.uniforms.distortion.value.set(lens * aspect, lens * aspect);

    // place the cards around the camera, wrapping, and paint the ones that come into view
    const halfH = camera.position.z * tanHalf + 0.7, halfW = camera.position.z * tanHalf * aspect + 0.7;
    let paints = 0;
    for (const c of cells) {
      const x = mod(c.bx + ox - camX + cols / 2, cols) - cols / 2 + camX;
      const y = mod(c.by + oy - camY + rows / 2, rows) - rows / 2 + camY;
      const vis = Math.abs(x - camX) < halfW && Math.abs(y - camY) < halfH;
      c.bg.visible = vis;
      if (!vis) { c.fg.visible = false; continue; }
      c.seen = frameNo;
      c.bg.position.set(x, y, 0);
      c.fg.position.set(x, y, 0.001);
      if (c.cv) c.fg.visible = true;
      else if (paints < 6) { paint(c); paints++; } // a few new cards per frame keeps scrolling smooth
    }
    // hover: the card under the pointer washes in with its own colours
    const h = pointerIn && !touch && !down ? cellAt(px, py) : null;
    if (h !== hovered) { hovered = h; cvs.style.cursor = h ? "pointer" : ""; }
    for (const c of cells) {
      if (!c.bg.visible) continue;
      const t = c === hovered ? 1 : 0;
      if (t || c.act > 0.001) {
        c.act += (t - c.act) * 0.12;
        if (c.act < 0.001) c.act = 0;
        c.bg.material.color.setScalar(c.wash ? c.act * WASH : 0);
      }
    }

    renderer.setRenderTarget(target);
    renderer.render(scene, camera);
    renderer.setRenderTarget(null);
    renderer.render(lensScene, lensCam);
    raf = requestAnimationFrame(frame);
  }
  const io = new IntersectionObserver((es) => { visible = es[0].isIntersecting; if (visible && !raf) raf = requestAnimationFrame(frame); });
  io.observe(view);
  let rt = 0;
  const ro = new ResizeObserver(() => {
    if (Math.abs(view.clientWidth - vw) < 2 && Math.abs(view.clientHeight - vh) < 2) return;
    clearTimeout(rt);
    rt = setTimeout(() => { if (current) setList(current); else size(); }, 150);
  });
  ro.observe(view);

  // the cards are painted with the site's fonts, so wait for them first
  const ready = document.fonts
    ? Promise.all([document.fonts.load('500 30px "IBM Plex Sans Hebrew"'), document.fonts.load('400 30px "IBM Plex Mono"')]).catch(() => {})
    : Promise.resolve();
  size();
  raf = requestAnimationFrame(frame);

  return {
    setList(list) { current = list; ready.then(() => { if (!ac.signal.aborted && current === list) setList(list); }); },
    destroy() {
      ac.abort(); cancelAnimationFrame(raf); io.disconnect(); ro.disconnect(); clearTimeout(rt);
      clear(); plane.dispose(); target.dispose(); lensMat.dispose(); renderer.dispose(); cvs.remove();
    },
  };
}
