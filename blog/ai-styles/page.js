// AI styles post: filter by family, search by name, and a viewer that shows each style with its prompt.
(function () {
  "use strict";
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var DATA = JSON.parse($("#st-data").textContent);
  var cards = $$(".st"), fams = $$(".fam"), chips = $$(".chip"), input = $(".find input");
  var fam = "all";

  // ---------- filter + search ----------
  function apply() {
    var q = (input.value || "").trim().toLowerCase(), shown = 0;
    cards.forEach(function (li) {
      var i = +$(".st__btn", li).dataset.i, d = DATA[i];
      var ok = (fam === "all" || li.closest(".fam").dataset.fam === fam) && (!q || d.t.toLowerCase().indexOf(q) > -1 || d.p.toLowerCase().indexOf(q) > -1);
      li.hidden = !ok; if (ok) shown++;
    });
    fams.forEach(function (f) { f.hidden = !$$(".st", f).some(function (li) { return !li.hidden; }); });
    $(".count .mono").textContent = shown;
    $(".empty").hidden = shown > 0;
  }
  chips.forEach(function (c) {
    c.addEventListener("click", function () {
      fam = c.dataset.fam;
      chips.forEach(function (x) { x.setAttribute("aria-pressed", x === c ? "true" : "false"); });
      apply();
      // keep the page still: if the filter bar was stuck at the top, it stays exactly there and the results start under it
      var stuckAt = $(".bar-anchor").getBoundingClientRect().top + window.scrollY + parseFloat(getComputedStyle($(".bar")).marginTop || 0);
      if (window.scrollY > stuckAt) window.scrollTo({ top: stuckAt, behavior: "instant" });
      navUpdate();
    });
  });
  input.addEventListener("input", function () { apply(); navUpdate(); });


  // ---------- side navigation with a track ----------
  var nav = $(".fnav"), navLinks = $$(".fnav__list a"), bar = $(".bar");
  var navCur = -1;
  function navUpdate() {
    var barRect = bar.getBoundingClientRect(), anchorTop = $(".bar-anchor").getBoundingClientRect().top;
    nav.style.setProperty("--fnav-top", Math.round(Math.max(barRect.bottom, 0) + 24) + "px");
    // only beside the gallery: hidden over the intro
    nav.classList.toggle("is-hidden", anchorTop > window.innerHeight * 0.5);
    // the full menu only where it fits beside the centred gallery
    var g = $(".fam:not([hidden]) .sts"), room = g ? window.innerWidth - g.getBoundingClientRect().right : 0;
    nav.classList.toggle("is-thin", window.innerWidth < 1200 || room < 10.5 * 16 + 24);
    // red line: how far through the families that are shown
    var shown = fams.filter(function (f) { return !f.hidden; });
    if (shown.length) {
      var top = shown[0].getBoundingClientRect().top + window.scrollY, end = shown[shown.length - 1].getBoundingClientRect().bottom + window.scrollY;
      var p = (window.scrollY + window.innerHeight * 0.4 - top) / Math.max(1, end - top);
      nav.style.setProperty("--p", Math.min(1, Math.max(0, p)).toFixed(4));
    }
    navLinks.forEach(function (a) { a.parentNode.hidden = $(a.hash).hidden; });
    var i = -1;
    navLinks.forEach(function (a, k) { var f = $(a.hash); if (!f.hidden && f.getBoundingClientRect().top < window.innerHeight * 0.4) i = k; });
    if (i !== navCur) { if (navLinks[navCur]) navLinks[navCur].classList.remove("is-on"); navCur = i; if (navLinks[i]) navLinks[i].classList.add("is-on"); }
  }
  navLinks.forEach(function (a) {
    a.addEventListener("click", function (e) {
      e.preventDefault();
      var f = $(a.hash), y = f.getBoundingClientRect().top + window.scrollY - bar.offsetHeight - 8;
      window.scrollTo({ top: y, behavior: "smooth" });
    });
  });
  window.addEventListener("scroll", navUpdate, { passive: true });
  window.addEventListener("resize", navUpdate);
  navUpdate();

  // ---------- viewer ----------
  var sv = $(".sv"), img = $(".sv__fig img"), at = -1, back = null;
  var visible = function () { return cards.filter(function (li) { return !li.hidden; }).map(function (li) { return +$(".st__btn", li).dataset.i; }); };
  function show(i) {
    var d = DATA[i]; at = i;
    img.src = "../../media/blog/ai-styles/" + d.id + ".webp?v=1"; img.alt = d.t;
    $(".sv__title").textContent = d.t;
    $(".sv__fam").textContent = d.f;
    $(".sv__prompt").textContent = d.p;
    var list = visible(), k = list.indexOf(i);
    $(".sv__n").textContent = (k + 1) + " / " + list.length;
    var copy = $(".sv__copy"); copy.classList.remove("is-done"); $("span", copy).textContent = "העתקת הפרומפט";
    try { history.replaceState(null, "", "#" + d.id); } catch (e) {}
  }
  function open(i, from) {
    back = from || document.activeElement;
    show(i); sv.hidden = false; document.documentElement.classList.add("sv-open");
    $(".sv__copy").focus({ preventScroll: true });
  }
  function close() {
    sv.hidden = true; document.documentElement.classList.remove("sv-open"); at = -1;
    try { history.replaceState(null, "", location.pathname + location.search); } catch (e) {}
    if (back && back.focus) back.focus({ preventScroll: true });
  }
  function step(dir) { var list = visible(), k = list.indexOf(at); if (k < 0) return; show(list[(k + dir + list.length) % list.length]); }
  $$(".st__btn").forEach(function (b) { b.addEventListener("click", function () { open(+b.dataset.i, b); }); });
  $$("[data-close]", sv).forEach(function (b) { b.addEventListener("click", close); });
  $(".sv__prev").addEventListener("click", function () { step(-1); });
  $(".sv__next").addEventListener("click", function () { step(1); });
  document.addEventListener("keydown", function (e) {
    if (sv.hidden) return;
    if (e.key === "Escape") close();
    // right-to-left page: the left arrow moves forward
    else if (e.key === "ArrowLeft") step(1);
    else if (e.key === "ArrowRight") step(-1);
  });
  // swipe on phones
  var x0 = null;
  sv.addEventListener("touchstart", function (e) { x0 = e.touches[0].clientX; }, { passive: true });
  sv.addEventListener("touchend", function (e) { if (x0 === null) return; var dx = e.changedTouches[0].clientX - x0; x0 = null; if (Math.abs(dx) > 60) step(dx > 0 ? 1 : -1); });

  // copy the prompt
  $(".sv__copy").addEventListener("click", function () {
    var btn = this, text = DATA[at].p;
    var done = function () { btn.classList.add("is-done"); $("span", btn).textContent = "הועתק"; };
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(done, fallback); else fallback();
    function fallback() { var t = document.createElement("textarea"); t.value = text; document.body.appendChild(t); t.select(); try { document.execCommand("copy"); done(); } catch (e) {} t.remove(); }
  });

  // a link straight to one style (#ghibli) opens it
  var hash = decodeURIComponent(location.hash.slice(1));
  if (hash) { var hit = DATA.findIndex(function (d) { return d.id === hash; }); if (hit > -1) open(hit, $('.st__btn[data-i="' + hit + '"]')); }
})();
