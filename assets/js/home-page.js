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

  /* ---------- header ---------- */
  var nav = (H.nav || []).map(function (n) {
    return '<a href="' + esc(n.href) + '">' + esc(n.label) + '</a>';
  }).join("");
  var header =
    '<header class="hp-header"><div class="wrap hp-nav">' +
      '<div class="hp-logo">' + esc(S.profile.brand) + '</div>' +
      '<nav class="hp-menu">' + nav + '</nav>' +
      btn(H.ctaButton, "primary") +
    '</div></header>';

  /* ---------- hero ---------- */
  var hero = H.hero || {};
  var slides = (hero.teaser || []).map(function (src, i) {
    return '<img src="' + esc(src) + '" alt=""' + (i === 0 ? ' class="is-on"' : '') + '>';
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
      '<a class="service-card" href="' + esc(it.href || "#") + '">' +
        (it.image ? '<img class="service-card__img" src="' + esc(it.image) + '" alt="">' : '') +
        '<div class="service-card__body">' +
          '<div class="service-number">' + esc(it.number || "") + '</div>' +
          '<h3>' + esc(it.title || "") + '</h3>' +
          '<p>' + esc(it.body || "") + '</p>' +
          (it.extra ? '<div class="service-extra">' + esc(it.extra) + '</div>' : '') +
        '</div>' +
      '</a>';
  }).join("");
  var servicesHTML =
    '<section id="services"><div class="wrap">' +
      sectionHead(svc.title, svc.intro) +
      '<div class="services">' + svcCards + '</div>' +
    '</div></section>';

  /* ---------- works ---------- */
  var wk = H.works || {};
  var workCards = (wk.items || []).map(function (it) {
    var media = it.image
      ? '<img class="work-card__img" src="' + esc(it.image) + '" alt="">'
      : '<div class="work-card__ph">PROJECT IMAGE</div>';
    var go = (it.size === "large" || it.size === "medium")
      ? '<span class="wgo">לצפייה ←</span>' : '';
    return '' +
      '<a class="work-card ' + esc(it.size || "third") + '" href="' + esc(it.href || "#") + '">' +
        media +
        '<div class="work-meta">' +
          '<div><h4>' + esc(it.title || "") + '</h4><span class="wmeta">' + esc(it.meta || "") + '</span></div>' +
          go +
        '</div>' +
      '</a>';
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
      '<div class="about-img-wrap">' + (ab.image ? '<img src="' + esc(ab.image) + '" alt="">' : '') + '</div>' +
    '</div></section>';

  /* ---------- cta ---------- */
  var cta = H.cta || {};
  var ctaHTML =
    '<section class="cta" id="contact"><div class="wrap">' +
      '<h2>' + esc(cta.heading || "") + '</h2>' +
      '<p>' + esc(cta.copy || "") + '</p>' +
      btn(cta.button, "primary") +
    '</div></section>';

  /* ---------- footer ---------- */
  var socials = (S.socials || []).map(function (s) {
    return '<a href="' + esc(s.url) + '" target="_blank" rel="noopener">' + esc(s.label) + '</a>';
  }).join("");
  var footer =
    '<footer class="hp-footer"><div class="wrap footer-row">' +
      '<div class="footer-socials">' + socials + '</div>' +
      '<div class="footer-copy">' + esc(S.profile.copyright || "") + '</div>' +
    '</div></footer>';

  /* ---------- lightbox ---------- */
  var lightbox =
    '<div class="lightbox" id="lightbox" aria-hidden="true">' +
      '<button class="lightbox__close" id="lb-close" aria-label="סגירה">&times;</button>' +
      '<div class="lightbox__frame">' +
        '<div class="lightbox__mount" id="lb-mount"></div>' +
      '</div>' +
    '</div>';

  app.innerHTML = header + '<main>' + heroHTML + servicesHTML + worksHTML + processHTML + aboutHTML + ctaHTML + '</main>' + footer + lightbox;

  function sectionHead(title, intro) {
    return '<div class="section-head"><h2>' + esc(title || "") + '</h2>' +
      (intro ? '<p>' + esc(intro) + '</p>' : '') + '</div>';
  }

  /* ================= behaviours ================= */

  /* hero teaser rotation */
  var imgs = app.querySelectorAll(".hero-slides img");
  if (imgs.length > 1) {
    var idx = 0;
    setInterval(function () {
      imgs[idx].classList.remove("is-on");
      idx = (idx + 1) % imgs.length;
      imgs[idx].classList.add("is-on");
    }, 4200);
  }

  /* showreel lightbox */
  var stage = document.getElementById("hero-stage");
  var lb = document.getElementById("lightbox");
  var mount = document.getElementById("lb-mount");
  var embed = videoEmbed(hero.showreelUrl || "");

  function openLB() {
    if (embed) {
      var sep = embed.indexOf("?") >= 0 ? "&" : "?";
      mount.innerHTML = '<iframe src="' + esc(embed) + sep + 'autoplay=1&rel=0&modestbranding=1&playsinline=1" ' +
        'allow="autoplay; encrypted-media; fullscreen" allowfullscreen></iframe>';
    } else {
      mount.innerHTML = '<div class="lightbox__empty">כאן ייכנס השוריל שלך.<br>הדביקו קישור יוטיוב בשדה showreelUrl (בהמשך — דרך הסטודיו).</div>';
    }
    lb.classList.add("is-open");
    lb.setAttribute("aria-hidden", "false");
  }
  function closeLB() {
    lb.classList.remove("is-open");
    lb.setAttribute("aria-hidden", "true");
    mount.innerHTML = "";   // stop the video
  }

  if (stage) {
    stage.addEventListener("click", function (e) {
      if (e.target.closest("a")) return;   // hero action buttons navigate normally, don't open the showreel
      openLB();
    });
    stage.addEventListener("keydown", function (e) {
      if (e.target !== stage) return;      // only the stage itself opens the showreel via keyboard
      if (e.key === "Enter" || e.key === " ") { e.preventDefault(); openLB(); }
    });
  }
  document.getElementById("lb-close").addEventListener("click", closeLB);
  lb.addEventListener("click", function (e) { if (e.target === lb) closeLB(); });
  document.addEventListener("keydown", function (e) { if (e.key === "Escape") closeLB(); });
};
