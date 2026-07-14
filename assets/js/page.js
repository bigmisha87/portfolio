/* Generic project page — renders a "page" project as a vertical STACK of
   elements: heading / text / image / video / gallery.
   • A gallery is a mixed-media cluster (images AND videos) shown either at
     Native proportions (masonry) or cropped to a Uniform ratio.
   • Videos inside a gallery autoplay muted on hover (Behance-style).
   • Clicking any media opens the shared full-screen lightbox / zoom viewer. */
window.PAGE_INIT = function () {
  var DC = window.DC, S = DC.data, esc = DC.esc, el = DC.el, G = window.Gallery;
  var q = new URLSearchParams(location.search);
  var cat = q.get("cat") || "", slug = q.get("page") || q.get("brand") || "";

  var list = (S.works && S.works[cat]) || [];
  var page = list.filter(function (w) { return w.type === "page" && w.slug === slug; })[0];

  var back = el("page-back");
  if (back && cat) back.href = "category.html?cat=" + esc(cat);

  if (!page) {
    el("page-title").textContent = "Project";
    el("page-content").innerHTML = '<div class="blog-empty">This project wasn\'t found.</div>';
    return;
  }

  document.title = (page.title || "Project") + " — " + S.profile.brand;
  el("page-title").textContent = page.title || "";
  el("page-kind").textContent = page.kind || "";

  var body = page.body || [];
  var c = el("page-content");
  var sw = page.stackWidth || 1100;
  var galleryLists = [];               // media lists per gallery, for the lightbox
  var mobileView = "grid";
  function textAttrs(b) {
    var dir = (b.dir && b.dir !== "auto") ? b.dir : "auto";
    var st = (b.align ? "text-align:" + b.align + ";" : "") + (b.size ? "font-size:" + b.size + "px;" : "") + (b.bold ? "font-weight:700;" : "") + (b.italic ? "font-style:italic;" : "") + (b.underline ? "text-decoration:underline;" : "") + (b.color ? "color:" + b.color + ";" : "");
    return ' dir="' + dir + '"' + (st ? ' style="' + st + '"' : '');
  }

  /* ---- gallery helpers ---------------------------------------------- */
  function isVideoItem(it) { return !!(it && (it.type === "video" || it.video)); }
  function itemPoster(it) { return it.poster || it.thumb || DC.videoThumb(it.video || "") || ""; }
  function itemRatio(it) { return it.ratio || "4 / 5"; }

  // Map a gallery's items to lightbox "work" objects (image or video).
  function galleryMediaList(items) {
    return (items || []).map(function (it) {
      return isVideoItem(it)
        ? { video: it.video, poster: itemPoster(it), ratio: itemRatio(it) }
        : { image: it.src || it.poster || "", ratio: itemRatio(it) };
    });
  }

  function galleryCell(it, i) {
    if (isVideoItem(it)) {
      var emb = DC.videoEmbed(it.video), poster = itemPoster(it);
      var hov = emb ? ' data-embed="' + esc(emb) + '"' : ' data-file="' + esc(it.video) + '"';
      var pic = poster ? '<img src="' + esc(poster) + '" alt="" loading="lazy" decoding="async">' : '';
      return '<button class="pg-gmedia pg-gmedia--vid" data-i="' + i + '" data-ar="' + esc(itemRatio(it)) + '"' + hov + '>' +
               '<span class="pg-gmedia__poster">' + pic + '</span>' +
               '<span class="pg-play" aria-hidden="true"></span>' +
             '</button>';
    }
    var src = it.src || it.poster || "";
    return '<button class="pg-gmedia pg-gmedia--img" data-i="' + i + '" data-ar="' + esc(itemRatio(it)) + '">' +
             '<img src="' + esc(src) + '" alt="' + esc(it.alt || "") + '" loading="lazy" decoding="async">' +
           '</button>';
  }

  function galleryHTML(b) {
    var items = b.items || [];
    var gi = galleryLists.length; galleryLists.push(galleryMediaList(items));
    var mode = b.mode === "uniform" ? "uniform" : "native";
    var cols = Math.max(1, parseInt(b.cols, 10) || 3);
    var gap = (b.gap != null ? b.gap : 8);
    var vars = '--cols:' + cols + ';--gap:' + gap + 'px;' + (mode === "uniform" ? '--ar:' + (b.ratio || "1 / 1") + ';' : '');
    var cls = mode === "uniform" ? "pg-gallery--uniform" : "pg-gallery--masonry";
    return '<div class="pg-gallery ' + cls + '" data-gal="' + gi + '" style="' + vars + '">' +
             items.map(galleryCell).join("") +
           '</div>';
  }
  // Pinterest-style masonry for native galleries: respects the chosen column
  // count AND the item order (row-major, shortest-column packing). Uses each
  // item's known aspect ratio (data-ar) so it lays out before images load.
  function layoutGalleries() {
    [].forEach.call(c.querySelectorAll('.pg-gallery--masonry'), function (gal) {
      var isPhone = matchMedia('(max-width: 640px)').matches;
      var cols = isPhone ? (mobileView === 'single' ? 1 : 3) : Math.max(1, parseInt(gal.style.getPropertyValue('--cols'), 10) || 3);
      var gap = parseInt(gal.style.getPropertyValue('--gap'), 10) || 8;
      var items = [].slice.call(gal.children);
      if (!items.length) { gal.style.height = ''; return; }
      var W = gal.clientWidth; if (!W) return;
      var colW = (W - (cols - 1) * gap) / cols, i, j;
      var heights = []; for (i = 0; i < cols; i++) heights.push(0);
      items.forEach(function (it) {
        var ratio, img = it.querySelector('img');
        if (img && img.naturalWidth > 0) ratio = img.naturalWidth / img.naturalHeight;
        else { var a = (it.getAttribute('data-ar') || '1 / 1').split('/'); ratio = (parseFloat(a[0]) || 1) / (parseFloat(a[1]) || 1); }
        var ih = colW / (ratio || 1), m = 0;
        for (j = 1; j < cols; j++) if (heights[j] < heights[m]) m = j;
        it.style.position = 'absolute'; it.style.width = colW + 'px'; it.style.height = ih + 'px';
        it.style.left = (m * (colW + gap)) + 'px'; it.style.top = heights[m] + 'px';
        heights[m] += ih + gap;
      });
      var mx = 0; heights.forEach(function (x) { if (x > mx) mx = x; });
      gal.style.height = (mx > 0 ? mx - gap : 0) + 'px';
    });
  }
  var galTimer;
  function relayoutSoon() { clearTimeout(galTimer); galTimer = setTimeout(layoutGalleries, 60); }
  window.addEventListener('resize', relayoutSoon);

  /* ---- blocks -------------------------------------------------------- */
  function blockHTML(b) {
    if (b.type === "heading") {
      return '<div class="pg-text"><h3 class="pg-text__h"' + textAttrs(b) + '>' + (b.text || b.heading || "") + '</h3></div>';
    }
    if (b.type === "text") {
      return '<div class="pg-text">' +
        (b.heading ? '<h3 class="pg-text__h">' + esc(b.heading) + '</h3>' : '') +
        (b.text ? '<p class="pg-text__p"' + textAttrs(b) + '>' + b.text + '</p>' : '') + '</div>';
    }
    if (b.type === "video") {
      var emb = DC.videoEmbed(b.url || "");
      return '<div class="pg-video">' + (emb
        ? '<iframe src="' + esc(emb) + '" title="' + esc(page.title || "") + '" allow="autoplay; fullscreen; picture-in-picture" allowfullscreen></iframe>'
        : '<video src="' + esc(b.url || "") + '" controls playsinline></video>') + '</div>';
    }
    if (b.type === "gallery") return galleryHTML(b);
    // single image
    var full = b.src || b.poster || "";
    var widthCls = b.width === "full" ? " pg-figure--full" : (b.width === "wide" ? " pg-figure--wide" : "");
    var inner = '<button class="pg-img" data-src="' + esc(full) + '" style="aspect-ratio:' + esc(b.ratio || "4 / 3") + '">' +
        '<img src="' + esc(full) + '" alt="' + esc(b.alt || "") + '" loading="lazy" decoding="async"></button>';
    if (b.link) inner = '<a class="pg-imglink" href="' + esc(b.link) + '" target="_blank" rel="noopener">' + inner + '</a>';
    return '<figure class="pg-figure' + widthCls + '">' + inner +
      (b.caption ? '<figcaption class="pg-cap" dir="auto">' + esc(b.caption) + '</figcaption>' : '') + '</figure>';
  }

  // Page-level Grid view: the whole page as one media grid. Titles & text
  // span the full width (so nothing disappears); all media flattens into cells.
  function pageGridHTML() {
    var mode = page.gridMode === "uniform" ? "uniform" : "native";
    var cols = Math.max(1, parseInt(page.gridCols, 10) || 3);
    var gap = (page.gridGap != null ? page.gridGap : 8);
    var vars = '--cols:' + cols + ';--gap:' + gap + 'px;' + (mode === "uniform" ? '--ar:' + (page.gridRatio || "1 / 1") + ';' : '');
    var media = [], parts = [];
    body.forEach(function (b) {
      if (b.type === "heading" || b.type === "text") parts.push('<div class="pg-gspan">' + blockHTML(b) + '</div>');
      else if (b.type === "gallery") (b.items || []).forEach(function (it) { parts.push(galleryCell(it, media.length)); media.push(it); });
      else if (b.type === "video") { var v = { type: "video", video: b.url, ratio: b.ratio }; parts.push(galleryCell(v, media.length)); media.push(v); }
      else { var im = { src: b.src, ratio: b.ratio, alt: b.alt }; parts.push(galleryCell(im, media.length)); media.push(im); }
    });
    galleryLists = [galleryMediaList(media)];
    return '<div class="pg-gallery pg-gallery--' + mode + '" data-gal="0" style="' + vars + '">' + parts.join("") + '</div>';
  }
  function render() {
    galleryLists = [];
    // On phones the visitor's switch takes precedence over the editor's
    // desktop page layout: Grid flattens all media, Single restores the stack.
    var phoneGrid = matchMedia('(max-width: 640px)').matches && mobileView === 'grid';
    c.innerHTML = (page.view === "grid" || phoneGrid)
      ? pageGridHTML()
      : '<div class="pg-stack" style="max-width:' + sw + 'px">' + body.map(blockHTML).join("") + '</div>';
    layoutGalleries();
    [].forEach.call(c.querySelectorAll('.pg-gallery--masonry img'), function (img) { if (!img.complete) img.addEventListener('load', relayoutSoon, { once: true }); });
  }

  G.bindMobileView(document.body, function (view) {
    mobileView = view;
    render();
  });

  /* ---- hover-autoplay for gallery videos ----------------------------- */
  function hoverIn(btn) {
    if (btn.__on) return; btn.__on = true;
    var emb = btn.getAttribute("data-embed"), file = btn.getAttribute("data-file");
    if (emb) {
      var sep = emb.indexOf("?") >= 0 ? "&" : "?";
      btn.insertAdjacentHTML("beforeend",
        '<iframe class="pg-gmedia__iframe" src="' + esc(emb + sep + "autoplay=1&mute=1&controls=0&loop=1&playsinline=1") +
        '" allow="autoplay" frameborder="0"></iframe>');
    } else if (file) {
      var v = document.createElement("video");
      v.className = "pg-gmedia__video"; v.src = file; v.muted = true; v.loop = true; v.playsInline = true; v.autoplay = true;
      btn.appendChild(v); var p = v.play(); if (p && p.catch) p.catch(function () {});
    }
  }
  function hoverOut(btn) {
    btn.__on = false;
    var f = btn.querySelector(".pg-gmedia__iframe, .pg-gmedia__video");
    if (f) f.remove();
  }
  c.addEventListener("mouseover", function (e) {
    var btn = e.target.closest(".pg-gmedia--vid"); if (!btn || !c.contains(btn)) return;
    if (e.relatedTarget && btn.contains(e.relatedTarget)) return;
    hoverIn(btn);
  });
  c.addEventListener("mouseout", function (e) {
    var btn = e.target.closest(".pg-gmedia--vid"); if (!btn) return;
    if (e.relatedTarget && btn.contains(e.relatedTarget)) return;
    hoverOut(btn);
  });

  /* ---- clicks → lightbox / zoom -------------------------------------- */
  c.addEventListener("click", function (e) {
    var gm = e.target.closest(".pg-gmedia");
    if (gm) {
      e.preventDefault();
      var gal = gm.closest(".pg-gallery"); if (!gal) return;
      var gi = parseInt(gal.getAttribute("data-gal"), 10);
      var i = parseInt(gm.getAttribute("data-i"), 10);
      var mlist = galleryLists[gi];
      if (mlist && mlist.length) G.open(mlist, i);
      return;
    }
    var im = e.target.closest(".pg-img");
    if (im) { e.preventDefault(); G.openZoom(im.getAttribute("data-src")); }
  });

  render();
};
