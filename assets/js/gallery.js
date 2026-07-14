/* ==========================================================================
   Shared gallery + lightbox — used by the Category pages and the Brand
   case-study pages. Renders work tiles and the height-capped video/image
   lightbox. A piece can be an image, a video, or both.
   ========================================================================== */
window.Gallery = (function () {
  "use strict";
  var esc = window.DC.esc;
  var RATIO_LABEL = { "9 / 16": "9:16", "16 / 9": "16:9", "1 / 1": "1:1", "4 / 5": "4:5" };

  function ratioOf(w) { return w.ratio || "4 / 5"; }
  // Poster: an uploaded image if there is one, otherwise the YouTube thumbnail of the video link.
  function imageOf(w) { return w.poster || w.image || window.DC.videoThumb(w.video || "") || ""; }

  // Turn a YouTube/Vimeo link into an embeddable URL (else null = local file).
  function embedUrl(v) { return window.DC.videoEmbed(v || ""); }

  // The media inside a grid tile. For a YouTube video with no custom cover we
  // load the hi-res thumbnail and fall back to the standard one if it 404s.
  function tileMedia(w) {
    var hasVideo = !!w.video, alt = esc(w.en || "");
    var over = hasVideo ? '<span class="play play--over" aria-hidden="true"></span>' : '';
    // Tile uses the lightweight thumbnail when one exists; the lightbox still
    // loads the full-res poster. Keeps scrolling fast on big image galleries.
    var poster = w.thumb || w.poster || w.image;
    if (poster) return '<img src="' + esc(poster) + '" alt="' + alt + '" loading="lazy" decoding="async">' + over;
    if (hasVideo) {
      var hi = window.DC.videoThumbHi(w.video), lo = window.DC.videoThumb(w.video);
      // maxres: fall back to hqdefault on 404 (onerror) AND on YouTube's grey
      // "no maxres" placeholder, which loads OK but is tiny (onload size check).
      if (hi) return '<img src="' + esc(hi) + '" alt="' + alt + '" loading="lazy"' +
                     ' onload="if(this.dataset.fb)return;if(this.naturalWidth<600){this.dataset.fb=1;this.src=\'' + esc(lo) + '\'}"' +
                     ' onerror="this.onerror=null;this.src=\'' + esc(lo) + '\'">' + over;
      return '<span class="play" aria-hidden="true"></span>';
    }
    return '<span class="ph">[ image ]</span>';
  }

  // The full media inside the lightbox.
  function playerMedia(w) {
    if (w.video) {
      var emb = embedUrl(w.video);
      // YouTube/Vimeo players need a real web origin. Opened straight from disk
      // (file://) they fail with a config error (e.g. "Error 153"), so link out
      // to the video instead of showing a broken player.
      if (emb && location.protocol === "file:") {
        return '<a class="lb-watch" href="' + esc(w.video) + '" target="_blank" rel="noopener">' +
                 '<span class="lb-player__play" aria-hidden="true"></span>' +
                 '<span class="lb-watch__txt">Watch on YouTube ↗</span>' +
                 '<span class="lb-watch__note">Videos play right here once the site is online (or opened through a local server).</span>' +
               '</a>';
      }
      if (emb) return '<iframe src="' + esc(emb) + '" title="' + esc(w.en || "") +
                      '" allow="autoplay; fullscreen; picture-in-picture" allowfullscreen></iframe>';
      return '<video src="' + esc(w.video) + '" controls autoplay playsinline' +
             (imageOf(w) ? ' poster="' + esc(imageOf(w)) + '"' : '') + '></video>';
    }
    if (imageOf(w)) return '<img src="' + esc(imageOf(w)) + '" alt="' + esc(w.en || "") + '">';
    return '<span class="lb-player__play" aria-hidden="true"></span>' +
           '<span class="lb-player__note">' + (RATIO_LABEL[ratioOf(w)] || ratioOf(w)) + ' · add media in the Studio</span>';
  }

  // One grid tile. `i` is the index into the works array passed to bindGrid.
  function tileHTML(w, i, showClient) {
    return '' +
      '<button class="work" data-i="' + i + '">' +
        '<div class="work__frame" style="aspect-ratio:' + esc(ratioOf(w)) + '">' +
          '<div class="work__media">' + tileMedia(w) + '</div>' +
        '</div>' +
        '<div class="work__row"><span class="work__title" dir="auto">' + esc(w.en || "") + '</span></div>' +
        (showClient && w.client ? '<div class="work__client" dir="auto">' + esc(w.client) + '</div>' : '') +
      '</button>';
  }

  /* ---- lightbox (injected once) -------------------------------------- */
  var lb = null, works = [], idx = null;

  function injectLightbox() {
    if (document.getElementById("lightbox")) { lb = document.getElementById("lightbox"); return; }
    var div = document.createElement("div");
    div.innerHTML =
      '<div class="lightbox" id="lightbox" hidden>' +
        '<div class="lb-top"><span class="lb-counter" id="lb-counter"></span>' +
          '<button class="lb-close" id="lb-close" aria-label="Close">✕</button></div>' +
        '<div class="lb-stage">' +
          '<button class="lb-nav" id="lb-prev" aria-label="Previous">‹</button>' +
          '<div class="lb-player" id="lb-player"></div>' +
          '<div class="lb-info">' +
            '<div><div class="lb-info__title" id="lb-title" dir="auto"></div>' +
              '<div class="lb-info__title-he" id="lb-title-he" dir="rtl"></div></div>' +
            '<div class="lb-info__client" id="lb-client"></div>' +
            '<p class="lb-info__body" id="lb-body"></p>' +
            '<div class="lb-tags" id="lb-tags"></div>' +
          '</div>' +
          '<button class="lb-nav" id="lb-next" aria-label="Next">›</button>' +
        '</div>' +
        '<div class="lb-strip" id="lb-strip"></div>' +
      '</div>';
    lb = div.firstChild;
    document.body.appendChild(lb);

    document.getElementById("lb-close").addEventListener("click", close);
    document.getElementById("lb-prev").addEventListener("click", function () { move(-1); });
    document.getElementById("lb-next").addEventListener("click", function () { move(1); });
    document.getElementById("lb-strip").addEventListener("click", function (e) {
      var b = e.target.closest(".lb-thumb"); if (!b) return;
      idx = parseInt(b.getAttribute("data-i"), 10); paint();
    });
    lb.addEventListener("click", function (e) {
      if (e.target === lb || e.target.classList.contains("lb-stage")) close();
    });
    // Behance-style zoom: click a still image to open it full-screen at full
    // resolution; pan by dragging or with the mouse wheel; a single click exits.
    document.getElementById("lb-player").addEventListener("click", function (e) {
      if (!this.classList.contains("lb-player--img") || !e.target.closest("img")) return;
      e.stopPropagation();
      openZoom(imageOf(works[idx]));
    });
    window.addEventListener("keydown", function (e) {
      if (idx == null) return;
      if (e.key === "Escape") close();
      else if (e.key === "ArrowRight") move(1);
      else if (e.key === "ArrowLeft") move(-1);
    });
  }

  // Full-screen image viewer: shows the image at full resolution, pannable by
  // drag or mouse wheel; a single click (no drag) closes it. Esc also closes.
  function openZoom(src) {
    if (!src) return;
    var z = document.createElement("div");
    z.className = "lb-zoom";
    z.innerHTML = '<img src="' + esc(src) + '" alt="" draggable="false">';
    document.body.appendChild(z);
    var img = z.firstChild;
    img.style.transformOrigin = "0 0";
    var scale = 1, tx = 0, ty = 0, dragging = false, lastX = 0, lastY = 0, moved = 0;
    function apply() { img.style.transform = "translate(" + tx + "px," + ty + "px) scale(" + scale + ")"; }
    function center() {
      scale = 1;
      tx = (window.innerWidth - img.naturalWidth) / 2;
      ty = (window.innerHeight - img.naturalHeight) / 2;
      apply();
    }
    // Wheel zooms in/out, anchored to the cursor.
    function zoomAt(cx, cy, factor) {
      var ns = Math.min(8, Math.max(0.1, scale * factor));
      var ix = (cx - tx) / scale, iy = (cy - ty) / scale;
      scale = ns; tx = cx - ix * scale; ty = cy - iy * scale; apply();
    }
    function destroy() { z.remove(); window.removeEventListener("keydown", onKey); }
    function onKey(e) { if (e.key === "Escape") destroy(); }
    if (img.complete) center(); else img.addEventListener("load", center);
    z.addEventListener("pointerdown", function (e) {
      dragging = true; moved = 0; lastX = e.clientX; lastY = e.clientY;
      z.setPointerCapture(e.pointerId);
    });
    z.addEventListener("pointermove", function (e) {
      if (!dragging) return;
      var dx = e.clientX - lastX, dy = e.clientY - lastY;
      lastX = e.clientX; lastY = e.clientY;
      tx += dx; ty += dy; moved += Math.abs(dx) + Math.abs(dy); apply();
    });
    z.addEventListener("pointerup", function () { dragging = false; if (moved < 6) destroy(); });
    z.addEventListener("wheel", function (e) { e.preventDefault(); zoomAt(e.clientX, e.clientY, e.deltaY < 0 ? 1.12 : 1 / 1.12); }, { passive: false });
    window.addEventListener("keydown", onKey);
  }

  function open(list, i) { works = list; idx = i; injectLightbox(); paint(); lb.hidden = false; document.body.style.overflow = "hidden"; }
  function close() { idx = null; if (lb) { lb.hidden = true; document.getElementById("lb-player").innerHTML = ""; } document.body.style.overflow = ""; }
  function move(d) { if (idx == null || !works.length) return; idx = (idx + d + works.length) % works.length; paint(); }

  function paint() {
    var w = works[idx]; if (!w) return;
    var g = function (id) { return document.getElementById(id); };
    g("lb-counter").textContent = (idx + 1) + " / " + works.length;
    var player = g("lb-player");
    player.style.aspectRatio = ratioOf(w);
    player.innerHTML = playerMedia(w);
    // Still images are click-to-zoom (full resolution); reset zoom on each paint.
    var zoomable = !w.video && !!imageOf(w);
    player.classList.toggle("lb-player--img", zoomable);
    player.classList.remove("is-zoom");
    g("lb-title").textContent = w.en || "";
    g("lb-title-he").textContent = w.he || "";
    g("lb-client").textContent = w.client ? "CLIENT · " + w.client : "";
    // Only show a description if the piece actually has one — no auto-filler.
    var bodyEl = g("lb-body");
    bodyEl.textContent = w.body || "";
    bodyEl.hidden = !(w.body && String(w.body).trim());
    g("lb-tags").innerHTML = (w.tags || []).map(function (t) { return '<span class="lb-tag">' + esc(t) + '</span>'; }).join("");
    // Hide the whole info column when the piece carries no text (image-only pages).
    var info = lb.querySelector(".lb-info");
    if (info) info.hidden = !(w.en || w.he || w.client || w.body || (w.tags && w.tags.length));
    g("lb-strip").innerHTML = works.map(function (ww, i) {
      var on = i === idx ? " is-on" : "";
      var inner = imageOf(ww) ? '<img src="' + esc(imageOf(ww)) + '" alt="">' : '';
      return '<button class="lb-thumb' + on + '" data-i="' + i + '" style="aspect-ratio:' + esc(ratioOf(ww)) + '">' + inner + '</button>';
    }).join("");
  }

  // Render `works` into a container and wire clicks to open the lightbox.
  // Re-call to re-render; the click handler is bound once per container.
  function bindGrid(containerEl, list) {
    if (!containerEl.__galleryBound) {
      containerEl.addEventListener("click", function (e) {
        var b = e.target.closest(".work"); if (!b) return;
        // Use the container's current list, not the one captured when the
        // handler was first bound — otherwise clicks after a filter change
        // open the wrong piece (the item at that index in the unfiltered list).
        open(containerEl.__list || list, parseInt(b.getAttribute("data-i"), 10));
      });
      containerEl.__galleryBound = true;
    }
    containerEl.__list = list;
  }

  /* ---- masonry (Pinterest/Wix-style) --------------------------------
     Cards keep their real aspect ratio (varying heights), so a plain grid
     leaves gaps. This packs each card into the currently-shortest column
     (row-major, like Pinterest): absolute-positioned, container height set
     to the tallest column. Re-run on render, resize and font load. */
  function masonryGrid(grid) {
    if (!grid) return;
    var items = [].filter.call(grid.children, function (c) { return c.matches && c.matches(".work, .cv-add"); });
    if (!items.length) { grid.style.height = ""; return; }
    // Phones use a CSS-driven Instagram grid / single-column switch. Clear the
    // desktop masonry's inline coordinates so both mobile modes stay fluid.
    var mobileScope = grid.closest(".mobile-gallery-grid, .mobile-gallery-single");
    if (matchMedia("(max-width: 640px)").matches && mobileScope) {
      grid.style.height = "";
      items.forEach(function (c) { c.style.position = ""; c.style.width = ""; c.style.left = ""; c.style.top = ""; });
      return;
    }
    var rs = getComputedStyle(document.documentElement);
    var gapX = parseFloat(rs.getPropertyValue("--card-gap")) || 22;
    var gapY = parseFloat(rs.getPropertyValue("--card-row-gap")) || 22;
    var colW = parseFloat(rs.getPropertyValue("--card-size")) || 260;
    var W = grid.clientWidth;
    if (!W) return;
    var cols = Math.max(1, Math.floor((W + gapX) / (colW + gapX)));
    var aw = (W - (cols - 1) * gapX) / cols;
    grid.style.position = "relative";
    items.forEach(function (c) { c.style.position = "absolute"; c.style.width = aw + "px"; });
    var heights = []; for (var i = 0; i < cols; i++) heights.push(0);
    items.forEach(function (c) {
      var h = c.offsetHeight, m = 0;
      for (var j = 1; j < cols; j++) if (heights[j] < heights[m]) m = j;
      c.style.left = (m * (aw + gapX)) + "px";
      c.style.top = heights[m] + "px";
      heights[m] += h + gapY;
    });
    var max = 0; heights.forEach(function (h) { if (h > max) max = h; });
    grid.style.height = (max > 0 ? max - gapY : 0) + "px";
  }
  function masonryAll(root) {
    [].forEach.call((root || document).querySelectorAll(".cat-grid"), function (g) { masonryGrid(g); });
  }
  function bindMobileView(scope, onChange) {
    if (!scope || scope.__mobileViewBound) return;
    scope.__mobileViewBound = true;
    scope.classList.add("mobile-gallery-grid");
    scope.addEventListener("click", function (e) {
      var b = e.target.closest("[data-mobile-view]");
      if (!b || !scope.contains(b)) return;
      var view = b.getAttribute("data-mobile-view") === "single" ? "single" : "grid";
      scope.classList.toggle("mobile-gallery-grid", view === "grid");
      scope.classList.toggle("mobile-gallery-single", view === "single");
      [].forEach.call(scope.querySelectorAll("[data-mobile-view]"), function (x) {
        x.classList.toggle("is-on", x.getAttribute("data-mobile-view") === view);
      });
      if (onChange) onChange(view);
      masonryAll(scope);
    });
  }
  var _mzTimer;
  window.addEventListener("resize", function () { clearTimeout(_mzTimer); _mzTimer = setTimeout(function () { masonryAll(); }, 120); });

  return { tileHTML: tileHTML, open: open, openZoom: openZoom, bindGrid: bindGrid, bindMobileView: bindMobileView, RATIO_LABEL: RATIO_LABEL, masonryGrid: masonryGrid, masonryAll: masonryAll };
})();
