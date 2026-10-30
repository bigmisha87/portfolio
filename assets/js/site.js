/* Misha Graphics v2 — site script. Content comes from window.MG (assets/js/content.js).
   Pages: body[data-page] = home | project | blog | post | 404. Home is the whole site on one page (reel, gallery tabs,
   about, services, contact); about.html and gallery.html only forward to it. No build step. */
(function () {
  "use strict";

  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const html = document.documentElement;
  const PAGE = document.body.dataset.page || "home";
  const PREVIEW = /[?&]preview\b/.test(location.search);
  const hasGsap = typeof window.gsap !== "undefined";
  const reduced = () => matchMedia("(prefers-reduced-motion: reduce)").matches;
  const touch = () => matchMedia("(hover: none), (pointer: coarse)").matches;
  const mobile = () => matchMedia("(max-width: 699px)").matches;
  const motion = () => hasGsap && !reduced();
  let D = window.MG || { site: {}, home: {}, about: {}, services: [], process: { steps: [] }, contact: {}, sections: [] };

  if (hasGsap) {
    if (window.ScrollTrigger) gsap.registerPlugin(ScrollTrigger);
    if (window.SplitText) gsap.registerPlugin(SplitText);
  }

  /* ---------------- helpers ---------------- */
  const ytId = (u) => { const m = String(u || "").match(/(?:youtu\.be\/|v=|shorts\/|embed\/|live\/)([\w-]{11})/); return m ? m[1] : ""; };
  const yt = (id, kind) => `https://i.ytimg.com/vi/${id}/${kind}.jpg`;
  const dirOf = (s) => (/[֐-׿]/.test(String(s || "")) ? "rtl" : "ltr");
  const ratioNum = (r) => { const p = String(r || "16 / 9").split("/").map(parseFloat); return p[0] && p[1] ? p[0] / p[1] : 16 / 9; };
  const ratioCss = (r) => { const n = ratioNum(r); return `${n}`; };
  const visibleSections = () => (D.sections || []).filter((s) => !s.hidden);
  const sectionById = (id) => (D.sections || []).find((s) => s.id === id);
  const liveItems = (s) => (s ? s.items.filter((i) => !i.hidden) : []);
  const plural = (n, one, many) => (n === 1 ? one : many);
  // a work that carries its own image set (the branding projects) is a case study with its own page
  // a work sits in its main sub-category and, optionally, in more (an "also in" list)
  const inGroup = (it, g) => it.group === g || (Array.isArray(it.alsoIn) && it.alsoIn.includes(g));
  const isCase = (it) => !!(it && it.images && it.images.length);
  const caseHref = (it) => `project.html?p=${encodeURIComponent(it.id)}`;
  const icon = {
    play: '<svg viewBox="0 0 10 12" aria-hidden="true"><path d="M0 0l10 6-10 6z"/></svg>',
    pause: '<svg viewBox="0 0 12 12" aria-hidden="true"><path d="M1 0h3.5v12H1zM7.5 0H11v12H7.5z"/></svg>',
    prev: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M6 3l5 5-5 5"/></svg>',
    next: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M10 3L5 8l5 5"/></svg>',
    close: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3 3l10 10M13 3L3 13"/></svg>',
    tall: '<svg viewBox="0 0 16 16" aria-hidden="true"><rect x="4.5" y="1.5" width="7" height="13" rx="1.5"/></svg>',
    wide: '<svg viewBox="0 0 16 16" aria-hidden="true"><rect x="1.5" y="4.5" width="13" height="7" rx="1.5"/></svg>',
  };

  /* ---------------- smooth scroll on one clock ---------------- */
  let lenis = null;
  const scrollFeed = new Set();
  const scrollState = { y: 0, dir: 1 };
  function initScroll() {
    if (motion() && window.Lenis && !touch()) {
      lenis = new Lenis({ lerp: 0.11, wheelMultiplier: 1, anchors: { offset: -20 } });
      lenis.on("scroll", (l) => { tickScroll(l.scroll); if (window.ScrollTrigger) ScrollTrigger.update(); });
      gsap.ticker.add((t) => lenis && lenis.raf(t * 1000));
      gsap.ticker.lagSmoothing(0);
    } else {
      addEventListener("scroll", () => tickScroll(scrollY), { passive: true });
    }
    tickScroll(scrollY);
  }
  function tickScroll(y) {
    scrollState.dir = y > scrollState.y ? 1 : y < scrollState.y ? -1 : scrollState.dir;
    scrollState.y = y;
    scrollFeed.forEach((fn) => fn(scrollState));
  }
  const stopScroll = () => { lenis ? lenis.stop() : (document.body.style.overflow = "hidden"); };
  const startScroll = () => { lenis ? lenis.start() : (document.body.style.overflow = ""); };
  // resolves once the page has loaded and fonts are in, when the masonry has its final heights
  const settled = () => {
    const loaded = document.readyState === "complete" ? Promise.resolve() : new Promise((r) => addEventListener("load", r, { once: true }));
    return Promise.all([loaded, document.fonts ? document.fonts.ready : 0]).then(() => new Promise((r) => setTimeout(r, 350)));
  };
  function scrollToEl(el, offset = 0) {
    const y = el.getBoundingClientRect().top + scrollY - offset;
    if (lenis) lenis.scrollTo(y, { duration: 1.1 });
    else scrollTo({ top: y, behavior: reduced() ? "auto" : "smooth" });
  }

  /* ---------------- header ---------------- */
  function initHeader() {
    const hdr = $("#hdr");
    if (!hdr) return;
    let away = false;
    const setAway = (v) => {
      if (v === away) return;
      away = v;
      html.classList.toggle("hdr-away", v);
      html.style.setProperty("--hdr-offset", v ? "0px" : "var(--hdr)");
    };
    html.style.setProperty("--hdr-offset", "var(--hdr)");
    let last = 0;
    scrollFeed.add(({ y }) => {
      hdr.classList.toggle("is-solid", y > 40 || PAGE !== "home");
      if (Math.abs(y - last) < 6) return;
      setAway(y > 240 && y > last && !html.classList.contains("menu-open"));
      last = y;
    });
    hdr.classList.toggle("is-solid", PAGE !== "home");

    // mobile menu
    const btn = $(".menu-btn"), menu = $("#mmenu");
    if (!btn || !menu) return;
    const links = () => $$("a, button", menu);
    let open = false;
    const set = (v) => {
      open = v;
      btn.setAttribute("aria-expanded", String(v));
      btn.querySelector(".menu-btn__label").textContent = v ? "סגירה" : "תפריט";
      html.classList.toggle("menu-open", v);
      if (v) {
        menu.classList.add("is-open");
        stopScroll();
        if (motion()) {
          gsap.fromTo(menu, { clipPath: "inset(0 0 100% 0)" }, { clipPath: "inset(0 0 0% 0)", duration: 0.75, ease: "expo.inOut" });
          gsap.fromTo($$(".mmenu__link > span", menu), { yPercent: 110 }, { yPercent: 0, duration: 0.9, ease: "expo.out", stagger: 0.06, delay: 0.25 });
        } else menu.style.clipPath = "none";
        setTimeout(() => links()[0] && links()[0].focus(), 50);
      } else {
        const done = () => { menu.classList.remove("is-open"); };
        if (motion()) gsap.to(menu, { clipPath: "inset(0 0 100% 0)", duration: 0.6, ease: "expo.inOut", onComplete: done });
        else { menu.style.clipPath = ""; done(); }
        startScroll();
        btn.focus();
      }
    };
    btn.addEventListener("click", () => set(!open));
    menu.addEventListener("click", (e) => { if (e.target.closest("a")) set(false); });
    addEventListener("keydown", (e) => {
      if (!open) return;
      if (e.key === "Escape") set(false);
      if (e.key === "Tab") {
        const f = [btn, ...links()];
        const i = f.indexOf(document.activeElement);
        if (e.shiftKey && i <= 0) { e.preventDefault(); f[f.length - 1].focus(); }
        else if (!e.shiftKey && i === f.length - 1) { e.preventDefault(); f[0].focus(); }
      }
    });
  }

  /* ---------------- page transition: a render pass ---------------- */
  function initCurtain() {
    const c = $(".curtain");
    if (!c) return;
    const scan = $(".curtain__scan");
    const reveal = () => {
      sessionStorage.removeItem("mg-curtain");
      if (!html.classList.contains("curtain-in")) return;
      if (!motion()) { html.classList.remove("curtain-in"); return; }
      gsap.timeline({ onComplete: () => html.classList.remove("curtain-in") })
        .fromTo(c, { clipPath: "inset(0% 0 0 0)" }, { clipPath: "inset(100% 0 0 0)", duration: 0.85, ease: "expo.inOut" }, 0.05)
        .fromTo(scan, { top: "0%", opacity: 1 }, { top: "100%", duration: 0.85, ease: "expo.inOut" }, 0.05)
        .set(c, { clearProps: "clipPath" });
    };
    reveal();
    addEventListener("pageshow", (e) => { if (e.persisted) { html.classList.remove("curtain-in"); gsap && gsap.set && gsap.set(c, { clearProps: "all" }); } });

    document.addEventListener("click", (e) => {
      const a = e.target.closest("a[href]");
      if (!a || e.defaultPrevented || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
      if (a.target === "_blank" || a.hasAttribute("download") || a.dataset.noCurtain != null) return;
      const url = new URL(a.href, location.href);
      if (url.origin !== location.origin || !/\.html$|\/$/.test(url.pathname)) return;
      if (url.pathname === location.pathname) return; // same-page anchors scroll natively
      if (PREVIEW) return;
      e.preventDefault();
      sessionStorage.setItem("mg-curtain", "1");
      if (!motion()) { location.href = url.href; return; }
      gsap.timeline({ onComplete: () => { location.href = url.href; } })
        .fromTo(c, { clipPath: "inset(0 0 100% 0)" }, { clipPath: "inset(0 0 0% 0)", duration: 0.6, ease: "expo.inOut" })
        .fromTo(scan, { top: "0%", opacity: 1 }, { top: "100%", duration: 0.6, ease: "expo.inOut" }, 0);
    });
  }

  /* ---------------- buttons: fill floods from the pointer ---------------- */
  function initFills(root = document) {
    $$("[data-fill]", root).forEach((btn) => {
      if (btn.__fill) return;
      btn.__fill = true;
      if (!btn.querySelector(".btn__fill")) btn.insertAdjacentHTML("afterbegin", '<span class="btn__fill" aria-hidden="true"></span>');
      if (touch() || !motion()) return;
      const fill = btn.querySelector(".btn__fill");
      const at = (e) => { const r = btn.getBoundingClientRect(); return `${e.clientX - r.left}px ${e.clientY - r.top}px`; };
      let closed = true;
      const open = (p) => { if (closed) gsap.set(fill, { clipPath: `circle(0% at ${p})` }); closed = false; btn.classList.add("is-filled"); gsap.to(fill, { clipPath: `circle(150% at ${p})`, duration: 0.6, ease: "power3.out", overwrite: true }); };
      const close = (p) => { btn.classList.remove("is-filled"); gsap.to(fill, { clipPath: `circle(0% at ${p})`, duration: 0.45, ease: "power3.out", overwrite: true, onComplete: () => { closed = true; } }); };
      btn.addEventListener("pointerenter", (e) => open(at(e)));
      btn.addEventListener("pointerleave", (e) => close(at(e)));
      btn.addEventListener("focus", () => btn.matches(":focus-visible") && open("50% 50%"));
      btn.addEventListener("blur", () => close("50% 50%"));
    });
  }

  /* ---------------- reveals ---------------- */
  let revealIO = null;
  function initReveals(root = document) {
    const els = $$("[data-reveal]:not(.is-in)", root);
    if (!motion()) { els.forEach((el) => el.classList.add("is-in")); return; }
    revealIO = revealIO || new IntersectionObserver((entries) => {
      entries.forEach((en) => { if (en.isIntersecting) { en.target.classList.add("is-in"); revealIO.unobserve(en.target); } });
    }, { rootMargin: "0px 0px -8% 0px", threshold: 0.08 });
    els.forEach((el) => revealIO.observe(el));
  }
  const splits = [];
  // masked line reveal; plays once (on load for the page title, on view for the rest)
  function splitIn(el, { intro = false, delay = 0 } = {}) {
    if (!el || !motion() || !window.SplitText) return;
    let played = false;
    const play = (lines, d) => { played = true; gsap.fromTo(lines, { yPercent: 115 }, { yPercent: 0, duration: 1.15, ease: "expo.out", stagger: 0.08, delay: d }); };
    const s = SplitText.create(el, {
      type: "lines", mask: "lines", linesClass: "sl", autoSplit: true,
      onSplit(self) {
        if (played) return;
        if (intro) play(self.lines, delay);
        else gsap.set(self.lines, { yPercent: 115 });
      },
    });
    splits.push(s);
    if (!intro) {
      const io = new IntersectionObserver((es) => {
        if (!es[0].isIntersecting) return;
        io.disconnect();
        play(s.lines, 0);
      }, { rootMargin: "0px 0px -8% 0px" });
      io.observe(el);
      s.__io = io;
    }
  }

  /* ---------------- lightbox ---------------- */
  const LB = (() => {
    let el, media, list = [], idx = 0, source = null, isOpen = false, pushed = false, onCloseCb = null;
    function build() {
      el = document.createElement("div");
      el.className = "lb";
      el.hidden = true;
      el.setAttribute("role", "dialog");
      el.setAttribute("aria-modal", "true");
      el.setAttribute("aria-label", "נגן");
      el.innerHTML = `
        <div class="lb__bg"></div>
        <div class="lb__top"><span class="lb__count mono" aria-live="polite"></span>
          <button class="icon-btn lb__close" type="button" aria-label="סגירה">${icon.close}</button></div>
        <div class="lb__stage"><div class="lb__media"></div></div>
        <div class="lb__bar">
          <div><p class="lb__title" dir="auto"></p><p class="lb__sub"></p></div>
          <div class="lb__nav">
            <button class="icon-btn lb__prev" type="button" aria-label="הקודם">${icon.prev}</button>
            <a class="lb__open" target="_blank" rel="noopener"></a>
            <button class="icon-btn lb__next" type="button" aria-label="הבא">${icon.next}</button>
          </div>
        </div>`;
      document.body.appendChild(el);
      // the arrows sit on the screen's sides, outside the bar (which animates in and would carry them along)
      el.append($(".lb__prev", el), $(".lb__next", el));
      media = $(".lb__media", el);
      $(".lb__close", el).addEventListener("click", () => close());
      $(".lb__bg", el).addEventListener("click", () => close());
      $(".lb__next", el).addEventListener("click", () => go(1));
      $(".lb__prev", el).addEventListener("click", () => go(-1));
      $(".lb__stage", el).addEventListener("click", (e) => { if (e.target === e.currentTarget) close(); });
      addEventListener("keydown", (e) => {
        if (!isOpen) return;
        if (e.key === "Escape") close();
        else if (e.key === "ArrowLeft") go(1);
        else if (e.key === "ArrowRight") go(-1);
        else if (e.key === "Tab") {
          const f = $$("button:not([hidden]), a[href]:not([hidden]), iframe", el).filter((x) => x.offsetParent);
          const i = f.indexOf(document.activeElement);
          if (e.shiftKey && i <= 0) { e.preventDefault(); f[f.length - 1].focus(); }
          else if (!e.shiftKey && i === f.length - 1) { e.preventDefault(); f[0].focus(); }
        }
      });
      // swipe: RTL, so a finger moving right brings the next item
      let sx = 0, sy = 0, st = 0;
      const stage = $(".lb__stage", el);
      stage.addEventListener("pointerdown", (e) => { sx = e.clientX; sy = e.clientY; st = Date.now(); });
      stage.addEventListener("pointerup", (e) => {
        const dx = e.clientX - sx, dy = e.clientY - sy;
        if (Date.now() - st < 700 && Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.4) go(dx > 0 ? 1 : -1);
      });
      addEventListener("popstate", () => { if (isOpen) { pushed = false; close(); } });
    }
    function paint(first) {
      const it = list[idx];
      const r = ratioNum(it.ratio);
      el.style.setProperty("--r", `${r}`);
      el.style.setProperty("--rn", `${r}`);
      media.style.setProperty("--r", `${r}`);
      media.style.setProperty("--rn", `${r}`);
      const id = ytId(it.video);
      if (id) {
        media.innerHTML = `<img class="lb__poster" src="${yt(id, "hqdefault")}" alt="">
          <iframe src="https://www.youtube-nocookie.com/embed/${id}?autoplay=1&rel=0&playsinline=1&modestbranding=1" title="${esc(it.title || "וידאו")}" allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowfullscreen></iframe>`;
      } else if (it.video) {
        media.innerHTML = `<video src="${esc(it.video)}" controls autoplay playsinline></video>`;
      } else {
        media.innerHTML = `<img src="${esc(it.image)}" alt="${esc(it.title || "")}">`;
      }
      $(".lb__title", el).textContent = it.title || "";
      $(".lb__title", el).dir = dirOf(it.title);
      const sub = [it.client, it.group, it.note].filter(Boolean).join(" · ");
      $(".lb__sub", el).textContent = sub;
      $(".lb__count", el).textContent = list.length > 1 ? `${idx + 1} / ${list.length}` : "";
      const one = list.length < 2;
      $(".lb__next", el).hidden = one;
      $(".lb__prev", el).hidden = one;
      const open = $(".lb__open", el);
      if (id) { open.href = it.video; open.textContent = "ביוטיוב"; open.hidden = false; }
      else { open.removeAttribute("href"); open.hidden = true; }
      if (!first && motion()) gsap.fromTo(media, { clipPath: "inset(0 0 100% 0)" }, { clipPath: "inset(0 0 0% 0)", duration: 0.7, ease: "expo.out" });
    }
    function go(d) { if (list.length < 2) return; idx = (idx + d + list.length) % list.length; paint(false); }
    function open(items, i, src, onClose) {
      if (!el) build();
      list = items; idx = i; source = src || null; onCloseCb = onClose || null;
      el.hidden = false; isOpen = true;
      stopScroll();
      paint(true);
      if (!pushed) { history.pushState({ mgLb: 1 }, ""); pushed = true; }
      const bg = $(".lb__bg", el);
      if (motion()) {
        gsap.fromTo(bg, { opacity: 0 }, { opacity: 1, duration: 0.5, ease: "power2.out" });
        gsap.fromTo([$(".lb__top", el), $(".lb__bar", el)], { opacity: 0, y: 14 }, { opacity: 1, y: 0, duration: 0.6, ease: "expo.out", delay: 0.2 });
        const s = source && source.getBoundingClientRect();
        const m = media.getBoundingClientRect();
        if (s && s.width && m.width) {
          gsap.fromTo(media, { x: s.left - m.left, y: s.top - m.top, scaleX: s.width / m.width, scaleY: s.height / m.height, transformOrigin: "0 0" },
            { x: 0, y: 0, scaleX: 1, scaleY: 1, duration: 0.85, ease: "expo.out", clearProps: "transform" });
        } else gsap.fromTo(media, { clipPath: "inset(0 0 100% 0)" }, { clipPath: "inset(0 0 0% 0)", duration: 0.8, ease: "expo.out" });
      }
      $(".lb__close", el).focus({ preventScroll: true });
    }
    function close() {
      if (!isOpen) return;
      isOpen = false;
      const finish = () => {
        el.hidden = true; media.innerHTML = ""; startScroll();
        if (source && source.closest) { const f = source.closest("a, button"); f && f.focus({ preventScroll: true }); }
        onCloseCb && onCloseCb();
      };
      if (pushed) { pushed = false; history.back(); }
      if (motion()) {
        media.innerHTML = media.innerHTML.replace(/<iframe[\s\S]*?<\/iframe>/, "");
        gsap.to(el, { opacity: 0, duration: 0.3, ease: "power2.out", onComplete: () => { gsap.set(el, { clearProps: "opacity" }); finish(); } });
      } else finish();
    }
    return { open, close, get isOpen() { return isOpen; } };
  })();

  /* ---------------- gallery: prompt tokens + masonry ---------------- */
  function Gallery(root, section, opts = {}) {
    const isVideo = section.kind === "video";
    const state = { group: opts.group || "", fmt: "all", shown: 0, list: [] };
    const step = () => (mobile() ? 12 : 24);
    root.innerHTML = `
      <div class="prompt" role="group" aria-label="סינון ${esc(section.title)}">
        <span class="prompt__label">הצג:</span>
        <div class="prompt__tokens" data-tokens></div>
        ${isVideo ? `<div class="prompt__fmt" role="group" aria-label="צורת הסרטון">
          <button class="tok tok--fmt" type="button" data-fmt="all" aria-pressed="true">כל הצורות</button>
          <button class="tok tok--fmt" type="button" data-fmt="tall" aria-pressed="false">${icon.tall}<span>אנכי</span></button>
          <button class="tok tok--fmt" type="button" data-fmt="wide" aria-pressed="false">${icon.wide}<span>רוחבי</span></button>
        </div>` : ""}
      </div>
      <div class="grid" data-grid aria-live="polite"></div>
      <div class="grid__sentinel" aria-hidden="true"></div>
      <div class="more-btn" hidden><button class="btn" type="button" data-fill data-more><span data-more-label></span> <span class="btn__arrow" aria-hidden="true">↓</span></button></div>`;
    const tokens = $("[data-tokens]", root);
    const grid = $("[data-grid]", root);
    const sentinel = $(".grid__sentinel", root);
    const moreWrap = $(".more-btn", root);
    const infinite = opts.infinite !== false;
    if (!section.groups || section.groups.length < 2) { const p = $(".prompt", root); if (!isVideo) p.hidden = true; }

    const fmtOk = (it) => { if (state.fmt === "all") return true; const r = ratioNum(it.ratio); return state.fmt === "tall" ? r < 0.95 : r > 1.05; };
    const all = () => liveItems(section);
    function drawTokens() {
      const base = all().filter(fmtOk);
      const groups = (section.groups || []).filter((g) => base.some((i) => inGroup(i, g)));
      if (state.group && !groups.includes(state.group)) state.group = "";
      tokens.innerHTML = [["", "הכל", base.length], ...groups.map((g) => [g, g, base.filter((i) => inGroup(i, g)).length])]
        .map(([v, label]) => `<button class="tok" type="button" data-group="${esc(v)}" aria-pressed="${state.group === v}">${esc(label)}</button>`).join("");
      $$("[data-fmt]", root).forEach((b) => b.setAttribute("aria-pressed", String(state.fmt === b.dataset.fmt)));
    }
    root.addEventListener("click", (e) => {
      const g = e.target.closest("[data-group]");
      const f = e.target.closest("[data-fmt]");
      if (g) { if (state.group === g.dataset.group) return; state.group = g.dataset.group; refresh(true); }
      else if (f) { if (state.fmt === f.dataset.fmt) return; state.fmt = f.dataset.fmt; refresh(true); }
    });

    function cardHTML(it, i) {
      const id = ytId(it.video);
      const r = ratioCss(it.ratio);
      const sub = isVideo ? (it.client || it.group || "") : (it.note || it.group || "");
      const media = id
        ? `<img class="card__lo" src="${yt(id, "default")}" alt="" loading="lazy" decoding="async">
           <img class="card__img" src="${yt(id, "maxresdefault")}" alt="" loading="lazy" decoding="async" data-yt="${id}">`
        : `<img class="card__img" src="${esc(it.thumb || it.image)}" alt="${esc(it.title || "")}" loading="lazy" decoding="async">`;
      return `<a class="card ${isVideo ? "card--video" : "card--image"}" href="${esc(isCase(it) ? caseHref(it) : it.video || it.image)}" data-i="${i}" ${id ? 'data-scrub' : ""}>
        <div class="card__frame" style="aspect-ratio:${r}">
          ${media}
          <span class="card__scan" aria-hidden="true"></span>
          ${isVideo ? `<span class="card__play" aria-hidden="true">${icon.play}</span><span class="card__bar" aria-hidden="true"><i></i></span>` : ""}
        </div>
        <div class="card__meta"><h3 class="card__title" dir="${dirOf(it.title)}">${esc(it.title || "")}</h3>${sub ? `<p class="card__sub" dir="${dirOf(sub)}">${esc(sub)}</p>` : ""}</div>
      </a>`;
    }

    // masonry: row-major, shortest column, RTL (first card on the right)
    let cols = 1, colW = 0, gapX = 24, gapY = 34, heights = [], metaH = 0;
    function measure() {
      const w = grid.clientWidth;
      cols = w < 700 ? 2 : w < 1100 ? 3 : w < 1600 ? 4 : 5;
      if (opts.maxCols) cols = Math.min(cols, opts.maxCols);
      gapX = w < 700 ? 10 : 24;
      gapY = w < 700 ? 22 : 34;
      colW = (w - gapX * (cols - 1)) / cols;
      heights = new Array(cols).fill(0);
      const m = grid.querySelector(".card__meta");
      metaH = m ? m.offsetHeight : 0;
    }
    function place(cards) {
      cards.forEach((card) => {
        let c = 0;
        for (let k = 1; k < cols; k++) if (heights[k] < heights[c] - 1) c = k;
        const it = state.list[+card.dataset.i];
        const h = colW / ratioNum(it.ratio) + metaH;
        card.style.width = `${colW}px`;
        card.style.right = `${c * (colW + gapX)}px`;
        card.style.top = `${heights[c]}px`;
        card.dataset.col = c;
        heights[c] += h + gapY;
      });
      grid.style.height = `${Math.max(0, ...heights) - gapY}px`;
    }
    function packAll() {
      if (!grid.children.length) { grid.style.height = ""; return; }
      grid.classList.add("is-packed");
      measure();
      place($$(".card", grid));
      if (window.ScrollTrigger) ScrollTrigger.refresh();
    }

    let cardIO = null;
    function watch(cards) {
      cards.forEach((card, k) => {
        const img = card.querySelector(".card__img");
        const done = () => card.classList.add("is-loaded");
        img.addEventListener("load", function () {
          if (this.dataset.yt && this.naturalWidth < 600 && !this.dataset.fb) { this.dataset.fb = 1; this.src = yt(this.dataset.yt, "hqdefault"); return; }
          done();
        });
        img.addEventListener("error", function () { if (this.dataset.yt && !this.dataset.fb) { this.dataset.fb = 1; this.src = yt(this.dataset.yt, "hqdefault"); } else done(); });
        if (img.complete && img.naturalWidth) img.dispatchEvent(new Event("load"));
        if (!motion()) { card.classList.add("is-in"); return; }
        card.style.transitionDelay = `${(+card.dataset.col || 0) * 70 + Math.min(k, 6) * 15}ms`;
        cardIO = cardIO || new IntersectionObserver((ents) => ents.forEach((en) => {
          if (en.isIntersecting) { en.target.classList.add("is-in"); cardIO.unobserve(en.target); setTimeout(() => (en.target.style.transitionDelay = ""), 1200); }
        }), { rootMargin: "0px 0px -6% 0px", threshold: 0.05 });
        cardIO.observe(card);
      });
    }
    function more() {
      const next = state.list.slice(state.shown, state.shown + step());
      if (!next.length) return;
      const start = state.shown;
      grid.insertAdjacentHTML("beforeend", next.map((it, k) => cardHTML(it, start + k)).join(""));
      state.shown += next.length;
      const cards = $$(".card", grid).slice(start);
      if (start === 0) packAll(); else { grid.classList.add("is-packed"); place(cards); if (window.ScrollTrigger) ScrollTrigger.refresh(); }
      watch(cards);
      syncMore();
    }
    function syncMore() {
      const left = state.list.length - state.shown;
      moreWrap.hidden = infinite || left <= 0;
      // only the label changes: rewriting the whole button would drop its hover fill
      if (!moreWrap.hidden) $("[data-more-label]", moreWrap).textContent = `עוד ${isVideo ? "סרטונים" : "עבודות"}`;
    }
    function refresh(user) {
      drawTokens();
      state.list = all().filter(fmtOk).filter((i) => !state.group || inGroup(i, state.group));
      const rebuild = () => {
        grid.innerHTML = "";
        state.shown = 0;
        grid.classList.remove("is-packed");
        if (!state.list.length) { grid.innerHTML = '<p class="grid__empty">אין כאן עבודות כרגע.</p>'; grid.style.height = ""; syncMore(); return; }
        more();
      };
      if (user && motion() && grid.children.length) {
        gsap.to(grid, { opacity: 0, duration: 0.18, ease: "power1.out", onComplete: () => {
          rebuild(); gsap.to(grid, { opacity: 1, duration: 0.25 });
          const top = root.getBoundingClientRect().top;
          if (top < 0) scrollToEl(root, 70);
        } });
      } else rebuild();
    }

    // load more as the end approaches
    const moreIO = new IntersectionObserver((ents) => { if (ents[0].isIntersecting && infinite) more(); }, { rootMargin: "900px 0px" });
    moreIO.observe(sentinel);
    moreWrap.querySelector("button").addEventListener("click", () => { const k = state.shown; more(); const c = grid.querySelectorAll(".card")[k]; c && c.focus({ preventScroll: true }); });
    initFills(root);

    // hover scrub: three real frames of the video under the pointer
    if (!touch()) {
      grid.addEventListener("pointermove", (e) => {
        const card = e.target.closest("[data-scrub]");
        if (!card) return;
        const fr = card.querySelector(".card__frame");
        const id = card.querySelector(".card__img").dataset.yt;
        const r = fr.getBoundingClientRect();
        const p = Math.min(0.999, Math.max(0, (e.clientX - r.left) / r.width));
        let s = card.querySelector(".card__scrub");
        if (!s) {
          s = document.createElement("img");
          s.className = "card__scrub"; s.alt = ""; s.decoding = "async";
          fr.insertBefore(s, fr.querySelector(".card__scan"));
          [1, 2, 3].forEach((n) => { const im = new Image(); im.src = yt(id, `hq${n}`); });
        }
        const n = 1 + Math.floor(p * 3);
        if (s.dataset.n !== String(n)) { s.dataset.n = n; s.src = yt(id, `hq${n}`); }
        card.classList.add("is-scrubbing");
        card.querySelector(".card__bar i").style.width = `${p * 100}%`;
      });
      grid.addEventListener("pointerout", (e) => {
        const card = e.target.closest("[data-scrub]");
        if (card && !card.contains(e.relatedTarget)) card.classList.remove("is-scrubbing");
      });
    }

    grid.addEventListener("click", (e) => {
      const card = e.target.closest(".card");
      if (!card || e.metaKey || e.ctrlKey) return;
      const it = state.list[+card.dataset.i];
      if (isCase(it)) return; // a project with its own image set opens its own page (the link does it)
      e.preventDefault();
      LB.open(state.list, +card.dataset.i, card.querySelector(".card__frame"));
    });

    let rt;
    addEventListener("resize", () => { clearTimeout(rt); rt = setTimeout(packAll, 150); });
    if (document.fonts) document.fonts.ready.then(packAll);

    // bring one work into view and play it (links like index.html#ai/ai-yvMEFMIkBJ8)
    function openItem(id) {
      const i = state.list.findIndex((x) => x.id === id);
      if (i < 0) return;
      while (state.shown <= i) more();
      const card = grid.querySelector(`.card[data-i="${i}"]`);
      if (!card) return;
      settled().then(() => {
        scrollToEl(card, 110);
        setTimeout(() => card.click(), reduced() ? 0 : 1100);
      });
    }

    refresh(false);
    return { refresh: () => refresh(false), destroy: () => { moreIO.disconnect(); }, openItem };
  }

  /* ---------------- hero reel ---------------- */
  const Hero = (() => {
    let player = null, userPaused = false, curId = "", localVideo = null, onScreen = true;
    function render() {
      const reel = (D.home && D.home.reel) || {};
      const id = ytId(reel.youtube);
      renderFrames(reel.frames && reel.frames.length ? reel.frames : id ? [yt(id, "maxresdefault")] : []);
      $$("[data-mg='headline']").forEach((e) => (e.textContent = D.home.headline || ""));
      $$("[data-mg='sub']").forEach((e) => (e.textContent = D.home.sub || ""));
      $$("[data-mg='reelButton']").forEach((e) => (e.textContent = D.home.reelButton || "שואוריל"));
      const ai = sectionById("ai");
      $$("[data-mg='aiCount']").forEach((e) => (e.textContent = liveItems(ai).length));
      // "" vs null must compare equal, or a second call builds a second player under the first
      if (id !== curId || (reel.video || "") !== ((localVideo && localVideo.getAttribute("src")) || "")) startBackground(reel, id);
    }
    // frames from the work cut like a reel until the real reel takes over
    let frameList = [], frameIdx = 0, cutCall = null, playing = false;
    function renderFrames(list) {
      const box = $("[data-frames]");
      if (!box) return;
      if (list.join("|") === frameList.join("|")) return;
      frameList = list.slice();
      frameIdx = 0;
      cutCall && cutCall.kill();
      box.innerHTML = frameList.map((src, i) => `<img src="${i === 0 ? esc(src) : ""}" data-src="${esc(src)}" alt="${i === 0 ? "פריים מתוך השואוריל" : ""}" ${i ? 'aria-hidden="true"' : 'fetchpriority="high"'} class="${i === 0 ? "is-on" : ""}" decoding="async">`).join("");
      if (motion() && frameList.length > 1) cutCall = gsap.delayedCall(1.9, cut);
    }
    function cut() {
      const imgs = $$("[data-frames] img");
      if (!imgs.length) return;
      const cur = imgs[frameIdx], nIdx = (frameIdx + 1) % imgs.length, nxt = imgs[nIdx];
      const after = imgs[(nIdx + 1) % imgs.length];
      if (after && !after.getAttribute("src")) after.src = after.dataset.src; // preload the one after
      const go = () => {
        if (playing || !onScreen || userPaused) { cutCall = gsap.delayedCall(1.2, cut); return; }
        nxt.classList.add("is-next");
        const scan = $(".hero__scan");
        gsap.timeline({ onComplete: () => { cur.classList.remove("is-on"); nxt.classList.remove("is-next"); nxt.classList.add("is-on"); gsap.set(nxt, { clearProps: "clipPath" }); frameIdx = nIdx; cutCall = gsap.delayedCall(1.6, cut); } })
          .fromTo(nxt, { clipPath: "inset(0 0 100% 0)" }, { clipPath: "inset(0 0 0% 0)", duration: 0.7, ease: "expo.inOut" }, 0)
          .fromTo(scan, { top: "0%", opacity: 1 }, { top: "100%", duration: 0.7, ease: "expo.inOut" }, 0)
          .to(scan, { opacity: 0, duration: 0.15 }, 0.6);
      };
      if (!nxt.getAttribute("src")) { nxt.src = nxt.dataset.src; }
      if (nxt.complete && nxt.naturalWidth) go(); else { nxt.onload = go; nxt.onerror = () => { frameIdx = nIdx; cutCall = gsap.delayedCall(0.2, cut); }; }
    }
    function setPlaying(v) {
      playing = v;
      const m = $(".hero__media");
      m && m.classList.toggle("is-playing", v);
    }
    let gen = 0;
    function startBackground(reel, id) {
      curId = id;
      const box = $(".hero__media");
      const pauseBtn = $(".hero__pause");
      if (!box) return;
      const my = ++gen;
      box.innerHTML = ""; player = null; localVideo = null; setPlaying(false);
      const save = navigator.connection && navigator.connection.saveData;
      if (reduced() || save) { if (pauseBtn) pauseBtn.hidden = true; return; }
      if (pauseBtn) pauseBtn.hidden = false;
      if (reel.video) {
        localVideo = document.createElement("video");
        Object.assign(localVideo, { muted: true, loop: true, playsInline: true, autoplay: true, preload: "auto" });
        localVideo.setAttribute("muted", ""); localVideo.setAttribute("playsinline", "");
        localVideo.src = reel.video;
        localVideo.addEventListener("playing", () => setPlaying(true));
        box.appendChild(localVideo);
        return;
      }
      if (!id) return;
      const make = () => {
        if (my !== gen) return; // a newer reel replaced this one before the API loaded
        const host = document.createElement("div");
        box.appendChild(host);
        player = new YT.Player(host, {
          videoId: id, host: "https://www.youtube-nocookie.com",
          playerVars: { autoplay: 1, mute: 1, controls: 0, loop: 1, playlist: id, playsinline: 1, rel: 0, modestbranding: 1, disablekb: 1, iv_load_policy: 3, fs: 0, cc_load_policy: 0 },
          events: {
            onReady: (e) => { e.target.mute(); noCaptions(e.target); if (!userPaused && onScreen) e.target.playVideo(); const f = box.querySelector("iframe"); f && f.setAttribute("tabindex", "-1"); f && f.setAttribute("aria-hidden", "true"); },
            onStateChange: (e) => { if (e.data === 1) noCaptions(e.target); if (e.data === 1 && !playing) setTimeout(() => setPlaying(true), 2600); },
          },
        });
      };
      if (window.YT && window.YT.Player) make();
      else {
        const prev = window.onYouTubeIframeAPIReady;
        window.onYouTubeIframeAPIReady = () => { prev && prev(); make(); };
        if (!document.querySelector("script[src*='iframe_api']")) {
          const go = () => { const s = document.createElement("script"); s.src = "https://www.youtube.com/iframe_api"; document.head.appendChild(s); };
          if (document.readyState === "complete") setTimeout(go, 300); else addEventListener("load", () => setTimeout(go, 300), { once: true });
        }
      }
    }
    function noCaptions(p) { try { p.unloadModule("captions"); p.unloadModule("cc"); } catch (e) {} }
    function pause(v) {
      if (player && player.pauseVideo) v ? player.pauseVideo() : player.playVideo();
      if (localVideo) v ? localVideo.pause() : localVideo.play();
    }
    function init() {
      if (!$(".hero")) return;
      render();
      const pauseBtn = $(".hero__pause");
      pauseBtn && pauseBtn.addEventListener("click", () => {
        userPaused = !userPaused;
        pause(userPaused);
        pauseBtn.setAttribute("aria-pressed", String(userPaused));
        pauseBtn.setAttribute("aria-label", userPaused ? "הפעלת הווידאו ברקע" : "עצירת הווידאו ברקע");
        pauseBtn.innerHTML = userPaused ? icon.play : icon.pause;
      });
      $$("[data-reel-open]").forEach((b) => b.addEventListener("click", () => {
        const reel = D.home.reel || {};
        pause(true);
        LB.open([{ title: "שואוריל", video: reel.youtube, ratio: "16 / 9", group: D.site.name }], 0, $(".hero__frame"), () => { if (!userPaused) pause(false); });
      }));
      // the reel tightens into a framed clip as the gallery arrives
      if (motion() && window.ScrollTrigger) {
        ScrollTrigger.create({ trigger: ".hero__frame", start: "top bottom", end: "bottom top",
          onLeave: () => { onScreen = false; if (!userPaused) pause(true); },
          onEnterBack: () => { onScreen = true; if (!userPaused && !LB.isOpen) pause(false); } });
      }
    }
    return { init, render };
  })();

  /* ---------------- shared footer ---------------- */
  function renderFooter() {
    const f = $("#ftr");
    if (!f) return;
    const h = D.home || {}, s = D.site || {};
    // the home page ends on its contact form, so a second "let's talk" block there would repeat it
    const hasContact = !!$("#contact");
    f.classList.toggle("ftr--slim", hasContact);
    f.innerHTML = `${hasContact ? "" : `
      <div class="ftr__cta">
        <h2 class="ftr__title" data-split>${esc(h.ctaTitle || "בואו נדבר")}</h2>
        <p class="ftr__text" data-reveal>${esc(h.ctaText || "")}</p>
        <div class="ftr__btns" data-reveal style="--d:.1s">
          <a class="btn btn--solid" data-fill href="index.html#contact">${esc(h.ctaButton || "דברו איתי")} <span class="btn__arrow" aria-hidden="true">←</span></a>
          ${s.whatsapp ? `<a class="btn" data-fill href="https://wa.me/${esc(String(s.whatsapp).replace(/\D/g, "").replace(/^0/, "972"))}" target="_blank" rel="noopener">וואטסאפ</a>` : ""}
          ${s.email ? `<a class="btn" data-fill href="mailto:${esc(s.email)}">דוא"ל</a>` : ""}
        </div>
      </div>`}
      <div class="ftr__bottom">
        <span dir="ltr">© ${new Date().getFullYear()} ${esc(s.brand || "Misha Graphics")}</span>
        <nav class="ftr__social" aria-label="רשתות">${(s.socials || []).map((x) => `<a href="${esc(x.url)}" target="_blank" rel="noopener">${esc(x.label)}</a>`).join("")}</nav>
      </div>`;
    const m = $(".mmenu__foot");
    if (m) m.innerHTML = (s.socials || []).map((x) => `<a href="${esc(x.url)}" target="_blank" rel="noopener">${esc(x.label)}</a>`).join("");
  }

  /* ---------------- pages ---------------- */
  let galleries = [];
  function renderHome() {
    Hero.render();
    renderWorks();
    renderLens();
  }

  // "All works": every work as a card in one grid seen through a lens (after Phantom, phantom.land), drawn
  // in WebGL by gallery-lens.js. It loads only when the visitor scrolls near it; without WebGL the block hides.
  let lensMounted = null;
  function renderLens() {
    const block = $("#all-works");
    if (!block || lensMounted) return;
    lensMounted = true;
    const secs = visibleSections();
    const bySec = {};
    const all = [];
    secs.forEach((s) => {
      bySec[s.id] = [];
      liveItems(s).forEach((it) => {
        const id = ytId(it.video), thumb = it.thumb || it.image || "";
        if (!id && !thumb) return;
        const w = {
          it, sec: s.id, secTitle: s.title, title: it.title || "", client: it.client || it.note || "", group: it.group || "",
          yt: id, ratio: id ? 16 / 9 : Math.min(1.78, Math.max(0.56, ratioNum(it.ratio))),
          medium: id ? yt(id, "hqdefault") : thumb, fb: thumb || (id ? yt(id, "mqdefault") : ""),
        };
        bySec[s.id].push(w); all.push(w);
      });
    });
    if (!all.length) { block.hidden = true; return; }
    // "all" is a fair mix: one from each discipline in turn
    const mixed = [];
    for (let k = 0; mixed.length < all.length; k++) secs.forEach((s) => { if (bySec[s.id][k]) mixed.push(bySec[s.id][k]); });
    const chips = $(".ln__chips", block);
    chips.innerHTML = `<div class="gl-chips" role="group" aria-label="תחום">${[["", "הכל", all.length], ...secs.filter((s) => bySec[s.id].length).map((s) => [s.id, s.title, bySec[s.id].length])]
      .map(([id, t, n]) => `<button class="gl-chip" type="button" data-sec="${esc(id)}" aria-pressed="${id === ""}">${esc(t)}<span class="mono">${n}</span></button>`).join("")}</div>`;
    // a click opens the work here: a branding project goes to its page, anything else plays in the lightbox
    const open = (w) => {
      if (isCase(w.it)) { location.href = caseHref(w.it); return; }
      const list = liveItems(sectionById(w.sec));
      LB.open(list, Math.max(0, list.indexOf(w.it)), null);
    };
    const start = () => {
      import("./gallery-lens.js?v=6")
        .then((m) => {
          const lens = m.mount($(".ln__view", block), { open });
          lens.setList(mixed);
          chips.addEventListener("click", (e) => {
            const c = e.target.closest("[data-sec]");
            if (!c) return;
            $$("[data-sec]", chips).forEach((x) => x.setAttribute("aria-pressed", String(x === c)));
            lens.setList(c.dataset.sec ? bySec[c.dataset.sec] : mixed);
          });
        })
        .catch(() => { block.hidden = true; });
    };
    const io = new IntersectionObserver((es) => { if (es[0].isIntersecting) { io.disconnect(); start(); } }, { rootMargin: "800px 0px" });
    io.observe(block);
  }

  // One gallery for every discipline, as tabs on the home page. The first view is the AI videos,
  // narrowed to the concepts token; a hash (#motion, #3d, ...) opens that tab instead.
  const FIRST_VIEW = { tab: "ai", group: "קונספטים" };
  // #3d opens a tab; #3d/<work id> also scrolls to that work and opens it
  const hashWork = () => {
    const [tab, item] = decodeURIComponent(location.hash.slice(1)).split("/");
    return sectionById(tab) ? { tab, item: item || "" } : null;
  };
  let workTab = "", worksBound = false;
  function renderWorks() {
    const tabs = $("#tabs"), body = $("#gal-body");
    if (!tabs || !body) return;
    const secs = visibleSections();
    const order = [...secs.filter((s) => s.id === "ai"), ...secs.filter((s) => s.id !== "ai")];
    tabs.innerHTML = order.map((s) => `<button class="tab" type="button" role="tab" id="tab-${esc(s.id)}" aria-controls="gal-body" aria-selected="false" data-tab="${esc(s.id)}">${esc(s.title)}</button>`).join("");
    const show = (id, user, item) => {
      const s = order.find((x) => x.id === id) || order.find((x) => x.id === FIRST_VIEW.tab) || order[0];
      if (!s) return;
      workTab = s.id;
      $$(".tab", tabs).forEach((t) => { const on = t.dataset.tab === s.id; t.setAttribute("aria-selected", String(on)); t.tabIndex = on ? 0 : -1; });
      body.setAttribute("aria-labelledby", `tab-${s.id}`);
      galleries.forEach((g) => g.destroy());
      galleries = [];
      body.innerHTML = `${s.intro ? `<p class="gal-intro">${esc(s.intro)}</p>` : ""}<div data-host></div>`;
      // a link to one work shows the whole tab, so that work is surely in the list
      const g = Gallery($("[data-host]", body), s, { infinite: false, group: !item && s.id === FIRST_VIEW.tab ? FIRST_VIEW.group : "" });
      galleries.push(g);
      if (item) g.openItem(item);
      if (user) { history.replaceState(null, "", `#${s.id}`); const t = $(`#tab-${s.id}`); t && t.scrollIntoView({ block: "nearest", inline: "center", behavior: "smooth" }); }
    };
    tabs.onclick = (e) => { const t = e.target.closest("[data-tab]"); if (t) show(t.dataset.tab, true); };
    tabs.onkeydown = (e) => {
      const list = $$(".tab", tabs), i = list.indexOf(document.activeElement);
      if (i < 0) return;
      const n = e.key === "ArrowLeft" ? i + 1 : e.key === "ArrowRight" ? i - 1 : null;
      if (n == null) return;
      e.preventDefault();
      const t = list[(n + list.length) % list.length]; t.focus(); show(t.dataset.tab, true);
    };
    const h = hashWork();
    show(h ? h.tab : workTab, false, h && h.item);
    if (!worksBound) {
      worksBound = true;
      addEventListener("hashchange", () => { const x = hashWork(); if (x) { show(x.tab, false, x.item); if (!x.item) scrollToEl($("#work"), 0); } });
    }
  }

  function renderAbout() {
    const a = D.about || {};
    const set = (k, v) => $$(`[data-mg='${k}']`).forEach((e) => (e.textContent = v || ""));
    set("aboutTitle", a.title); set("aboutLead", a.lead);
    const p = $("#portrait"); if (p && a.portrait) { p.src = a.portrait; p.alt = `${D.site.name || ""}`; }
    // where the bio mentions the YouTube channel, the words link to it (the address comes from the site's socials)
    const ytUrl = ((D.site.socials || []).find((x) => /youtube/i.test(x.label + x.url)) || {}).url;
    // a joined prefix letter ("ב") gets a hyphen and stays on the same line as the badge
    const linkChannel = (h) => (ytUrl ? h.replace(/([בלמהוכש]?)ערוץ היוטיוב/, (_, pre) => `<span class="yt-wrap">${pre ? pre + "-" : ""}<a class="yt-link" href="${esc(ytUrl)}" target="_blank" rel="noopener"><span class="yt-link__icon" aria-hidden="true"><svg viewBox="0 0 10 12"><path d="M0 0l10 6-10 6z"/></svg></span>ערוץ היוטיוב<span class="yt-link__arrow" aria-hidden="true">↗</span></a></span>`) : h);
    const bio = $("#bio"); if (bio) bio.innerHTML = (a.bio || []).map((t) => `<p data-reveal>${linkChannel(esc(t))}</p>`).join("");
    const facts = $("#facts"); if (facts) facts.innerHTML = (a.stats || []).map((s, i) => `<li class="fact" data-reveal style="--d:${i * 0.08}s"><span class="fact__label">${esc(s.label)}</span><span class="fact__num">${esc(s.num)}</span></li>`).join("");
    const svcs = $("#services");
    if (svcs) svcs.innerHTML = (D.services || []).map((s, i) => `
      <section class="chap" id="${esc(s.id)}" aria-labelledby="t-${esc(s.id)}">
        ${i === 0 ? `<p class="chap__label">שירותים</p>` : `<span aria-hidden="true"></span>`}
        <div class="chap__body svc">
        <div class="svc__side"><div class="svc__sticky">
          <h2 class="svc__title display" id="t-${esc(s.id)}" dir="auto" data-split>${esc(s.title)}</h2>
          <p class="svc__lead" data-reveal>${esc(s.lead)}</p>
          ${s.image ? `<div class="frame-media svc__img" data-reveal><img src="${esc(s.image)}" alt="" loading="lazy"></div>` : ""}
        </div></div>
        <div class="svc__main">
          <p class="svc__intro" data-reveal>${esc(s.intro)}</p>
          ${s.problems && s.problems.length ? `<div data-reveal><h3>${esc(s.problemTitle || "מתי פונים אליי")}</h3><ul class="svc__problems">${s.problems.map((x) => `<li>${esc(x)}</li>`).join("")}</ul></div>` : ""}
          ${s.includes && s.includes.length ? `<div data-reveal><h3>${esc(s.includesTitle || "מה כלול")}</h3><ul class="svc__includes">${s.includes.map((x) => { const [b, ...r] = String(x).split(":"); return `<li>${r.length ? `<b>${esc(b)}</b><span>${esc(r.join(":").trim())}</span>` : `<b>${esc(x)}</b>`}</li>`; }).join("")}</ul></div>` : ""}
          ${s.audience && s.audience.length ? `<div data-reveal><h3>למי זה מתאים</h3><ul class="svc__tags">${s.audience.map((x) => `<li>${esc(x)}</li>`).join("")}</ul></div>` : ""}
          ${s.faq && s.faq.length ? `<div class="faq" data-reveal><h3>שאלות נפוצות</h3>${s.faq.map((f) => `<details><summary>${esc(f.q)}</summary><p>${esc(f.a)}</p></details>`).join("")}</div>` : ""}
          <div data-reveal><a class="btn btn--solid" data-fill href="#contact">${esc(s.cta || "בואו נדבר")} <span class="btn__arrow" aria-hidden="true">←</span></a></div>
        </div>
        </div>
      </section>`).join("");
    const pr = D.process || {};
    set("processTitle", pr.title);
    const steps = $("#steps"); if (steps) steps.innerHTML = (pr.steps || []).map((s, i) => `<li class="step" data-reveal style="--d:${i * 0.08}s"><h3>${esc(s.title)}</h3><p>${esc(s.copy)}</p></li>`).join("");
    set("clientsTitle", a.clientsTitle);
    const cl = $("#clients"); if (cl) cl.innerHTML = (a.clients || []).map((c) => `<li><span dir="auto">${esc(c)}</span></li>`).join("");
    renderContact();
  }

  function renderContact() {
    const c = D.contact || {}, s = D.site || {};
    const set = (k, v) => $$(`[data-mg='${k}']`).forEach((e) => (e.textContent = v || ""));
    set("contactTitle", c.title); set("contactIntro", c.intro);
    const direct = $("#direct");
    if (direct) direct.innerHTML = [
      s.whatsapp ? `<a class="draw" href="https://wa.me/${esc(String(s.whatsapp).replace(/\D/g, "").replace(/^0/, "972"))}" target="_blank" rel="noopener">וואטסאפ: <span class="mono" dir="ltr">${esc(s.whatsapp)}</span></a>` : "",
      s.email ? `<a class="draw" href="mailto:${esc(s.email)}">דוא"ל: <span class="mono" dir="ltr">${esc(s.email)}</span></a>` : "",
    ].join("");
    const subj = $("#subjects");
    if (subj) subj.innerHTML = (c.subjects || []).map((x, i) => `<label class="chip"><input type="radio" name="subject" value="${esc(x)}" ${i === 0 ? "checked" : ""}><span>${esc(x)}</span></label>`).join("");
  }

  function initForm() {
    const form = $("#contact-form");
    if (!form || form.__on) return;
    form.__on = true;
    const status = $(".form__status", form);
    const say = (t, kind) => { status.textContent = t; status.className = `form__status ${kind ? "is-" + kind : ""}`; };
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const fd = new FormData(form);
      if (fd.get("botcheck")) return;
      const name = String(fd.get("name") || "").trim(), email = String(fd.get("email") || "").trim(), phone = String(fd.get("phone") || "").trim(), msg = String(fd.get("message") || "").trim();
      if (!name) { say("נשמח לדעת איך קוראים לך.", "error"); form.name.focus(); return; }
      if (!email && !phone) { say('צריך דוא"ל או טלפון כדי שאוכל לחזור אליך.', "error"); form.email.focus(); return; }
      if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { say('כתובת הדוא"ל לא נראית תקינה.', "error"); form.email.focus(); return; }
      if (!msg) { say("ספרו לי בכמה מילים על הפרויקט.", "error"); form.message.focus(); return; }
      const btn = form.querySelector("button[type=submit]");
      btn.disabled = true; say("שולח...");
      try {
        const r = await fetch("https://api.web3forms.com/submit", {
          method: "POST", headers: { "Content-Type": "application/json", Accept: "application/json" },
          body: JSON.stringify({ access_key: (D.contact || {}).accessKey, subject: `פנייה חדשה מהאתר: ${fd.get("subject") || ""}`, from_name: "Misha Graphics site", name, email, phone, topic: fd.get("subject"), message: msg }),
        });
        const j = await r.json();
        if (j.success) { form.reset(); say((D.contact || {}).success || "ההודעה נשלחה. תודה!", "ok"); }
        else throw new Error(j.message);
      } catch (err) { say((D.contact || {}).error || "משהו השתבש בשליחה. נסו שוב.", "error"); }
      btn.disabled = false;
    });
  }

  // project.html?p=<id>: one case study, laid out the way it was built on the old site: a column of
  // blocks (heading, text, single image, gallery, video) or, for "grid" projects, one grid of every
  // picture with the text spanning across. Then the next project.
  function renderProject() {
    const host = $("#project");
    if (!host) return;
    const id = new URLSearchParams(location.search).get("p") || "";
    const all = visibleSections().flatMap((s) => liveItems(s).filter(isCase).map((it) => ({ ...it, sec: s })));
    const k = all.findIndex((x) => x.id === id);
    if (k < 0) {
      host.innerHTML = `<div class="proj__head"><h1 class="proj__title display">הפרויקט לא נמצא.</h1>
        <p class="proj__meta"><a class="draw" href="index.html#work">חזרה לעבודות</a></p></div>`;
      return;
    }
    const it = all[k], next = all[(k + 1) % all.length];
    document.title = `${it.title} | ${D.site.name || ""}`;
    // a project without a built layout falls back to its pictures, one under the other
    const body = it.body && it.body.length ? it.body
      : [{ type: "image", src: it.image, ratio: it.ratio }, ...it.images.map((x) => ({ type: "image", src: x.image, ratio: x.ratio }))];

    const media = []; // every picture on the page, in order, for the lightbox
    const addMedia = (src, ratio) => { media.push({ image: src, ratio, title: it.title, note: it.note }); return media.length - 1; };
    const isVid = (x) => !!(x && (x.type === "video" || x.video));
    const embedOf = (u) => {
      const y = ytId(u);
      if (y) return `https://www.youtube-nocookie.com/embed/${y}?rel=0&playsinline=1`;
      const m = String(u || "").match(/vimeo\.com\/(?:video\/)?(\d+)/);
      if (m) return `https://player.vimeo.com/video/${m[1]}`;
      return /adobe\.io|\/embed/.test(u || "") ? u : ""; // Behance's own player, or any ready-made embed
    };
    const player = (u) => {
      const e = embedOf(u);
      return e
        ? `<iframe src="${esc(e)}" title="${esc(it.title)}" loading="lazy" allow="autoplay; fullscreen; picture-in-picture" allowfullscreen></iframe>`
        : `<video src="${esc(u)}" controls playsinline preload="metadata"></video>`;
    };
    // the text styling chosen per block in the old editor (alignment, size, weight, colour)
    const look = (b) => esc([b.align && `text-align:${b.align}`, b.size && `font-size:${+b.size}px`, b.bold && "font-weight:700",
      b.italic && "font-style:italic", b.underline && "text-decoration:underline", b.color && `color:${b.color}`].filter(Boolean).join(";"));
    const dirAttr = (b) => (b.dir && b.dir !== "auto" ? b.dir : "auto");
    // headings and text are the owner's own markup (line breaks, coloured words), so they go in as written
    const heading = (b) => `<h2 class="pb-h" dir="${esc(dirAttr(b))}" style="${look(b)}">${b.text || b.heading || ""}</h2>`;
    const text = (b) => `<div class="pb-text">${b.heading ? `<h2 class="pb-h" dir="auto">${esc(b.heading)}</h2>` : ""}${b.text ? `<p dir="${esc(dirAttr(b))}" style="${look(b)}">${b.text}</p>` : ""}</div>`;
    const cell = (x) => {
      if (isVid(x)) return `<div class="pb-cell pb-cell--vid" data-ar="${esc(x.ratio || "16 / 9")}">${player(x.video || x.url)}</div>`;
      const src = x.src || x.image || x.poster || "";
      return `<button class="pb-cell" type="button" data-m="${addMedia(src, x.ratio)}" data-ar="${esc(x.ratio || "1 / 1")}" aria-label="הגדלת התמונה"><img src="${esc(src)}" alt="${esc(x.alt || "")}" loading="lazy" decoding="async"></button>`;
    };
    const gallery = (cells, o) => {
      const uniform = o.mode === "uniform";
      const cols = Math.max(1, parseInt(o.cols, 10) || 3);
      return `<div class="pb-gal ${uniform ? "pb-gal--uniform" : "pb-gal--masonry"}" data-cols="${cols}" style="--cols:${cols};--gap:${o.gap != null ? +o.gap : 8}px;${uniform ? `--ar:${esc(o.ratio || "1 / 1")}` : ""}">${cells.join("")}</div>`;
    };
    const block = (b) => {
      if (b.type === "heading") return heading(b);
      if (b.type === "text") return text(b);
      if (b.type === "video") return `<div class="pb-video" style="aspect-ratio:${ratioCss(b.ratio || "16 / 9")}">${player(b.url)}</div>`;
      if (b.type === "gallery") return gallery((b.items || []).map(cell), b);
      // a single image; "full" and "wide" step out of the text column
      const src = b.src || b.poster || "", r = ratioCss(b.ratio || "4 / 3");
      const w = b.width === "full" ? " pb-fig--full" : b.width === "wide" ? " pb-fig--wide" : "";
      const img = `<button class="pb-img" type="button" data-m="${addMedia(src, b.ratio)}" style="--r:${r}" aria-label="הגדלת התמונה"><img src="${esc(src)}" alt="${esc(b.alt || "")}" loading="lazy" decoding="async"></button>`;
      return `<figure class="pb-fig${w}">${b.link ? `<a href="${esc(b.link)}" target="_blank" rel="noopener">${img}</a>` : img}${b.caption ? `<figcaption dir="auto">${esc(b.caption)}</figcaption>` : ""}</figure>`;
    };
    // "grid" projects: every picture in one grid, headings and text running across the full width
    const pageGrid = () => {
      const cells = body.map((b) => {
        if (b.type === "heading") return `<div class="pb-span">${heading(b)}</div>`;
        if (b.type === "text") return `<div class="pb-span">${text(b)}</div>`;
        if (b.type === "gallery") return (b.items || []).map(cell).join("");
        if (b.type === "video") return cell({ type: "video", video: b.url, ratio: b.ratio });
        return cell({ src: b.src || b.poster, ratio: b.ratio, alt: b.alt });
      });
      return gallery(cells, { mode: it.gridMode, cols: it.gridCols || 3, gap: it.gridGap, ratio: it.gridRatio });
    };

    host.innerHTML = `
      <header class="proj__head" style="max-width:${it.view === "grid" ? 1600 : parseInt(it.stackWidth, 10) || 1100}px">
        <a class="proj__back" href="index.html#${esc(it.sec.id)}"><span class="arrow" aria-hidden="true">→</span> כל עבודות ה${esc(it.sec.title)}</a>
        <h1 class="proj__title display" dir="${dirOf(it.title)}">${esc(it.title)}</h1>
        ${it.note ? `<p class="proj__meta" dir="auto">${esc(it.note)}</p>` : ""}
      </header>
      ${it.view === "grid" ? `<div class="pb pb--grid">${pageGrid()}</div>`
        : `<div class="pb" style="--sw:${parseInt(it.stackWidth, 10) || 1100}px">${body.map(block).join("")}</div>`}
      ${all.length > 1 ? `<a class="proj__next" href="${esc(caseHref(next))}">
        <span class="proj__next-label">הפרויקט הבא</span>
        <span class="proj__next-title display" dir="${dirOf(next.title)}">${esc(next.title)}</span>
        <span class="proj__next-img" aria-hidden="true"><img src="${esc(next.thumb || next.image)}" alt="" loading="lazy"></span>
        <span class="arrow" aria-hidden="true">←</span>
      </a>` : ""}`;

    // masonry that keeps each picture's shape and the built order (left to right, as it was designed)
    const pack = () => $$(".pb-gal--masonry", host).forEach((g) => {
      const W = g.clientWidth;
      if (!W) return;
      const cols = Math.min(+g.dataset.cols || 3, mobile() ? 2 : 99);
      const gap = parseFloat(g.style.getPropertyValue("--gap")) || 0;
      const colW = (W - gap * (cols - 1)) / cols, h = new Array(cols).fill(0);
      Array.from(g.children).forEach((c) => {
        if (c.classList.contains("pb-span")) {
          const top = Math.max(...h);
          c.style.cssText = `position:absolute;left:0;top:${top}px;width:${W}px`;
          h.fill(top + c.offsetHeight + gap);
          return;
        }
        const a = String(c.dataset.ar || "1 / 1").split("/").map(parseFloat), r = a[0] && a[1] ? a[0] / a[1] : 1;
        let m = 0;
        for (let j = 1; j < cols; j++) if (h[j] < h[m] - 0.5) m = j;
        const ch = colW / r;
        c.style.cssText = `position:absolute;left:${m * (colW + gap)}px;top:${h[m]}px;width:${colW}px;height:${ch}px`;
        h[m] += ch + gap;
      });
      g.style.height = `${Math.max(0, Math.max(...h) - gap)}px`;
    });
    pack();
    let pt;
    addEventListener("resize", () => { clearTimeout(pt); pt = setTimeout(pack, 120); });
    if (document.fonts) document.fonts.ready.then(pack);

    host.onclick = (e) => {
      const b = e.target.closest("[data-m]");
      if (!b || e.target.closest("a")) return;
      LB.open(media, +b.dataset.m, b);
    };
  }

  /* ---------------- blog: blog.html (all posts) and post.html?slug=<slug> (one post) ----------------
     The addresses are the old site's, so links from search and social keep working. */
  const TAG_HE = { Design: "עיצוב", AI: "AI", "3D": "תלת מימד", Gear: "ציוד", Resources: "משאבים", Inspiration: "השראה" };
  const tagLabel = (t) => TAG_HE[t] || t;
  // a post with its own designed page (href) opens that page instead of the shared post template
  const postHref = (p) => p.href || `post.html?slug=${encodeURIComponent(p.slug)}`;
  const postCover = (p) => p.cover || ((p.body || []).find((b) => b.type === "img") || {}).src || "";

  function renderBlog() {
    const host = $("#blog");
    if (!host) return;
    const posts = D.posts || [];
    const tags = (D.blogTags || []).filter((t) => posts.some((p) => p.tag === t));
    let tag = "", query = "";
    host.innerHTML = `
      <header class="blog-head">
        <h1 class="blog-head__title display">בלוג</h1>
        <p class="blog-head__lead">מדריכים, השוואות ציוד, עבודה עם AI וכל מה שלמדתי בדרך. <span class="mono">${posts.length}</span> פוסטים.</p>
        <div class="blog-tools">
          <div class="blog-tags" role="group" aria-label="נושא">${[["", "הכל"], ...tags.map((t) => [t, tagLabel(t)])].map(([v, l]) => `<button class="tok" type="button" data-tag="${esc(v)}" aria-pressed="${v === ""}">${esc(l)}</button>`).join("")}</div>
          <label class="blog-search"><span class="sr-only">חיפוש</span><input type="search" placeholder="חיפוש בפוסטים" autocomplete="off"></label>
        </div>
      </header>
      <div class="blog-grid"></div>
      <p class="blog-empty" hidden>לא נמצאו פוסטים.</p>`;
    const grid = $(".blog-grid", host), empty = $(".blog-empty", host);
    const card = (p) => {
      const c = postCover(p);
      return `<a class="post-card" href="${postHref(p)}">
        <span class="post-card__cover">${c ? `<img src="${esc(c)}" alt="" loading="lazy" decoding="async">` : ""}</span>
        <span class="post-card__meta"><span class="post-card__tag">${esc(tagLabel(p.tag))}</span>${p.date ? `<span class="mono">${esc(p.date)}</span>` : ""}</span>
        <span class="post-card__title" dir="auto">${esc(p.title)}</span>
        ${p.excerpt ? `<span class="post-card__excerpt" dir="auto">${esc(p.excerpt)}</span>` : ""}
      </a>`;
    };
    const draw = () => {
      const q = query.trim().toLowerCase();
      const list = posts.filter((p) => (!tag || p.tag === tag) && (!q || `${p.title} ${p.excerpt}`.toLowerCase().includes(q)));
      grid.innerHTML = list.map(card).join("");
      empty.hidden = list.length > 0;
    };
    $(".blog-tags", host).addEventListener("click", (e) => {
      const b = e.target.closest("[data-tag]");
      if (!b) return;
      tag = b.dataset.tag;
      $$("[data-tag]", host).forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
      draw();
    });
    $(".blog-search input", host).addEventListener("input", (e) => { query = e.target.value; draw(); });
    draw();
  }

  function renderPost() {
    const host = $("#post");
    if (!host) return;
    const slug = new URLSearchParams(location.search).get("slug") || "";
    const posts = D.posts || [];
    const k = posts.findIndex((p) => p.slug === slug);
    if (k < 0) {
      host.innerHTML = `<header class="post-head"><h1 class="post-head__title display">הפוסט לא נמצא.</h1><p><a class="draw" href="blog.html">לכל הפוסטים</a></p></header>`;
      return;
    }
    const p = posts[k], next = posts[(k + 1) % posts.length];
    if (p.href) { location.replace(p.href); return; }
    document.title = `${p.title} | ${D.site.name || ""}`;
    // the text styling chosen per block in the old editor (alignment, size, weight, colour)
    const look = (b) => esc([b.align && `text-align:${b.align}`, b.size && `font-size:${+b.size}px`, b.bold && "font-weight:700",
      b.italic && "font-style:italic", b.underline && "text-decoration:underline", b.color && `color:${b.color}`].filter(Boolean).join(";"));
    const dir = (b) => esc(b.dir && b.dir !== "auto" ? b.dir : "auto");
    const embed = (u) => { const y = ytId(u); if (y) return `https://www.youtube-nocookie.com/embed/${y}?rel=0`; const m = String(u || "").match(/vimeo\.com\/(?:video\/)?(\d+)/); return m ? `https://player.vimeo.com/video/${m[1]}` : ""; };
    // headings and paragraphs are the owner's own markup (links, bold words), so they go in as written
    const block = (b) => {
      if (b.type === "h") return `<h2 dir="${dir(b)}" style="${look(b)}">${b.text || ""}</h2>`;
      if (b.type === "p") return `<p dir="${dir(b)}" style="${look(b)}">${b.text || ""}</p>`;
      if (b.type === "quote") return `<blockquote dir="${dir(b)}">${b.text || ""}</blockquote>`;
      if (b.type === "img") return b.src ? `<figure><img src="${esc(b.src)}" alt="${esc(b.alt || "")}" loading="lazy" decoding="async"></figure>` : "";
      if (b.type === "video") { const v = b.url || b.src || "", e = embed(v); return v ? `<figure class="post-video">${e ? `<iframe src="${esc(e)}" title="${esc(b.alt || "וידאו")}" loading="lazy" allow="autoplay; fullscreen; picture-in-picture" allowfullscreen></iframe>` : `<video src="${esc(v)}" controls playsinline preload="metadata"></video>`}</figure>` : ""; }
      if (b.type === "file") return `<p class="post-file"><a class="btn" data-fill href="${esc(b.href || "#")}" download="${esc(b.name || b.text || "")}"><span aria-hidden="true">↓</span> <span dir="auto">${esc(b.text || "הורדה")}</span></a></p>`;
      return "";
    };
    host.innerHTML = `
      <header class="post-head">
        <a class="post-head__back" href="blog.html"><span aria-hidden="true">→</span> לכל הפוסטים</a>
        <p class="post-head__meta"><span class="post-card__tag">${esc(tagLabel(p.tag))}</span>${p.date ? `<span class="mono">${esc(p.date)}</span>` : ""}${p.read ? `<span>${esc(p.read)}</span>` : ""}</p>
        <h1 class="post-head__title display" dir="auto">${esc(p.title)}</h1>
        ${p.excerpt ? `<p class="post-head__lead" dir="auto">${esc(p.excerpt)}</p>` : ""}
      </header>
      ${p.cover ? `<figure class="post-cover"><img src="${esc(p.cover)}" alt="" fetchpriority="high"></figure>` : ""}
      <div class="post-body">${(p.body || []).map(block).join("")}</div>
      ${posts.length > 1 ? `<a class="proj__next post-next" href="${postHref(next)}">
        <span class="proj__next-label">הפוסט הבא</span>
        <span class="proj__next-title display" dir="auto">${esc(next.title)}</span>
        ${postCover(next) ? `<span class="proj__next-img" aria-hidden="true"><img src="${esc(postCover(next))}" alt="" loading="lazy"></span>` : "<span></span>"}
        <span class="arrow" aria-hidden="true">←</span>
      </a>` : ""}`;
  }

  function render404() {
    const cv = $("#nf-canvas");
    if (!cv) return;
    const ctx = cv.getContext("2d");
    cv.width = 48; cv.height = 27;
    const draw = () => {
      const d = ctx.createImageData(48, 27);
      for (let i = 0; i < d.data.length; i += 4) { const v = Math.random() * 60 + 10; d.data[i] = v; d.data[i + 1] = v; d.data[i + 2] = v + 4; d.data[i + 3] = 255; }
      ctx.putImageData(d, 0, 0);
    };
    draw();
    if (motion()) { let t = 0; gsap.ticker.add(() => { if (++t % 6 === 0) draw(); }); }
  }

  /* ---------------- hero intro ---------------- */
  function intro() {
    if (!motion()) return;
    const t = $(".hero__title, .proj__title, .blog-head__title, .post-head__title, .nf__title");
    if (t) splitIn(t, { intro: true, delay: 0.15 });
    const after = $(".hero__aside, .hero__frame, .about-hero__lead, .tabs");
    if (after && after.length) gsap.from(after, { opacity: 0, y: 18, duration: 1, ease: "expo.out", stagger: 0.08, delay: 0.45 });
    $$("[data-split]").forEach((el) => { if (el !== t) splitIn(el); });
  }

  /* ---------------- boot ---------------- */
  function renderAll() {
    galleries.forEach((g) => g.destroy && g.destroy());
    galleries = [];
    renderFooter();
    if (PAGE === "home") { renderHome(); renderAbout(); }
    if (PAGE === "project") renderProject();
    if (PAGE === "blog") renderBlog();
    if (PAGE === "post") renderPost();
    if (PAGE === "404") render404();
    initFills();
    initReveals();
  }

  function boot() {
    initScroll();
    initHeader();
    initCurtain();
    renderAll();
    Hero.init();
    initForm();
    const go = () => { intro(); if (window.ScrollTrigger) ScrollTrigger.refresh(); };
    if (document.fonts && motion()) Promise.race([document.fonts.ready, new Promise((r) => setTimeout(r, 900))]).then(go);
    else go();
    // a hash on load (#contact, or a gallery tab like #3d) after layout settles; #3d/<id> scrolls itself
    const hw = hashWork();
    if (location.hash && !(hw && hw.item)) {
      const t = hw ? $("#work") : document.getElementById(decodeURIComponent(location.hash.slice(1)));
      if (t) {
        let moved = false;
        const stop = () => { moved = true; };
        ["wheel", "touchstart", "keydown"].forEach((ev) => addEventListener(ev, stop, { once: true, passive: true }));
        setTimeout(() => scrollToEl(t, 20), 120);
        // the gallery above repacks once fonts and the page finish loading, which moves the target; aim again
        settled().then(() => { if (!moved) scrollToEl(t, 20); });
      }
    }

    // live preview from admin.html
    if (PREVIEW) {
      addEventListener("message", (e) => {
        if (e.origin !== location.origin || !e.data) return;
        if (e.data.type === "mg:data") {
          D = window.MG = e.data.data;
          const y = scrollY;
          splits.forEach((s) => { s.__io && s.__io.disconnect(); s.revert && s.revert(); }); splits.length = 0;
          renderAll();
          if (PAGE === "home") { Hero.render(); initForm(); }
          $$("[data-reveal]").forEach((x) => x.classList.add("is-in"));
          scrollTo(0, y);
          if (window.ScrollTrigger) ScrollTrigger.refresh();
        } else if (e.data.type === "mg:scroll") {
          const t = $(e.data.to); if (t) scrollToEl(t, 60);
        }
      });
      parent.postMessage({ type: "mg:ready" }, location.origin);
    }
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
