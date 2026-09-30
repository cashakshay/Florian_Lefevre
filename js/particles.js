/* ============================================================
   FLORIAN LEFÈVRE — particle engine (WebGL)
   Tens of thousands of points in real 3D. Each "shape" is a set of
   positions + colors; the engine morphs between two shapes on the GPU,
   with particles arcing out, swirling and settling as they travel.
   Shapes can be built from the real product photos, so the particles
   carry the photo's actual colors and light.
   ============================================================ */
(function () {
  const VS = `
  precision highp float;
  attribute vec3 aA; attribute vec3 aB;
  attribute vec3 aCA; attribute vec3 aCB;
  attribute vec4 aR;
  uniform float uT, uTime, uScale, uCamZ, uDpr, uPulse, uBurst, uSize;
  uniform vec2 uRes, uCenter, uRot;
  uniform vec4 uSA, uSB; // per shape: spin, boil, loose, brightness
  varying vec3 vC;
  mat2 r2(float a) { float c = cos(a), s = sin(a); return mat2(c, -s, s, c); }
  vec3 shapePos(vec3 p, vec4 S) {
    float sp = uTime * S.x * (0.35 + aR.w * 0.9) / (0.25 + length(p.xz));
    p.xz = r2(sp) * p.xz;
    p *= 1.0 + S.y * 0.07 * sin(uTime * 2.4 + aR.z * 6.2832 + p.y * 6.0);
    return p;
  }
  void main() {
    float t = clamp((uT - aR.x * 0.42) / 0.58, 0.0, 1.0);
    float e = t * t * (3.0 - 2.0 * t);
    vec3 p = mix(shapePos(aA, uSA), shapePos(aB, uSB), e);

    float mid = sin(e * 3.14159);
    vec3 dir = normalize(vec3(sin(aR.z * 12.9 + 0.3), cos(aR.z * 7.3 + aR.w * 3.1), sin(aR.w * 9.7 + 1.3)));
    p += dir * mid * uBurst * (0.2 + aR.w * 0.9);
    p.xz = r2(mid * (aR.w - 0.5) * 3.2) * p.xz;

    float loose = mix(uSA.z, uSB.z, e);
    p += vec3(sin(uTime * (0.3 + aR.w) + aR.z * 6.28),
              cos(uTime * (0.25 + aR.w * 0.8) + aR.z * 4.0),
              sin(uTime * 0.2 + aR.z * 9.0)) * (0.003 + loose * 0.07);

    float rl = length(p);
    p += (p / (rl + 1e-4)) * uPulse * (0.1 + 0.2 * aR.w) * (0.6 + 0.4 * sin(rl * 9.0 - uTime * 7.0));

    p.xz = r2(uRot.x) * p.xz;
    p.yz = r2(uRot.y) * p.yz;

    float persp = uCamZ / max(uCamZ - p.z, 0.2);
    vec2 s = uCenter + vec2(p.x, -p.y) * uScale * persp;
    vec2 clip = s / uRes * 2.0 - 1.0;
    gl_Position = vec4(clip.x, -clip.y, 0.0, 1.0);

    float bright = mix(uSA.w, uSB.w, e);
    gl_PointSize = max(1.0, (0.6 + aR.y * 1.8) * uSize * uDpr * persp);
    float tw = 0.78 + 0.22 * sin(uTime * (1.2 + aR.w * 2.0) + aR.z * 20.0);
    vC = mix(aCA, aCB, e) * bright * tw * (1.0 + mid * 0.6);
  }`;

  const FS = `
  precision mediump float;
  varying vec3 vC;
  void main() {
    vec2 d = gl_PointCoord - 0.5;
    float r = dot(d, d) * 4.0;
    if (r > 1.0) discard;
    gl_FragColor = vec4(vC * exp(-r * 2.6), 1.0);
  }`;

  const BG = [26 / 255, 24 / 255, 22 / 255];

  function compile(gl, type, src) {
    const s = gl.createShader(type);
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
    return s;
  }

  /* ---------------- engine ---------------- */
  function create(canvas, opts) {
    const o = Object.assign({ count: 30000, size: 1.6, camZ: 3.4, maxDpr: 1.75 }, opts);
    const gl = canvas.getContext("webgl", { alpha: false, antialias: false, premultipliedAlpha: false, powerPreference: "high-performance" });
    if (!gl) return null;

    const prog = gl.createProgram();
    gl.attachShader(prog, compile(gl, gl.VERTEX_SHADER, VS));
    gl.attachShader(prog, compile(gl, gl.FRAGMENT_SHADER, FS));
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(prog));
    gl.useProgram(prog);

    const N = o.count;
    const loc = (n) => gl.getAttribLocation(prog, n);
    const U = {};
    ["uT", "uTime", "uScale", "uCamZ", "uDpr", "uPulse", "uBurst", "uSize", "uRes", "uCenter", "uRot", "uSA", "uSB"].forEach((n) => (U[n] = gl.getUniformLocation(prog, n)));

    function buffer(name, size, data) {
      const b = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, b);
      gl.bufferData(gl.ARRAY_BUFFER, data, gl.DYNAMIC_DRAW);
      const l = loc(name);
      gl.enableVertexAttribArray(l);
      gl.vertexAttribPointer(l, size, gl.FLOAT, false, 0, 0);
      return b;
    }
    const rnd = new Float32Array(N * 4);
    for (let i = 0; i < N * 4; i++) rnd[i] = Math.random();
    const bufs = {
      aA: buffer("aA", 3, new Float32Array(N * 3)),
      aB: buffer("aB", 3, new Float32Array(N * 3)),
      aCA: buffer("aCA", 3, new Float32Array(N * 3)),
      aCB: buffer("aCB", 3, new Float32Array(N * 3)),
    };
    buffer("aR", 4, rnd);

    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE);
    gl.clearColor(BG[0], BG[1], BG[2], 1);

    const state = {
      t: 0, burst: 1, pulse: 0, rotX: 0, rotY: 0,
      cx: 0.5, cy: 0.5, scale: 0.3, // fractions of canvas size (scale is of min side)
      A: null, B: null, dim: 1,
    };
    let W = 0, H = 0, dpr = 1, running = false, raf = 0;
    const t0 = performance.now();
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    function upload(name, data) {
      gl.bindBuffer(gl.ARRAY_BUFFER, bufs[name]);
      gl.bufferSubData(gl.ARRAY_BUFFER, 0, data);
    }

    function resize() {
      dpr = Math.min(window.devicePixelRatio || 1, o.maxDpr);
      const r = canvas.getBoundingClientRect();
      W = Math.max(1, Math.round(r.width * dpr));
      H = Math.max(1, Math.round(r.height * dpr));
      if (canvas.width !== W || canvas.height !== H) { canvas.width = W; canvas.height = H; }
      gl.viewport(0, 0, W, H);
    }

    function frame() {
      const time = reduce ? 0 : (performance.now() - t0) / 1000;
      if (o.onFrame) o.onFrame(state, time);
      gl.clear(gl.COLOR_BUFFER_BIT);
      if (state.A && state.B) {
        gl.uniform1f(U.uT, state.t);
        gl.uniform1f(U.uTime, time);
        gl.uniform1f(U.uScale, Math.min(W, H) * state.scale);
        gl.uniform1f(U.uCamZ, o.camZ);
        gl.uniform1f(U.uDpr, dpr);
        gl.uniform1f(U.uPulse, state.pulse);
        gl.uniform1f(U.uBurst, reduce ? 0 : state.burst);
        gl.uniform1f(U.uSize, o.size);
        gl.uniform2f(U.uRes, W, H);
        gl.uniform2f(U.uCenter, W * state.cx, H * state.cy);
        gl.uniform2f(U.uRot, state.rotX, state.rotY);
        const a = state.A, b = state.B, d = state.dim;
        gl.uniform4f(U.uSA, a.spin, a.boil, a.loose, a.bright * d);
        gl.uniform4f(U.uSB, b.spin, b.boil, b.loose, b.bright * d);
        gl.drawArrays(gl.POINTS, 0, N);
      }
      if (running) raf = requestAnimationFrame(frame);
    }

    const api = {
      count: N,
      state,
      setPair(A, B) {
        if (A !== state.A) { upload("aA", A.pos); upload("aCA", A.col); }
        if (B !== state.B) { upload("aB", B.pos); upload("aCB", B.col); }
        state.A = A; state.B = B;
      },
      start() { if (!running) { running = true; resize(); raf = requestAnimationFrame(frame); } },
      stop() { running = false; cancelAnimationFrame(raf); },
      resize,
    };

    window.addEventListener("resize", resize);
    // pause when off-screen / tab hidden
    if ("IntersectionObserver" in window) {
      new IntersectionObserver((es) => es.forEach((e) => (e.isIntersecting ? api.start() : api.stop()))).observe(canvas);
    }
    document.addEventListener("visibilitychange", () => (document.hidden ? api.stop() : api.start()));
    return api;
  }

  /* ---------------- shape builders ---------------- */
  const rand = Math.random;
  function gauss() { return (rand() + rand() + rand() - 1.5) / 1.5; }
  function make(N, extra) {
    return Object.assign({ pos: new Float32Array(N * 3), col: new Float32Array(N * 3), spin: 0, boil: 0, loose: 0.02, bright: 1 }, extra);
  }

  // a tornado of ash with embers caught in it
  function vortex(N) {
    const s = make(N, { spin: 1.1, loose: 0.35, bright: 0.5 });
    for (let i = 0; i < N; i++) {
      const k = i * 3;
      if (rand() < 0.18) {
        s.pos[k] = (rand() - 0.5) * 5; s.pos[k + 1] = (rand() - 0.5) * 3.2; s.pos[k + 2] = (rand() - 0.5) * 2.5;
      } else {
        const y = rand() * 2.5 - 1.25;
        const h = (y + 1.25) / 2.5;
        const r = (0.07 + 0.95 * h * h) * (0.55 + 0.45 * Math.sqrt(rand()));
        const a = rand() * Math.PI * 2;
        s.pos[k] = Math.cos(a) * r; s.pos[k + 1] = y; s.pos[k + 2] = Math.sin(a) * r;
      }
      if (rand() < 0.1) {
        const heat = 0.6 + rand() * 0.6;
        s.col[k] = 1.0 * heat * 1.4; s.col[k + 1] = 0.5 * heat; s.col[k + 2] = 0.15 * heat;
      } else {
        const g = 0.25 + rand() * 0.55;
        s.col[k] = g * 0.95; s.col[k + 1] = g * 0.9; s.col[k + 2] = g * 0.82;
      }
    }
    return s;
  }

  // a boiling ball of molten metal
  function molten(N, radius = 0.78) {
    const s = make(N, { spin: 0.18, boil: 1, loose: 0.03, bright: 0.62 });
    for (let i = 0; i < N; i++) {
      const k = i * 3;
      const u = rand() * 2 - 1, a = rand() * Math.PI * 2;
      const shell = rand() < 0.82 ? 1 + gauss() * 0.03 : Math.cbrt(rand());
      const r = radius * shell, q = Math.sqrt(1 - u * u);
      s.pos[k] = Math.cos(a) * q * r; s.pos[k + 1] = u * r; s.pos[k + 2] = Math.sin(a) * q * r;
      const h = (u + 1) / 2; // 0 bottom → 1 top
      const heat = shell < 0.98 ? 1.2 : 1;
      s.col[k] = (0.75 + 0.35 * h) * heat;
      s.col[k + 1] = (0.18 + 0.72 * h * h) * heat;
      s.col[k + 2] = (0.04 + 0.5 * Math.pow(h, 4)) * heat;
    }
    return s;
  }

  // a slow sphere of ash and embers (contact page)
  function emberSphere(N, radius = 0.95) {
    const s = molten(N, radius);
    s.spin = 0.25; s.boil = 0.45; s.bright = 0.42; s.loose = 0.05;
    for (let i = 0; i < N; i++) {
      const k = i * 3;
      if (rand() < 0.86) {
        const g = 0.25 + rand() * 0.5;
        s.col[k] = g; s.col[k + 1] = g * 0.93; s.col[k + 2] = g * 0.85;
      } else {
        s.col[k] = 1.3; s.col[k + 1] = 0.55; s.col[k + 2] = 0.18;
      }
    }
    return s;
  }

  // particles thrown wide into the dark
  function scatter(N) {
    const s = make(N, { spin: 0.08, loose: 1, bright: 0.28 });
    for (let i = 0; i < N; i++) {
      const k = i * 3;
      s.pos[k] = (rand() - 0.5) * 6; s.pos[k + 1] = (rand() - 0.5) * 4; s.pos[k + 2] = (rand() - 0.5) * 3;
      const g = 0.3 + rand() * 0.5;
      s.col[k] = g; s.col[k + 1] = g * 0.92; s.col[k + 2] = g * 0.84;
    }
    return s;
  }

  function loadImage(src) {
    return new Promise((res, rej) => {
      const img = new Image();
      img.onload = () => res(img);
      img.onerror = rej;
      img.src = src;
    });
  }

  /* ---- small image-processing helpers for photo sampling ---- */
  function boxBlur(src, w, h, r) {
    // three box passes ≈ gaussian blur
    let a = Float32Array.from(src), b = new Float32Array(src.length);
    const rr = Math.max(1, Math.round(r));
    for (let pass = 0; pass < 3; pass++) {
      for (let y = 0; y < h; y++) {           // horizontal
        let acc = 0; const row = y * w;
        for (let x = -rr; x <= rr; x++) acc += a[row + Math.min(w - 1, Math.max(0, x))];
        for (let x = 0; x < w; x++) {
          b[row + x] = acc / (2 * rr + 1);
          acc += a[row + Math.min(w - 1, x + rr + 1)] - a[row + Math.max(0, x - rr)];
        }
      }
      for (let x = 0; x < w; x++) {           // vertical
        let acc = 0;
        for (let y = -rr; y <= rr; y++) acc += b[Math.min(h - 1, Math.max(0, y)) * w + x];
        for (let y = 0; y < h; y++) {
          a[y * w + x] = acc / (2 * rr + 1);
          acc += b[Math.min(h - 1, y + rr + 1) * w + x] - b[Math.max(0, y - rr) * w + x];
        }
      }
    }
    return a;
  }

  function otsu(values) {
    const bins = 64, hist = new Float32Array(bins);
    values.forEach((v) => hist[Math.min(bins - 1, (v * bins) | 0)]++);
    let best = 0, thr = 0.15;
    for (let i = 1; i < bins; i++) {
      let w0 = 0, w1 = 0, s0 = 0, s1 = 0;
      for (let j = 0; j < bins; j++) {
        const c = j / bins;
        if (j < i) { w0 += hist[j]; s0 += hist[j] * c; } else { w1 += hist[j]; s1 += hist[j] * c; }
      }
      if (!w0 || !w1) continue;
      const v = w0 * w1 * Math.pow(s0 / w0 - s1 / w1, 2);
      if (v > best) { best = v; thr = i / bins; }
    }
    return thr;
  }

  // A real product photo, rebuilt from points that carry its colors.
  // modes: "silver"  bright metal on stone (keeps only the metal)
  //        "garment" dark clothing on a warm studio backdrop (edges, sheen, hardware)
  //        "dark"    dark clothing on a lighter grey backdrop (isolates the silhouette)
  // read a photo's pixels at 200×250. Try the real file first (so swapped
  // photos update); if the browser blocks it (site opened as a local file),
  // use the built-in copy from js/photo-data.js.
  async function readPixels(src, w, h) {
    const c = document.createElement("canvas");
    c.width = w; c.height = h;
    const g = c.getContext("2d", { willReadFrequently: true });
    const attempt = async (url) => {
      const img = await loadImage(url);
      g.clearRect(0, 0, w, h);
      g.drawImage(img, 0, 0, w, h);
      return g.getImageData(0, 0, w, h).data;
    };
    const builtIn = (window.LEFEVRE_PHOTO_DATA || {})[src];
    if (location.protocol === "file:" && builtIn) return attempt(builtIn);
    try { return await attempt(src); }
    catch (e) {
      if (builtIn) return attempt(builtIn);
      throw e;
    }
  }

  async function photo(src, N, mode) {
    const w = 200, h = 250, n = w * h;
    const d = await readPixels(src, w, h);

    const lum = new Float32Array(n), sat = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const r = d[i * 4] / 255, gg = d[i * 4 + 1] / 255, b = d[i * 4 + 2] / 255;
      lum[i] = 0.299 * r + 0.587 * gg + 0.114 * b;
      const mx = Math.max(r, gg, b), mn = Math.min(r, gg, b);
      sat[i] = mx > 0 ? (mx - mn) / mx : 0;
    }
    const soft = boxBlur(lum, w, h, 1);
    const big = boxBlur(lum, w, h, 22);
    const edge = new Float32Array(n);
    for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) {
      const i = y * w + x;
      const gx = (soft[i + 1] - soft[i - 1]) / 2, gy = (soft[i + w] - soft[i - w]) / 2;
      edge[i] = Math.sqrt(gx * gx + gy * gy);
    }

    let mask = null;
    if (mode === "dark") {
      const centre = [];
      for (let y = (h * 0.15) | 0; y < h * 0.9; y++) for (let x = (w * 0.2) | 0; x < w * 0.8; x++) centre.push(lum[y * w + x]);
      const thr = otsu(centre) * 1.12;
      const m = new Float32Array(n);
      for (let i = 0; i < n; i++) m[i] = lum[i] < thr ? 1 : 0;
      const mb = boxBlur(m, w, h, 2);
      // flood-fill from the centre so only the garment itself is kept
      mask = new Uint8Array(n);
      const inside = (x, y) => Math.pow(x / w - 0.5, 2) / 0.2 + Math.pow(y / h - 0.5, 2) / 0.33 < 1;
      const q = [];
      for (let y = (h * 0.2) | 0; y < h * 0.8; y++) for (const x of [w / 2 - 2, w / 2, w / 2 + 2]) {
        const i = y * w + x;
        if (mb[i] > 0.45 && !mask[i]) { mask[i] = 1; q.push(i); }
      }
      while (q.length) {
        const i = q.pop(), x = i % w, y = (i / w) | 0;
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const x1 = x + dx, y1 = y + dy, j = y1 * w + x1;
          if (x1 >= 0 && x1 < w && y1 >= 0 && y1 < h && !mask[j] && mb[j] > 0.45 && inside(x1, y1)) { mask[j] = 1; q.push(j); }
        }
      }
    }

    const R = mode === "silver" ? 0.92 : mode === "dark" ? 0.9 : 1.05;
    const weight = new Float32Array(n);
    let total = 0;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const i = y * w + x;
      const nx = (x / w - 0.5) / 0.5, ny = (y / h - 0.52) / 0.5;
      const vig = Math.max(0, Math.min(1, (R - Math.sqrt(nx * nx * 0.9 + ny * ny)) / 0.3));
      const top = Math.min(1, y / (h * 0.1));
      let s;
      if (mode === "silver") {
        const metal = Math.max(0, lum[i] - 0.36) * Math.max(0, 1 - sat[i] * 3);
        s = metal * 3 + Math.max(0, edge[i] - 0.02) * 2 * Math.max(0, 1 - sat[i] * 2.5) * (lum[i] > 0.3 ? 1 : 0);
        s = Math.pow(s, 1.25);
      } else if (mode === "dark") {
        s = mask[i] ? Math.max(0, edge[i] - 0.008) * 4 + 0.02 + Math.max(0, lum[i] - big[i]) * 3 : 0;
        s = Math.pow(s, 1.3);
      } else {
        const darker = Math.max(0, big[i] - lum[i] - 0.015);
        const light = Math.max(0, lum[i] - big[i] - 0.03);
        s = Math.max(0, edge[i] - 0.012) * 4 + darker * 1.2 + light * 2;
        s = Math.pow(s, 1.5);
      }
      s *= vig * top;
      weight[i] = s;
      total += s;
    }
    if (!(total > 0)) throw new Error("nothing to sample in " + src);

    const cdf = new Float32Array(n);
    let acc = 0;
    for (let i = 0; i < n; i++) { acc += weight[i] / total; cdf[i] = acc; }

    const silver = mode === "silver";
    const shape = make(N, { spin: 0, boil: 0, loose: 0.012, bright: silver ? 0.11 : 0.2 });
    const aspect = w / h;
    const lift = silver ? 1.5 : 2.2, floor = silver ? 0 : 0.07;
    for (let k3 = 0; k3 < N * 3; k3 += 3) {
      const u = rand();
      let lo = 0, hi = n - 1;
      while (lo < hi) { const m = (lo + hi) >> 1; if (cdf[m] < u) lo = m + 1; else hi = m; }
      const x = (lo % w) + rand(), y = ((lo / w) | 0) + rand();
      shape.pos[k3] = (x / w - 0.5) * 2 * aspect * 1.12;
      shape.pos[k3 + 1] = (0.5 - y / h) * 2 * 1.12;
      shape.pos[k3 + 2] = (lum[lo] - 0.2) * 0.6 + (rand() - 0.5) * 0.05; // brighter parts float forward
      shape.col[k3] = Math.pow(d[lo * 4] / 255, 0.8) * lift + floor;
      shape.col[k3 + 1] = Math.pow(d[lo * 4 + 1] / 255, 0.8) * lift + floor * 0.95;
      shape.col[k3 + 2] = Math.pow(d[lo * 4 + 2] / 255, 0.8) * lift + floor * 0.88;
    }
    return shape;
  }

  window.LefevreParticles = { create, vortex, molten, emberSphere, scatter, photo };
})();
