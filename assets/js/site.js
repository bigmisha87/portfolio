/* ==========================================================================
   Shared site engine — builds the header & footer on every page and
   provides small helpers. You shouldn't need to edit this file.
   ========================================================================== */
(function () {
  "use strict";

  var S = window.SITE;
  if (!S) { console.error("data.js did not load — check the <script> order."); return; }

  /* --- tiny helpers ---------------------------------------------------- */
  // Escape text so titles with < > & can't break the layout.
  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }
  // Turn {{ phrase }} into a purple <span>. Used in bio text.
  function accentize(s) {
    return esc(s).replace(/\{\{\s*([^}]+?)\s*\}\}/g, '<span class="accent">$1</span>');
  }
  function el(id) { return document.getElementById(id); }

  // Map an original Wix image URL to its downloaded local copy in assets/img/blog.
  // (Migrated posts store the original URL; the file is saved as <mediaId>.<ext>.)
  function localImg(url) {
    if (!url) return "";
    if (url.indexOf("assets/") === 0) return url;           // already local
    var m = url.match(/\/media\/([^~\/?]+)~mv2[^.?\/]*\.(\w+)/i);
    return m ? "assets/img/blog/" + m[1] + "." + m[2].toLowerCase() : url;
  }
  function imgSrc(block) { return block.src || localImg(block.url); }
  function coverOf(post) {
    if (post.cover) return post.cover;
    var f = (post.body || []).filter(function (b) { return b.type === "img"; })[0];
    return f ? imgSrc(f) : "";
  }

  // Pull the YouTube id out of any common YouTube link form (watch, youtu.be, embed, shorts).
  function youtubeId(v) {
    var m = (v || "").match(/(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([\w-]{6,})/);
    return m ? m[1] : "";
  }
  // Turn a YouTube/Vimeo link into an embeddable URL (else null = local file).
  function videoEmbed(v) {
    v = v || "";
    var yt = youtubeId(v);
    if (yt) return "https://www.youtube.com/embed/" + yt;
    var m = v.match(/vimeo\.com\/(?:video\/)?(\d+)/);
    if (m) return "https://player.vimeo.com/video/" + m[1];
    // Behance / Adobe CCV native player, or any ready-made iframe embed URL.
    if (v.indexOf("adobe.io") >= 0 || v.indexOf("/embed") >= 0) return v;
    return null;
  }
  // A still thumbnail for a video link (YouTube only; "" otherwise).
  function videoThumb(v) {
    var yt = youtubeId(v);
    return yt ? "https://img.youtube.com/vi/" + yt + "/hqdefault.jpg" : "";
  }
  // Hi-res thumbnail (maxresdefault) — much sharper, especially for Shorts on
  // big cards. Not every video has one, so callers fall back to videoThumb.
  function videoThumbHi(v) {
    var yt = youtubeId(v);
    return yt ? "https://img.youtube.com/vi/" + yt + "/maxresdefault.jpg" : "";
  }

  // Expose helpers for the page scripts.
  window.DC = { esc: esc, accentize: accentize, el: el, data: S, localImg: localImg, imgSrc: imgSrc, coverOf: coverOf, videoEmbed: videoEmbed, videoThumb: videoThumb, videoThumbHi: videoThumbHi };

  /* --- header ---------------------------------------------------------- */
  function renderHeader(active) {
    var cats = S.categories.map(function (c) {
      return '<a class="work-drop__item" href="category.html?cat=' + esc(c.slug) + '">' +
               '<span class="t">' + esc(c.name) + '</span>' +
               '<span class="k">' + esc(c.kind) + '</span>' +
             '</a>';
    }).join("");

    var isWork = active === "work";
    return '' +
    '<header class="site-header">' +
      '<div class="site-header__inner">' +
        '<a class="brand" href="index.html">' +
          '<span class="brand__name">' + esc(S.profile.brand) + '</span>' +
        '</a>' +
        '<button class="nav-toggle" aria-label="Menu" aria-expanded="false">☰</button>' +
        '<nav class="nav">' +
          '<div class="work-menu">' +
            '<a class="nav__link work-menu__toggle' + (isWork ? ' is-active' : '') + '" href="index.html">' +
              'Work <span class="work-menu__caret">▾</span>' +
            '</a>' +
            '<div class="work-drop"><div class="work-drop__panel">' + cats + '</div></div>' +
          '</div>' +
          '<a class="nav__link' + (active === "about" ? ' is-active' : '') + '" href="about.html">About</a>' +
          '<a class="nav__link' + (active === "blog" ? ' is-active' : '') + '" href="blog.html">Blog</a>' +
        '</nav>' +
      '</div>' +
    '</header>';
  }

  /* --- footer ---------------------------------------------------------- */
  function renderFooter() {
    var links = S.socials.map(function (s) {
      return '<a href="' + esc(s.url) + '" target="_blank" rel="noopener">' + esc(s.label) + '</a>';
    }).join("");
    return '' +
    '<footer class="site-footer">' +
      '<div class="site-footer__inner">' +
        '<div class="socials">' + links + '</div>' +
        '<div class="copyright">' + esc(S.profile.copyright) + '</div>' +
      '</div>' +
    '</footer>';
  }

  /* --- gallery layout (Studio "Design" tab) ---------------------------- */
  // Apply SITE.layout sizes as CSS variables on :root. Missing values fall
  // back to the defaults declared in styles.css, so this is fully optional.
  function applyLayout() {
    var L = S.layout || {};
    var r = document.documentElement.style;
    if (L.cardSize != null)       r.setProperty("--card-size", L.cardSize + "px");
    if (L.cardGap != null)        r.setProperty("--card-gap", L.cardGap + "px");
    if (L.cardRowGap != null)     r.setProperty("--card-row-gap", L.cardRowGap + "px");
    if (L.cardTitleSize != null)  r.setProperty("--card-title-size", L.cardTitleSize + "px");
    if (L.clientHeadSize != null) r.setProperty("--client-head-size", L.clientHeadSize + "px");
    if (L.pageMargin != null)     r.setProperty("--gallery-pad-x", L.pageMargin + "px");
  }

  /* --- mount on load --------------------------------------------------- */
  function mount() {
    applyLayout();
    // animated purple glow behind everything
    if (!document.querySelector(".bg-glow")) {
      document.body.insertAdjacentHTML("afterbegin", '<div class="bg-glow" aria-hidden="true"></div>');
    }
    var active = document.body.getAttribute("data-active") || "";
    var head = el("site-header");
    var foot = el("site-footer");
    if (head) head.outerHTML = renderHeader(active);
    if (foot) foot.outerHTML = renderFooter();

    // Set the document title from the brand if not already specific.
    if (!document.title) document.title = S.profile.brand;

    // Mobile nav toggle (delegated, since header was just injected).
    document.addEventListener("click", function (e) {
      var btn = e.target.closest && e.target.closest(".nav-toggle");
      if (!btn) return;
      var nav = document.querySelector(".nav");
      if (!nav) return;
      var open = nav.classList.toggle("is-open");
      btn.setAttribute("aria-expanded", open ? "true" : "false");
    });

    // Let each page run after chrome is in place.
    if (typeof window.PAGE_INIT === "function") window.PAGE_INIT();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", mount);
  } else {
    mount();
  }
})();
