/* Shared top bar for blog posts that are their own designed page (site-v2/blog/<slug>/).
   Put it as the FIRST thing inside <body>, as a plain (not deferred) script:
     <script src="../../assets/js/blog-nav.js?v=1"></script>
   and the stylesheet in <head>:
     <link rel="stylesheet" href="../../assets/css/blog-nav.css?v=1">
   It writes the site header (same links as post.html), a row with "→ לכל הפוסטים",
   and a theme switch (dark by default, light remembered as localStorage "theme").
   A page adds its own buttons to that row by marking them data-bn-action (e.g. a PDF download);
   data-bn-action="raw" moves an element in without restyling it (e.g. a search box).
   Options on the script tag: data-theme="off" hides the theme switch. */
(function () {
  var me = document.currentScript;
  if (!me) return;
  var root = new URL("../../", me.src).href; // .../assets/js/blog-nav.js → site root
  var doc = document, html = doc.documentElement;

  if (!doc.querySelector('link[href*="Karantina"]')) {
    var f = doc.createElement("link");
    f.rel = "stylesheet";
    f.href = "https://fonts.googleapis.com/css2?family=Karantina:wght@700&family=IBM+Plex+Sans+Hebrew:wght@300;400;500;600&family=IBM+Plex+Mono&display=swap";
    doc.head.appendChild(f);
  }

  var links = [
    ["index.html#work", "עבודות"],
    ["index.html#about", "אודות ושירותים"],
    ["blog.html", "בלוג", true],
    ["tools.html", "כלים"]
  ];
  var cur = ' aria-current="page"';
  var nav = links.map(function (l) { return '<a class="bn__link" href="' + root + l[0] + '"' + (l[2] ? cur : "") + ">" + l[1] + "</a>"; }).join("");
  var mob = links.concat([["index.html#contact", "דברו איתי"]]).map(function (l) { return '<li><a href="' + root + l[0] + '"' + (l[2] ? cur : "") + ">" + l[1] + "</a></li>"; }).join("");
  var themeOn = me.getAttribute("data-theme") !== "off";

  me.insertAdjacentHTML("afterend",
    '<div class="bn" id="bn">' +
      '<header class="bn__row bn__hdr">' +
        '<a class="bn__brand" href="' + root + 'index.html" aria-label="מישה קרץ\', לדף הבית"><span class="bn__he">מישה קרץ\'</span><span class="bn__en">MISHA GRAPHICS</span></a>' +
        '<nav class="bn__nav" aria-label="ראשי">' + nav +
          '<a class="bn__cta" href="' + root + 'index.html#contact">דברו איתי</a>' +
          '<button class="bn__menu" type="button" aria-expanded="false" aria-controls="bn-menu"><span class="bn__menu-lbl">תפריט</span><span class="bn__lines" aria-hidden="true"><i></i><i></i></span></button>' +
        "</nav>" +
      "</header>" +
      '<div class="bn__row bn__sub">' +
        '<a class="bn__back" href="' + root + 'blog.html"><span aria-hidden="true">→</span> לכל הפוסטים</a>' +
        '<div class="bn__acts">' + (themeOn ? '<button class="bn__theme" type="button"></button>' : "") + "</div>" +
      "</div>" +
    "</div>" +
    '<div class="bn-menu" id="bn-menu" aria-hidden="true"><nav aria-label="תפריט נייד"><ul>' + mob + "</ul></nav></div>"
  );

  var bar = doc.getElementById("bn");
  var acts = bar.querySelector(".bn__acts");
  var menu = doc.getElementById("bn-menu");
  var mbtn = bar.querySelector(".bn__menu");

  /* full width even when the page pads its <body> */
  var bs = getComputedStyle(doc.body);
  bar.style.marginLeft = "-" + bs.paddingLeft;
  bar.style.marginRight = "-" + bs.paddingRight;

  /* phone menu */
  function setMenu(open) {
    menu.classList.toggle("is-open", open);
    menu.setAttribute("aria-hidden", open ? "false" : "true");
    mbtn.setAttribute("aria-expanded", open ? "true" : "false");
    mbtn.querySelector(".bn__menu-lbl").textContent = open ? "סגירה" : "תפריט";
    html.classList.toggle("bn-locked", open);
    if (open) scrollTo(0, 0);
  }
  mbtn.addEventListener("click", function () { setMenu(mbtn.getAttribute("aria-expanded") !== "true"); });
  doc.addEventListener("keydown", function (e) { if (e.key === "Escape" && menu.classList.contains("is-open")) { setMenu(false); mbtn.focus(); } });
  menu.addEventListener("click", function (e) { if (e.target.closest("a")) setMenu(false); });

  /* theme: dark by default, light only when chosen */
  var tb = bar.querySelector(".bn__theme");
  function paint() {
    if (!tb) return;
    var light = html.getAttribute("data-theme") === "light";
    tb.innerHTML = light ? '<span aria-hidden="true">☾</span><span class="bn__tl"> מצב כהה</span>' : '<span aria-hidden="true">☀</span><span class="bn__tl"> מצב בהיר</span>';
    tb.setAttribute("aria-label", light ? "מעבר למצב כהה" : "מעבר למצב בהיר");
  }
  if (tb) tb.addEventListener("click", function () {
    var light = html.getAttribute("data-theme") !== "light";
    if (light) html.setAttribute("data-theme", "light"); else html.removeAttribute("data-theme");
    try { localStorage.setItem("theme", light ? "light" : "dark"); } catch (e) {}
    paint();
    doc.dispatchEvent(new CustomEvent("bn:theme", { detail: { light: light } }));
  });
  paint();

  /* the page's own buttons (data-bn-action) move into the row, before the theme switch */
  function adopt() {
    Array.prototype.forEach.call(doc.querySelectorAll("[data-bn-action]"), function (el) {
      if (bar.contains(el)) return;
      if (el.getAttribute("data-bn-action") !== "raw") el.classList.add("bn__act"); // "raw" keeps the page's own look
      el.hidden = false;
      acts.insertBefore(el, tb || null);
    });
  }
  if (doc.readyState === "loading") doc.addEventListener("DOMContentLoaded", adopt); else adopt();
})();
