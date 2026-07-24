/* Category — gallery grid + sub-category filter chips + "by client" grouping.
   The grid tiles and the video/image lightbox come from the shared gallery.js
   module. Sub-categories (work.sub) act as optional filters: "All" by default,
   and each distinct sub becomes a chip. Categories without sub-categories show
   no filter bar at all. */
window.PAGE_INIT = function () {
  var S = window.DC.data, esc = window.DC.esc, el = window.DC.el;

  // Which category? Read ?cat= from the URL, default to the first one.
  var slug = new URLSearchParams(location.search).get("cat") || (S.categories[0] && S.categories[0].slug) || "";
  var meta = S.categories.filter(function (c) { return c.slug === slug; })[0] || { slug: slug, name: "Work" };
  var works = ((S.works && S.works[slug]) || []).slice();
  // A "gallery" category shows one big page directly — send the visitor there.
  if (meta.mode === "gallery") {
    var gpage = works.filter(function (w) { return w.type === "page"; })[0];
    if (gpage) { location.replace("page.html?cat=" + encodeURIComponent(slug) + "&page=" + encodeURIComponent(gpage.slug)); return; }
  }
  // Also include pieces that live in another discipline but are assigned to this
  // page via their `also` list (a piece can show on several pages at once).
  if (S.works) Object.keys(S.works).forEach(function (other) {
    if (other === slug) return;
    (S.works[other] || []).forEach(function (w) { if (w.also && w.also.indexOf(slug) >= 0) works.push(w); });
  });
  var desc = (S.categoryDesc && S.categoryDesc[slug]) || "Selected pieces.";
  var state = { view: "new", filter: "__all__" };
  window.Gallery.bindMobileView(document.body);

  // client name -> brand slug (for the case-study links)
  var brandByName = {};
  (S.brands || []).forEach(function (b) { brandByName[b.name] = b.slug; });

  // Distinct sub-categories, in first-seen order.
  var subs = [];
  works.forEach(function (w) { if (w.sub && subs.indexOf(w.sub) < 0) subs.push(w.sub); });

  // Tag chips: for categories that don't use sub-categories (e.g. Concepts),
  // let visitors filter by tag instead. Tags are ordered most-used first.
  var tagCount = {};
  works.forEach(function (w) { (w.tags || []).forEach(function (t) { tagCount[t] = (tagCount[t] || 0) + 1; }); });
  var tagList = Object.keys(tagCount).sort(function (a, b) { return tagCount[b] - tagCount[a] || a.localeCompare(b); });
  // "sub" when the page uses sub-categories, else "tag" when pieces carry tags, else no bar.
  var filterMode = subs.length >= 2 ? "sub" : (tagList.length >= 2 ? "tag" : "none");

  // The works currently shown (filtered by the active chip — sub or tag).
  function visibleWorks() {
    if (state.filter === "__all__") return works;
    // Pages (projects) are always shown; the filter applies to media pieces.
    if (filterMode === "tag") return works.filter(function (w) { return w.type === "page" || (w.tags || []).indexOf(state.filter) >= 0; });
    return works.filter(function (w) { return w.type === "page" || w.sub === state.filter; });
  }

  function renderNewest(list) {
    return '<div class="cat-grid">' +
      list.map(function (w, i) { return window.Gallery.tileHTML(w, i, true); }).join("") +
      '</div>';
  }

  function renderByClient(list) {
    var order = [], byClient = {};
    list.forEach(function (w, i) {
      var key = w.client || "—";
      if (!byClient[key]) { byClient[key] = []; order.push(key); }
      byClient[key].push({ w: w, i: i });
    });
    return '<div class="client-groups">' + order.map(function (cl) {
      var items = byClient[cl];
      var count = items.length + (items.length === 1 ? " piece" : " pieces");
      var grid = items.map(function (o) { return window.Gallery.tileHTML(o.w, o.i, false); }).join("");
      var bslug = brandByName[cl];
      var nameHTML = bslug
        ? '<a class="client-group__name client-group__link" href="brand.html?brand=' + esc(bslug) + '">' + esc(cl) + ' <span class="cs">view case study →</span></a>'
        : '<span class="client-group__name" dir="auto">' + esc(cl) + '</span>';
      return '<div>' +
               '<div class="client-group__head">' +
                 '<span class="client-group__rule"></span>' +
                 nameHTML +
                 '<span class="client-group__count">' + esc(count) + '</span>' +
                 '<span class="client-group__rule"></span>' +
               '</div>' +
               '<div class="cat-grid">' + grid + '</div>' +
             '</div>';
    }).join("") + '</div>';
  }

  // Filter chips: "All" + one per sub-category, or one per tag. Hidden unless 2+.
  function renderFilters() {
    var bar = el("subfilter");
    if (!bar) return;
    if (filterMode === "none") { bar.hidden = true; return; }
    bar.hidden = false;
    var keys = filterMode === "tag" ? tagList : subs;
    var chips = [{ key: "__all__", label: "All" }].concat(keys.map(function (s) { return { key: s, label: s }; }));
    bar.innerHTML = chips.map(function (c) {
      return '<button class="' + (state.filter === c.key ? "is-on" : "") + '" data-filter="' + esc(c.key) + '" dir="auto">' + esc(c.label) + '</button>';
    }).join("");
  }

  // Page items (projects) render as cards that open their own page; media
  // items render as lightbox tiles. A category may hold either or both.
  function isPage(w) { return w && w.type === "page"; }
  function pageCover(w) {
    if (w.cover) return w.cover;
    var first = (w.body || []).filter(function (b) { return b.type === "image"; })[0];
    if (!first) {
      var g = (w.body || []).filter(function (b) { return b.type === "gallery"; })[0];
      first = g && g.items && g.items[0];
    }
    return (first && (first.src || first.poster)) || "";
  }
  function pageCard(w) {
    var cover = pageCover(w);
    var media = cover
      ? '<img src="' + esc(cover) + '" alt="' + esc(w.title || "") + '" loading="lazy">'
      : '<span class="ph">[ cover ]</span>';
    return '<a class="cat-card" href="page.html?cat=' + esc(slug) + '&page=' + esc(w.slug) + '">' +
             '<div class="cat-card__media">' + media + '</div>' +
             '<div class="cat-card__row"><span class="cat-card__name" dir="auto">' + esc(w.title || "") + '</span></div>' +
             (w.kind ? '<div class="cat-card__kind">' + esc(w.kind) + '</div>' : '') +
           '</a>';
  }

  // Breadcrumb trail (only when nested) + sub-category cards.
  function renderCrumbs() {
    var byslug = {}; (S.categories || []).forEach(function (c) { byslug[c.slug] = c; });
    var path = [], cur = meta;
    while (cur) { path.unshift(cur); cur = cur.parent ? byslug[cur.parent] : null; }
    if (path.length < 2) return "";
    return '<nav class="cat-crumbs"><a href="works.html">Work</a>' + path.map(function (c, i) {
      return ' <span class="cat-crumbs__sep">/</span> ' + (i === path.length - 1
        ? '<span>' + esc(c.name) + '</span>'
        : '<a href="category.html?cat=' + esc(c.slug) + '">' + esc(c.name) + '</a>');
    }).join("") + '</nav>';
  }
  function renderChildren() {
    var kids = (S.categories || []).filter(function (c) { return c.parent === slug; });
    if (!kids.length) return "";
    return '<div class="home-grid cat-children">' + kids.map(function (c) {
      var media = c.image ? '<img src="' + esc(c.image) + '" alt="' + esc(c.name) + '" loading="lazy">' : '<span class="ph">[ thumbnail ]</span>';
      return '<a class="cat-card" href="category.html?cat=' + esc(c.slug) + '"><div class="cat-card__media">' + media + '</div><div class="cat-card__row"><span class="cat-card__name">' + esc(c.name) + '</span></div>' + (c.kind ? '<div class="cat-card__kind">' + esc(c.kind) + '</div>' : '') + '</a>';
    }).join("") + '</div>';
  }
  function renderContent() {
    var listAll = visibleWorks();
    var pages = listAll.filter(isPage);
    var media = listAll.filter(function (w) { return !isPage(w); });
    var c = el("cat-content");
    var html = renderCrumbs() + renderChildren();
    if (pages.length) html += '<div class="home-grid page-cards">' + pages.map(pageCard).join("") + '</div>';
    if (media.length) html += (state.view === "new" ? renderNewest(media) : renderByClient(media));
    c.innerHTML = html || '<div class="blog-empty">No pieces here yet — add some in the Studio (or in data.js).</div>';
    window.Gallery.bindGrid(c, media);
    window.Gallery.masonryAll(c);
    var n = pages.length + media.length;
    el("count-label").textContent = (pages.length && !media.length)
      ? pages.length + (pages.length === 1 ? " project" : " projects")
      : n + (n === 1 ? " work" : " works");
  }

  function setView(v) {
    state.view = v;
    el("view-new").classList.toggle("is-on", v === "new");
    el("view-client").classList.toggle("is-on", v === "client");
    renderContent();
  }

  document.title = meta.name + " — " + S.profile.brand;
  el("cat-name").textContent = meta.name;
  el("cat-desc").textContent = desc;
  el("view-new").addEventListener("click", function () { setView("new"); });
  el("view-client").addEventListener("click", function () { setView("client"); });

  // Filter chips (sub-category or tag).
  var bar = el("subfilter");
  if (bar) {
    bar.addEventListener("click", function (e) {
      var b = e.target.closest("button"); if (!b) return;
      state.filter = b.getAttribute("data-filter");
      renderFilters();
      renderContent();
    });
  }

  renderFilters();
  renderContent();
  // Title text height affects packing — re-pack once fonts have loaded.
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { window.Gallery.masonryAll(); });
};
