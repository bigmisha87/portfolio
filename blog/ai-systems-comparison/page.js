/* AI image model comparison: gallery filters, lightbox, research list (search, sort, open/close),
   copy buttons and the red reading line. No libraries. */
(function () {
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var html = document.documentElement;

  /* ---------- shared state: which maker (the three galleries and the research cards all follow it) ---------- */
  var state = { maker: "all" };
  var gals = $$(".gal");
  var rows = $$(".rc");

  function applyFilters() {
    gals.forEach(function (g) {
      var shown = 0;
      $$(".card", g).forEach(function (c) {
        var ok = state.maker === "all" || c.dataset.maker === state.maker;
        c.hidden = !ok;
        if (ok) shown++;
      });
      $(".gal__count", g).textContent = shown + " תמונות";
      $(".gal__empty", g).hidden = shown > 0;
    });
    filterRows();
  }
  $$(".chip").forEach(function (b) {
    b.addEventListener("click", function () {
      state.maker = b.dataset.maker;
      $$(".chip").forEach(function (x) { x.setAttribute("aria-pressed", x === b ? "true" : "false"); });
      applyFilters();
    });
  });

  /* ---------- research list ---------- */
  var list = $("[data-list]");
  var search = $("[data-search]");
  var empty = $(".empty");
  function filterRows() {
    var q = (search && search.value || "").trim().toLowerCase();
    var shown = 0;
    rows.forEach(function (r) {
      var ok = (state.maker === "all" || r.dataset.maker === state.maker) && (!q || r.dataset.search.indexOf(q) > -1);
      r.hidden = !ok;
      if (ok) shown++;
    });
    if (empty) empty.hidden = shown > 0;
  }
  if (search) search.addEventListener("input", filterRows);
  $$("[data-sort]").forEach(function (b) {
    b.addEventListener("click", function () {
      var key = b.dataset.sort;
      $$("[data-sort]").forEach(function (x) { x.setAttribute("aria-pressed", x === b ? "true" : "false"); });
      rows.slice().sort(function (a, c) {
        if (key === "order") return a.dataset.order - c.dataset.order;
        return (c.dataset[key] - a.dataset[key]) || (a.dataset.order - c.dataset.order);
      }).forEach(function (r) { list.appendChild(r); });
    });
  });
  // a link to a model (#m-...) scrolls to its card and lights it up
  function openRow(id, smooth) {
    var r = document.getElementById(id);
    if (!r || !r.classList.contains("rc")) return false;
    if (r.hidden) { state.maker = "all"; $$(".chip").forEach(function (x) { x.setAttribute("aria-pressed", x.dataset.maker === "all" ? "true" : "false"); }); if (search) search.value = ""; applyFilters(); }
    r.scrollIntoView({ behavior: smooth ? "smooth" : "auto", block: "start" });
    r.classList.remove("is-flash"); void r.offsetWidth; r.classList.add("is-flash");
    return true;
  }
  document.addEventListener("click", function (e) {
    var a = e.target.closest("a[href^='#m-']");
    if (!a) return;
    if (openRow(a.getAttribute("href").slice(1), true)) { e.preventDefault(); history.replaceState(null, "", a.getAttribute("href")); }
  });
  if (location.hash.indexOf("#m-") === 0) setTimeout(function () { openRow(location.hash.slice(1), false); }, 50);

  /* ---------- copy a prompt ---------- */
  $$("[data-copy]").forEach(function (b) {
    b.addEventListener("click", function () {
      var done = function () {
        var t = b.lastElementChild, old = t.textContent;
        b.classList.add("is-done"); t.textContent = "הועתק";
        setTimeout(function () { b.classList.remove("is-done"); t.textContent = old; }, 1800);
      };
      if (navigator.clipboard) navigator.clipboard.writeText(b.dataset.copy).then(done, function () {});
    });
  });

  /* ---------- lightbox ---------- */
  var lb = $(".lb"), lbImg = $(".lb__fig img"), lbName = $(".lb__name"), lbMeta = $(".lb__meta"),
    lbScore = $(".lb__score"), lbMore = $(".lb__more"), lbCount = $(".lb__count");
  var group = [], at = 0, opener = null;
  var SC = { "מצוין": "a", "טוב": "b", "בינוני": "c", "חלש": "d" };
  function paint() {
    var b = group[at];
    lbImg.src = b.dataset.full;
    lbImg.alt = b.dataset.name || "";
    lbName.textContent = b.dataset.name || "";
    // maker and pixel size as two separate items, spaced apart (no separator dot)
    lbMeta.innerHTML = "";
    (b.dataset.meta || "").split(" · ").forEach(function (part) { var sp = document.createElement("span"); sp.textContent = part; lbMeta.appendChild(sp); });
    var s = b.dataset.score;
    lbScore.innerHTML = s ? '<span class="score score--' + SC[s] + '">' + s + "</span>" : "";
    lbMore.hidden = !b.dataset.id;
    if (b.dataset.id) lbMore.setAttribute("href", "#" + b.dataset.id);
    lbCount.textContent = group.length > 1 ? (at + 1) + " / " + group.length : "";
    $(".lb__prev").hidden = $(".lb__next").hidden = group.length < 2;
    // load the neighbours ahead of time so arrows feel instant
    [at + 1, at - 1].forEach(function (k) { var n = group[(k + group.length) % group.length]; if (n) (new Image()).src = n.dataset.full; });
  }
  function open(btn) {
    var scope = btn.closest(".grid, .rcards, .old__imgs, .task");
    group = $$("[data-full]", scope).filter(function (b) { return !b.closest("[hidden]"); });
    at = Math.max(0, group.indexOf(btn));
    opener = btn;
    paint();
    lb.hidden = false;
    html.classList.add("lb-open");
    $(".lb__close").focus();
  }
  function close() {
    lb.hidden = true;
    html.classList.remove("lb-open");
    lbImg.removeAttribute("src");
    if (opener) opener.focus({ preventScroll: true });
  }
  function go(d) { if (group.length < 2) return; at = (at + d + group.length) % group.length; paint(); }
  document.addEventListener("click", function (e) {
    var b = e.target.closest("button[data-full]");
    if (b) open(b);
  });
  $$("[data-close]", lb).forEach(function (x) { x.addEventListener("click", close); });
  $(".lb__next").addEventListener("click", function () { go(1); });
  $(".lb__prev").addEventListener("click", function () { go(-1); });
  lbMore.addEventListener("click", function (e) { e.preventDefault(); e.stopPropagation(); var id = lbMore.getAttribute("href").slice(1); close(); openRow(id, true); });
  document.addEventListener("keydown", function (e) {
    if (lb.hidden) return;
    if (e.key === "Escape") close();
    else if (e.key === "ArrowLeft") go(1);   // right-to-left: left is "next"
    else if (e.key === "ArrowRight") go(-1);
    else if (e.key === "Tab") {
      var f = $$("button:not([hidden]), a:not([hidden])", lb);
      var i = f.indexOf(document.activeElement);
      if (e.shiftKey && i <= 0) { e.preventDefault(); f[f.length - 1].focus(); }
      else if (!e.shiftKey && i === f.length - 1) { e.preventDefault(); f[0].focus(); }
    }
  });
  var sx = 0, sy = 0;
  lb.addEventListener("touchstart", function (e) { sx = e.touches[0].clientX; sy = e.touches[0].clientY; }, { passive: true });
  lb.addEventListener("touchend", function (e) {
    var dx = e.changedTouches[0].clientX - sx, dy = e.changedTouches[0].clientY - sy;
    if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.4) go(dx > 0 ? 1 : -1);
  });

  /* ---------- red reading line ---------- */
  var bar = $(".progress");
  var tick = false;
  function progress() {
    tick = false;
    var max = document.documentElement.scrollHeight - innerHeight;
    bar.style.setProperty("--p", max > 0 ? Math.min(1, scrollY / max).toFixed(4) : 0);
  }
  addEventListener("scroll", function () { if (!tick) { tick = true; requestAnimationFrame(progress); } }, { passive: true });
  addEventListener("resize", progress);
  progress();

  applyFilters();
})();
