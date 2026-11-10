// The big AI image guide: search, model filter, contents with a reading line, copy buttons, long prompts that fold, and a picture viewer.
(function () {
  "use strict";
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var secs = $$(".sec"), chaps = $$(".chap"), chips = $$(".chip[data-m]"), input = $(".find input"), bar = $(".bar");
  var onlyBtn = $(".chip[data-only]"), content = $(".content"), onlyPrompts = false;
  var toc = $(".toc"), tocLinks = $$(".toc__ch ol a"), tocChs = $$(".toc__ch");

  // ---------- search index: each section's own text, flattened (no niqqud, no quotes) ----------
  function norm(s) { return (s || "").toLowerCase().replace(/[֑-ׇ]/g, "").replace(/["'״׳`’]/g, "").replace(/\s+/g, " "); }
  secs.forEach(function (s) { s._q = norm(s.textContent); });
  chaps.forEach(function (c) { c._q = norm($(".chap__h", c).textContent); });

  var model = "all";
  function apply() {
    var q = norm(input.value).trim(), words = q ? q.split(" ") : [], shown = 0;
    secs.forEach(function (s) {
      var okM = model === "all" || (" " + s.dataset.models + " ").indexOf(" " + model + " ") > -1;
      var hay = s._q + " " + s.closest(".chap")._q;
      var okQ = words.every(function (w) { return hay.indexOf(w) > -1; });
      var okP = !onlyPrompts || !!s.querySelector(".pr");
      s.hidden = !(okM && okQ && okP); if (!s.hidden) shown++;
    });
    // "prompts only": inside each topic, only the prompt cards and the pictures right after them stay
    content.classList.toggle("only-prompts", onlyPrompts);
    chaps.forEach(function (c) { c.hidden = !$$(".sec", c).some(function (s) { return !s.hidden; }); });
    tocLinks.forEach(function (a) { a.parentNode.hidden = $(a.hash).hidden; });
    tocChs.forEach(function (li) { li.hidden = $("#" + li.dataset.ch).parentNode.hidden; });
    var filtered = q || model !== "all" || onlyPrompts;
    var nPr = onlyPrompts ? secs.filter(function (s) { return !s.hidden; }).reduce(function (n, s) { return n + $$(".pr", s).length; }, 0) : 0;
    $(".count").textContent = !filtered ? "" : onlyPrompts ? nPr + " פרומפטים" : shown + " נושאים";
    $(".empty").hidden = shown > 0;
    toc.classList.toggle("is-searching", !!filtered);
    highlight(words);
    tocUpdate();
  }
  // mark the words that were searched for (only inside visible sections, never inside prompts' copy text)
  function highlight(words) {
    $$("mark.hit").forEach(function (m) { var p = m.parentNode; p.replaceChild(document.createTextNode(m.textContent), m); p.normalize(); });
    words = words.filter(function (w) { return w.length > 1; });
    if (!words.length) return;
    var re = new RegExp("(" + words.map(function (w) { return w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); }).join("|") + ")", "gi");
    secs.forEach(function (s) {
      if (s.hidden) return;
      var walker = document.createTreeWalker(s, NodeFilter.SHOW_TEXT, null), nodes = [], n;
      while ((n = walker.nextNode())) { if (re.test(n.nodeValue)) nodes.push(n); re.lastIndex = 0; }
      nodes.slice(0, 200).forEach(function (t) {
        var frag = document.createDocumentFragment(), last = 0, v = t.nodeValue;
        v.replace(re, function (m, g, i) {
          frag.appendChild(document.createTextNode(v.slice(last, i)));
          var mk = document.createElement("mark"); mk.className = "hit"; mk.textContent = m; frag.appendChild(mk);
          last = i + m.length; return m;
        });
        frag.appendChild(document.createTextNode(v.slice(last)));
        t.parentNode.replaceChild(frag, t);
      });
    });
  }
  var timer;
  input.addEventListener("input", function () {
    clearTimeout(timer);
    timer = setTimeout(function () { apply(); jumpToStart(); }, 160);
  });
  chips.forEach(function (c) {
    c.addEventListener("click", function () {
      model = c.dataset.m;
      chips.forEach(function (x) { x.setAttribute("aria-pressed", x === c ? "true" : "false"); });
      apply(); jumpToStart();
    });
  });
  onlyBtn.addEventListener("click", function () {
    onlyPrompts = !onlyPrompts;
    onlyBtn.setAttribute("aria-pressed", onlyPrompts ? "true" : "false");
    apply(); jumpToStart();
  });
  // after filtering, if the bar was stuck at the top, show the results from their start
  function jumpToStart() {
    var stuckAt = $(".bar-anchor").getBoundingClientRect().top + window.scrollY;
    if (window.scrollY > stuckAt) window.scrollTo({ top: stuckAt, behavior: "instant" });
  }

  // ---------- contents: open chapter, current section, red reading line ----------
  var cur = null;
  function tocUpdate() {
    var barH = bar.getBoundingClientRect().bottom;
    document.documentElement.style.setProperty("--toc-top", Math.round(bar.offsetHeight + 8) + "px");
    var line = Math.max(barH, 0) + window.innerHeight * 0.25, on = null;
    secs.forEach(function (s) { if (!s.hidden && s.getBoundingClientRect().top < line) on = s; });
    if (on !== cur) {
      tocLinks.forEach(function (a) { a.classList.toggle("is-on", on && a.hash === "#" + on.id); });
      tocChs.forEach(function (li) { li.classList.toggle("is-open", !!on && li.dataset.ch === on.closest(".chap").id); });
      cur = on;
      var a = on && $('.toc a[data-sec="' + on.id + '"]');
      if (a && window.innerWidth >= 1200) {
        var list = $(".toc__list"), r = a.getBoundingClientRect(), lr = list.getBoundingClientRect();
        if (r.top < lr.top + 20 || r.bottom > lr.bottom - 20) list.scrollTop += r.top - lr.top - lr.height / 3;
      }
    }
    var c = $(".content"), top = c.getBoundingClientRect().top + window.scrollY, end = top + c.offsetHeight;
    var p = (window.scrollY + window.innerHeight * 0.4 - top) / Math.max(1, end - top - window.innerHeight * 0.6);
    toc.style.setProperty("--p", Math.min(1, Math.max(0, p)).toFixed(4));
  }
  var ticking = false;
  window.addEventListener("scroll", function () { if (!ticking) { ticking = true; requestAnimationFrame(function () { ticking = false; tocUpdate(); }); } }, { passive: true });
  window.addEventListener("resize", tocUpdate);

  // drawer on smaller screens
  var tocBtn = $(".tocbtn"), shade = $(".toc-shade");
  function tocOpen(open) {
    toc.classList.toggle("is-open", open); shade.hidden = !open;
    tocBtn.setAttribute("aria-expanded", open ? "true" : "false");
    document.documentElement.classList.toggle("toc-open", open);
    if (open) { var a = $(".toc a.is-on"); if (a) a.scrollIntoView({ block: "center" }); }
  }
  tocBtn.addEventListener("click", function () { tocOpen(true); });
  shade.addEventListener("click", function () { tocOpen(false); });
  $(".toc__x").addEventListener("click", function () { tocOpen(false); });
  // contents links: scroll so the heading sits just under the sticky bar
  $$(".toc a").forEach(function (a) {
    a.addEventListener("click", function (e) {
      var t = $(a.hash); if (!t) return;
      e.preventDefault(); tocOpen(false);
      var y = t.getBoundingClientRect().top + window.scrollY - bar.offsetHeight - 12;
      window.scrollTo({ top: y, behavior: "smooth" });
      try { history.replaceState(null, "", a.hash); } catch (err) {}
    });
  });

  // ---------- prompts: copy, and fold the long ones ----------
  $$(".pr").forEach(function (pr) {
    var pre = $(".pr__x", pr);
    if (pre.scrollHeight > 330) {
      pr.classList.add("is-long");
      var more = document.createElement("button"); more.type = "button"; more.className = "pr__more"; more.textContent = "להצגת כל הפרומפט";
      more.addEventListener("click", function () { var o = pr.classList.toggle("is-open"); more.textContent = o ? "לקיפול" : "להצגת כל הפרומפט"; });
      pre.after(more);
    }
    $(".copy", pr).addEventListener("click", function () {
      var btn = this, text = pre.textContent;
      var done = function () { btn.classList.add("is-done"); $("span", btn).textContent = "הועתק"; setTimeout(function () { btn.classList.remove("is-done"); $("span", btn).textContent = "העתקה"; }, 2200); };
      if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(done, fallback); else fallback();
      function fallback() { var t = document.createElement("textarea"); t.value = text; document.body.appendChild(t); t.select(); try { document.execCommand("copy"); done(); } catch (e) {} t.remove(); }
    });
  });

  // ---------- picture viewer: steps through the pictures of the same section ----------
  var lb = $(".lb"), lbImg = $(".lb__fig img"), lbCap = $(".lb__fig figcaption"), list = [], at = 0, back = null;
  function show(i) {
    at = (i + list.length) % list.length;
    var b = list[at];
    lbImg.src = b.dataset.full; lbImg.alt = b.dataset.cap || "";
    lbCap.textContent = b.dataset.cap || "";
    $(".lb__count").textContent = list.length > 1 ? (at + 1) + " / " + list.length : "";
  }
  $$(".gi__b").forEach(function (b) {
    b.addEventListener("click", function () {
      list = $$(".gi__b", b.closest(".sec")); back = b;
      show(list.indexOf(b)); lb.hidden = false; document.documentElement.classList.add("lb-open");
      $(".lb__close").focus({ preventScroll: true });
    });
  });
  function close() { lb.hidden = true; lbImg.src = ""; document.documentElement.classList.remove("lb-open"); if (back) back.focus({ preventScroll: true }); }
  $$("[data-close]", lb).forEach(function (x) { x.addEventListener("click", close); });
  $(".lb__prev").addEventListener("click", function () { show(at - 1); });
  $(".lb__next").addEventListener("click", function () { show(at + 1); });
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && toc.classList.contains("is-open")) tocOpen(false);
    if (lb.hidden) return;
    if (e.key === "Escape") close();
    else if (e.key === "ArrowLeft") show(at + 1); // right-to-left page: left moves forward
    else if (e.key === "ArrowRight") show(at - 1);
  });
  var x0 = null;
  lb.addEventListener("touchstart", function (e) { x0 = e.touches[0].clientX; }, { passive: true });
  lb.addEventListener("touchend", function (e) { if (x0 === null) return; var dx = e.changedTouches[0].clientX - x0; x0 = null; if (Math.abs(dx) > 60) show(at + (dx > 0 ? 1 : -1)); });

  apply();
  // a link to a section (#angles) lands under the sticky bar
  if (location.hash && $(location.hash)) setTimeout(function () {
    var t = $(location.hash); window.scrollTo({ top: t.getBoundingClientRect().top + window.scrollY - bar.offsetHeight - 12 });
  }, 60);
})();
