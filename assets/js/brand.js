/* Brand case study — gathers every piece made for one client (across all
   categories) and shows the brand intro + a gallery (uses gallery.js). */
window.PAGE_INIT = function () {
  var S = window.DC.data, esc = window.DC.esc, el = window.DC.el;

  var slug = new URLSearchParams(location.search).get("brand") || "";
  var brand = (S.brands || []).filter(function (b) { return b.slug === slug; })[0];

  if (!brand) {
    el("brand-name").textContent = "Case study";
    el("brand-intro").textContent = "This client wasn't found. Go back to all work.";
    return;
  }

  // Gather all works assigned to this brand (by `brand` slug, or legacy `client`).
  var works = [];
  Object.keys(S.works || {}).forEach(function (cat) {
    S.works[cat].forEach(function (w) {
      if (w.brand === brand.slug || (!w.brand && w.client === brand.name)) works.push(w);
    });
  });

  document.title = brand.name + " — " + S.profile.brand;
  el("brand-name").textContent = brand.name;
  el("brand-intro").textContent = brand.intro || "";

  if (brand.logo) {
    var logo = el("brand-logo");
    logo.hidden = false;
    logo.innerHTML = '<img src="' + esc(brand.logo) + '" alt="' + esc(brand.name) + '">';
  }

  el("brand-count").textContent = works.length + (works.length === 1 ? " piece" : " pieces");

  var c = el("brand-content");
  var G = window.Gallery;
  var view = "grid"; // "grid" (masonry) or "stack" (Behance single column)

  function tile(i) { return G.tileHTML(works[i], i, false); }

  // Stacked view: full-width images top-to-bottom. Consecutive pieces that
  // share the same `strip` id collapse into one horizontal swipe gallery.
  function stackHTML() {
    var out = "", i = 0;
    while (i < works.length) {
      var sid = works[i].strip;
      if (sid) {
        var group = [];
        while (i < works.length && works[i].strip === sid) { group.push(i); i++; }
        out += '<div class="brand-strip">' + group.map(tile).join("") + '</div>';
      } else { out += tile(i); i++; }
    }
    return '<div class="brand-stack">' + out + '</div>';
  }

  function render() {
    if (!works.length) { c.innerHTML = '<div class="blog-empty">No pieces here yet.</div>'; return; }
    var bar = '<div class="brand-views">' +
        '<button class="bview' + (view === "grid" ? " is-on" : "") + '" data-view="grid">Grid</button>' +
        '<button class="bview' + (view === "stack" ? " is-on" : "") + '" data-view="stack">Stacked</button>' +
      '</div>';
    c.innerHTML = bar + (view === "grid"
      ? '<div class="cat-grid">' + works.map(function (w, i) { return tile(i); }).join("") + '</div>'
      : stackHTML());
    G.bindGrid(c, works);
    if (view === "grid") G.masonryAll(c);
  }

  c.addEventListener("click", function (e) {
    var b = e.target.closest(".bview"); if (!b) return;
    view = b.getAttribute("data-view"); render();
  });

  render();
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { if (view === "grid") G.masonryAll(c); });
};
