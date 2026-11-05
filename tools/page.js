/* Shared behaviour for the designed pages under tools/: theme toggle, "back to tools", image viewer. */
(function () {
  var root = document.documentElement;

  /* theme: dark unless the visitor chose light (saved per visitor) */
  function paintToggle() {
    var light = root.getAttribute("data-theme") === "light";
    document.querySelectorAll(".tp-theme").forEach(function (b) {
      b.textContent = light ? "☾" : "☀";
      b.setAttribute("aria-label", light ? "מעבר למצב כהה" : "מעבר למצב בהיר");
    });
  }
  document.querySelectorAll(".tp-theme").forEach(function (b) {
    b.addEventListener("click", function () {
      var light = root.getAttribute("data-theme") === "light";
      if (light) root.removeAttribute("data-theme"); else root.setAttribute("data-theme", "light");
      try { localStorage.setItem("mg-theme", light ? "dark" : "light"); } catch (e) {}
      paintToggle();
    });
  });
  paintToggle();

  /* tool cards open in a new tab; "back" closes this tab when the visitor came from the site,
     otherwise (search, shared link) it goes to the tools page */
  document.querySelectorAll("[data-back]").forEach(function (a) {
    a.addEventListener("click", function (e) {
      var fromSite = false;
      try { fromSite = new URL(document.referrer).origin === location.origin; } catch (x) {}
      if (!fromSite) return;
      e.preventDefault();
      window.close();
      setTimeout(function () { location.href = a.href; }, 150);
    });
  });

  /* viewer: any [data-view="<full image url>"] opens it; click toggles fit / full size, drag pans */
  var triggers = document.querySelectorAll("[data-view]");
  if (!triggers.length) return;
  var v = document.createElement("div");
  v.className = "viewer";
  v.setAttribute("role", "dialog");
  v.setAttribute("aria-modal", "true");
  v.setAttribute("aria-label", "תצוגה מוגדלת");
  v.innerHTML =
    '<div class="viewer__bar"><button class="viewer__btn" type="button" data-close>✕ סגירה</button>' +
    '<a class="viewer__btn" data-dl download hidden>הורדת PDF ↓</a></div>' +
    '<div class="viewer__scroll" dir="ltr"><img alt=""></div>' + // ltr: keeps scroll positions simple to compute

    '<p class="viewer__hint">לחיצה על התמונה מגדילה לגודל מלא, ואז אפשר לגרור</p>';
  document.body.appendChild(v);
  var scroller = v.querySelector(".viewer__scroll"), img = v.querySelector("img"), dl = v.querySelector("[data-dl]");
  var hint = v.querySelector(".viewer__hint"), last = null, drag = null, moved = false;

  function open(t) {
    last = t;
    img.src = t.getAttribute("data-view");
    img.alt = t.getAttribute("data-alt") || "";
    var pdf = t.getAttribute("data-pdf");
    dl.hidden = !pdf;
    if (pdf) { dl.href = pdf; dl.setAttribute("download", t.getAttribute("data-pdf-name") || ""); }
    v.classList.remove("is-zoomed");
    hint.hidden = false;
    v.classList.add("is-open");
    document.body.style.overflow = "hidden";
    v.querySelector("[data-close]").focus();
  }
  function close() {
    v.classList.remove("is-open", "is-zoomed");
    document.body.style.overflow = "";
    img.removeAttribute("src");
    if (last) last.focus();
  }
  triggers.forEach(function (t) {
    t.addEventListener("click", function (e) { e.preventDefault(); open(t); });
  });
  v.querySelector("[data-close]").addEventListener("click", close);
  addEventListener("keydown", function (e) { if (e.key === "Escape" && v.classList.contains("is-open")) close(); });

  scroller.addEventListener("pointerdown", function (e) {
    moved = false;
    if (!v.classList.contains("is-zoomed")) return;
    drag = { x: e.clientX, y: e.clientY, l: scroller.scrollLeft, t: scroller.scrollTop };
  });
  addEventListener("pointermove", function (e) {
    if (!drag) return;
    var dx = e.clientX - drag.x, dy = e.clientY - drag.y;
    if (Math.abs(dx) + Math.abs(dy) > 4) moved = true;
    scroller.scrollLeft = drag.l - dx;
    scroller.scrollTop = drag.t - dy;
  });
  addEventListener("pointerup", function () { drag = null; });
  scroller.addEventListener("click", function (e) {
    if (moved) return;
    if (e.target !== img) { close(); return; }
    var r = img.getBoundingClientRect();
    var fx = (e.clientX - r.left) / r.width, fy = (e.clientY - r.top) / r.height;
    var z = v.classList.toggle("is-zoomed");
    hint.hidden = z;
    if (z) {
      // keep the clicked spot under the pointer
      scroller.scrollLeft = fx * img.offsetWidth - e.clientX;
      scroller.scrollTop = fy * img.offsetHeight - e.clientY;
    }
  });
})();
