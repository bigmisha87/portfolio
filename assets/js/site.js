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
  // Map to the local copy whether the original Wix URL was stored in .src OR
  // .url — some migrated blocks kept it in .src, which would otherwise load
  // remotely from Wix. localImg() passes through anything already local.
  function imgSrc(block) { return localImg(block.src || block.url); }
  function coverOf(post) {
    if (post.cover) return localImg(post.cover);
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
  window.DC = { esc: esc, accentize: accentize, el: el, data: S, localImg: localImg, imgSrc: imgSrc, coverOf: coverOf, videoEmbed: videoEmbed, videoThumb: videoThumb, videoThumbHi: videoThumbHi, rerenderChrome: rerenderChrome };

  /* --- shared chrome: header + footer -----------------------------------
     Defined ONCE here, so every page — existing or new — shows the same
     navigation and footer. A page only needs an empty <div id="site-header">
     and <div id="site-footer">, plus this script. The stylesheet and the
     Hebrew font are injected below, so no page ever needs editing for this. */

  function currentFile() { return location.pathname.split("/").pop() || "index.html"; }
  function isHome() { return currentFile() === "index.html"; }

  // "#services" only resolves on the home page, so elsewhere it has to
  // become "index.html#services".
  function navHref(href) {
    href = href || "#";
    return (href.charAt(0) === "#" && !isHome()) ? "index.html" + href : href;
  }

  function injectChromeAssets() {
    function link(id, href) {
      if (document.getElementById(id)) return;
      var l = document.createElement("link");
      l.id = id; l.rel = "stylesheet"; l.href = href;
      document.head.appendChild(l);
    }
    link("chrome-css", "assets/css/chrome.css");
    link("chrome-font", "https://fonts.googleapis.com/css2?family=Heebo:wght@400;500;700;800;900&display=swap");
  }
  injectChromeAssets();

  function renderHeader() {
    var H = S.home || {};
    var here = currentFile();
    var items = (H.nav || []).map(function (n) {
      var on = (n.href === here) ? ' class="is-active"' : "";
      return '<a href="' + esc(navHref(n.href)) + '"' + on + '>' + esc(n.label) + '</a>';
    }).join("");
    var cta = (H.ctaButton && H.ctaButton.label)
      ? '<a class="btn btn--primary" href="' + esc(navHref(H.ctaButton.href)) + '">' + esc(H.ctaButton.label) + '</a>'
      : "";
    return '' +
    '<header class="hp-header"><div class="hp-wrap hp-nav">' +
      '<div class="hp-logo"><a href="index.html">' + esc(S.profile.brand) + '</a></div>' +
      '<nav class="hp-menu" id="hp-menu">' + items + '</nav>' +
      '<div class="hp-actions">' + cta +
        '<button class="hp-burger" id="hp-burger" aria-label="תפריט" aria-expanded="false">' +
          '<span></span><span></span><span></span>' +
        '</button>' +
      '</div>' +
    '</div></header>';
  }

  function renderFooter() {
    var links = (S.socials || []).map(function (s) {
      return '<a href="' + esc(s.url) + '" target="_blank" rel="noopener">' + esc(s.label) + '</a>';
    }).join("");
    return '' +
    '<footer class="hp-footer"><div class="hp-wrap footer-row">' +
      '<div class="footer-socials">' + links + '</div>' +
      '<div class="footer-copy">' + esc(S.profile.copyright || "") + '</div>' +
    '</div></footer>';
  }

  /* --- background glow (every page) ------------------------------------
     One purple orb behind all content. It follows the cursor through TWO
     stages of easing: a lagging "goal" point chases the pointer, and the orb
     then eases toward that goal. Two soft stages read as a gentle delayed
     trail rather than something glued to the cursor. A slow wobble rides on
     top so it never sits perfectly still, and the easing is scaled by real
     frame time so it feels identical on 60Hz and 120Hz screens. */
  function startGlow() {
    var host = document.querySelector(".bg-glow");
    if (!host) {
      host = document.createElement("div");
      host.className = "bg-glow";
      host.setAttribute("aria-hidden", "true");
      document.body.insertBefore(host, document.body.firstChild);
    }
    if (host.querySelector(".bg-glow__orb")) return;   // already running
    if (window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    var orb = document.createElement("div");
    orb.className = "bg-glow__orb";
    host.appendChild(orb);

    var W = window.innerWidth, H = window.innerHeight;
    var x = W * 0.5, y = H * 0.42;            // the orb itself
    var gx = x, gy = y;                        // the lagging goal it trails
    var mx = x, my = y, hasPointer = false;    // the cursor
    var t0 = performance.now(), last = t0;

    // Position it immediately: a throttled tab can delay the first frame.
    orb.style.transform = "translate3d(" + x + "px," + y + "px,0)";

    window.addEventListener("resize", function () { W = window.innerWidth; H = window.innerHeight; });
    window.addEventListener("pointermove", function (e) {
      mx = e.clientX; my = e.clientY; hasPointer = true;
    }, { passive: true });

    // Turn a "per 60fps frame" easing factor into one for this frame's real
    // duration, so the feel doesn't change with refresh rate.
    function easeK(perFrame, dt) { return 1 - Math.pow(1 - perFrame, dt / 16.667); }

    function frame(now) {
      var dt = Math.min(now - last, 64) || 16.667;   // clamp after a tab switch
      last = now;
      var t = now - t0;

      // gentle wobble — layered frequencies so it never repeats obviously
      var wx = Math.sin(t * 0.00061) * 90 + Math.sin(t * 0.00033 + 2.1) * 55;
      var wy = Math.cos(t * 0.00047 + 1.1) * 80 + Math.sin(t * 0.00072) * 45;

      var tx, ty;
      if (hasPointer) { tx = mx; ty = my; }
      else {                                   // no cursor yet (or touch) — drift on its own
        tx = W * (0.5 + 0.34 * Math.sin(t * 0.000123));
        ty = H * (0.45 + 0.30 * Math.sin(t * 0.000167 + 1.3));
      }

      var k1 = easeK(0.018, dt);               // stage 1 — creates the delay
      gx += (tx - gx) * k1;
      gy += (ty - gy) * k1;

      var k2 = easeK(0.050, dt);               // stage 2 — smooths the trail
      x += ((gx + wx) - x) * k2;
      y += ((gy + wy) - y) * k2;

      var s = 1 + 0.13 * Math.sin(t * 0.000209);   // slow breathing
      orb.style.transform =
        "translate3d(" + x.toFixed(1) + "px," + y.toFixed(1) + "px,0) scale(" + s.toFixed(3) + ")";
      requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
  }

  // Re-render the header + footer from the CURRENT DC.data. Used by the
  // Studio's live preview so nav/footer edits show without a full reload.
  function rerenderChrome() {
    S = window.DC.data || S;
    var h = document.querySelector("header.hp-header");
    if (h) h.outerHTML = renderHeader();
    var f = document.querySelector("footer.hp-footer");
    if (f) f.outerHTML = renderFooter();
    wireBurger();
  }

  // Hamburger, wired once for whichever page rendered the header.
  function wireBurger() {
    var burger = el("hp-burger"), menu = el("hp-menu");
    if (!burger || !menu) return;
    burger.addEventListener("click", function () {
      var open = menu.classList.toggle("is-open");
      burger.setAttribute("aria-expanded", open ? "true" : "false");
    });
    menu.addEventListener("click", function (e) {
      if (e.target.closest("a")) {
        menu.classList.remove("is-open");
        burger.setAttribute("aria-expanded", "false");
      }
    });
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
    startGlow();
    var head = el("site-header");
    var foot = el("site-footer");
    if (head) head.outerHTML = renderHeader();
    if (foot) foot.outerHTML = renderFooter();
    wireBurger();

    // Set the document title from the brand if not already specific.
    if (!document.title) document.title = S.profile.brand;

    // Let each page run after chrome is in place.
    if (typeof window.PAGE_INIT === "function") window.PAGE_INIT();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", mount);
  } else {
    mount();
  }
})();
