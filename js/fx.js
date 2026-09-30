/* ============================================================
   FLORIAN LEFÈVRE — where the particles live on each page
   Home     scroll through the process: ash storm → molten metal →
            the ring → the jacket → the pendant → scattered ash
   Shop     the collection assembles itself, piece after piece
   Contact  a sphere of embers that ripples as you type
   ============================================================ */
(function () {
  const P = window.LefevreParticles;
  const page = document.body.dataset.page;
  const canvas = document.getElementById("fx");
  if (!P || !canvas) return;

  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const small = () => window.innerWidth < 820;
  const mouse = { x: 0, y: 0, sx: 0, sy: 0 };
  window.addEventListener("pointermove", (e) => {
    mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
    mouse.y = (e.clientY / window.innerHeight) * 2 - 1;
  }, { passive: true });

  async function photoOr(src, N, mode, fallback) {
    try { return await P.photo(src, N, mode); }
    catch (e) {
      console.warn("Could not build particles from " + src + ":", e);
      return fallback();
    }
  }

  const modeOf = (p) => p.fx || (p.category === "Silver" ? "silver" : "garment");

  function fail(e) {
    console.warn("Particle animation unavailable:", e);
    canvas.style.display = "none";
  }

  /* ================= HOME ================= */
  async function home() {
    const section = document.getElementById("process");
    const steps = Array.from(section.querySelectorAll(".step"));
    const rail = document.querySelector(".process-rail");
    const railItems = rail ? Array.from(rail.querySelectorAll("li")) : [];
    const N = small() ? 16000 : 42000;

    let target = 0, now = 0, pair = -1, shapes = null, last = null;

    const eng = P.create(canvas, {
      count: N,
      size: small() ? 1.4 : 1.5,
      onFrame(s, time) {
        const dt = last === null ? 0.016 : Math.min(0.1, time - last);
        last = time;
        now += (target - now) * (1 - Math.exp(-dt * 3.2)); // time-based, so slow devices keep up
        if (!shapes) return;
        const end = shapes.length - 1;
        const i = Math.min(Math.floor(now), end - 1);
        const f = clamp(now - i, 0, 1);
        if (i !== pair) { eng.setPair(shapes[i], shapes[i + 1]); pair = i; }
        s.t = f;
        s.burst = 1.25;
        mouse.sx += (mouse.x - mouse.sx) * 0.04;
        mouse.sy += (mouse.y - mouse.sy) * 0.04;
        s.rotX = Math.sin(time * 0.18) * 0.32 + mouse.sx * 0.35;
        s.rotY = mouse.sy * 0.18 + Math.sin(time * 0.13) * 0.06;
        s.cx = small() ? 0.5 : 0.64;
        s.cy = small() ? 0.36 : 0.5;
        s.scale = small() ? 0.36 : 0.34;
        // quieter behind the hero text on phones, and after the story ends
        s.dim = (small() ? 0.8 : 1) * (1 - clamp(now - 4.2, 0, 0.8) * 0.5);
      },
    });
    if (!eng) return fail("WebGL not supported");

    eng.setPair(P.vortex(N), P.vortex(N));
    eng.start();

    const ash = eng.state.A;
    const [ring, jacket, pendant] = await Promise.all([
      photoOr("images/broken-halo-ring.jpg", N, "silver", () => P.scatter(N)),
      photoOr("images/requiem-jacket.jpg", N, "garment", () => P.scatter(N)),
      photoOr("images/vigil-pendant.jpg", N, "silver", () => P.scatter(N)),
    ]);
    shapes = [ash, P.molten(N), ring, jacket, pendant, P.scatter(N)];

    function readScroll() {
      const H = window.innerHeight;
      const stepH = steps[0].offsetHeight || H;
      const p = (H * 0.5 - section.getBoundingClientRect().top) / stepH - 0.5;
      target = clamp(p, 0, 5);
      steps.forEach((el, i) => el.style.setProperty("--focus", clamp(1 - Math.abs(p - i) * 1.1, 0.12, 1).toFixed(3)));
      if (rail) {
        rail.classList.toggle("is-visible", p > -0.4 && p < 4.5);
        const active = Math.round(clamp(p, 0, 4));
        railItems.forEach((li, i) => li.classList.toggle("is-active", i === active));
      }
    }
    window.addEventListener("scroll", readScroll, { passive: true });
    window.addEventListener("resize", readScroll);
    readScroll();
    now = target;
  }

  /* ================= SHOP ================= */
  async function shop() {
    const products = (window.HG && window.HG.products) || window.HALOGRAVE_PRODUCTS || [];
    const caption = document.getElementById("fx-caption");
    const N = small() ? 14000 : 30000;
    let shapes = [], cur = 0, phase = "hold", phaseStart = 0, introDone = false;
    const HOLD = 3.4, MORPH = 2.2;

    const eng = P.create(canvas, {
      count: N,
      size: small() ? 1.5 : 1.6,
      onFrame(s, time) {
        if (!phaseStart) phaseStart = time;
        mouse.sx += (mouse.x - mouse.sx) * 0.05;
        mouse.sy += (mouse.y - mouse.sy) * 0.05;
        s.rotX = Math.sin(time * 0.25) * 0.35 + mouse.sx * 0.3;
        s.rotY = mouse.sy * 0.15;
        s.cx = 0.5; s.cy = 0.5; s.scale = 0.4; s.burst = 1.1;
        if (!introDone || shapes.length < 2) return;
        const el = time - phaseStart;
        if (phase === "hold" && el > HOLD) {
          phase = "morph"; phaseStart = time;
          eng.setPair(shapes[cur], shapes[(cur + 1) % shapes.length]);
        } else if (phase === "morph") {
          s.t = clamp(el / MORPH, 0, 1);
          if (s.t > 0.55 && caption.dataset.idx !== String((cur + 1) % shapes.length)) setCaption((cur + 1) % shapes.length);
          if (el > MORPH) {
            cur = (cur + 1) % shapes.length;
            eng.setPair(shapes[cur], shapes[cur]);
            s.t = 0; phase = "hold"; phaseStart = time;
          }
        }
      },
    });
    if (!eng) return fail("WebGL not supported");

    const first = products[0];
    eng.setPair(P.vortex(N), P.vortex(N));
    eng.start();

    function setCaption(i) {
      const p = products[i];
      caption.dataset.idx = String(i);
      caption.classList.remove("is-in");
      void caption.offsetWidth;
      caption.innerHTML = `<span>Forming now</span><button type="button" data-open="${p.id}">${p.name}</button>`;
      caption.classList.add("is-in");
    }

    // build the first piece fast, then the rest in the background
    const firstShape = await photoOr(first.image, N, modeOf(first), () => P.scatter(N));
    shapes = [firstShape];
    eng.setPair(eng.state.A, firstShape);
    let t0 = null;
    const intro = (time) => { // one-time ash → first product morph
      if (t0 === null) t0 = time;
      eng.state.t = clamp((time - t0) / 2400, 0, 1);
      if (eng.state.t < 1) requestAnimationFrame(intro);
      else { eng.setPair(firstShape, firstShape); eng.state.t = 0; phaseStart = 0; introDone = true; }
    };
    requestAnimationFrame(intro);
    setCaption(0);

    for (let i = 1; i < products.length; i++) {
      const p = products[i];
      shapes.push(await photoOr(p.image, N, modeOf(p), () => P.scatter(N)));
    }
  }

  /* ================= CONTACT ================= */
  function contact() {
    const N = small() ? 12000 : 26000;
    let pulse = 0;
    const eng = P.create(canvas, {
      count: N,
      size: 1.6,
      onFrame(s, time) {
        pulse *= 0.93;
        s.pulse = pulse;
        mouse.sx += (mouse.x - mouse.sx) * 0.04;
        mouse.sy += (mouse.y - mouse.sy) * 0.04;
        s.rotX = time * 0.06 + mouse.sx * 0.5;
        s.rotY = 0.35 + mouse.sy * 0.25;
        s.cx = small() ? 0.5 : 0.76;
        s.cy = small() ? 0.3 : 0.5;
        s.scale = small() ? 0.36 : 0.3;
        s.dim = small() ? 0.7 : 1;
      },
    });
    if (!eng) return fail("WebGL not supported");
    const sphere = P.emberSphere(N);
    eng.setPair(sphere, sphere);
    eng.start();

    const form = document.getElementById("contact-form");
    if (form) {
      form.addEventListener("input", () => { pulse = Math.min(1.2, pulse + 0.22); });
      form.addEventListener("focusin", () => { pulse = Math.min(1.2, pulse + 0.35); });
    }
    // the message was sent: blow the sphere apart, let it pull back together
    document.addEventListener("lefevre:sent", () => {
      const scat = P.scatter(N);
      eng.setPair(sphere, scat);
      let start = null;
      const go = (ts) => {
        if (start === null) start = ts;
        const e = (ts - start) / 1000;
        eng.state.t = e < 1.4 ? clamp(e / 1.4, 0, 1) : clamp(1 - (e - 2.4) / 2.2, 0, 1);
        if (e < 4.8) requestAnimationFrame(go);
        else { eng.setPair(sphere, sphere); eng.state.t = 0; }
      };
      requestAnimationFrame(go);
    });
  }

  try {
    if (page === "home") home().catch(fail);
    else if (page === "shop") shop().catch(fail);
    else if (page === "contact") contact();
  } catch (e) { fail(e); }
})();
