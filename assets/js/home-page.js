/* New Hebrew home page — renders everything from SITE.home so it stays
   editable from the Studio, then wires the hero teaser rotation + the
   showreel lightbox. */
window.PAGE_INIT = function () {
  var S = window.DC.data, esc = window.DC.esc, videoEmbed = window.DC.videoEmbed, accentize = window.DC.accentize;
  var H = S.home || {};
  var app = document.getElementById("app");
  if (!app) return;

  function btn(b, kind) {
    if (!b || !b.label) return "";
    return '<a class="btn btn--' + kind + '" href="' + esc(b.href || "#") + '">' + esc(b.label) + '</a>';
  }

  /* The header and footer are NOT built here — site.js renders the shared
     chrome into #site-header / #site-footer on every page. */

  /* ---------- hero ---------- */
  var hero = H.hero || {};
  // Only the first frame is fetched up front. The rest are attached to
  // data-src and pulled in after load, so the page doesn't pay for ~2MB of
  // teaser frames before it can show anything.
  var slides = (hero.teaser || []).map(function (src, i) {
    return i === 0
      ? '<img src="' + esc(src) + '" alt="" class="is-on" fetchpriority="high">'
      : '<img data-src="' + esc(src) + '" alt="" decoding="async">';
  }).join("");
  var heroHTML =
    '<section class="hero"><div class="wrap">' +
      '<div class="hero-stage" id="hero-stage" role="button" tabindex="0" aria-label="נגן את השוריל">' +
        '<div class="hero-slides">' + slides + '</div>' +
        '<div class="hero-play"><svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg></div>' +
        '<div class="hero-grid">' +
          '<div><h1>' + esc(hero.title || "") + '</h1></div>' +
          '<div class="hero-copy">' +
            '<p>' + esc(hero.copy || "") + '</p>' +
            '<div class="hero-actions">' + btn(hero.primary, "primary") + btn(hero.secondary, "secondary") + '</div>' +
          '</div>' +
        '</div>' +
      '</div>' +
    '</div></section>';

  /* ---------- services ---------- */
  var svc = H.services || {};
  var svcCards = (svc.items || []).map(function (it) {
    return '' +
      // Clickable only when the service actually has a page behind it.
      (it.href ? '<a class="service-card is-link" href="' + esc(it.href) + '">' : '<div class="service-card">') +
        (it.image ? '<img class="service-card__img" src="' + esc(it.image) + '" alt="' + esc(it.title || "") + '">' : '') +
        '<div class="service-card__body">' +
          (it.number ? '<div class="service-number">' + esc(it.number) + '</div>' : "") +
          '<h3>' + esc(it.title || "") + '</h3>' +
          '<p>' + esc(it.body || "") + '</p>' +
          (it.extra ? '<div class="service-extra">' + esc(it.extra) + '</div>' : '') +
          (it.href ? '<span class="service-more">לפרטים ←</span>' : '') +
        '</div>' +
      (it.href ? '</a>' : '</div>');
  }).join("");
  var servicesHTML =
    '<section id="services"><div class="wrap">' +
      sectionHead(svc.title, svc.intro) +
      '<div class="services">' + svcCards + '</div>' +
    '</div></section>';

  /* ---------- works ----------
     Each entry only REFERENCES a real project in SITE.works (by category +
     title), so the title, thumbnail and video always follow whatever the
     Studio holds — nothing is duplicated here. */
  var wk = H.works || {};
  function findWork(ref) {
    var list = (S.works && S.works[ref.cat]) || [];
    var want = String(ref.title || "").trim().toLowerCase();
    for (var i = 0; i < list.length; i++) {
      if (String(list[i].en || "").trim().toLowerCase() === want) return list[i];
    }
    return null;
  }
  var workCards = (wk.items || []).map(function (ref) {
    var w = findWork(ref);
    var title = w ? (w.he || w.en) : (ref.title || "");
    var meta = w ? (w.client || w.sub || "") : "לא נמצא בגלריה";
    var video = w ? (w.video || "") : "";
    var poster = w && w.poster ? w.poster : window.DC.videoThumbHi(video);
    var fallback = window.DC.videoThumb(video);
    var media = poster
      ? '<img class="work-card__img" src="' + esc(poster) + '" alt="' + esc(title) + '" loading="lazy"' +
        (fallback ? ' onerror="this.onerror=null;this.src=\'' + esc(fallback) + '\'"' : '') + '>'
      : '<div class="work-card__ph">PROJECT IMAGE</div>';
    return '' +
      '<button type="button" class="work-card ' + esc(ref.size || "third") + '"' +
        ' data-video="' + esc(video) + '">' +
        media +
        '<div class="work-meta">' +
          '<div><h4>' + esc(title) + '</h4><span class="wmeta">' + esc(meta) + '</span></div>' +
          (video ? '<span class="wgo">לצפייה ←</span>' : '') +
        '</div>' +
      '</button>';
  }).join("");
  var worksHTML =
    '<section id="works"><div class="wrap">' +
      sectionHead(wk.title, wk.intro) +
      '<div class="works">' + workCards + '</div>' +
      (wk.moreLabel ? '<div class="works-more">' + btn({ label: wk.moreLabel, href: wk.moreHref }, "secondary") + '</div>' : '') +
    '</div></section>';

  /* ---------- process ---------- */
  var pr = H.process || {};
  var steps = (pr.steps || []).map(function (st) {
    return '' +
      '<div class="step">' +
        '<span class="step__num">' + esc(st.num || "") + '</span>' +
        '<div>' +
          '<b class="step__title">' + esc(st.title || "") + '</b>' +
          '<p>' + esc(st.copy || "") + '</p>' +
        '</div>' +
        (st.icon ? '<img class="step__icon" src="' + esc(st.icon) + '" alt="">' : '') +
      '</div>';
  }).join("");
  var processHTML =
    '<section id="process"><div class="wrap">' +
      sectionHead(pr.title, pr.intro) +
      '<div class="process">' + steps + '</div>' +
    '</div></section>';

  /* ---------- about ---------- */
  var ab = H.about || {};
  var aboutStats = (ab.stats && ab.stats.length)
    ? '<div class="about-stats">' + ab.stats.map(function (s) {
        return '<div class="stat"><div class="stat__num">' + esc(s.num) + '</div>' +
               '<div class="stat__label">' + esc(s.label) + '</div></div>';
      }).join("") + '</div>'
    : "";
  var aboutHTML =
    '<section id="about"><div class="wrap about-strip">' +
      '<div class="about-copy">' +
        // break after the first sentence: "חשיבה של פרסום." / "ביצוע של סטודיו עצמאי."
        '<h2>' + esc(ab.heading || "").replace(/\.\s+/, ".<br>") + '</h2>' +
        aboutStats +
        // accentize() turns {{ ... }} into the purple accent span; \n → line break
        (ab.copy || []).map(function (p) { return '<p>' + accentize(p).replace(/\n/g, "<br>") + '</p>'; }).join("") +
      '</div>' +
      '<div class="about-img-wrap">' + (ab.image ? '<img src="' + esc(ab.image) + '" alt="' + esc(S.profile.name || "מישה קרץ׳") + '">' : '') + '</div>' +
    '</div></section>';

  /* ---------- cta ---------- */
  var cta = H.cta || {};
  var ctaHTML =
    '<section class="cta" id="contact"><div class="wrap">' +
      '<h2>' + esc(cta.heading || "") + '</h2>' +
      '<p>' + esc(cta.copy || "") + '</p>' +
      btn(cta.button, "primary") +
    '</div></section>';

  /* ---------- lightbox ---------- */
  var lightbox =
    '<div class="lightbox" id="lightbox" aria-hidden="true">' +
      '<button class="lightbox__close" id="lb-close" aria-label="סגירה">&times;</button>' +
      '<div class="lightbox__frame">' +
        '<div class="lightbox__mount" id="lb-mount"></div>' +
      '</div>' +
    '</div>';

  app.innerHTML = '<main>' + heroHTML + servicesHTML + worksHTML + processHTML + aboutHTML + ctaHTML + '</main>' + lightbox;

  function sectionHead(title, intro) {
    return '<div class="section-head"><h2>' + esc(title || "") + '</h2>' +
      (intro ? '<p>' + esc(intro) + '</p>' : '') + '</div>';
  }

  /* ================= behaviours ================= */

  /* hero teaser rotation */
  var imgs = app.querySelectorAll(".hero-slides img");

  // Pull the remaining frames in only once the page itself has finished
  // loading, and one at a time so they never compete with anything visible.
  function warmTeasers() {
    var queue = [].filter.call(imgs, function (im) { return im.getAttribute("data-src"); });
    (function next() {
      var im = queue.shift();
      if (!im) return;
      im.addEventListener("load", next, { once: true });
      im.addEventListener("error", next, { once: true });
      im.src = im.getAttribute("data-src");
      im.removeAttribute("data-src");
    })();
  }
  if (document.readyState === "complete") warmTeasers();
  else window.addEventListener("load", warmTeasers, { once: true });

  // PAGE_INIT can run again (the Studio's live preview re-renders on every
  // edit), so the rotation timer is stored globally and cleared first, and
  // document/app-level listeners are bound only once with DOM lookups instead
  // of captured elements.
  if (window.__heroRot) clearInterval(window.__heroRot);
  if (imgs.length > 1) {
    var idx = 0;
    window.__heroRot = setInterval(function () {
      // don't rotate onto a frame that hasn't arrived yet
      var next = (idx + 1) % imgs.length;
      if (imgs[next].getAttribute("data-src")) return;
      imgs[idx].classList.remove("is-on");
      idx = next;
      imgs[idx].classList.add("is-on");
    }, 4200);
  }

  /* video lightbox — used by the hero showreel AND by the featured works */
  var stage = document.getElementById("hero-stage");
  var lb = document.getElementById("lightbox");

  function openLB(url) {
    var box = document.getElementById("lightbox");
    var mount = document.getElementById("lb-mount");
    if (!box || !mount) return;
    var embed = videoEmbed(url || "");
    if (embed) {
      var sep = embed.indexOf("?") >= 0 ? "&" : "?";
      mount.innerHTML = '<iframe src="' + esc(embed) + sep + 'autoplay=1&rel=0&modestbranding=1&playsinline=1" ' +
        'allow="autoplay; encrypted-media; fullscreen" allowfullscreen></iframe>';
    } else {
      mount.innerHTML = '<div class="lightbox__empty">כאן ייכנס השוריל שלך.<br>הדביקו קישור יוטיוב בשדה showreelUrl (בהמשך — דרך הסטודיו).</div>';
    }
    box.classList.add("is-open");
    box.setAttribute("aria-hidden", "false");
  }
  function closeLB() {
    var box = document.getElementById("lightbox");
    var mount = document.getElementById("lb-mount");
    if (!box || !mount) return;
    box.classList.remove("is-open");
    box.setAttribute("aria-hidden", "true");
    mount.innerHTML = "";   // stop the video
  }

  // featured works — each card plays its own video in the same lightbox
  if (!app.__worksBound) {
    app.__worksBound = true;
    app.addEventListener("click", function (e) {
      var card = e.target.closest(".work-card");
      if (!card) return;
      var v = card.getAttribute("data-video");
      if (v) openLB(v);
    });
  }

  if (stage) {
    stage.addEventListener("click", function (e) {
      if (e.target.closest("a")) return;   // hero action buttons navigate normally, don't open the showreel
      openLB(hero.showreelUrl);
    });
    stage.addEventListener("keydown", function (e) {
      if (e.target !== stage) return;      // only the stage itself opens the showreel via keyboard
      if (e.key === "Enter" || e.key === " ") { e.preventDefault(); openLB(hero.showreelUrl); }
    });
  }
  document.getElementById("lb-close").addEventListener("click", closeLB);
  lb.addEventListener("click", function (e) { if (e.target === lb) closeLB(); });
  if (!window.__lbEscBound) {
    window.__lbEscBound = true;
    document.addEventListener("keydown", function (e) { if (e.key === "Escape") closeLB(); });
  }

  /* The background glow is shared by every page — see site.js. */
};
