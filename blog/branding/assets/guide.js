/* Branding guide — shared behaviour (blog/branding/*)
   - chapter navigation (side list + this chapter's sections), prev/next
   - search across every chapter (loads the chapter pages once, then searches in memory)
   - ?q=word highlights every match on the page, with a find bar (next / previous)
   - animation figures (.anim) play once when they scroll into view, then offer "הפעל שוב"
   - gallery lightbox, theme toggle (dark is the default), reading progress, ?review=1 */
(function () {
  "use strict";

  var CHAPTERS = [
    { f: "what-is-branding.html", k: "what", t: "מה זה בעצם מיתוג", d: "שפה עיצובית שלמה, לא רק לוגו. מה היא פותרת, ושבעה צעדים מעיצוב למיתוג." },
    { f: "brands.html", k: "brands", t: "איך מותגים גדולים נבנים", d: "95% מההחלטות רגשיות. הרעיון המארגן, נכסים חושיים, עקביות רדיקלית ומותג Top of Mind." },
    { f: "strategy.html", k: "strategy", t: "אסטרטגיה, קול ומתחרים", d: "מה המותג אומר ומה לעולם לא, למי הוא מדבר, ואיפה החלל העיצובי שאף אחד לא תפס." },
    { f: "color.html", k: "color", t: "צבע", d: "פלטה, פסיכולוגיה, ניגודיות, שחור שהוא לא שחור, ולמה המסך משקר לדפוס." },
    { f: "typography.html", k: "type", t: "טיפוגרפיה", d: "פונט ראשי ומשני, היררכיה, סוגי פונטים, ועברית מול אנגלית." },
    { f: "logo.html", k: "logo", t: "לוגו", d: "מה זה לוגו ולמה צריך אותו, חמשת העקרונות, חמשת הסוגים, גרסאות, מרווח מגן ומבחני לחץ." },
    { f: "logo-design.html", k: "logodesign", t: "עיצוב לוגו: מהרעיון לסקיצה", d: "שאלות ללקוח, מפות חשיבה, לוח השראה, סגנונות, סקיצות, פונט וצבע, ושלבי העבודה." },
    { f: "visual-language.html", k: "visual", t: "שפה גרפית, איור וצילום", d: "אייקונים, איורים, דמות, עקרונות עיצוב וסגנון צילום אחיד." },
    { f: "grid.html", k: "grid", t: "גריד וריווח", d: "גרידים מתמטיים וחופשיים, מערכת ריווח של 8, ומרווח בין שורות." },
    { f: "mockups.html", k: "mockups", t: "יישומים ומוקאפים", d: "המותג בעולם האמיתי: אריזות, שילוט, דפוס ודיגיטל, ואיך מציגים." },
    { f: "digital.html", k: "digital", t: "פרסום דיגיטלי", d: "כל המידות לרשתות ולבאנרים, בקנה מידה אמיתי, ולמה זה לא מפוקסל." },
    { f: "golden-rules.html", k: "rules", t: "כללי זהב", d: "לא למתוח, ניגודיות לפני אפקטים, בלי אנימציה ליד טקסט, ובלי חפירות." },
    { f: "presenting.html", k: "presenting", t: "הצגה ללקוח", d: "לא מוכרים לוגו, מוכרים ביטחון. איך מובילים להחלטה במקום לבקש דעה." },
    { f: "checklist.html", k: "checklist", t: "ההגשה: רשימת בדיקה", d: "מה חובה, מה בונוס, וספר מותג קצר. מסמנים תוך כדי עבודה." },
    { f: "resources.html", k: "resources", t: "השראה ומקורות", d: "פרויקטים שאהבתי, סטודיואים, ערוצי יוטיוב, ספרים וכלים." }
  ];
  window.GUIDE = { chapters: CHAPTERS };

  var doc = document, root = doc.documentElement;
  var reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  var here = (location.pathname.split("/").pop() || "index.html");
  if (here === "") here = "index.html";
  var curIdx = -1;
  CHAPTERS.forEach(function (c, i) { if (c.f === here) curIdx = i; });
  var params = new URLSearchParams(location.search);

  function $(s, el) { return (el || doc).querySelector(s); }
  function $$(s, el) { return Array.prototype.slice.call((el || doc).querySelectorAll(s)); }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  function pad(n) { return (n < 10 ? "0" : "") + n; }

  /* ---------- theme ---------- */
  function setThemeIcon() {
    var b = $("#g-theme"); if (!b) return;
    var light = root.getAttribute("data-theme") === "light";
    b.textContent = light ? "☾" : "☀";
    b.setAttribute("aria-label", light ? "מעבר למצב כהה" : "מעבר למצב בהיר");
  }
  function toggleTheme() {
    var light = root.getAttribute("data-theme") !== "light";
    if (light) root.setAttribute("data-theme", "light"); else root.removeAttribute("data-theme");
    try { localStorage.setItem("theme", light ? "light" : "dark"); } catch (e) {}
    setThemeIcon();
  }

  /* each chapter's own colour (defined in guide.css as --cNN / --iNN) */
  function colorVars(i) { var k = CHAPTERS[i].k; return "--c:var(--c-" + k + ");--ci:var(--i-" + k + ")"; }

  /* ---------- nav ---------- */
  function sectionsOf(scope) {
    return $$("h2[id]", scope || $("#main")).map(function (h) {
      return { id: h.id, t: h.getAttribute("data-short") || h.textContent.trim() };
    });
  }
  function buildNav() {
    var nav = $("#g-nav"); if (!nav) return;
    var html = '<h2>מדריך המיתוג</h2><ol>';
    html += '<li class="home' + (here === "index.html" ? " cur" : "") + '"><a href="index.html"><span class="n">00</span><span>פתיחה וכל הפרקים</span></a></li>';
    CHAPTERS.forEach(function (c, i) {
      var cur = i === curIdx;
      html += '<li' + (cur ? ' class="cur"' : "") + ' style="' + colorVars(i) + '"><a href="' + c.f + '"' + (cur ? ' aria-current="page"' : "") + '><span class="n">' + pad(i + 1) + '</span><span>' + esc(c.t) + "</span></a>";
      if (cur) {
        var secs = sectionsOf();
        if (secs.length) {
          html += '<ol class="subs">' + secs.map(function (s) { return '<li><a href="#' + s.id + '" data-sec="' + s.id + '">' + esc(s.t) + "</a></li>"; }).join("") + "</ol>";
        }
      }
      html += "</li>";
    });
    html += "</ol>";
    nav.innerHTML = html;

    var scrim = doc.createElement("div"); scrim.className = "g-scrim"; doc.body.appendChild(scrim);
    var btn = $("#g-menu");
    function close() { nav.classList.remove("open"); scrim.classList.remove("open"); if (btn) btn.setAttribute("aria-expanded", "false"); }
    if (btn) btn.addEventListener("click", function () {
      var open = !nav.classList.contains("open");
      nav.classList.toggle("open", open); scrim.classList.toggle("open", open); btn.setAttribute("aria-expanded", String(open));
    });
    scrim.addEventListener("click", close);
    nav.addEventListener("click", function (e) { if (e.target.closest("a")) close(); });
    doc.addEventListener("keydown", function (e) { if (e.key === "Escape") close(); });

    // highlight the section in view
    var links = $$(".subs a", nav);
    if (links.length && "IntersectionObserver" in window) {
      var map = {}; links.forEach(function (a) { map[a.getAttribute("data-sec")] = a; });
      var io = new IntersectionObserver(function (ents) {
        ents.forEach(function (en) {
          if (en.isIntersecting) { links.forEach(function (a) { a.classList.remove("on"); }); var a = map[en.target.id]; if (a) a.classList.add("on"); }
        });
      }, { rootMargin: "-20% 0px -70% 0px" });
      $$("h2[id]", $("#main")).forEach(function (h) { io.observe(h); });
    }
  }
  function buildPager() {
    var p = $("#ch-pager"); if (!p || curIdx < 0) return;
    var prev = curIdx > 0 ? CHAPTERS[curIdx - 1] : null;
    var next = curIdx < CHAPTERS.length - 1 ? CHAPTERS[curIdx + 1] : null;
    p.innerHTML =
      (prev ? '<a class="prev" style="' + colorVars(curIdx - 1) + '" href="' + prev.f + '"><small>→ הפרק הקודם · ' + pad(curIdx) + "</small><b>" + esc(prev.t) + "</b></a>"
            : '<a class="prev" href="index.html"><small>→ חזרה</small><b>כל הפרקים</b></a>') +
      (next ? '<a class="next" style="' + colorVars(curIdx + 1) + '" href="' + next.f + '"><small>הפרק הבא · ' + pad(curIdx + 2) + " ←</small><b>" + esc(next.t) + "</b></a>"
            : '<a class="next" href="index.html"><small>סוף המדריך ←</small><b>חזרה לפתיחה</b></a>');
  }

  /* ---------- progress ---------- */
  function progress() {
    var bar = $(".g-progress i"); if (!bar) return;
    var tick = false;
    function upd() { tick = false; var h = doc.documentElement.scrollHeight - innerHeight; bar.style.transform = "scaleX(" + (h > 0 ? Math.min(1, scrollY / h) : 0) + ")"; }
    addEventListener("scroll", function () { if (!tick) { tick = true; requestAnimationFrame(upd); } }, { passive: true });
    upd();
  }

  /* ---------- search ---------- */
  var INDEX = null, loading = null;
  function norm(s) {
    return String(s || "").toLowerCase()
      .replace(/[֑-ׇ]/g, "")             // niqqud & cantillation
      .replace(/[׳״'"`״׳]/g, "")          // geresh, gershayim, quotes
      .replace(/[־–—-]/g, " ")
      .replace(/\s+/g, " ").trim();
  }
  function textOf(el) {
    var c = el.cloneNode(true);
    $$("script,style,.anim__replay,svg", c).forEach(function (x) { x.remove(); });
    return (c.textContent || "").replace(/\s+/g, " ").trim();
  }
  function indexDoc(d, file, chTitle, chNum) {
    var main = d.querySelector("#main"); if (!main) return [];
    var out = [];
    var head = main.querySelector(".ch-head");
    if (head) out.push({ f: file, id: "", ch: chTitle, n: chNum, t: chTitle, x: textOf(head) });
    main.querySelectorAll("section.sec").forEach(function (sec) {
      var h2 = sec.querySelector("h2");
      var base = { f: file, ch: chTitle, n: chNum };
      // split the section into h3 sub-parts so results point close to the word
      var cur = { f: file, id: (h2 && h2.id) || sec.id || "", ch: chTitle, n: chNum, t: h2 ? h2.textContent.trim() : chTitle, x: "" };
      Array.prototype.forEach.call(sec.children, function (child) {
        if (child.tagName === "H2") return;
        if (child.tagName === "H3") {
          if (cur.x) out.push(cur);
          cur = { f: file, id: child.id || cur.id, ch: chTitle, n: chNum, t: (h2 ? h2.textContent.trim() + " · " : "") + child.textContent.trim(), x: "" };
          return;
        }
        cur.x += " " + textOf(child);
      });
      if (cur.x || cur.t) out.push(cur);
      void base;
    });
    return out;
  }
  function loadIndex() {
    if (INDEX) return Promise.resolve(INDEX);
    if (loading) return loading;
    try { var c = sessionStorage.getItem("bg-index-v4"); if (c) { INDEX = JSON.parse(c); return Promise.resolve(INDEX); } } catch (e) {}
    var parser = new DOMParser();
    loading = Promise.all(CHAPTERS.map(function (c, i) {
      if (i === curIdx) return Promise.resolve(indexDoc(doc, c.f, c.t, pad(i + 1)));
      return fetch(c.f, { cache: "force-cache" }).then(function (r) { return r.ok ? r.text() : ""; })
        .then(function (h) { return h ? indexDoc(parser.parseFromString(h, "text/html"), c.f, c.t, pad(i + 1)) : []; })
        .catch(function () { return []; });
    })).then(function (parts) {
      INDEX = [].concat.apply([], parts).map(function (e) { e.nt = norm(e.t); e.nx = norm(e.x); return e; });
      try { sessionStorage.setItem("bg-index-v4", JSON.stringify(INDEX)); } catch (e) {}
      return INDEX;
    });
    return loading;
  }
  function snippet(text, q) {
    var t = text, n = norm(t), i = n.indexOf(q);
    if (i < 0) return esc(t.slice(0, 140)) + (t.length > 140 ? "…" : "");
    // positions in normalized text ≈ positions in raw text (we only drop rare marks); good enough for a snippet
    var start = Math.max(0, i - 60), end = Math.min(t.length, i + q.length + 80);
    var raw = t.slice(start, end);
    var re = new RegExp("(" + q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + ")", "i");
    return (start > 0 ? "…" : "") + esc(raw).replace(re, "<mark>$1</mark>") + (end < t.length ? "…" : "");
  }
  function search(q) {
    var nq = norm(q); if (nq.length < 2) return [];
    var words = nq.split(" ").filter(Boolean);
    var res = [];
    INDEX.forEach(function (e) {
      var score = 0, all = true;
      var nc = norm(e.ch);
      words.forEach(function (w) {
        var inT = e.nt.indexOf(w) >= 0, inX = e.nx.indexOf(w) >= 0, inC = nc.indexOf(w) >= 0;
        if (!inT && !inX) all = false;
        score += (inT ? 6 : 0) + (inX ? 1 + Math.min(4, e.nx.split(w).length - 1) : 0);
        /* "צבע" should open the colour chapter first, not a paragraph elsewhere that mentions colour */
        if (inC) score += e.id === "" ? 14 : 3;
      });
      if (all) res.push({ e: e, s: score });
    });
    res.sort(function (a, b) { return b.s - a.s; });
    return res.slice(0, 30);
  }
  function wireSearch(box) {
    var input = $("input", box), panel = $(".g-results", box);
    if (!input || !panel) return;
    var sel = -1, timer = null;
    function render() {
      var q = input.value.trim();
      if (norm(q).length < 2) { panel.innerHTML = '<div class="hint">הקלידו לפחות 2 אותיות. למשל: שחור, באנר, גריד, פונט</div>'; panel.classList.add("open"); return; }
      panel.innerHTML = '<div class="hint">מחפש בכל הפרקים…</div>'; panel.classList.add("open");
      loadIndex().then(function () {
        var r = search(q); sel = -1;
        if (!r.length) { panel.innerHTML = '<div class="hint">לא נמצא שום דבר עבור „' + esc(q) + '”.</div>'; return; }
        var first = norm(q).split(" ")[0];
        panel.innerHTML = r.map(function (o) {
          var e = o.e, href = e.f + "?q=" + encodeURIComponent(q) + (e.id ? "#" + e.id : "");
          return '<a href="' + href + '"><span class="r-ch">' + e.n + " · " + esc(e.ch) + '</span><span class="r-t">' + esc(e.t) + '</span><span class="r-s">' + snippet(e.x, first) + "</span></a>";
        }).join("");
      });
    }
    input.addEventListener("input", function () { clearTimeout(timer); timer = setTimeout(render, 120); });
    input.addEventListener("focus", function () { loadIndex(); if (input.value.trim()) render(); });
    input.addEventListener("keydown", function (e) {
      var items = $$("a", panel);
      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault(); if (!items.length) return;
        sel = (sel + (e.key === "ArrowDown" ? 1 : -1) + items.length) % items.length;
        items.forEach(function (a, i) { a.classList.toggle("on", i === sel); });
        items[sel].scrollIntoView({ block: "nearest" });
      } else if (e.key === "Enter") {
        var go = items[sel >= 0 ? sel : 0]; if (go) { e.preventDefault(); location.href = go.href; }
      } else if (e.key === "Escape") { panel.classList.remove("open"); input.blur(); }
    });
    doc.addEventListener("click", function (e) { if (!box.contains(e.target)) panel.classList.remove("open"); });
  }
  function shortcut() {
    doc.addEventListener("keydown", function (e) {
      var t = e.target; if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable)) return;
      if (e.key === "/" || ((e.ctrlKey || e.metaKey) && (e.key === "k" || e.key === "K"))) {
        var i = $(".hub-search input") || $(".bn .g-search input"); if (i) { e.preventDefault(); i.focus(); i.select(); }
      }
    });
  }

  /* ---------- highlight ?q on the page ---------- */
  function highlight(q) {
    var main = $("#main"); var nq = norm(q); if (!main || nq.length < 2) return;
    var words = nq.split(" ").filter(function (w) { return w.length >= 2; });
    if (!words.length) return;
    /* the search ignores ״ ׳ ' " (דוא"ל = דואל), so the page match has to allow them between letters */
    var re = new RegExp(words.map(function (w) {
      return w.split("").map(function (ch) { return ch.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); }).join("[׳״'\"`]?");
    }).join("|"), "gi");
    var walker = doc.createTreeWalker(main, NodeFilter.SHOW_TEXT, {
      acceptNode: function (n) {
        var p = n.parentNode; if (!p || /SCRIPT|STYLE|TEXTAREA|BUTTON/.test(p.nodeName) || p.closest("svg,.anim__replay,.ch-pager")) return NodeFilter.FILTER_REJECT;
        re.lastIndex = 0; return re.test(n.nodeValue) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT;
      }
    });
    var nodes = []; while (walker.nextNode()) nodes.push(walker.currentNode);
    nodes.forEach(function (n) {
      var frag = doc.createDocumentFragment(), s = n.nodeValue, last = 0, m;
      re.lastIndex = 0;
      while ((m = re.exec(s))) {
        if (m.index > last) frag.appendChild(doc.createTextNode(s.slice(last, m.index)));
        var mk = doc.createElement("mark"); mk.className = "hit"; mk.textContent = m[0]; frag.appendChild(mk);
        last = m.index + m[0].length;
      }
      if (last < s.length) frag.appendChild(doc.createTextNode(s.slice(last)));
      n.parentNode.replaceChild(frag, n);
    });
    var hits = $$("mark.hit", main); if (!hits.length) return;
    var bar = doc.createElement("div"); bar.className = "g-findbar open"; bar.setAttribute("role", "status");
    bar.innerHTML = '<span>„<b>' + esc(q) + '</b>” · <span class="c"></span></span><button type="button" data-d="-1" aria-label="ההופעה הקודמת">↑</button><button type="button" data-d="1" aria-label="ההופעה הבאה">↓</button><button type="button" data-x aria-label="סגירת הסימון">✕</button>';
    doc.body.appendChild(bar);
    var i = 0;
    // start from the first hit at/after the #section, if any
    if (location.hash) {
      var target = doc.getElementById(decodeURIComponent(location.hash.slice(1)));
      if (target) { for (var k = 0; k < hits.length; k++) { if (target.compareDocumentPosition(hits[k]) & Node.DOCUMENT_POSITION_FOLLOWING || target.contains(hits[k])) { i = k; break; } } }
    }
    function seen(el) {
      if (el.checkVisibility) return el.checkVisibility({ opacityProperty: true, visibilityProperty: true });
      return el.getClientRects().length > 0;
    }
    /* a match inside an infographic may sit on a step that isn't showing: move the figure to that step */
    function reveal(h) {
      var d = h.closest("details:not([open])"); if (d) d.open = true;
      if (seen(h)) return;
      var f = h.closest(".anim[data-steps]"); if (!f || !f.GUIDE_go) return;
      var n = Number(f.getAttribute("data-steps")) || 2, was = Number(f.getAttribute("data-step")) || 1;
      f.classList.add("no-trans");
      for (var k = 1; k <= n; k++) { f.GUIDE_go(k); void f.offsetWidth; if (seen(h)) break; }
      if (!seen(h)) f.GUIDE_go(was);
      void f.offsetWidth; f.classList.remove("no-trans");
    }
    var moved = false;
    function show() {
      hits.forEach(function (h) { h.classList.remove("now"); });
      reveal(hits[i]);
      hits[i].classList.add("now");
      hits[i].scrollIntoView({ block: "center", behavior: reduce ? "auto" : "smooth" });
      $(".c", bar).textContent = (i + 1) + " מתוך " + hits.length;
    }
    /* images that load later push the page down: put the current match back in view, unless the reader moved */
    ["wheel", "touchmove", "keydown"].forEach(function (ev) { addEventListener(ev, function () { moved = true; }, { passive: true, once: true }); });
    addEventListener("load", function () { setTimeout(function () { if (!moved) hits[i].scrollIntoView({ block: "center", behavior: "instant" }); }, 120); }, { once: true });
    bar.addEventListener("click", function (e) {
      var b = e.target.closest("button"); if (!b) return;
      if (b.hasAttribute("data-x")) {
        hits.forEach(function (h) { h.replaceWith(doc.createTextNode(h.textContent)); }); main.normalize(); bar.remove();
        history.replaceState(null, "", location.pathname + location.hash); return;
      }
      i = (i + Number(b.getAttribute("data-d")) + hits.length) % hits.length; show();
    });
    setTimeout(show, 60);
  }

  /* ---------- animation figures ---------- */
  function anims() {
    var figs = $$(".anim"); if (!figs.length) return;
    figs.forEach(function (f) {
      if (f.hasAttribute("data-manual")) return; // page script drives it
      var b = doc.createElement("button"); b.type = "button"; b.className = "anim__replay";
      b.innerHTML = '<span aria-hidden="true">↻</span> הפעל שוב'; f.appendChild(b);
      b.addEventListener("click", function () { play(f, true); });
    });
    function done(f) { f.classList.add("is-done"); f.dispatchEvent(new CustomEvent("anim:done")); }
    function play(f, again) {
      clearTimeout(f._t);
      f.classList.remove("is-playing", "is-done", "is-static");
      void f.offsetWidth; // restart CSS animations
      f.classList.add("is-playing");
      f.dispatchEvent(new CustomEvent("anim:play", { detail: { again: !!again } }));
      var dur = Number(f.getAttribute("data-duration") || 4000);
      f._t = setTimeout(function () { done(f); }, dur);
    }
    window.GUIDE.play = play;
    if (reduce || !("IntersectionObserver" in window)) {
      figs.forEach(function (f) { if (!f.hasAttribute("data-manual")) { f.classList.add("is-static", "is-done"); f.dispatchEvent(new CustomEvent("anim:static")); } });
      return;
    }
    var io = new IntersectionObserver(function (ents) {
      ents.forEach(function (en) { if (en.isIntersecting) { io.unobserve(en.target); play(en.target); } });
    }, { threshold: 0.45 });
    figs.forEach(function (f) { if (!f.hasAttribute("data-manual")) io.observe(f); });
  }

  /* ---------- steppers: infographics the reader moves through by clicking ----------
     <figure class="anim" data-steps="3" data-step-labels="לפני|מתקנים עם צל|מחליפים רקע"> … </figure>
     - nothing plays by itself; the figure starts on step 1 (data-step="1")
     - guide.js adds a row of numbered step buttons + prev/next under the stage (or uses the page's own
       elements that carry data-goto="N", e.g. clickable cards), plus ←/→ keys while the figure has focus
     - page CSS styles each state with  .anim[data-step="2"] …  ; JS-driven figures listen to "anim:step"
       (event.detail.step, event.detail.from) */
  function steppers() {
    $$(".anim[data-steps]").forEach(function (f) {
      var n = Math.max(2, Number(f.getAttribute("data-steps")) || 2);
      var labels = (f.getAttribute("data-step-labels") || "").split("|");
      f.setAttribute("data-manual", "");
      f.setAttribute("tabindex", "0");
      f.classList.add("is-stepper");
      var bar = doc.createElement("div"); bar.className = "stepper"; bar.setAttribute("role", "group"); bar.setAttribute("aria-label", "שלבי ההדגמה");
      var html = '<button type="button" class="stepper__nav" data-d="-1" aria-label="השלב הקודם">→</button><div class="stepper__list">';
      for (var i = 1; i <= n; i++) {
        html += '<button type="button" class="stepper__btn" data-goto="' + i + '"><span class="n">' + i + "</span>" + (labels[i - 1] ? '<span class="t">' + esc(labels[i - 1]) + "</span>" : "") + "</button>";
      }
      html += '</div><button type="button" class="stepper__nav" data-d="1" aria-label="השלב הבא">←</button>';
      bar.innerHTML = html;
      if (!f.hasAttribute("data-no-bar")) {
        var cap = f.querySelector(":scope > figcaption"); f.insertBefore(bar, cap || null);
      }
      var cur = 0;
      function go(k) {
        k = Math.min(n, Math.max(1, k)); if (k === cur) return;
        var from = cur; cur = k;
        f.setAttribute("data-step", String(k));
        $$("[data-goto]", f).forEach(function (b) {
          var on = Number(b.getAttribute("data-goto")) === k;
          b.classList.toggle("on", on); b.setAttribute("aria-pressed", String(on));
        });
        $$(".stepper__nav", f).forEach(function (b) { b.disabled = (b.getAttribute("data-d") === "-1" ? k === 1 : k === n); });
        f.dispatchEvent(new CustomEvent("anim:step", { detail: { step: k, from: from } }));
      }
      f.addEventListener("click", function (e) {
        var b = e.target.closest("[data-goto], .stepper__nav"); if (!b || !f.contains(b)) return;
        if (b.classList.contains("stepper__nav")) go(cur + Number(b.getAttribute("data-d")));
        else go(Number(b.getAttribute("data-goto")));
      });
      f.addEventListener("keydown", function (e) {
        if (e.target.closest("input,textarea,select")) return;
        if (e.key === "ArrowLeft") { e.preventDefault(); go(cur + 1); }      // RTL: left = forward
        else if (e.key === "ArrowRight") { e.preventDefault(); go(cur - 1); }
      });
      f.GUIDE_go = go;
      go(1);
    });
  }

  /* ---------- step rails: a vertical axis for step-by-step sections ----------
     <section class="sec" data-rail> <h2 id>…</h2> … <h3 id="a" data-rail-label="קצר">…</h3> … </section>
     Steps = the section's h3[id] (or any [data-rail-step][id]). Desktop: a sticky column beside the text that
     follows the reader and stops where the section ends. Phone: a sticky strip at the top of the section. */
  function rails() {
    $$("section.sec[data-rail]").forEach(function (sec) {
      var steps = $$("[data-rail-step][id]", sec);
      if (!steps.length) steps = $$(":scope > h3[id]", sec);
      if (steps.length < 2) return;
      var h2 = $(":scope > h2", sec);
      var grid = doc.createElement("div"); grid.className = "rail-grid";
      var body = doc.createElement("div"); body.className = "rail-body";
      var kids = Array.prototype.slice.call(sec.children).filter(function (el) { return el !== h2; });
      kids.forEach(function (el) { body.appendChild(el); });
      var rail = doc.createElement("nav"); rail.className = "rail"; rail.setAttribute("aria-label", "שלבים בקטע: " + (h2 ? h2.textContent.trim() : ""));
      rail.innerHTML = '<div class="rail__track" aria-hidden="true"><i></i></div><ol>' + steps.map(function (st, i) {
        var label = st.getAttribute("data-rail-label") || st.textContent.replace(/^\s*\d+[.)]\s*/, "").trim();
        return '<li><a href="#' + st.id + '"><span class="n">' + (i + 1) + '</span><span class="t">' + esc(label) + "</span></a></li>";
      }).join("") + "</ol>";
      if (steps.length > 9) rail.classList.add("is-long");
      grid.appendChild(body); grid.appendChild(rail);
      sec.appendChild(grid);
      sec.classList.add("has-rail");
      var links = $$("a", rail), fill = $(".rail__track i", rail);
      /* a clicked step stays lit until the reader scrolls on their own (short steps would otherwise
         hand the highlight to the next one) */
      var locked = -1;
      function unlock() { if (locked !== -1) { locked = -1; update(); } }
      ["wheel", "touchmove", "keydown"].forEach(function (ev) { addEventListener(ev, unlock, { passive: true }); });
      /* any link to one of the steps (the rail itself, slide tiles, links in the text) lights that step;
         a link to anywhere else lets go of the lock */
      doc.addEventListener("click", function (e) {
        var a = e.target.closest && e.target.closest('a[href^="#"]'); if (!a) return;
        var id = a.getAttribute("href").slice(1), i = -1;
        steps.forEach(function (st, k) { if (st.id === id) i = k; });
        if (i < 0) { if (locked !== -1) { locked = -1; requestAnimationFrame(update); } return; }
        var t = steps[i];
        if (rail.contains(a)) {
          e.preventDefault();
          t.scrollIntoView({ block: "start", behavior: reduce ? "auto" : "smooth" });
          history.replaceState(null, "", "#" + t.id);
        }
        locked = i; cur = -1; update();
        /* a long smooth scroll can stop short: when it ends, land exactly on the step */
        var settle = function () {
          removeEventListener("scrollend", settle);
          if (locked !== i) return;
          var want = parseFloat(getComputedStyle(t).scrollMarginTop) || 84;
          if (Math.abs(t.getBoundingClientRect().top - want) > 24) t.scrollIntoView({ block: "start", behavior: "instant" });
        };
        if ("onscrollend" in window) addEventListener("scrollend", settle);
      });
      var cur = -1;
      function update() {
        var line = innerHeight * 0.35, idx = 0;
        steps.forEach(function (st, i) { if (st.getBoundingClientRect().top <= line) idx = i; });
        if (locked !== -1) idx = locked;
        if (idx !== cur) {
          cur = idx;
          links.forEach(function (a, i) { a.classList.toggle("on", i === idx); a.classList.toggle("past", i < idx); if (i === idx) a.setAttribute("aria-current", "step"); else a.removeAttribute("aria-current"); });
          var on = links[idx]; if (on && rail.scrollWidth > rail.clientWidth) rail.scrollTo({ left: on.offsetLeft - rail.clientWidth / 2 + on.offsetWidth / 2, behavior: "auto" });
        }
        var r = body.getBoundingClientRect(), pr = Math.min(1, Math.max(0, (line - r.top) / Math.max(1, r.height)));
        fill.style.transform = "scaleY(" + pr + ")";
        fill.style.setProperty("--p", pr);
      }
      var tick = false;
      addEventListener("scroll", function () { if (!tick) { tick = true; requestAnimationFrame(function () { tick = false; update(); }); } }, { passive: true });
      addEventListener("resize", update);
      update();
    });
  }

  /* ---------- lightbox ---------- */
  function lightbox() {
    var links = $$("a[data-lb]"); if (!links.length) return;
    var lb = doc.createElement("div"); lb.className = "lightbox"; lb.setAttribute("role", "dialog"); lb.setAttribute("aria-label", "תמונה בגדול");
    lb.innerHTML = '<div><img alt=""><p></p></div>'; doc.body.appendChild(lb);
    links.forEach(function (a) {
      a.addEventListener("click", function (e) {
        e.preventDefault(); var img = a.querySelector("img");
        $("img", lb).src = a.href; $("img", lb).alt = img ? img.alt : ""; $("p", lb).textContent = a.getAttribute("data-cap") || (img ? img.alt : "");
        lb.classList.add("open");
      });
    });
    lb.addEventListener("click", function () { lb.classList.remove("open"); });
    doc.addEventListener("keydown", function (e) { if (e.key === "Escape") lb.classList.remove("open"); });
  }

  /* ---------- deep links: land on #section even while fonts/images still change the height ---------- */
  function jumpToHash() {
    var el; try { el = doc.getElementById(decodeURIComponent(location.hash.slice(1))); } catch (e) {}
    if (!el) return;
    var go = function () { el.scrollIntoView({ block: "start", behavior: "instant" }); };
    go();
    if (doc.fonts && doc.fonts.ready) doc.fonts.ready.then(go);
    addEventListener("load", function () { go(); setTimeout(go, 250); }, { once: true });
  }

  /* ---------- go ---------- */
  function init() {
    var tb = $("#g-theme"); if (tb) { tb.addEventListener("click", toggleTheme); setThemeIcon(); }
    if (params.get("review") === "1") root.classList.add("review");
    buildNav(); buildPager(); progress(); shortcut();
    $$(".g-search").forEach(wireSearch);
    rails(); steppers(); anims(); lightbox();
    var q = params.get("q"); if (q) highlight(q);
    else if (location.hash.length > 1) jumpToHash();
    // external links open in a new tab
    $$('#main a[href^="http"]').forEach(function (a) { if (!a.target) { a.target = "_blank"; a.rel = "noopener"; } });
  }
  if (doc.readyState === "loading") doc.addEventListener("DOMContentLoaded", init); else init();
})();
