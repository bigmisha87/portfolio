/* Service page — one template for every entry in SITE.services, chosen by
   ?s=<slug>. Section order follows the standard high-converting service page:
   hero → benefits → problem → what's included → process → proof → FAQ → CTA. */
window.PAGE_INIT = function () {
  var S = window.DC.data, esc = window.DC.esc;
  var app = document.getElementById("app");
  if (!app) return;

  var all = S.services || {};
  var slug = (new URLSearchParams(location.search).get("s") || "").trim();
  var V = all[slug] || all[Object.keys(all)[0]];
  if (!V) { app.innerHTML = '<main class="wrap svc-empty"><h1>השירות לא נמצא</h1></main>'; return; }

  document.title = (V.title || "שירותים") + " — " + (S.profile.brand || "");

  function btn(b, kind) {
    if (!b || !b.label) return "";
    return '<a class="btn btn--' + kind + '" href="' + esc(b.href || "#") + '">' + esc(b.label) + "</a>";
  }
  function nl2br(t) { return esc(t).replace(/\n/g, "<br>"); }
  function head(title, intro) {
    return '<div class="section-head"><h2>' + esc(title || "") + "</h2>" +
      (intro ? "<p>" + esc(intro) + "</p>" : "") + "</div>";
  }

  var out = "";

  /* ---------- hero ---------- */
  out += '<section class="svc-hero">' +
      (V.image ? '<img class="svc-hero__bg" src="' + esc(V.image) + '" alt="">' : "") +
      '<div class="wrap svc-hero__in">' +
        '<a class="svc-back" href="index.html#services">← כל השירותים</a>' +
        "<h1>" + esc(V.title || "") + "</h1>" +
        (V.lead ? '<p class="svc-lead">' + esc(V.lead) + "</p>" : "") +
        (V.intro ? '<p class="svc-intro">' + esc(V.intro) + "</p>" : "") +
        '<div class="svc-actions">' + btn(V.primary, "primary") + btn(V.secondary, "secondary") + "</div>" +
      "</div></section>";

  /* ---------- benefits ---------- */
  var bn = V.benefits;
  if (bn && (bn.items || []).length) {
    out += '<section class="svc-benefits"><div class="wrap">' + head(bn.title, bn.intro) +
      '<div class="svc-bgrid">' + bn.items.map(function (b) {
        var ico = b.iconImg
          ? '<img class="svc-bcard__img" src="' + esc(b.iconImg) + '" alt="">'
          : (b.icon ? '<span class="svc-bcard__ico">' + esc(b.icon) + "</span>" : "");
        return '<div class="svc-bcard">' + ico +
          "<h3>" + esc(b.title || "") + "</h3><p>" + esc(b.body || "") + "</p></div>";
      }).join("") + "</div></div></section>";
  }

  /* ---------- the problem this solves ---------- */
  var pb = V.problem;
  if (pb && (pb.items || []).length) {
    out += '<section class="svc-problem"><div class="wrap">' + head(pb.title, pb.intro) +
      '<ul class="svc-plist">' + pb.items.map(function (t) {
        return "<li>" + esc(t) + "</li>";
      }).join("") + "</ul></div></section>";
  }

  /* ---------- what's included ---------- */
  var inc = V.includes;
  if (inc && (inc.items || []).length) {
    out += '<section class="svc-includes"><div class="wrap">' + head(inc.title, inc.intro) +
      '<div class="svc-igrid">' + inc.items.map(function (it, i) {
        return '<div class="svc-icard"><span class="svc-icard__n">' + String(i + 1).padStart(2, "0") + "</span>" +
          "<h3>" + esc(it.title || "") + "</h3><p>" + esc(it.body || "") + "</p></div>";
      }).join("") + "</div></div></section>";
  }

  /* ---------- who it's for ---------- */
  var au = V.audience;
  if (au && (au.items || []).length) {
    out += '<section class="svc-audience"><div class="wrap">' + head(au.title, au.intro) +
      '<div class="svc-tags">' + au.items.map(function (t) {
        return '<span class="svc-tag">' + esc(t) + "</span>";
      }).join("") + "</div></div></section>";
  }

  /* ---------- process ---------- */
  var pr = V.process;
  if (pr && (pr.steps || []).length) {
    out += '<section class="svc-process"><div class="wrap">' + head(pr.title, pr.intro) +
      '<div class="process">' + pr.steps.map(function (s) {
        return '<div class="step"><span class="step__num">' + esc(s.num || "") + "</span>" +
          '<div><b class="step__title">' + esc(s.title || "") + "</b><p>" + esc(s.copy || "") + "</p></div>" +
          (s.icon ? '<img class="step__icon" src="' + esc(s.icon) + '" alt="">' : "") + "</div>";
      }).join("") + "</div></div></section>";
  }

  /* ---------- proof: real pieces pulled from the galleries ---------- */
  var wk = V.works;
  if (wk && (wk.items || []).length) {
    var cards = wk.items.map(function (ref) {
      var list = (S.works && S.works[ref.cat]) || [];
      var want = String(ref.title || "").trim().toLowerCase();
      var w = null;
      for (var i = 0; i < list.length; i++) {
        if (String(list[i].en || "").trim().toLowerCase() === want) { w = list[i]; break; }
      }
      var title = w ? (w.he || w.en) : (ref.title || "");
      var meta = w ? (w.client || w.sub || "") : "לא נמצא בגלריה";
      var video = w ? (w.video || "") : "";
      var poster = (w && w.poster) ? w.poster : window.DC.videoThumbHi(video);
      var fb = window.DC.videoThumb(video);
      var media = poster
        ? '<img class="work-card__img" src="' + esc(poster) + '" alt="' + esc(title) + '" loading="lazy"' +
          (fb ? ' onerror="this.onerror=null;this.src=\'' + esc(fb) + '\'"' : "") + ">"
        : '<div class="work-card__ph">PROJECT IMAGE</div>';
      return '<button type="button" class="work-card third" data-video="' + esc(video) + '">' + media +
        '<div class="work-meta"><div><h4>' + esc(title) + '</h4><span class="wmeta">' + esc(meta) + "</span></div>" +
        (video ? '<span class="wgo">לצפייה ←</span>' : "") + "</div></button>";
    }).join("");
    out += '<section class="svc-works"><div class="wrap">' + head(wk.title, wk.intro) +
      '<div class="works">' + cards + "</div>" +
      (wk.moreLabel ? '<div class="works-more">' + btn({ label: wk.moreLabel, href: wk.moreHref }, "secondary") + "</div>" : "") +
      "</div></section>";
  }

  /* ---------- FAQ ---------- */
  var fq = V.faq;
  if (fq && (fq.items || []).length) {
    out += '<section class="svc-faq"><div class="wrap">' + head(fq.title, fq.intro) +
      '<div class="svc-faqlist">' + fq.items.map(function (f, i) {
        return "<details class=\"svc-q\"" + (i === 0 ? " open" : "") + ">" +
          "<summary><span>" + esc(f.q || "") + '</span><span class="svc-q__i">+</span></summary>' +
          "<div class=\"svc-q__a\">" + nl2br(f.a || "") + "</div></details>";
      }).join("") + "</div></div></section>";
  }

  /* ---------- closing CTA ---------- */
  var cta = V.cta;
  if (cta) {
    out += '<section class="cta svc-cta"><div class="wrap">' +
      "<h2>" + esc(cta.heading || "") + "</h2>" +
      "<p>" + nl2br(cta.copy || "") + "</p>" + btn(cta.button, "primary") + "</div></section>";
  }

  /* ---------- video lightbox (same behaviour as the home page) ---------- */
  out += '<div class="lightbox" id="lightbox" aria-hidden="true">' +
      '<button class="lightbox__close" id="lb-close" aria-label="סגירה">&times;</button>' +
      '<div class="lightbox__frame"><div class="lightbox__mount" id="lb-mount"></div></div>' +
    "</div>";

  app.innerHTML = "<main>" + out + "</main>";

  /* ================= behaviour ================= */
  function openLB(url) {
    var box = document.getElementById("lightbox"), mount = document.getElementById("lb-mount");
    if (!box || !mount) return;
    var embed = window.DC.videoEmbed(url || "");
    if (!embed) return;
    var sep = embed.indexOf("?") >= 0 ? "&" : "?";
    mount.innerHTML = '<iframe src="' + esc(embed) + sep + 'autoplay=1&rel=0&modestbranding=1&playsinline=1" ' +
      'allow="autoplay; encrypted-media; fullscreen" allowfullscreen></iframe>';
    box.classList.add("is-open");
    box.setAttribute("aria-hidden", "false");
  }
  function closeLB() {
    var box = document.getElementById("lightbox"), mount = document.getElementById("lb-mount");
    if (!box || !mount) return;
    box.classList.remove("is-open");
    box.setAttribute("aria-hidden", "true");
    mount.innerHTML = "";
  }
  if (!app.__svcBound) {
    app.__svcBound = true;
    app.addEventListener("click", function (e) {
      var card = e.target.closest(".work-card");
      if (card && card.getAttribute("data-video")) { openLB(card.getAttribute("data-video")); return; }
      if (e.target.id === "lb-close" || e.target.id === "lightbox") closeLB();
    });
    document.addEventListener("keydown", function (e) { if (e.key === "Escape") closeLB(); });
  }
};
