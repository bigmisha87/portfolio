/* ==========================================================================
   Studio — a LIVE visual editor (think Wix, much simpler).
   • Left = the real site, rendered (the "canvas").
   • Click a tile / image / section → edit it in the right-hand panel.
   • Changes show on the canvas instantly. Click an image to upload one.
   • Press Save → writes everything back into your folder.
   Works in Chrome/Edge on a computer, opened over http://localhost.
   ========================================================================== */
(function () {
  "use strict";

  /* ---------- helpers ------------------------------------------------- */
  function esc(s) { return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;"); }
  function accentize(s) { return esc(s).replace(/\{\{\s*([^}]+?)\s*\}\}/g, '<span class="accent">$1</span>'); }
  // Rich-text: strip scripts/handlers on save; treat all-whitespace as empty.
  function cleanHTML(html) { html = String(html == null ? "" : html).replace(/<script[\s\S]*?<\/script>/gi, "").replace(/ on\w+="[^"]*"/gi, ""); return /^(?:<br\s*\/?>|<div><br\s*\/?><\/div>|&nbsp;|\s)*$/i.test(html) ? "" : html; }
  function el(id) { return document.getElementById(id); }
  function clone(o) { return JSON.parse(JSON.stringify(o)); }
  function getPath(o, p) { return p.split(".").reduce(function (a, k) { return a == null ? a : a[k]; }, o); }
  function setPath(o, p, v) { var ks = p.split("."), x = o; for (var i = 0; i < ks.length - 1; i++) x = x[ks[i]]; x[ks[ks.length - 1]] = v; }
  function uniqueSlug(base, taken) { base = base || "item"; var s = base, n = 1; while (taken.indexOf(s) >= 0) { s = base + "-" + n; n++; } return s; }
  function sanitizeName(name) { var d = name.lastIndexOf("."), stem = d > 0 ? name.slice(0, d) : name, ext = d > 0 ? name.slice(d) : ""; stem = stem.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "file"; return stem + ext.toLowerCase(); }
  var RATIO_LABEL = { "9 / 16": "9:16", "16 / 9": "16:9", "1 / 1": "1:1", "4 / 5": "4:5" };
  var RATIOS = ["9 / 16", "16 / 9", "1 / 1", "4 / 5"];
  function isHeb(s) { return /[֐-׿]/.test(s || ""); }
  // Mirror site.js: a migrated post stores the original Wix URL in `url`; the
  // real file lives locally as assets/img/blog/<mediaId>.<ext>. Resolve it so
  // the Studio shows the same image the live site does.
  function localImg(u) { if (!u) return ""; if (u.indexOf("assets/") === 0) return u; var m = u.match(/\/media\/([^~\/?]+)~mv2[^.?\/]*\.(\w+)/i); return m ? "assets/img/blog/" + m[1] + "." + m[2].toLowerCase() : u; }
  function blkImg(b) { return b.src || localImg(b.url) || ""; }
  function firstBodyImg(body) { var f = (body || []).filter(function (x) { return x.type === "img"; })[0]; return f ? blkImg(f) : ""; }
  function ytId(v) { var m = (v || "").match(/(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([\w-]{6,})/); return m ? m[1] : ""; }
  function ytThumb(v) { var id = ytId(v); return id ? "https://img.youtube.com/vi/" + id + "/hqdefault.jpg" : ""; }
  function ytThumbHi(v) { var id = ytId(v); return id ? "https://img.youtube.com/vi/" + id + "/maxresdefault.jpg" : ""; }
  // Card thumbnail markup: custom cover if set, else hi-res YT thumb with a
  // fall back to the standard one if maxres 404s.
  function studioThumb(w) {
    if (w.poster) return '<img src="' + esc(w.poster) + '" loading="lazy">';
    var hi = ytThumbHi(w.video), lo = ytThumb(w.video);
    if (hi) return '<img src="' + esc(hi) + '" loading="lazy"' +
                   ' onload="if(this.dataset.fb)return;if(this.naturalWidth<600){this.dataset.fb=1;this.src=\'' + esc(lo) + '\'}"' +
                   ' onerror="this.onerror=null;this.src=\'' + esc(lo) + '\'">';
    return w.video ? '<span class="play"></span>' : '<span class="ph">[ image ]</span>';
  }

  if (!window.SITE) { document.body.innerHTML = "<p style='padding:40px;color:#fff'>data.js did not load.</p>"; return; }
  var D = clone(window.SITE);
  var LAYOUT_DEFAULTS = { cardSize: 260, cardGap: 22, cardRowGap: 22, cardTitleSize: 16, clientHeadSize: 22, pageMargin: 48 };
  D.layout = Object.assign({}, LAYOUT_DEFAULTS, D.layout || {});

  /* ---------- File System Access (connect / save / upload) ----------- */
  var rootHandle = null, pendingHandle = null;
  var FS_SUPPORTED = !!window.showDirectoryPicker;

  function idb() { return new Promise(function (res, rej) { var r = indexedDB.open("mishaStudio", 1); r.onupgradeneeded = function () { r.result.createObjectStore("h"); }; r.onsuccess = function () { res(r.result); }; r.onerror = function () { rej(r.error); }; }); }
  function idbSet(k, v) { return idb().then(function (db) { return new Promise(function (res, rej) { var t = db.transaction("h", "readwrite"); t.objectStore("h").put(v, k); t.oncomplete = res; t.onerror = function () { rej(t.error); }; }); }); }
  function idbGet(k) { return idb().then(function (db) { return new Promise(function (res, rej) { var t = db.transaction("h", "readonly"); var q = t.objectStore("h").get(k); q.onsuccess = function () { res(q.result); }; q.onerror = function () { rej(q.error); }; }); }); }

  function markConnected() { var f = el("st-folder"); f.textContent = "folder connected ✓"; f.classList.add("is-on"); el("st-save").disabled = false; el("st-connect").textContent = "Connected"; }

  async function restore() {
    if (!FS_SUPPORTED) return;
    try { var h = await idbGet("root"); if (!h) return;
      var p = await h.queryPermission({ mode: "readwrite" });
      if (p === "granted") { rootHandle = h; markConnected(); }
      else { pendingHandle = h; el("st-connect").textContent = "Reconnect folder"; }
    } catch (e) {}
  }
  async function connect() {
    try {
      if (pendingHandle) { var pp = await pendingHandle.requestPermission({ mode: "readwrite" }); if (pp === "granted") { rootHandle = pendingHandle; pendingHandle = null; markConnected(); return; } }
      var h = await window.showDirectoryPicker({ mode: "readwrite" });
      var ok = true; try { await h.getFileHandle("index.html"); } catch (e) { ok = confirm("This folder has no index.html — use it anyway?"); }
      if (!ok) return;
      rootHandle = h; await idbSet("root", h); markConnected(); status("Folder connected — you can Save and upload now.", "ok");
    } catch (e) { if (e && e.name !== "AbortError") status("Couldn't connect: " + e.message, "err"); }
  }
  async function ensure() {
    if (!rootHandle) throw new Error('click "Connect folder" first');
    var p = await rootHandle.queryPermission({ mode: "readwrite" });
    if (p !== "granted") p = await rootHandle.requestPermission({ mode: "readwrite" });
    if (p !== "granted") throw new Error("folder permission denied");
  }
  async function fileHandle(path, create) { var parts = path.split("/").filter(Boolean), dir = rootHandle; for (var i = 0; i < parts.length - 1; i++) dir = await dir.getDirectoryHandle(parts[i], { create: create }); return dir.getFileHandle(parts[parts.length - 1], { create: create }); }
  async function pathExists(path) { try { await fileHandle(path, false); return true; } catch (e) { return false; } }
  async function writeFile(path, data) { var fh = await fileHandle(path, true); var w = await fh.createWritable(); await w.write(data); await w.close(); }
  async function uploadFile(file) {
    await ensure();
    var base = sanitizeName(file.name), name = base, n = 1, d = base.lastIndexOf("."), stem = d > 0 ? base.slice(0, d) : base, ext = d > 0 ? base.slice(d) : "";
    while (await pathExists("assets/img/" + name)) { name = stem + "-" + n + ext; n++; }
    await writeFile("assets/img/" + name, file); return "assets/img/" + name;
  }
  async function save() {
    try { await ensure();
      await writeFile("assets/js/data.js", "/* Generated by the Studio (studio.html). Hand-editing still works. */\nwindow.SITE = " + JSON.stringify(D, null, 2) + ";\n");
      status("Saved ✓  —  refresh the site to see it live", "ok");
    } catch (e) { status("Could not save: " + e.message, "err"); }
  }
  var statusTimer;
  function status(msg, kind) { var s = el("st-status"); s.textContent = msg; s.className = "st-status " + (kind || ""); s.hidden = false; clearTimeout(statusTimer); statusTimer = setTimeout(function () { s.hidden = true; }, 4200); }

  /* hidden file picker */
  var fileInput = document.createElement("input"); fileInput.type = "file"; fileInput.style.display = "none"; document.body.appendChild(fileInput);
  var uploadTarget = null;
  function startUpload(path, kind) {
    if (!rootHandle) { status('Click "Connect folder" (top-right) first, then upload.', "err"); return; }
    uploadTarget = path; fileInput.accept = kind === "video" ? "video/*" : "image/*"; fileInput.value = ""; fileInput.click();
  }
  fileInput.addEventListener("change", async function () {
    var file = fileInput.files[0]; if (!file || !uploadTarget) return;
    var target = uploadTarget; uploadTarget = null;
    try { status("Uploading " + file.name + "…"); var path = await uploadFile(file); setPath(D, target, path); if (fullEdit) { renderPostEdit(); } else { renderCanvas(); renderInspector(); } status("Added " + path, "ok"); History.commit(); }
    catch (e) { status("Upload failed: " + e.message, "err"); }
  });

  /* ---------- inspector field builders -------------------------------- */
  function field(label, path, value, o) {
    o = o || {}; var dir = o.rtl ? ' dir="rtl"' : "", ph = o.placeholder ? ' placeholder="' + esc(o.placeholder) + '"' : "", inner;
    if (o.select) inner = '<select data-path="' + path + '">' + o.select.map(function (x) { return "<option" + (x === value ? " selected" : "") + ">" + esc(x) + "</option>"; }).join("") + "</select>";
    else if (o.textarea) inner = '<textarea data-path="' + path + '"' + dir + ph + ">" + esc(value || "") + "</textarea>";
    else {
      var attrs = o.list ? ' data-type="list"' : "", dl = "";
      // datalist: a dropdown of existing values that still lets you type a new one
      if (o.datalist && o.datalist.length) {
        var dlId = "dl-" + path.replace(/[^a-z0-9]+/gi, "-");
        attrs += ' list="' + dlId + '"';
        dl = '<datalist id="' + dlId + '">' + o.datalist.map(function (x) { return '<option value="' + esc(x) + '"></option>'; }).join("") + "</datalist>";
      }
      inner = '<input data-path="' + path + '"' + attrs + dir + ph + ' value="' + esc(value == null ? "" : value) + '">' + dl;
    }
    return '<div class="st-field"><label>' + esc(label) + "</label>" + inner + "</div>";
  }
  function listField(label, path, arr, o) { o = o || {}; o.list = true; return field(label, path, (arr || []).join(", "), o); }
  function rangeField(label, path, value, min, max, step) {
    return '<div class="st-field st-field--range"><label>' + esc(label) +
      ' <span class="st-rangeval" data-for="' + esc(path) + '">' + esc(value) + 'px</span></label>' +
      '<input type="range" data-path="' + path + '" data-type="num" min="' + min + '" max="' + max + '" step="' + (step || 1) + '" value="' + esc(value) + '"></div>';
  }
  function mediaField(label, path, value, kind) {
    var isImg = kind !== "video";
    var yt = isImg ? "" : ytThumb(value);
    var thumb = value ? (isImg ? '<img src="' + esc(value) + '">' : (yt ? '<img src="' + esc(yt) + '">' : "video ✓")) : "none";
    var ph = isImg ? "assets/img/…" : "Paste a YouTube / Vimeo link";
    return '<div class="st-field"><label>' + esc(label) + '</label><div class="st-media"><div class="st-thumb">' + thumb + "</div>" +
      '<div class="st-media__col"><div style="display:flex;gap:8px;flex-wrap:wrap">' +
      '<button class="st-mini" data-upload="' + path + '" data-kind="' + (isImg ? "image" : "video") + '">Upload ' + (isImg ? "image" : "video") + "</button>" +
      (value ? '<button class="st-mini st-mini--danger" data-clear="' + path + '">Remove</button>' : "") + "</div>" +
      '<input data-path="' + path + '" value="' + esc(value || "") + '" placeholder="' + ph + '">' +
      '<span class="st-hint">' + (isImg ? "Upload a JPG/PNG/WebP, or paste a path." : "Paste a YouTube/Vimeo link, or upload a file.") + "</span></div></div></div>";
  }

  /* ---------- canvas item markup ------------------------------------- */
  var selected = null;
  function isSel(k, l) { return selected && selected.kind === k && String(selected.loc) === String(l); }
  function selCls(k, l) { return isSel(k, l) ? " is-sel" : ""; }
  function bar() { return '<div class="cv-bar">' +
    '<button data-act="first" title="Move to first"><span class="cvb-edge cvb-edge--top">↑</span></button>' +
    '<button data-act="up" title="Move up">↑</button>' +
    '<button data-act="down" title="Move down">↓</button>' +
    '<button data-act="last" title="Move to last"><span class="cvb-edge cvb-edge--bot">↓</span></button>' +
    '<button data-act="del" title="Delete">✕</button></div>'; }
  function ov(t) { return '<span class="imgedit__ov">' + esc(t) + "</span>"; }
  // Hover pencil (top-right) — the only thing that opens the file picker now.
  function editBtn(path, kind) { return '<button class="cv-edit" data-upload="' + esc(path) + '" data-kind="' + (kind || "image") + '" title="Change image">✎</button>'; }

  function catCard(c, i) {
    return '<div class="cat-card cv-item cv-catcard' + selCls("category", i) + '" data-kind="category" data-loc="' + i + '" data-entercat="' + esc(c.slug) + '">' + bar() +
      '<button class="cv-pencil" data-act="edit-cat" title="Edit discipline details">✎</button>' +
      '<div class="cat-card__media imgedit">' +
      (c.image ? '<img src="' + esc(c.image) + '">' : '<span class="ph">[ thumbnail ]</span>') + editBtn("categories." + i + ".image", "image") + '<span class="cv-enter">Open →</span>' + "</div>" +
      '<div class="cat-card__row"><span class="cat-card__name">' + esc(c.name || "Untitled") + "</span></div>" +
      '<div class="cat-card__kind">' + esc(c.kind || "") + "</div></div>";
  }
  function workTile(w, slug, i) {
    var img = studioThumb(w);
    return '<div class="work cv-item' + selCls("work", slug + "." + i) + '" data-kind="work" data-loc="' + slug + "." + i + '">' +
      '<span class="cv-drag" draggable="true" title="Drag to reorder">⠿</span>' + bar() +
      '<div class="work__frame" style="aspect-ratio:' + esc(w.ratio || "4 / 5") + '"><div class="work__media">' +
      img + (w.poster && w.video ? '<span class="play play--over"></span>' : "") + "</div></div>" +
      '<div class="work__row"><span class="work__title">' + esc(w.en || "Untitled") + "</span></div>" +
      '<div class="work__client">' + esc(w.client || "") + "</div></div>";
  }
  function postCard(p, i) {
    var cover = p.cover || firstBodyImg(p.body);
    return '<div class="post cv-item' + selCls("post", i) + '" data-kind="post" data-loc="' + i + '" data-openpost="' + i + '">' +
      '<span class="cv-drag" draggable="true" title="Drag to reorder">⠿</span>' + bar() +
      '<div class="post__cover imgedit">' +
      (cover ? '<img src="' + esc(cover) + '">' : "[ cover image ]") + ov(cover ? "Cover" : "No cover") + editBtn("posts." + i + ".cover", "image") + "</div>" +
      '<div class="post__tag">' + esc(p.tag || "") + "</div>" +
      '<div class="post__title" dir="auto">' + esc(p.t || "") + "</div>" +
      '<div class="post__excerpt" dir="auto">' + esc(p.excerpt || "") + "</div>" +
      '<div class="post__meta"><span class="post__date">' + esc(p.d || "") + "</span></div></div>";
  }
  function brandCard(b, i) {
    return '<div class="cv-brand cv-item' + selCls("brand", i) + '" data-kind="brand" data-loc="' + i + '">' + bar() +
      '<div class="cv-brand__logo imgedit">' + (b.logo ? '<img src="' + esc(b.logo) + '">' : "logo") + ov("Logo") + editBtn("brands." + i + ".logo", "image") + "</div>" +
      '<div class="cv-brand__name">' + esc(b.name || "Brand") + "</div>" +
      '<div class="cv-brand__intro">' + esc(b.intro || "") + "</div></div>";
  }

  /* ---------- live layout (Design tab) -------------------------------- */
  // Push D.layout sizes onto the page as CSS variables, so the canvas preview
  // (which uses the real .work / .cat-grid / .client-group classes) updates
  // instantly while a slider is dragged. Mirrors applyLayout() in site.js.
  function applyLayoutVars() {
    var L = D.layout || {}, r = document.documentElement.style;
    r.setProperty("--card-size", (L.cardSize != null ? L.cardSize : 260) + "px");
    r.setProperty("--card-gap", (L.cardGap != null ? L.cardGap : 22) + "px");
    r.setProperty("--card-row-gap", (L.cardRowGap != null ? L.cardRowGap : 22) + "px");
    r.setProperty("--card-title-size", (L.cardTitleSize != null ? L.cardTitleSize : 16) + "px");
    r.setProperty("--client-head-size", (L.clientHeadSize != null ? L.clientHeadSize : 22) + "px");
    r.setProperty("--gallery-pad-x", (L.pageMargin != null ? L.pageMargin : 48) + "px");
  }
  // Pinterest-style masonry for the canvas gallery (mirrors gallery.js on the
  // live site; the Studio doesn't load gallery.js, so it has its own copy).
  function studioMasonry() {
    // Title heights grow when the web font finishes loading — re-pack once then,
    // so the grid's computed height covers every card (and you can scroll to the
    // bottom ones).
    if (document.fonts && document.fonts.status !== "loaded" && !studioMasonry._fontHook) {
      studioMasonry._fontHook = true;
      document.fonts.ready.then(studioMasonry);
    }
    [].forEach.call(document.querySelectorAll("#canvas .cat-grid"), function (grid) {
      var items = [].filter.call(grid.children, function (c) { return c.matches && c.matches(".work, .cv-add"); });
      if (!items.length) { grid.style.height = ""; return; }
      var rs = getComputedStyle(document.documentElement);
      var gapX = parseFloat(rs.getPropertyValue("--card-gap")) || 22;
      var gapY = parseFloat(rs.getPropertyValue("--card-row-gap")) || 22;
      var colW = parseFloat(rs.getPropertyValue("--card-size")) || 260;
      var W = grid.clientWidth; if (!W) return;
      var cols = Math.max(1, Math.floor((W + gapX) / (colW + gapX)));
      var aw = (W - (cols - 1) * gapX) / cols;
      grid.style.position = "relative";
      items.forEach(function (c) { c.style.position = "absolute"; c.style.width = aw + "px"; });
      var heights = []; for (var i = 0; i < cols; i++) heights.push(0);
      items.forEach(function (c) {
        var h = c.offsetHeight, m = 0;
        for (var j = 1; j < cols; j++) if (heights[j] < heights[m]) m = j;
        c.style.left = (m * (aw + gapX)) + "px"; c.style.top = heights[m] + "px";
        heights[m] += h + gapY;
      });
      var max = 0; heights.forEach(function (h) { if (h > max) max = h; });
      grid.style.height = (max > 0 ? max - gapY : 0) + "px";
    });
    // Native galleries inside the page editor — column-count masonry (order-preserving).
    [].forEach.call(document.querySelectorAll("#canvas .pg-gallery--masonry"), function (gal) {
      var cols = Math.max(1, parseInt(gal.style.getPropertyValue("--cols"), 10) || 3);
      var gap = parseInt(gal.style.getPropertyValue("--gap"), 10) || 8;
      var its = [].slice.call(gal.children);
      if (!its.length) { gal.style.height = ""; return; }
      var W = gal.clientWidth; if (!W) return;
      var colW = (W - (cols - 1) * gap) / cols, i, j;
      var gh = []; for (i = 0; i < cols; i++) gh.push(0);
      its.forEach(function (it) {
        var ratio, img = it.querySelector("img");
        if (img && img.naturalWidth > 0) ratio = img.naturalWidth / img.naturalHeight;
        else { var a = (it.getAttribute("data-ar") || "1 / 1").split("/"); ratio = (parseFloat(a[0]) || 1) / (parseFloat(a[1]) || 1); }
        var ih = colW / (ratio || 1), m = 0;
        for (j = 1; j < cols; j++) if (gh[j] < gh[m]) m = j;
        it.style.position = "absolute"; it.style.width = colW + "px"; it.style.height = ih + "px";
        it.style.left = (m * (colW + gap)) + "px"; it.style.top = gh[m] + "px";
        gh[m] += ih + gap;
      });
      var gmax = 0; gh.forEach(function (x) { if (x > gmax) gmax = x; });
      gal.style.height = (gmax > 0 ? gmax - gap : 0) + "px";
      [].forEach.call(gal.querySelectorAll("img"), function (img) { if (!img.complete && !img.__mh) { img.__mh = 1; img.addEventListener("load", function () { clearTimeout(studioMasonry._gz); studioMasonry._gz = setTimeout(studioMasonry, 60); }, { once: true }); } });
    });
  }
  function previewTile(w) {
    var img = studioThumb(w);
    return '<div class="work"><div class="work__frame" style="aspect-ratio:' + esc(w.ratio || "4 / 5") + '"><div class="work__media">' +
      img + '</div></div><div class="work__row"><span class="work__title" dir="auto">' + esc(w.en || "Untitled") + "</span></div>" +
      (w.client ? '<div class="work__client" dir="auto">' + esc(w.client) + "</div>" : "") + "</div>";
  }
  function renderDesignCanvas() {
    var cat = D.categories.filter(function (c) { return (D.works[c.slug] || []).length; })[0];
    var list = cat ? D.works[cat.slug].slice(0, 8) : [];
    var sampleClient = (list[0] && list[0].client) || (cat && cat.name) || "Client";
    var tiles = list.length
      ? list.map(previewTile).join("")
      : '<div class="work"><div class="work__frame"></div><div class="work__row"><span class="work__title">Sample card</span></div></div>';
    return '<div class="cv-hint">Design — drag the sliders on the right. This is a live preview of your real cards, spacing and section headings.</div>' +
      '<div class="client-groups"><div>' +
        '<div class="client-group__head"><span class="client-group__rule"></span>' +
          '<span class="client-group__name" dir="auto">' + esc(sampleClient) + '</span>' +
          '<span class="client-group__count">' + list.length + ' pieces</span>' +
          '<span class="client-group__rule"></span></div>' +
        '<div class="cat-grid">' + tiles + '</div>' +
      '</div></div>';
  }
  // Sub-category filter chips on the Work canvas — mirror the live site so you
  // can preview/focus one group while editing. Reuses the site's .subfilter style.
  function workFilterChips(subs) {
    var chips = [{ k: "__all__", l: "All" }].concat(subs.map(function (s) { return { k: s, l: s }; }));
    return '<div class="subfilter cv-subfilter">' + chips.map(function (c) {
      return '<button class="' + (workSub === c.k ? "is-on" : "") + '" data-worksub="' + esc(c.k) + '" dir="auto">' + esc(c.l) + '</button>';
    }).join("") + '</div>';
  }

  /* ---------- Pages (projects): grid cards + drill-in block editor ----- */
  function pageFirstImg(w) {
    var b = (w.body || []).filter(function (x) { return x.type === "image"; })[0];
    if (!b) { var g = (w.body || []).filter(function (x) { return x.type === "gallery"; })[0]; b = g && g.items && g.items[0]; }
    return w.cover || (b && (b.src || b.poster || ytThumb(b.video))) || "";
  }
  function pageCardStudio(w, slug, i) {
    var cover = pageFirstImg(w), loc = slug + "." + i;
    return '<div class="work cv-item cv-page' + selCls("page", loc) + '" data-kind="page" data-loc="' + loc + '" data-openpage="' + esc(loc) + '">' +
      bar() + '<button class="cv-pencil" data-act="edit-page" title="Edit page details">✎</button>' +
      '<div class="work__frame imgedit" style="aspect-ratio:4 / 3"><div class="work__media">' +
      (cover ? '<img src="' + esc(cover) + '">' : '<span class="ph">[ cover ]</span>') +
      '<span class="cv-enter">Open →</span>' + editBtn("works." + slug + "." + i + ".cover", "image") + '</div></div>' +
      '<div class="work__row"><span class="work__title">' + esc(w.title || "Untitled page") + '</span></div>' +
      '<div class="work__client">' + ((w.body || []).length) + ' blocks</div></div>';
  }
  function curPageItem() { var l = D.works[workCat]; return (openPage != null && l && l[openPage] && l[openPage].type === "page") ? l[openPage] : null; }
  function pageBlockCard(b, j) {
    var inner;
    if (b.type === "text") inner = '<div class="cv-blk__text"><b dir="auto">' + esc(b.heading || "") + '</b><div dir="auto">' + esc((b.text || "").slice(0, 140)) + '</div></div>';
    else if (b.type === "video") inner = '<div class="cv-blk__media"><span class="play"></span>' + (ytThumb(b.url) ? '<img src="' + esc(ytThumb(b.url)) + '">' : "") + '</div>';
    else if (b.type === "gallery") inner = '<div class="cv-blk__gal">' + (b.items || []).slice(0, 8).map(function (im) { return '<img src="' + esc(im.thumb || im.src || "") + '">'; }).join("") + '</div>';
    else inner = '<div class="cv-blk__media imgedit">' + ((b.thumb || b.src) ? '<img src="' + esc(b.thumb || b.src) + '">' : '<span class="ph">[ image ]</span>') + editBtn("works." + workCat + "." + openPage + ".body." + j + ".src", "image") + '</div>';
    return '<div class="cv-item cv-blk' + selCls("block", j) + '" data-kind="block" data-loc="' + j + '">' + bar() +
      '<div class="cv-blk__type">' + esc(({ image: "Image", text: "Text", gallery: "Gallery", video: "Video" })[b.type] || b.type) + '</div>' + inner + '</div>';
  }
  // WYSIWYG block — renders exactly like the live page (same pg-* classes),
  // with a hover toolbar + image pencil for editing.
  function blkTools() { return '<div class="pg-blk__tools"><button data-act="up" title="Move up">↑</button><button data-act="down" title="Move down">↓</button><button data-act="del" title="Delete">✕</button></div>'; }
  // A contenteditable rich-text element (title or paragraph) for inline editing.
  function editableHTML(tag, cls, path, html, b, ph) {
    b = b || {};
    var dir = (b.dir && b.dir !== "auto") ? b.dir : "auto";
    var st = (b.align ? "text-align:" + b.align + ";" : "") + (b.size ? "font-size:" + b.size + "px;" : "") + (b.bold ? "font-weight:700;" : "") + (b.italic ? "font-style:italic;" : "") + (b.underline ? "text-decoration:underline;" : "") + (b.color ? "color:" + b.color + ";" : "");
    return '<' + tag + ' class="' + cls + ' pg-edit" dir="' + dir + '" contenteditable="true" spellcheck="false" data-edit="' + esc(path) + '" data-ph="' + esc(ph || "") + '"' + (st ? ' style="' + st + '"' : '') + '>' + (html || "") + '</' + tag + '>';
  }
  // Behance-style insert zone shown in the gap above a block (hover → menu).
  function insZone(k) {
    var t = [["heading", "Title"], ["text", "Text"], ["image", "Image"], ["gallery", "Gallery"], ["video", "Video"]];
    return '<div class="pg-ins"><span class="pg-ins__line"></span><div class="pg-ins__menu">' +
      t.map(function (x) { return '<button data-insat="' + k + '" data-instype="' + x[0] + '">+ ' + x[1] + '</button>'; }).join("") +
      '</div></div>';
  }
  function pageBlockWysiwyg(b, j) {
    var base = "works." + workCat + "." + openPage + ".body." + j, sel = selCls("block", j);
    var tools = blkTools();
    var inner;
    if (b.type === "heading") inner = '<div class="pg-text">' + editableHTML("h3", "pg-text__h", base + ".text", b.text || b.heading || "", b, "Title — click to edit") + '</div>';
    else if (b.type === "text") inner = '<div class="pg-text">' + editableHTML("p", "pg-text__p", base + ".text", b.text || "", b, "Text — click to edit") + '</div>';
    else if (b.type === "video") inner = '<div class="pg-video">' + (ytThumb(b.url) ? '<img src="' + esc(ytThumb(b.url)) + '">' : '<span class="play"></span>') + '</div>';
    else if (b.type === "gallery") inner = galleryPreview(b, base);
    else inner = '<div class="pg-img imgedit" style="aspect-ratio:' + esc(b.ratio || "4 / 3") + '">' + ((b.src || b.thumb) ? '<img src="' + esc(b.src || b.thumb) + '">' : '<span class="ph">[ image ]</span>') + editBtn(base + ".src", "image") + '</div>';
    return '<div class="pg-blk cv-item' + sel + '" data-kind="block" data-loc="' + j + '">' + insZone(j) + inner + tools + '</div>';
  }
  // Mixed-media gallery preview in the editor — mirrors the live .pg-gallery,
  // each cell with its own image/video edit pencil.
  function galleryPreview(b, base) {
    var items = b.items || [];
    if (!items.length) return '<div class="pg-gallery-empty">Empty gallery — add images or video on the right →</div>';
    var mode = b.mode === "uniform" ? "uniform" : "native";
    var cols = Math.max(1, parseInt(b.cols, 10) || 3), gap = (b.gap != null ? b.gap : 8);
    var vars = '--cols:' + cols + ';--gap:' + gap + 'px;' + (mode === "uniform" ? '--ar:' + (b.ratio || "1 / 1") + ';' : '');
    var cls = mode === "uniform" ? "pg-gallery--uniform" : "pg-gallery--masonry";
    return '<div class="pg-gallery ' + cls + '" style="' + vars + '">' + items.map(function (it, k) {
      var isVid = it.type === "video" || !!it.video, pic = isVid ? (it.poster || ytThumb(it.video)) : (it.src || it.thumb);
      var media = pic ? '<img src="' + esc(pic) + '">' : '<span class="ph">[ ' + (isVid ? 'video' : 'image') + ' ]</span>';
      var path = base + ".items." + k + (isVid ? ".video" : ".src");
      return '<div class="pg-gmedia imgedit' + (isVid ? ' pg-gmedia--vid' : '') + '" data-ar="' + esc(it.ratio || "1 / 1") + '">' + media + (isVid ? '<span class="pg-play"></span>' : '') + editBtn(path, isVid ? "video" : "image") + '</div>';
    }).join("") + '</div>';
  }
  function renderPageEditor(slug, i) {
    var w = D.works[slug][i], blocks = w.body || [], sw = w.stackWidth || 1100;
    var catName = (D.categories.filter(function (c) { return c.slug === slug; })[0] || {}).name || "work";
    var view = w.view === "grid" ? "grid" : "stack", base = "works." + slug + "." + i, body;
    if (!blocks.length) body = '<p class="cv-hint">No blocks yet — add one below.</p>';
    else if (view === "grid") {
      var gm = w.gridMode === "uniform" ? "uniform" : "native", cols = Math.max(1, parseInt(w.gridCols, 10) || 3), gap = (w.gridGap != null ? w.gridGap : 8);
      var vars = '--cols:' + cols + ';--gap:' + gap + 'px;' + (gm === "uniform" ? '--ar:' + (w.gridRatio || "1 / 1") + ';' : '');
      body = '<div class="pg-gallery pg-gallery--' + gm + '" style="' + vars + '">' + pageGridCells(w, base) + '</div>';
    } else {
      body = '<div class="pg-stack" style="max-width:' + sw + 'px">' + blocks.map(pageBlockWysiwyg).join("") + '</div>';
    }
    var hint = view === "grid" ? ' — grid preview · click a tile to edit · reorder &amp; add in Stacked' : ' — final look · click a block to edit · ↑↓ to reorder';
    return '<div class="cv-hint"><button class="cv-back" data-act="close-page">← ' + esc(catName) + '</button>&nbsp; <b>' + esc(w.title || "Untitled") + '</b>' + hint + '.</div>' +
      '<div class="cv-pagewrap">' + body + '</div>' +
      '<div class="cv-addblk">' +
        '<button data-act="pgadd-heading">+ Title</button>' +
        '<button data-act="pgadd-text">+ Text</button>' +
        '<button data-act="pgadd-image">+ Image</button>' +
        '<button data-act="pgadd-gallery">+ Gallery</button>' +
        '<button data-act="pgadd-video">+ Video</button>' +
      '</div>';
  }
  // Flatten a page into grid cells for the editor's Grid preview. Media cells
  // map to their source block (click to select); titles/text span full width.
  function pageGridCells(w, base) {
    return (w.body || []).map(function (b, j) {
      var bbase = base + ".body." + j, sel = selCls("block", j);
      if (b.type === "heading" || b.type === "text") {
        var t = b.type === "heading"
          ? editableHTML("h3", "pg-text__h", bbase + ".text", b.text || b.heading || "", b, "Title — click to edit")
          : editableHTML("p", "pg-text__p", bbase + ".text", b.text || "", b, "Text — click to edit");
        return '<div class="pg-gspan cv-item' + sel + '" data-kind="block" data-loc="' + j + '">' + t + gridTools(j) + '</div>';
      }
      if (b.type === "gallery") return (b.items || []).map(function (it, k) {
        var isVid = it.type === "video" || !!it.video, pic = isVid ? (it.poster || ytThumb(it.video)) : (it.src || it.thumb);
        return '<div class="pg-gmedia imgedit' + (isVid ? ' pg-gmedia--vid' : '') + ' cv-item' + sel + '" data-kind="block" data-loc="' + j + '" data-gitem="' + k + '">' + (pic ? '<img src="' + esc(pic) + '">' : '<span class="ph">[ ' + (isVid ? 'video' : 'image') + ' ]</span>') + (isVid ? '<span class="pg-play"></span>' : '') + editBtn(bbase + ".items." + k + (isVid ? ".video" : ".src"), isVid ? "video" : "image") + gridTools(j, k) + '</div>';
      }).join("");
      if (b.type === "video") return '<div class="pg-gmedia pg-gmedia--vid cv-item' + sel + '" data-kind="block" data-loc="' + j + '">' + (ytThumb(b.url) ? '<img src="' + esc(ytThumb(b.url)) + '">' : '') + '<span class="pg-play"></span>' + editBtn(bbase + ".url", "video") + gridTools(j) + '</div>';
      return '<div class="pg-gmedia imgedit cv-item' + sel + '" data-kind="block" data-loc="' + j + '">' + ((b.src || b.thumb) ? '<img src="' + esc(b.src || b.thumb) + '">' : '<span class="ph">[ image ]</span>') + editBtn(bbase + ".src", "image") + gridTools(j) + '</div>';
    }).join("");
  }
  // Per-tile tools in Grid view: drag handle + delete (works on blocks and on
  // individual gallery items).
  function gridTools(j, k) {
    var d = ' data-gloc="' + j + '"' + (k != null ? ' data-gitem="' + k + '"' : '');
    return '<div class="pg-gtools"><span class="pg-gdrag" draggable="true"' + d + ' title="Drag to reorder">⠿</span><button class="pg-gdel"' + d + ' title="Delete">✕</button></div>';
  }
  function gridDelete(j, k) {
    var w = curPageItem(); if (!w || !w.body) return;
    if (k != null) { var g = w.body[j]; if (g && g.items) g.items.splice(k, 1); }
    else w.body.splice(j, 1);
    selected = null; renderCanvas(); renderInspector();
  }
  function gridReorder(src, dst) {
    var w = curPageItem(); if (!w || !w.body) return;
    if (src.k != null && dst.k != null && src.j === dst.j) {        // reorder inside one gallery
      var g = w.body[src.j]; if (!g || !g.items || src.k === dst.k) return;
      g.items.splice(dst.k, 0, g.items.splice(src.k, 1)[0]);
    } else if (src.k == null && dst.k == null) {                    // reorder top-level blocks
      if (src.j === dst.j) return;
      w.body.splice(dst.j, 0, w.body.splice(src.j, 1)[0]);
    }
  }
  function inspPage(loc) { var sl = loc.split(".")[0], i = +loc.split(".")[1], w = (D.works[sl] || [])[i]; if (!w) return "";
    return head("Project page", sl) +
      field("Title", "works." + sl + "." + i + ".title", w.title) +
      field("Title (Hebrew)", "works." + sl + "." + i + ".he", w.he, { rtl: true }) +
      field("Small label", "works." + sl + "." + i + ".kind", w.kind) +
      mediaField("Cover (optional — else first image)", "works." + sl + "." + i + ".cover", w.cover, "image") +
      '<p class="st-hint">Click the card on the left to open the page and edit its media, text and galleries.</p>'; }
  function inspGallerySettings(b, base) {
    var mode = b.mode === "uniform" ? "uniform" : "native";
    var h = '<div class="st-subhead">Gallery layout</div>' +
      '<div class="st-viewtoggle">' +
        '<button class="' + (mode === "native" ? "is-on" : "") + '" data-setgmode="native">Native · keeps sizes</button>' +
        '<button class="' + (mode === "uniform" ? "is-on" : "") + '" data-setgmode="uniform">Uniform · crop</button>' +
      '</div>';
    if (mode === "uniform") h += field("Crop ratio", base + ".ratio", b.ratio || "1 / 1", { select: RATIOS });
    h += field("Columns", base + ".cols", String(b.cols || 3), { select: ["1", "2", "3", "4", "5", "6"] });
    h += rangeField("Gutter", base + ".gap", (b.gap != null ? b.gap : 8), 0, 40, 1);
    return h;
  }
  function inspGalleryItems(b, base) {
    b.items = b.items || [];
    var rows = b.items.map(function (im, k) {
      var isVid = im.type === "video" || !!im.video;
      return '<div class="st-galrow">' +
        mediaField((isVid ? "Video " : "Image ") + (k + 1), base + ".items." + k + (isVid ? ".video" : ".src"), isVid ? im.video : im.src, isVid ? "video" : "image") +
        '<button class="st-mini st-mini--danger" data-galdel="' + k + '">Remove ' + (k + 1) + '</button></div>';
    }).join("");
    return '<div class="st-subhead">Items</div>' + rows +
      '<div class="st-addblk"><button data-galadd="image">+ Add image</button><button data-galadd="video">+ Add video</button></div>';
  }
  function curTextBlock() {
    if (!selected) return null;
    if (selected.kind === "block") { var w = curPageItem(); return w && w.body ? w.body[+selected.loc] : null; }
    if (selected.kind === "postblock") { var p = D.posts[openPost]; return p && p.body ? p.body[+selected.loc] : null; }
    return null;
  }
  function textSettings(base, b) {
    var align = b.align || "", dir = b.dir || "auto";
    var alignBtns = [["", "Auto"], ["left", "Left"], ["center", "Center"], ["right", "Right"]].map(function (o) {
      return '<button class="' + (align === o[0] ? "is-on" : "") + '" data-setalign="' + o[0] + '">' + o[1] + '</button>';
    }).join("");
    var dirBtns = [["auto", "Auto"], ["rtl", "RTL"], ["ltr", "LTR"]].map(function (o) {
      return '<button class="' + (dir === o[0] ? "is-on" : "") + '" data-setdir="' + o[0] + '">' + o[1] + '</button>';
    }).join("");
    var fmtBtns = '<button class="st-fmtb' + (b.bold ? " is-on" : "") + '" data-setfmt="bold" title="Bold"><b>B</b></button>' +
      '<button class="st-fmtb' + (b.italic ? " is-on" : "") + '" data-setfmt="italic" title="Italic"><i>I</i></button>' +
      '<button class="st-fmtb' + (b.underline ? " is-on" : "") + '" data-setfmt="underline" title="Underline"><u>U</u></button>';
    var colors = ["", "#ffffff", "#a78bfa", "#9aa0a6", "#0a0a0c"];
    var colorBtns = colors.map(function (c) {
      return '<button class="st-sw' + ((b.color || "") === c ? " is-on" : "") + '" data-setcolor="' + c + '" title="' + (c || "default") + '" style="' + (c ? "background:" + c : "background:transparent;border-style:dashed") + '">' + (c ? "" : "×") + '</button>';
    }).join("");
    return '<div class="st-subhead">Style</div><div class="st-fmtrow">' + fmtBtns + '<span class="st-fmtrow__sep"></span>' + colorBtns + '</div>' +
      '<div class="st-subhead">Alignment</div><div class="st-viewtoggle">' + alignBtns + '</div>' +
      '<div class="st-subhead">Direction</div><div class="st-viewtoggle">' + dirBtns + '</div>' +
      rangeField("Text size (0 = auto)", base + ".size", b.size || 0, 0, 80, 1);
  }
  function inspBlock(j) {
    var w = curPageItem(); if (!w) return ""; var b = (w.body || [])[j]; if (!b) return "";
    var base = "works." + workCat + "." + openPage + ".body." + j;
    if (b.type === "heading") return head("Title") + '<p class="st-hint">Click the title on the canvas to type. Select text for bold, italic, link &amp; color.</p>' + textSettings(base, b);
    if (b.type === "text") return head("Text") + '<p class="st-hint">Click the text on the canvas to type. Select text for bold, italic, link &amp; color.</p>' + textSettings(base, b);
    if (b.type === "video") return head("Video") + mediaField("Video — YouTube / Vimeo / file", base + ".url", b.url, "video");
    if (b.type === "gallery") return head("Gallery") + inspGallerySettings(b, base) + inspGalleryItems(b, base);
    return head("Image") + mediaField("Image", base + ".src", b.src, "image") +
      field("Caption (optional)", base + ".caption", b.caption, { rtl: isHeb(b.caption) }) +
      field("Link (optional)", base + ".link", b.link, { placeholder: "https://…" }) +
      field("Alt text (accessibility)", base + ".alt", b.alt) +
      field("Width", base + ".width", b.width || "normal", { select: ["normal", "wide", "full"] });
  }
  function inspPageSettings() {
    var w = curPageItem(); if (!w) return "";
    var base = "works." + workCat + "." + openPage;
    var view = w.view === "grid" ? "grid" : "stack";
    var h = '<div class="st-subhead">Page display</div>' +
      '<div class="st-viewtoggle">' +
        '<button class="' + (view === "stack" ? "is-on" : "") + '" data-setpageview="stack">Stacked</button>' +
        '<button class="' + (view === "grid" ? "is-on" : "") + '" data-setpageview="grid">Grid</button>' +
      '</div>';
    if (view === "grid") {
      var gm = w.gridMode === "uniform" ? "uniform" : "native";
      h += '<div class="st-hint" style="margin:-2px 0 9px">The whole page as one media grid. Titles &amp; text span the full width.</div>' +
        '<div class="st-viewtoggle">' +
          '<button class="' + (gm === "native" ? "is-on" : "") + '" data-setpagegmode="native">Native · keeps sizes</button>' +
          '<button class="' + (gm === "uniform" ? "is-on" : "") + '" data-setpagegmode="uniform">Uniform · crop</button>' +
        '</div>';
      if (gm === "uniform") h += field("Crop ratio", base + ".gridRatio", w.gridRatio || "1 / 1", { select: RATIOS });
      h += field("Columns", base + ".gridCols", String(w.gridCols || 3), { select: ["1", "2", "3", "4", "5", "6"] });
      h += rangeField("Gutter", base + ".gridGap", (w.gridGap != null ? w.gridGap : 8), 0, 40, 1);
    } else {
      h += '<div class="st-hint" style="margin:-2px 0 9px">Vertical layout. Each gallery sets its own grid.</div>' +
        rangeField("Content width", base + ".stackWidth", w.stackWidth || 1100, 500, 1600, 10);
    }
    return h;
  }
  function newBlock(type) {
    return type === "heading" ? { type: "heading", text: "" }
      : type === "text" ? { type: "text", text: "" }
      : type === "video" ? { type: "video", url: "" }
      : type === "gallery" ? { type: "gallery", mode: "native", ratio: "1 / 1", cols: 3, gap: 8, items: [] }
      : { type: "image", src: "", ratio: "4 / 3", width: "normal" };
  }
  function addPageBlockAt(index, type) {
    var w = curPageItem(); if (!w) return; w.body = w.body || [];
    index = Math.max(0, Math.min(index, w.body.length));
    w.body.splice(index, 0, newBlock(type));
    selected = { kind: "block", loc: index };
    renderCanvas(); renderInspector();
  }
  function addPageBlock(type) { var w = curPageItem(); if (w) addPageBlockAt((w.body || []).length, type); }
  function galleryAction(which, k, kind) {
    if (!selected || selected.kind !== "block") return;
    var w = curPageItem(); if (!w) return; var b = w.body[+selected.loc]; if (!b || b.type !== "gallery") return;
    b.items = b.items || [];
    if (which === "add") b.items.push(kind === "video" ? { type: "video", video: "" } : { type: "image", src: "" }); else b.items.splice(k, 1);
    renderCanvas(); renderInspector();
  }

  /* ---------- canvas per page ---------------------------------------- */
  var page = "home", workCat = (D.categories[0] || {}).slug || "", workSub = "__all__", openPage = null, openPost = null;

  function renderCanvas() {
    var c = el("canvas"), h;
    applyLayoutVars();
    if (page === "home") {
      h = '<div class="cv-hint">Home — click a tile to open it · ✎ edits its name &amp; cover.</div><div class="home-grid">' +
        D.categories.map(function (c, i) { return c.parent ? "" : catCard(c, i); }).join("") + '<div class="cv-add" data-act="add-cat">+ Add discipline</div></div>';
    } else if (page === "work") {
      var curCat = D.categories.filter(function (x) { return x.slug === workCat; })[0] || {};
      var list = D.works[workCat] || (D.works[workCat] = []);
      if (openPage != null && list[openPage] && list[openPage].type === "page") {
        h = catCrumbs(workCat) + renderPageEditor(workCat, openPage);
      } else {
        if (openPage != null) openPage = null;
        var nm = curCat.name || "Work";
        var subs = []; list.forEach(function (w) { if (w.sub && subs.indexOf(w.sub) < 0) subs.push(w.sub); });
        if (workSub !== "__all__" && subs.indexOf(workSub) < 0) workSub = "__all__";
        var chips = subs.length >= 2 ? workFilterChips(subs) : "";
        var kids = D.categories.map(function (c, i) { return c.parent === workCat ? catCard(c, i) : ""; }).join("");
        var kidsBlock = kids ? '<div class="home-grid" style="margin-bottom:18px">' + kids + '</div>' : "";
        var tiles = list.map(function (w, i) {
          if (workSub !== "__all__" && w.type !== "page" && w.sub !== workSub) return "";
          return w.type === "page" ? pageCardStudio(w, workCat, i) : workTile(w, workCat, i);
        }).join("");
        h = catCrumbs(workCat) + '<div class="cv-hint">' + esc(nm) + ' — click a piece/page · ↑↓ to reorder.</div>' +
          kidsBlock + chips + '<div class="cat-grid">' + tiles + '</div>';
      }
    } else if (page === "blog") {
      if (openPost != null && D.posts[openPost]) {
        h = renderPostEditor(openPost);
      } else {
        if (openPost != null) openPost = null;
        h = '<div class="cv-hint">Blog — click a post to open &amp; edit it · drag ⠿ to reorder · newest first.</div><div class="blog-grid">' +
          (D.posts || []).map(postCard).join("") + '<div class="cv-add" data-act="add-post">+ Add post</div></div>';
      }
    } else if (page === "brands") {
      h = '<div class="cv-hint">Brands — each one becomes a clickable case-study page. Its name must match the “Client” on the work.</div><div class="cv-brandgrid">' +
        (D.brands || []).map(brandCard).join("") + '<div class="cv-add" data-act="add-brand" style="min-height:160px">+ Add brand</div></div>';
    } else if (page === "design") { h = renderDesignCanvas(); }
    else { h = renderAboutCanvas(); }
    c.innerHTML = '<div class="cv-screen">' + h + "</div>";
    studioMasonry();
  }

  function renderAboutCanvas() {
    var p = D.profile;
    return '<div class="cv-hint">About — click any field on the right to edit it; click the photo to upload one.</div>' +
      '<div class="about-hero" style="padding:0 0 8px"><h1 class="pg-aedit" contenteditable="true" data-aedit="profile.aboutHeadline">' + esc(p.aboutHeadline) + "</h1></div>" +
      '<div class="about-split" style="padding-left:0;padding-right:0">' +
        "<div><div class=\"portrait\"><div class=\"portrait__glow\"></div>" +
        '<div class="portrait__frame imgedit">' + (p.portrait ? '<img src="' + esc(p.portrait) + '">' : '<span class="ph">[ portrait ]</span>') + ov("Portrait") + editBtn("profile.portrait", "image") + "</div></div></div>" +
        '<div class="bio"><div class="bio__name pg-aedit" contenteditable="true" data-aedit="profile.name">' + esc(p.name) + '</div><p class="bio__lead">' + accentize(p.bioLead) + "</p>" +
        (p.bio || []).map(function (t, i) { return '<p class="pg-aedit" contenteditable="true" data-aedit="profile.bio.' + i + '">' + esc(t) + "</p>"; }).join("") +
        '<div class="stats">' + (p.stats || []).map(function (s) { return '<div class="stat"><div class="stat__num">' + esc(s.num) + '</div><div class="stat__label">' + esc(s.label) + "</div></div>"; }).join("") + "</div></div></div>" +
      '<div class="do-band"><div class="do-band__inner" style="padding-left:0;padding-right:0"><div class="mono-label">WHAT I DO</div><div class="do-grid">' +
        (p.skillGroups || []).map(function (g) { return '<div class="do-col"><span class="do-col__label">' + esc(g.label) + '</span><div class="do-col__rule"></div><div class="do-col__items">' + (g.items || []).map(function (k) { return "<span>" + esc(k) + "</span>"; }).join("") + "</div></div>"; }).join("") +
      "</div></div></div>";
  }

  /* ---------- inspector ---------------------------------------------- */
  function renderInspector() {
    var box = el("inspector"), h;
    if (page === "about") h = inspAbout();
    else if (page === "design") h = inspDesign();
    else if (page === "work" && openPage != null) {
      var gCat = (D.categories.filter(function (c) { return c.slug === workCat; })[0] || {}).mode === "gallery";
      var gci = D.categories.map(function (c) { return c.slug; }).indexOf(workCat);
      var topPart = (gCat && gci >= 0) ? inspCategory(gci) + '<div class="st-subhead" style="margin-top:16px">Block</div>' : inspPageSettings() + '<div class="st-subhead" style="margin-top:18px">Block</div>';
      h = topPart + (selected && selected.kind === "block" ? inspBlock(+selected.loc) : '<p class="st-hint">Click a block on the left to edit it.</p>');
    }
    else if (page === "work" && openPage == null && !selected) {
      var cci = D.categories.map(function (c) { return c.slug; }).indexOf(workCat);
      h = cci >= 0 ? inspCategory(cci) : '<p class="st-insp__empty">Click a tile to edit it.</p>';
    }
    else if (page === "blog" && openPost != null) {
      h = inspPostMeta(openPost) + '<div class="st-subhead" style="margin-top:16px">Block</div>' +
        (selected && selected.kind === "postblock" ? inspPostBlock(+selected.loc) : '<p class="st-hint">Click a block on the left to edit it. Text edits inline.</p>');
    }
    else if (!selected) h = '<p class="st-insp__empty">Click anything on the canvas to edit it here.<br><br>Click an image to upload one.<br><br>Use the ↑ ↓ ✕ buttons on a tile to reorder or delete it.</p>';
    else if (selected.kind === "category") h = inspCategory(selected.loc);
    else if (selected.kind === "work") h = inspWork(selected.loc);
    else if (selected.kind === "page") h = inspPage(selected.loc);
    else if (selected.kind === "block") h = inspBlock(+selected.loc);
    else if (selected.kind === "post") h = inspPost(selected.loc);
    else if (selected.kind === "brand") h = inspBrand(selected.loc);
    else h = "";
    // On the Work page, persistent add buttons live at the top of the panel.
    // In the grid: add a single piece or a whole page. Inside a page: a way out.
    if (page === "work" && openPage == null) h = '<button class="st-addpiece" data-act="add-work">+ Add piece</button><button class="st-addpiece st-addpiece--alt" data-act="add-page">+ Add page</button><button class="st-addpiece st-addpiece--alt" data-act="add-subcat">+ Add sub-category</button>' + h;
    box.innerHTML = h;
  }
  function head(title, sub) { return '<div class="st-insp__title">' + esc(title) + "</div>" + (sub ? '<div class="st-insp__sub">' + esc(sub) + "</div>" : ""); }

  function inspCategory(i) { var c = D.categories[i]; if (!c) return "";
    var mode = c.mode === "gallery" ? "gallery" : "cards";
    return head("Discipline", c.parent ? "sub-category" : "home tile") + field("Name", "categories." + i + ".name", c.name) + field("Kind (small label)", "categories." + i + ".kind", c.kind) +
      '<div class="st-subhead">Type</div><div class="st-hint" style="margin:-4px 0 8px">Cards = sub-categories &amp; pieces · Gallery = one big media gallery.</div>' +
      '<div class="st-viewtoggle">' +
        '<button class="' + (mode === "cards" ? "is-on" : "") + '" data-setcatmode="cards" data-ci="' + i + '">Cards</button>' +
        '<button class="' + (mode === "gallery" ? "is-on" : "") + '" data-setcatmode="gallery" data-ci="' + i + '">Gallery</button>' +
      '</div>' +
      '<div class="st-field"><label>Link id (fixed)</label><input value="' + esc(c.slug) + '" disabled></div>' + mediaField("Cover image", "categories." + i + ".image", c.image, "image"); }

  // The sub-categories (filter groups) already used inside one discipline, in the
  // order they first appear — these are the chips shown on that category page.
  function subsForCat(slug) {
    var out = [], seen = {};
    (D.works[slug] || []).forEach(function (w) { if (w.sub && !seen[w.sub]) { seen[w.sub] = 1; out.push(w.sub); } });
    return out;
  }
  // A real dropdown of the discipline's existing groups, with a "+ New group…"
  // escape hatch so you can still create one. Reuses a group instead of retyping
  // it (which avoids accidental near-duplicates like "Sci-Fi" vs "Scifi").
  function subField(label, path, value, slug) {
    var subs = subsForCat(slug);
    if (value && subs.indexOf(value) < 0) subs.unshift(value);   // keep an off-list value visible/selected
    var opts = '<option value=""' + (value ? "" : " selected") + ">— none —</option>" +
      subs.map(function (s) { return '<option value="' + esc(s) + '"' + (s === value ? " selected" : "") + ">" + esc(s) + "</option>"; }).join("") +
      '<option value="__newsub__">+ New group…</option>';
    return '<div class="st-field"><label>' + esc(label) + '</label><select data-subselect="' + esc(path) + '">' + opts + "</select></div>";
  }
  function inspWork(loc) { var slug = loc.split(".")[0], i = +loc.split(".")[1], w = (D.works[slug] || [])[i]; if (!w) return "";
    return head("Piece", slug) + field("Title", "works." + slug + "." + i + ".en", w.en) + field("Title (Hebrew)", "works." + slug + "." + i + ".he", w.he, { rtl: true }) +
      field("Client", "works." + slug + "." + i + ".client", w.client, { placeholder: "match a Brand name for the case study" }) +
      subField("Sub-category (filter group)", "works." + slug + "." + i + ".sub", w.sub, slug) +
      field("Card shape (auto-set from the link — change only if it looks wrong)", "works." + slug + "." + i + ".ratio", w.ratio, { select: RATIOS }) + listField("Tags (comma-separated)", "works." + slug + "." + i + ".tags", w.tags) +
      mediaField("Cover (optional — leave empty to auto-use the YouTube thumbnail)", "works." + slug + "." + i + ".poster", w.poster, "image") + mediaField("Video — YouTube / Vimeo link (or upload)", "works." + slug + "." + i + ".video", w.video, "video") +
      field("Description (optional)", "works." + slug + "." + i + ".body", w.body, { textarea: true }) +
      pagesPicker(slug, w); }
  // Which discipline pages this piece appears on. It lives in one "main" page
  // (the array it's in) and can also show on others via w.also.
  function pagesPicker(home, w) {
    var also = w.also || [];
    return '<div class="st-subhead">Show on pages</div>' +
      '<div class="st-hint" style="margin:-4px 0 9px">Tick every discipline page this piece should appear on. Untick to remove it.</div>' +
      '<div class="st-pagepick">' + D.categories.map(function (c) {
        var on = (c.slug === home) || (also.indexOf(c.slug) >= 0);
        return '<label class="st-pagepick__item' + (on ? " is-on" : "") + '">' +
          '<input type="checkbox" data-pageassign="' + esc(c.slug) + '"' + (on ? " checked" : "") + '>' +
          '<span>' + esc(c.name) + (c.slug === home ? " · main" : "") + '</span></label>';
      }).join("") + '</div>';
  }
  function assignPage(targetSlug, checked) {
    if (!selected || selected.kind !== "work") { renderInspector(); return; }
    var sl = selected.loc.split(".")[0], i = +selected.loc.split(".")[1], w = D.works[sl] && D.works[sl][i];
    if (!w) return;
    if (targetSlug === sl) {                        // toggling the "main" page
      if (checked) return;
      var others = (w.also || []).slice();
      if (!others.length) { status("A piece must stay on at least one page — use the ✕ to delete it.", "err"); renderInspector(); return; }
      var newHome = others[0];
      D.works[sl].splice(i, 1);
      w.also = others.filter(function (s) { return s !== newHome; });
      if (!w.also.length) delete w.also;
      (D.works[newHome] = D.works[newHome] || []).push(w);
      workCat = newHome; selected = { kind: "work", loc: newHome + "." + (D.works[newHome].length - 1) };
      renderSubbar(); renderCanvas(); renderInspector();
      return;
    }
    // toggling an extra page — the main discipline's canvas doesn't change, so
    // only refresh the inspector (keeps your scroll position in the canvas).
    w.also = w.also || [];
    if (checked) { if (w.also.indexOf(targetSlug) < 0) w.also.push(targetSlug); }
    else { w.also = w.also.filter(function (s) { return s !== targetSlug; }); }
    if (!w.also.length) delete w.also;
    renderInspector();
  }

  function inspPost(i) { var p = D.posts[i]; if (!p) return ""; var tags = (D.blogTags || []).filter(function (t) { return t !== "All"; });
    return head("Blog post") + field("Title", "posts." + i + ".t", p.t, { rtl: isHeb(p.t) }) + field("Excerpt", "posts." + i + ".excerpt", p.excerpt, { textarea: true, rtl: isHeb(p.excerpt) }) +
      '<div class="st-row2">' + field("Tag", "posts." + i + ".tag", p.tag, { select: tags }) + field("Read time", "posts." + i + ".r", p.r) + "</div>" +
      '<div class="st-row2">' + field("Date", "posts." + i + ".d", p.d) + field("Page address", "posts." + i + ".slug", p.slug, { placeholder: "my-post" }) + "</div>" +
      mediaField("Cover image", "posts." + i + ".cover", p.cover, "image") +
      field("Original link (optional)", "posts." + i + ".url", p.url, { placeholder: "only if it also lives elsewhere" }) +
      inspPostBody(i, p); }

  /* ----- post content: the body-block editor (headings, text, images, video) ----- */
  function blockLabel(t) { return ({ h: "Heading", p: "Text", quote: "Quote", img: "Image", video: "Video", file: "Download" })[t] || t; }
  function blockFields(i, j, b) {
    var base = "posts." + i + ".body." + j;
    if (b.type === "h") return field("Heading", base + ".text", b.text, { rtl: isHeb(b.text) });
    if (b.type === "p") return field("Text", base + ".text", b.text, { textarea: true, rtl: isHeb(b.text) });
    if (b.type === "quote") return field("Quote", base + ".text", b.text, { textarea: true, rtl: isHeb(b.text) });
    if (b.type === "img") return mediaField("Image", base + ".src", blkImg(b), "image");
    if (b.type === "video") return mediaField("Video (YouTube / Vimeo / file)", base + ".url", b.url || b.src || "", "video");
    if (b.type === "file") return field("Button text", base + ".text", b.text, { rtl: isHeb(b.text) }) + field("File link / path", base + ".href", b.href, { placeholder: "assets/files/… or a URL" });
    return "";
  }
  function inspPostBody(i, p) {
    var body = p.body || [];
    var rows = body.map(function (b, j) {
      return '<div class="st-blk" data-bidx="' + j + '">' +
        '<div class="st-blk__head"><span class="st-blk__drag" draggable="true" title="Drag to reorder">⠿</span>' +
        '<span class="st-blk__type">' + esc(blockLabel(b.type)) + "</span>" +
        '<span class="st-blk__tools">' +
        '<button data-bact="up" data-bidx="' + j + '" title="Move up">↑</button>' +
        '<button data-bact="down" data-bidx="' + j + '" title="Move down">↓</button>' +
        '<button class="st-blk__del" data-bact="del" data-bidx="' + j + '" title="Delete">✕</button>' +
        "</span></div><div class=\"st-blk__body\">" + blockFields(i, j, b) + "</div></div>";
    }).join("");
    return '<div class="st-subhead">Post content</div>' +
      (body.length ? rows : '<p class="st-hint" style="margin-bottom:10px">No content yet — add a heading, text, image or video below.</p>') +
      '<div class="st-addblk">' +
      '<button data-baddtype="h">+ Heading</button>' +
      '<button data-baddtype="p">+ Text</button>' +
      '<button data-baddtype="img">+ Image</button>' +
      '<button data-baddtype="video">+ Video</button>' +
      '<button data-baddtype="quote">+ Quote</button>' +
      '<button data-baddtype="file">+ Download</button>' +
      "</div>";
  }
  function curPost() { return selected && selected.kind === "post" ? D.posts[+selected.loc] : null; }
  function postBodyAction(act, j) {
    var p = curPost(); if (!p || !p.body) return;
    if (act === "del") p.body.splice(j, 1);
    else move(p.body, j, act === "up" ? -1 : 1);
    renderCanvas(); renderInspector();
  }
  function addBlock(type) {
    var p = curPost(); if (!p) return; p.body = p.body || [];
    var b = type === "img" ? { type: "img", src: "" } : type === "video" ? { type: "video", url: "" } : type === "file" ? { type: "file", text: "Download", href: "" } : { type: type, text: "" };
    p.body.push(b);
    renderCanvas(); renderInspector();
  }
  function moveBlockTo(from, to) {
    var p = curPost(); if (!p || !p.body) return;
    if (from === to || from < 0 || to < 0 || from >= p.body.length || to >= p.body.length) return;
    var it = p.body.splice(from, 1)[0]; p.body.splice(to, 0, it);
    renderCanvas(); renderInspector();
  }

  /* ----- WYSIWYG blog-post editor (same inline model as project pages) ----- */
  function postInsZone(k) {
    var t = [["h", "Heading"], ["p", "Text"], ["img", "Image"], ["video", "Video"], ["quote", "Quote"], ["file", "Download"]];
    return '<div class="pg-ins"><span class="pg-ins__line"></span><div class="pg-ins__menu">' +
      t.map(function (x) { return '<button data-insat="' + k + '" data-instype="' + x[0] + '">+ ' + x[1] + '</button>'; }).join("") + '</div></div>';
  }
  function postBlockWysiwyg(b, i, j) {
    var base = "posts." + i + ".body." + j, sel = selCls("postblock", j), tools = blkTools(), inner;
    if (b.type === "h") inner = '<div class="pg-text">' + editableHTML("h3", "pg-text__h", base + ".text", b.text || "", b, "Heading — click to edit") + '</div>';
    else if (b.type === "p") inner = '<div class="pg-text">' + editableHTML("p", "pg-text__p", base + ".text", b.text || "", b, "Text — click to edit") + '</div>';
    else if (b.type === "quote") inner = '<div class="pg-text">' + editableHTML("blockquote", "pg-quote", base + ".text", b.text || "", b, "Quote — click to edit") + '</div>';
    else if (b.type === "video") inner = '<div class="pg-video">' + (ytThumb(b.url || b.src) ? '<img src="' + esc(ytThumb(b.url || b.src)) + '">' : '<span class="play"></span>') + '</div>';
    else if (b.type === "file") inner = '<div class="pg-file">⬇ ' + esc(b.text || "Download") + '</div>';
    else inner = '<div class="pg-img imgedit" style="aspect-ratio:16 / 9">' + (blkImg(b) ? '<img src="' + esc(blkImg(b)) + '">' : '<span class="ph">[ image ]</span>') + editBtn(base + ".src", "image") + '</div>';
    return '<div class="pg-blk cv-item' + sel + '" data-kind="postblock" data-loc="' + j + '">' + postInsZone(j) + inner + tools + '</div>';
  }
  function renderPostEditor(i) {
    var p = D.posts[i], blocks = p.body || [];
    var body = blocks.length
      ? '<div class="pg-stack" style="max-width:900px">' + blocks.map(function (b, j) { return postBlockWysiwyg(b, i, j); }).join("") + '</div>'
      : '<p class="cv-hint">No content yet — add a block below.</p>';
    return '<div class="cv-hint"><button class="cv-back" data-act="close-post">← Blog</button>&nbsp; <b>' + esc(p.t || "Untitled") + '</b> — click text to edit · select for bold/italic/color · ↑↓ to reorder.</div>' +
      '<div class="cv-pagewrap">' + body + '</div>' +
      '<div class="cv-addblk">' +
        '<button data-postadd="h">+ Heading</button>' +
        '<button data-postadd="p">+ Text</button>' +
        '<button data-postadd="img">+ Image</button>' +
        '<button data-postadd="video">+ Video</button>' +
        '<button data-postadd="quote">+ Quote</button>' +
        '<button data-postadd="file">+ Download</button>' +
      '</div>';
  }
  function addPostBlockAt(index, type) {
    if (openPost == null) return; var p = D.posts[openPost]; if (!p) return; p.body = p.body || [];
    index = Math.max(0, Math.min(index, p.body.length));
    var b = type === "img" ? { type: "img", src: "" } : type === "video" ? { type: "video", url: "" } : type === "file" ? { type: "file", text: "Download", href: "" } : { type: type, text: "" };
    p.body.splice(index, 0, b); selected = { kind: "postblock", loc: index };
    renderCanvas(); renderInspector();
  }
  function inspPostMeta(i) { var p = D.posts[i]; if (!p) return ""; var tags = (D.blogTags || []).filter(function (t) { return t !== "All"; });
    return head("Blog post") + field("Title", "posts." + i + ".t", p.t, { rtl: isHeb(p.t) }) + field("Excerpt", "posts." + i + ".excerpt", p.excerpt, { textarea: true, rtl: isHeb(p.excerpt) }) +
      '<div class="st-row2">' + field("Tag", "posts." + i + ".tag", p.tag, { select: tags }) + field("Read time", "posts." + i + ".r", p.r) + "</div>" +
      '<div class="st-row2">' + field("Date", "posts." + i + ".d", p.d) + field("Page address", "posts." + i + ".slug", p.slug, { placeholder: "my-post" }) + "</div>" +
      mediaField("Cover image", "posts." + i + ".cover", p.cover, "image") +
      field("Original link (optional)", "posts." + i + ".url", p.url, { placeholder: "only if it also lives elsewhere" }); }
  function inspPostBlock(j) {
    var p = D.posts[openPost]; if (!p) return ""; var b = (p.body || [])[j]; if (!b) return "";
    var base = "posts." + openPost + ".body." + j;
    if (b.type === "img") return head("Image") + mediaField("Image", base + ".src", blkImg(b), "image");
    if (b.type === "video") return head("Video") + mediaField("Video — YouTube / Vimeo / file", base + ".url", b.url || b.src || "", "video");
    if (b.type === "file") return head("Download") + field("Button text", base + ".text", b.text, { rtl: isHeb(b.text) }) + field("File link / path", base + ".href", b.href, { placeholder: "assets/files/… or a URL" });
    return head(b.type === "h" ? "Heading" : b.type === "quote" ? "Quote" : "Text") + '<p class="st-hint">Edit on the canvas. Select text for bold, italic, link &amp; color.</p>' + textSettings(base, b);
  }

  /* ===== Full-screen blog-post editor (Wix-style) ===========================
     A focused, full-window writing surface for ONE post. Reuses the same data
     model + block rendering as the in-canvas editor, but presents it as a
     dedicated "page": cover + big title at the top, the article body below
     (same inline + / drag / ✎ affordances), and post settings in a slide-in
     panel. Save / Connect / Upload stay shared with the rest of Studio.
     openPost = which post; fullEdit = this overlay is showing.
     ========================================================================== */
  var fullEdit = false;
  function pePost() { return (openPost != null) ? D.posts[openPost] : null; }

  function peTopBar() {
    var p = pePost() || {};
    var prev = p.slug ? "post.html?slug=" + encodeURIComponent(p.slug) : "blog.html";
    return '<div class="pe-top">' +
      '<button class="pe-back" data-act="pe-back">← Blog</button>' +
      '<div class="pe-top__title" dir="auto">' + esc(p.t || "Untitled post") + '</div>' +
      '<div class="pe-top__actions">' +
        '<button class="st-btn" data-act="pe-settings">⚙ Post settings</button>' +
        '<a class="st-btn st-btn--ghost" href="' + esc(prev) + '" target="_blank" rel="noopener">Preview ↗</a>' +
        '<button class="st-btn st-btn--primary" data-act="pe-save">Save</button>' +
      '</div></div>';
  }

  // Context toolbar under the top bar: format buttons for text/heading/quote,
  // or the right inputs for image / video / file. "" when nothing is selected.
  function peBlockBar() {
    var b = curTextBlock(); if (!b || selected == null) return "";
    var i = openPost, j = selected.loc, base = "posts." + i + ".body." + j;
    if (b.type === "h" || b.type === "p" || b.type === "quote") {
      var align = b.align || "", dir = b.dir || "auto";
      var fmt = '<button class="st-fmtb' + (b.bold ? " is-on" : "") + '" data-setfmt="bold" title="Bold"><b>B</b></button>' +
        '<button class="st-fmtb' + (b.italic ? " is-on" : "") + '" data-setfmt="italic" title="Italic"><i>I</i></button>' +
        '<button class="st-fmtb' + (b.underline ? " is-on" : "") + '" data-setfmt="underline" title="Underline"><u>U</u></button>';
      var colors = ["", "#ffffff", "#a78bfa", "#9aa0a6", "#0a0a0c"];
      var col = colors.map(function (c) {
        return '<button class="st-sw' + ((b.color || "") === c ? " is-on" : "") + '" data-setcolor="' + c + '" title="' + (c || "default") + '" style="' + (c ? "background:" + c : "background:transparent;border-style:dashed") + '">' + (c ? "" : "×") + '</button>';
      }).join("");
      var aBtns = [["", "Auto"], ["left", "Left"], ["center", "Center"], ["right", "Right"]].map(function (o) { return '<button class="pe-seg' + (align === o[0] ? " is-on" : "") + '" data-setalign="' + o[0] + '">' + o[1] + '</button>'; }).join("");
      var dBtns = [["auto", "Auto"], ["rtl", "RTL"], ["ltr", "LTR"]].map(function (o) { return '<button class="pe-seg' + (dir === o[0] ? " is-on" : "") + '" data-setdir="' + o[0] + '">' + o[1] + '</button>'; }).join("");
      return '<span class="pe-fmt__grp">' + fmt + '</span><span class="pe-fmt__sep"></span>' +
             '<span class="pe-fmt__grp">' + col + '</span><span class="pe-fmt__sep"></span>' +
             '<span class="pe-fmt__grp">' + aBtns + '</span><span class="pe-fmt__sep"></span>' +
             '<span class="pe-fmt__grp">' + dBtns + '</span>';
    }
    if (b.type === "video") return '<div class="pe-bbar"><span class="pe-bbar__lbl">Video link</span>' +
      '<input class="pe-bbar__in" data-path="' + base + '.url" value="' + esc(b.url || b.src || "") + '" placeholder="Paste a YouTube / Vimeo link or file URL">' +
      '<button class="pe-seg" data-upload="' + base + '.url" data-kind="video">Upload</button></div>';
    if (b.type === "img") return '<div class="pe-bbar">' +
      '<button class="pe-seg" data-upload="' + base + '.src" data-kind="image">Change image</button>' +
      '<input class="pe-bbar__in" data-path="' + base + '.alt" value="' + esc(b.alt || "") + '" placeholder="Alt text (accessibility)"></div>';
    if (b.type === "file") return '<div class="pe-bbar">' +
      '<input class="pe-bbar__in" data-path="' + base + '.text" value="' + esc(b.text || "") + '" placeholder="Button text">' +
      '<input class="pe-bbar__in" data-path="' + base + '.href" value="' + esc(b.href || "") + '" placeholder="File link / path (assets/files/… or a URL)"></div>';
    return "";
  }

  function peDoc() {
    var p = pePost(); if (!p) return ""; var i = openPost;
    var cover = p.cover
      ? '<div class="pe-cover"><img src="' + esc(p.cover) + '">' +
          '<div class="pe-cover__tools">' +
            '<button class="st-mini" data-upload="posts.' + i + '.cover" data-kind="image">Change cover</button>' +
            '<button class="st-mini st-mini--danger" data-clear="posts.' + i + '.cover">Remove</button>' +
          '</div></div>'
      : '<button class="pe-cover pe-cover--empty" data-upload="posts.' + i + '.cover" data-kind="image">＋ Add cover image</button>';
    var tag = p.tag ? '<div class="pe-tag">' + esc(p.tag) + '</div>' : '<div class="pe-tag pe-tag--muted">No tag yet — set one in Post settings</div>';
    var title = '<h1 class="pe-title post-view__title" dir="auto" contenteditable="true" spellcheck="false" data-petitle data-ph="Post title">' + esc(p.t || "") + '</h1>';
    var meta = '<div class="pe-metaline">' + esc(p.d || "Add a date in Post settings") + (p.r ? ' · ' + esc(p.r) : '') + '</div>';
    var blocks = p.body || [];
    var body = blocks.length
      ? '<div class="cv-pagewrap"><div class="pg-stack pe-stack">' + blocks.map(function (b, j) { return postBlockWysiwyg(b, i, j); }).join("") + '</div></div>'
      : '<p class="pe-empty">This post is empty — add your first block below.</p>';
    var addrow = '<div class="cv-addblk pe-addblk">' +
      '<button data-postadd="h">+ Heading</button>' +
      '<button data-postadd="p">+ Text</button>' +
      '<button data-postadd="img">+ Image</button>' +
      '<button data-postadd="video">+ Video</button>' +
      '<button data-postadd="quote">+ Quote</button>' +
      '<button data-postadd="file">+ Download</button>' +
      '</div>';
    return cover + tag + title + meta + body + addrow;
  }

  function peSettings() {
    var p = pePost(); if (!p) return ""; var i = openPost;
    var tags = (D.blogTags || []).filter(function (t) { return t !== "All"; });
    return '<div class="pe-settings__head"><span>Post settings</span><button class="pe-x" data-act="pe-close-settings" title="Close">✕</button></div>' +
      '<div class="pe-settings__body">' +
        field("Excerpt (shown on the blog card)", "posts." + i + ".excerpt", p.excerpt, { textarea: true, rtl: isHeb(p.excerpt) }) +
        '<div class="st-row2">' + field("Tag", "posts." + i + ".tag", p.tag, { select: tags }) + field("Read time", "posts." + i + ".r", p.r) + '</div>' +
        '<div class="st-row2">' + field("Date", "posts." + i + ".d", p.d) + field("Page address", "posts." + i + ".slug", p.slug, { placeholder: "my-post" }) + '</div>' +
        mediaField("Cover image", "posts." + i + ".cover", p.cover, "image") +
        field("Original link (optional)", "posts." + i + ".url", p.url, { placeholder: "only if it also lives elsewhere" }) +
      '</div>';
  }

  function renderPostEdit() {
    var host = el("postedit"); if (!host) return;
    if (openPost == null || !D.posts[openPost]) { host.hidden = true; return; }
    host.innerHTML = peTopBar() +
      '<div class="pe-fmt" id="pe-fmt">' + peBlockBar() + '</div>' +
      '<div class="pe-scroll"><div class="pe-doc" id="pe-doc">' + peDoc() + '</div></div>' +
      '<div class="pe-backdrop" id="pe-backdrop"></div>' +
      '<aside class="pe-settings" id="pe-settings">' + peSettings() + '</aside>';
    host.hidden = false;
  }
  function pePaintDoc() { var d = el("pe-doc"); if (d) d.innerHTML = peDoc(); }
  function pePaintSettings() { var s = el("pe-settings"); if (s) s.innerHTML = peSettings(); }
  function pePaintFmt() { var f = el("pe-fmt"); if (f) f.innerHTML = peBlockBar(); }

  function openPostEditor(i) {
    openPost = i; fullEdit = true; selected = null;
    el("postedit").classList.remove("pe-show-settings");
    renderPostEdit(); pushHistory();
  }
  function closePostEditor() {
    fullEdit = false; selected = null;
    var host = el("postedit"); host.hidden = true; host.classList.remove("pe-show-settings");
    openPost = null; page = "blog";
    [].forEach.call(el("st-pages").children, function (b) { b.classList.toggle("is-on", b.getAttribute("data-page") === "blog"); });
    renderSubbar(); renderCanvas(); renderInspector(); pushHistory();
  }

  function peNewBlock(type) {
    return type === "img" ? { type: "img", src: "" } : type === "video" ? { type: "video", url: "" } : type === "file" ? { type: "file", text: "Download", href: "" } : { type: type, text: "" };
  }
  function peAddBlockAt(index, type) {
    var p = pePost(); if (!p) return; p.body = p.body || [];
    index = Math.max(0, Math.min(index, p.body.length));
    p.body.splice(index, 0, peNewBlock(type));
    selected = { kind: "postblock", loc: index };
    pePaintDoc(); pePaintFmt();
  }
  function peBlockAction(act, j) {
    var p = pePost(); if (!p || !p.body) return;
    if (act === "del") { p.body.splice(j, 1); selected = null; }
    else reorder(p.body, j, act);
    pePaintDoc(); pePaintFmt();
  }
  function peSetField(t) {
    var path = t.getAttribute("data-path"); if (!path) return;
    var v = t.value, type = t.getAttribute("data-type");
    if (type === "list") v = v.split(",").map(function (x) { return x.trim(); }).filter(Boolean);
    else if (type === "num") v = parseFloat(v);
    setPath(D, path, v);
  }

  function peClick(e) {
    var host = el("postedit");
    var a = e.target.closest("[data-act]");
    if (a) {
      var act = a.getAttribute("data-act");
      if (act === "pe-back") { closePostEditor(); return; }
      if (act === "pe-save") { save(); return; }
      if (act === "pe-settings") { host.classList.add("pe-show-settings"); return; }
      if (act === "pe-close-settings") { host.classList.remove("pe-show-settings"); return; }
      var itt = a.closest('.cv-item[data-kind="postblock"]'); if (itt) { peBlockAction(act, +itt.getAttribute("data-loc")); return; }
    }
    if (e.target.id === "pe-backdrop") { host.classList.remove("pe-show-settings"); return; }
    var sfmt = e.target.closest("[data-setfmt]"); if (sfmt) { var fb = curTextBlock(); if (fb) { var fk = sfmt.getAttribute("data-setfmt"); fb[fk] = !fb[fk]; pePaintDoc(); pePaintFmt(); } return; }
    var scol = e.target.closest("[data-setcolor]"); if (scol) { var cb = curTextBlock(); if (cb) { var cvv = scol.getAttribute("data-setcolor"); if (cvv) cb.color = cvv; else delete cb.color; pePaintDoc(); pePaintFmt(); } return; }
    var sal = e.target.closest("[data-setalign]"); if (sal) { var ab = curTextBlock(); if (ab) { ab.align = sal.getAttribute("data-setalign"); pePaintDoc(); pePaintFmt(); } return; }
    var sdir = e.target.closest("[data-setdir]"); if (sdir) { var db2 = curTextBlock(); if (db2) { db2.dir = sdir.getAttribute("data-setdir"); pePaintDoc(); pePaintFmt(); } return; }
    var cel = e.target.closest('[contenteditable="true"]');
    if (cel) { var cit = cel.closest('.cv-item[data-kind="postblock"]'); selected = cit ? { kind: "postblock", loc: +cit.getAttribute("data-loc") } : null; pePaintFmt(); return; }
    var insAt = e.target.closest("[data-insat]"); if (insAt) { peAddBlockAt(+insAt.getAttribute("data-insat"), insAt.getAttribute("data-instype")); return; }
    var pa = e.target.closest("[data-postadd]"); if (pa) { var pp = pePost(); peAddBlockAt(pp && pp.body ? pp.body.length : 0, pa.getAttribute("data-postadd")); return; }
    var ed = e.target.closest(".cv-edit"); if (ed) { startUpload(ed.getAttribute("data-upload"), ed.getAttribute("data-kind")); return; }
    var up = e.target.closest("[data-upload]"); if (up) { startUpload(up.getAttribute("data-upload"), up.getAttribute("data-kind")); return; }
    var clr = e.target.closest("[data-clear]"); if (clr) { setPath(D, clr.getAttribute("data-clear"), ""); pePaintDoc(); pePaintSettings(); return; }
    var item = e.target.closest('.cv-item[data-kind="postblock"]'); if (item) { selected = { kind: "postblock", loc: +item.getAttribute("data-loc") }; pePaintFmt(); }
  }
  function peInput(e) {
    var t = e.target;
    if (t.hasAttribute && t.hasAttribute("data-petitle")) { var p = pePost(); if (p) p.t = t.textContent; return; }
    var ce = t.closest && t.closest("[data-edit]"); if (ce) { setPath(D, ce.getAttribute("data-edit"), cleanHTML(ce.innerHTML)); return; }
    if (t.getAttribute && t.getAttribute("data-path") != null) peSetField(t);
  }
  function peChange(e) {
    var t = e.target;
    if (t.getAttribute && t.getAttribute("data-path") != null) { peSetField(t); pePaintDoc(); }
  }
  function pePaste(e) {
    var ce = e.target.closest && e.target.closest("[data-edit], [data-petitle]"); if (!ce) return;
    e.preventDefault();
    var txt = ((e.clipboardData || window.clipboardData).getData("text/plain") || "");
    document.execCommand("insertText", false, txt);
  }
  function peKeydown(e) {
    var ce = e.target.closest && e.target.closest('h3[data-edit], [data-petitle]');
    if (ce && e.key === "Enter") { e.preventDefault(); ce.blur(); }
  }
  (function bindPostEditor() {
    var pe = el("postedit"); if (!pe) return;
    pe.addEventListener("click", peClick);
    pe.addEventListener("input", peInput);
    pe.addEventListener("change", peChange);
    pe.addEventListener("paste", pePaste);
    pe.addEventListener("keydown", peKeydown);
  })();

  function inspBrand(i) { var b = D.brands[i]; if (!b) return "";
    return head("Brand / case study") + field("Name", "brands." + i + ".name", b.name) + '<div class="st-field"><label>Link id (fixed)</label><input value="' + esc(b.slug) + '" disabled></div>' +
      mediaField("Logo (optional)", "brands." + i + ".logo", b.logo, "image") + field("Intro / case-study text", "brands." + i + ".intro", b.intro, { textarea: true }); }

  function inspAbout() { var p = D.profile;
    var h = head("About page");
    h += field("Name", "profile.name", p.name) + field("Role", "profile.role", p.role);
    h += '<div class="st-row2">' + field("Brand (header)", "profile.brand", p.brand) + field("Tagline", "profile.tagline", p.tagline) + "</div>";
    h += '<div class="st-row2">' + field("Initials", "profile.initials", p.initials) + field("Author (blog)", "profile.author", p.author) + "</div>";
    h += field("Copyright (footer)", "profile.copyright", p.copyright);
    h += mediaField("Portrait", "profile.portrait", p.portrait, "image");
    h += field("Headline", "profile.aboutHeadline", p.aboutHeadline);
    h += field("Lead line ({{ }} = purple)", "profile.bioLead", p.bioLead, { textarea: true });
    h += '<div class="st-subhead">Bio paragraphs</div>';
    h += (p.bio || []).map(function (t, i) { return '<div class="st-field"><label>Paragraph ' + (i + 1) + ' <button class="st-mini st-mini--danger" data-iact="del-bio" data-idx="' + i + '" style="float:right;padding:2px 8px">remove</button></label><textarea data-path="profile.bio.' + i + '">' + esc(t) + "</textarea></div>"; }).join("");
    h += '<button class="st-addrow" data-iact="add-bio">+ Add paragraph</button>';
    h += '<div class="st-subhead">Stats</div>';
    h += (p.stats || []).map(function (s, i) { return '<div class="st-row2">' + field("Number", "profile.stats." + i + ".num", s.num) + '<div class="st-field"><label>Label <button class="st-mini st-mini--danger" data-iact="del-stat" data-idx="' + i + '" style="float:right;padding:2px 8px">×</button></label><input data-path="profile.stats.' + i + '.label" value="' + esc(s.label) + '"></div></div>'; }).join("");
    h += '<button class="st-addrow" data-iact="add-stat">+ Add stat</button>';
    h += '<div class="st-subhead">Social links (footer)</div>';
    h += (D.socials || []).map(function (s, i) { return '<div class="st-row2">' + field("Label", "socials." + i + ".label", s.label) + '<div class="st-field"><label>URL <button class="st-mini st-mini--danger" data-iact="del-social" data-idx="' + i + '" style="float:right;padding:2px 8px">×</button></label><input data-path="socials.' + i + '.url" value="' + esc(s.url) + '"></div></div>'; }).join("");
    h += '<button class="st-addrow" data-iact="add-social">+ Add social link</button>';
    h += '<div class="st-subhead">What I do</div>';
    h += (p.skillGroups || []).map(function (g, i) { return '<div class="st-field"><label>Group <button class="st-mini st-mini--danger" data-iact="del-skill" data-idx="' + i + '" style="float:right;padding:2px 8px">×</button></label><input data-path="profile.skillGroups.' + i + '.label" value="' + esc(g.label) + '" style="margin-bottom:6px">' + '<input data-path="profile.skillGroups.' + i + '.items" data-type="list" value="' + esc((g.items || []).join(", ")) + '" placeholder="items, comma-separated"></div>'; }).join("");
    h += '<button class="st-addrow" data-iact="add-skill">+ Add group</button>';
    return h;
  }

  function inspDesign() {
    var L = D.layout || {};
    return head("Design", "cards · spacing · headings") +
      '<p class="st-hint" style="margin-bottom:14px">These control every gallery on the site (Work pages & case studies). Drag a slider and watch the preview on the left.</p>' +
      rangeField("Card size", "layout.cardSize", L.cardSize, 180, 1000, 5) +
      rangeField("Gap between cards (sideways)", "layout.cardGap", L.cardGap, 4, 200, 1) +
      rangeField("Gap between rows", "layout.cardRowGap", L.cardRowGap, 4, 200, 1) +
      rangeField("Card title size", "layout.cardTitleSize", L.cardTitleSize, 12, 26, 1) +
      rangeField("Section heading size", "layout.clientHeadSize", L.clientHeadSize, 16, 40, 1) +
      rangeField("Page side margins (every gallery page)", "layout.pageMargin", L.pageMargin, 0, 200, 2) +
      '<button class="st-addrow" data-iact="reset-layout">Reset to defaults</button>';
  }

  /* ---------- selection + page switching ----------------------------- */
  function select(kind, loc) { var sy = scrollWrap ? scrollWrap.scrollTop : 0; selected = { kind: kind, loc: loc }; renderCanvas(); renderInspector(); if (scrollWrap) scrollWrap.scrollTop = sy; }
  function subSlider(label, path, value, min, max, step) {
    return '<span class="st-subctl"><label>' + esc(label) +
      ' <b class="st-rangeval" data-for="' + esc(path) + '">' + esc(value) + 'px</b></label>' +
      '<input type="range" data-path="' + path + '" data-type="num" min="' + min + '" max="' + max + '" step="' + (step || 1) + '" value="' + esc(value) + '"></span>';
  }
  function renderSubbar() {
    var sb = el("st-subbar");
    if (page === "work" && openPage == null) {
      var L = D.layout || {};
      sb.hidden = false;
      sb.innerHTML = '<label>Discipline:</label><select id="st-workcat">' +
        D.categories.map(function (c) { return '<option value="' + esc(c.slug) + '"' + (c.slug === workCat ? " selected" : "") + ">" + esc(c.name) + "</option>"; }).join("") + "</select>" +
        '<span class="st-subsep"></span><span class="st-subctl__group">Card size &amp; spacing:</span>' +
        subSlider("Size", "layout.cardSize", L.cardSize, 180, 1000, 5) +
        subSlider("Gap", "layout.cardGap", L.cardGap, 4, 200, 1) +
        subSlider("Rows", "layout.cardRowGap", L.cardRowGap, 4, 200, 1);
    } else { sb.hidden = true; sb.innerHTML = ""; }
  }
  // ---- category navigation: sub-categories + gallery-mode categories ------
  function ensureGalleryPage(slug) {
    var list = D.works[slug] = D.works[slug] || [];
    for (var k = 0; k < list.length; k++) if (list[k] && list[k].type === "page") return k;
    var nm = (D.categories.filter(function (c) { return c.slug === slug; })[0] || {}).name || "Gallery";
    list.unshift({ type: "page", slug: slug + "-gallery", title: nm, view: "grid", gridMode: "native", gridCols: 3, gridGap: 8, body: [] });
    return 0;
  }
  function goCat(slug) {
    workCat = slug; workSub = "__all__"; selected = null;
    var cat = D.categories.filter(function (c) { return c.slug === slug; })[0] || {};
    openPage = cat.mode === "gallery" ? ensureGalleryPage(slug) : null;
  }
  function showWork() {
    page = "work"; selected = null;
    [].forEach.call(el("st-pages").children, function (b) { b.classList.toggle("is-on", b.getAttribute("data-page") === "work"); });
    renderSubbar(); renderCanvas(); renderInspector();
  }
  function catCrumbs(slug) {
    var byslug = {}; D.categories.forEach(function (c) { byslug[c.slug] = c; });
    var path = [], cur = byslug[slug];
    while (cur) { path.unshift(cur); cur = cur.parent ? byslug[cur.parent] : null; }
    if (path.length < 2) return "";
    return '<div class="cv-crumbs">' + path.map(function (c, i) {
      return (i ? ' <span class="cv-crumbs__sep">›</span> ' : '') + (i === path.length - 1 ? '<b>' + esc(c.name) + '</b>' : '<button data-gocat="' + esc(c.slug) + '">' + esc(c.name) + '</button>');
    }).join("") + '</div>';
  }
  function setPage(p) {
    if (p === "work") {
      if (!D.categories.some(function (c) { return c.slug === workCat; })) workCat = (D.categories.filter(function (c) { return !c.parent; })[0] || D.categories[0] || {}).slug || "";
      goCat(workCat); showWork(); return;
    }
    page = p; selected = null; openPage = null;
    [].forEach.call(el("st-pages").children, function (b) { b.classList.toggle("is-on", b.getAttribute("data-page") === p); });
    if (p === "about") selected = { kind: "about", loc: "profile" };
    renderSubbar(); renderCanvas(); renderInspector();
  }

  /* ---------- browser Back / Forward ---------------------------------- */
  // Each navigation (page switch, entering a discipline, opening a project)
  // is a history entry, so the browser's back/forward buttons just work.
  function pushHistory(replace) {
    var hash = fullEdit ? "#blog/edit/" + openPost
      : "#" + page + (page === "work" ? "/" + workCat + (openPage != null ? "/" + openPage : "") : "");
    var st = { page: page, workCat: workCat, openPage: openPage, fullEdit: fullEdit, openPost: openPost };
    try { replace ? history.replaceState(st, "", hash) : history.pushState(st, "", hash); } catch (e) {}
  }
  function applyNavState(s) {
    s = s || { page: "home" };
    // Returning (forward) into the full-screen post editor.
    if (s.fullEdit && s.openPost != null && D.posts && D.posts[s.openPost]) {
      page = "blog"; openPost = s.openPost; fullEdit = true; selected = null;
      [].forEach.call(el("st-pages").children, function (b) { b.classList.toggle("is-on", b.getAttribute("data-page") === "blog"); });
      renderSubbar(); renderCanvas(); renderInspector();
      el("postedit").classList.remove("pe-show-settings"); renderPostEdit();
      return;
    }
    // Any other state: make sure the editor overlay is closed.
    fullEdit = false; openPost = null;
    var host = el("postedit"); if (host) { host.hidden = true; host.classList.remove("pe-show-settings"); }
    page = s.page || "home";
    if (s.workCat) workCat = s.workCat;
    openPage = (s.openPage == null ? null : s.openPage);
    selected = (page === "about") ? { kind: "about", loc: "profile" } : null;
    [].forEach.call(el("st-pages").children, function (b) { b.classList.toggle("is-on", b.getAttribute("data-page") === page); });
    renderSubbar(); renderCanvas(); renderInspector();
  }
  window.addEventListener("popstate", function (e) { applyNavState(e.state); });

  /* ---------- actions (add / delete / reorder) ----------------------- */
  function move(arr, i, dir) { var j = i + dir; if (j < 0 || j >= arr.length) return false; var t = arr[i]; arr[i] = arr[j]; arr[j] = t; return true; }
  function jump(arr, i, where) { if (i < 0 || i >= arr.length) return; var it = arr.splice(i, 1)[0]; if (where === "first") arr.unshift(it); else arr.push(it); }
  function reorder(arr, i, act) { if (act === "first" || act === "last") jump(arr, i, act); else move(arr, i, act === "up" ? -1 : 1); }
  function itemAction(act, kind, loc) {
    var sy = scrollWrap ? scrollWrap.scrollTop : 0;   // keep the user's place across the re-render
    if (kind === "category") { var i = +loc; if (act === "del") { var s = D.categories[i].slug; D.categories.splice(i, 1); delete D.works[s]; if (D.categoryDesc) delete D.categoryDesc[s]; } else reorder(D.categories, i, act); }
    else if (kind === "work" || kind === "page") { var sl = loc.split(".")[0], wi = +loc.split(".")[1]; if (act === "del") { D.works[sl].splice(wi, 1); if (kind === "page" && openPage === wi) openPage = null; } else reorder(D.works[sl], wi, act); }
    else if (kind === "block") { var w = curPageItem(); if (w && w.body) { var bi = +loc; if (act === "del") w.body.splice(bi, 1); else reorder(w.body, bi, act); } }
    else if (kind === "post") { var pi = +loc; if (act === "del") D.posts.splice(pi, 1); else reorder(D.posts, pi, act); }
    else if (kind === "postblock") { var pp = D.posts[openPost]; if (pp && pp.body) { var pbi = +loc; if (act === "del") pp.body.splice(pbi, 1); else reorder(pp.body, pbi, act); } }
    else if (kind === "brand") { var bi = +loc; if (act === "del") D.brands.splice(bi, 1); else reorder(D.brands, bi, act); }
    selected = null; renderCanvas(); renderInspector();
    if (scrollWrap) scrollWrap.scrollTop = sy;
  }
  function addAction(act) {
    if (act === "add-cat") { var slug = uniqueSlug("category", D.categories.map(function (c) { return c.slug; })); D.categories.push({ slug: slug, name: "New discipline", kind: "", image: "" }); D.works[slug] = []; if (D.categoryDesc) D.categoryDesc[slug] = ""; }
    else if (act === "add-subcat") { var ssl = uniqueSlug(workCat + "-sub", D.categories.map(function (c) { return c.slug; })); D.categories.push({ slug: ssl, name: "New sub-category", kind: "", image: "", parent: workCat }); D.works[ssl] = []; }
    else if (act === "add-work") { (D.works[workCat] = D.works[workCat] || []).unshift({ en: "", he: "", client: "", sub: (workSub && workSub !== "__all__") ? workSub : "", ratio: "16 / 9", tags: [], poster: "", video: "", body: "" }); selected = { kind: "work", loc: workCat + ".0" }; }
    else if (act === "add-page") { var taken = []; Object.keys(D.works).forEach(function (s) { (D.works[s] || []).forEach(function (w) { if (w.slug) taken.push(w.slug); }); }); var ps = uniqueSlug("page", taken); (D.works[workCat] = D.works[workCat] || []).unshift({ type: "page", slug: ps, title: "New page", kind: "", cover: "", body: [] }); openPage = 0; selected = { kind: "page", loc: workCat + ".0" }; }
    else if (act === "add-post") { D.posts = D.posts || []; var pslug = uniqueSlug("post", D.posts.map(function (x) { return x.slug; }).filter(Boolean)); D.posts.unshift({ t: "New post", excerpt: "", tag: (D.blogTags || []).filter(function (t) { return t !== "All"; })[0] || "Design", d: "", r: "1 min", slug: pslug, url: "", cover: "", body: [{ type: "h", text: "Heading" }, { type: "p", text: "Write your text here…" }] }); openPostEditor(0); return; }
    else if (act === "add-brand") { var bs = uniqueSlug("brand", (D.brands || []).map(function (x) { return x.slug; })); (D.brands = D.brands || []).push({ slug: bs, name: "New brand", logo: "", intro: "" }); }
    renderSubbar(); renderCanvas(); renderInspector();
  }
  function inspectorAction(act, idx) {
    idx = idx == null ? null : +idx; var p = D.profile;
    if (act === "add-bio") (p.bio = p.bio || []).push(""); else if (act === "del-bio") p.bio.splice(idx, 1);
    else if (act === "add-stat") (p.stats = p.stats || []).push({ num: "", label: "" }); else if (act === "del-stat") p.stats.splice(idx, 1);
    else if (act === "add-social") (D.socials = D.socials || []).push({ label: "", url: "" }); else if (act === "del-social") D.socials.splice(idx, 1);
    else if (act === "add-skill") (p.skillGroups = p.skillGroups || []).push({ label: "NEW", items: [] }); else if (act === "del-skill") p.skillGroups.splice(idx, 1);
    else if (act === "reset-layout") D.layout = Object.assign({}, LAYOUT_DEFAULTS);
    renderCanvas(); renderInspector();
  }

  /* ---------- events -------------------------------------------------- */
  el("st-pages").addEventListener("click", function (e) { var b = e.target.closest("button"); if (b) { setPage(b.getAttribute("data-page")); pushHistory(); } });
  el("st-subbar").addEventListener("change", function (e) { if (e.target.id === "st-workcat") { goCat(e.target.value); showWork(); pushHistory(); } });
  el("st-subbar").addEventListener("input", function (e) { if (e.target.type === "range") liveUpdate(e.target); });

  el("canvas").addEventListener("click", function (e) {
    var subChip = e.target.closest("[data-worksub]");
    if (subChip) { workSub = subChip.getAttribute("data-worksub"); renderCanvas(); return; }
    // Clicking into editable text: let the browser place the caret, select the
    // block for the side panel, but do NOT re-render the canvas (would kill the edit).
    var cel = e.target.closest('[contenteditable="true"]');
    if (cel) { var cit = cel.closest(".cv-item"); if (cit) { selected = { kind: cit.getAttribute("data-kind"), loc: cit.getAttribute("data-loc") }; renderInspector(); } return; }
    // Grid-view per-tile delete (block, or a single gallery item)
    var gdel = e.target.closest(".pg-gdel");
    if (gdel) { gridDelete(+gdel.getAttribute("data-gloc"), gdel.hasAttribute("data-gitem") ? +gdel.getAttribute("data-gitem") : null); return; }
    // Insert a new block at a gap between elements (hover "+")
    var insAt = e.target.closest("[data-insat]");
    if (insAt) { var _it = insAt.getAttribute("data-instype"), _ik = +insAt.getAttribute("data-insat"); if (openPost != null) addPostBlockAt(_ik, _it); else addPageBlockAt(_ik, _it); return; }
    var postAdd = e.target.closest("[data-postadd]");
    if (postAdd) { addPostBlockAt(((D.posts[openPost] && D.posts[openPost].body) || []).length, postAdd.getAttribute("data-postadd")); return; }
    var actBtn = e.target.closest("[data-act]");
    if (actBtn) {
      var a = actBtn.getAttribute("data-act");
      if (a === "edit-cat") { var ic = actBtn.closest(".cv-item"); if (ic) select("category", ic.getAttribute("data-loc")); return; }
      if (a === "edit-page") { var ip = actBtn.closest(".cv-item"); if (ip) select("page", ip.getAttribute("data-loc")); return; }
      if (a === "close-page") { var ccg = D.categories.filter(function (c) { return c.slug === workCat; })[0]; if (ccg && ccg.mode === "gallery") { if (ccg.parent) { goCat(ccg.parent); showWork(); } else { setPage("home"); } pushHistory(); return; } openPage = null; selected = null; renderSubbar(); renderCanvas(); renderInspector(); pushHistory(); return; }
      if (a === "close-post") { openPost = null; selected = null; renderCanvas(); renderInspector(); pushHistory(); return; }
      if (a.indexOf("pgadd-") === 0) { addPageBlock(a.slice(6)); return; }
      if (a.indexOf("add-") === 0) { addAction(a); return; }
      var it = actBtn.closest(".cv-item"); if (it) itemAction(a, it.getAttribute("data-kind"), it.getAttribute("data-loc"));
      return;
    }
    // Only the hover pencil opens the file picker — clicking the image itself
    // just navigates/selects, like the live site.
    var editImg = e.target.closest(".cv-edit"); if (editImg) { startUpload(editImg.getAttribute("data-upload"), editImg.getAttribute("data-kind")); return; }
    var enterCat = e.target.closest("[data-entercat]");
    if (enterCat) { goCat(enterCat.getAttribute("data-entercat")); showWork(); pushHistory(); return; }
    var goc = e.target.closest("[data-gocat]");
    if (goc) { goCat(goc.getAttribute("data-gocat")); showWork(); pushHistory(); return; }
    var openCard = e.target.closest("[data-openpage]");
    if (openCard) { openPage = +openCard.getAttribute("data-openpage").split(".")[1]; selected = null; renderSubbar(); renderCanvas(); renderInspector(); pushHistory(); return; }
    var openPostCard = e.target.closest("[data-openpost]");
    if (openPostCard) { openPostEditor(+openPostCard.getAttribute("data-openpost")); return; }
    var item = e.target.closest(".cv-item"); if (item) select(item.getAttribute("data-kind"), item.getAttribute("data-loc"));
  });

  /* ---------- inline text editing: save on type (formatting is in the side panel) ----- */
  el("canvas").addEventListener("input", function (e) {
    var ce = e.target.closest("[data-edit]"); if (ce) { setPath(D, ce.getAttribute("data-edit"), cleanHTML(ce.innerHTML)); return; }
    var ap = e.target.closest("[data-aedit]"); if (ap) setPath(D, ap.getAttribute("data-aedit"), ap.textContent);
  });
  el("canvas").addEventListener("keydown", function (e) {
    var ce = e.target.closest('h3[data-edit]'); if (ce && e.key === "Enter") { e.preventDefault(); ce.blur(); }
  });
  el("canvas").addEventListener("paste", function (e) {
    var ce = e.target.closest("[data-edit], [data-aedit]"); if (!ce) return;
    e.preventDefault();
    var t = ((e.clipboardData || window.clipboardData).getData("text/plain") || "");
    document.execCommand("insertText", false, t);
  });

  // (Text formatting lives in the side panel — no floating toolbar.)

  // Pull a video's title from YouTube (oEmbed) and drop it into an empty title.
  // Debounced so typing/pasting a link only fires one request; never overwrites
  // a title you've already written.
  var _ytTitleTimer;
  function fetchYtTitle(videoPath, url) {
    clearTimeout(_ytTitleTimer);
    if (!/(youtube\.com|youtu\.be)/.test(url)) return;
    var enPath = videoPath.replace(/\.video$/, ".en"), cur = getPath(D, enPath);
    if (cur && cur !== "New piece") return;
    _ytTitleTimer = setTimeout(function () {
      fetch("https://www.youtube.com/oembed?url=" + encodeURIComponent(url) + "&format=json")
        .then(function (r) { return r.ok ? r.json() : null; })
        .then(function (data) {
          if (!data || !data.title) return;
          var c2 = getPath(D, enPath);
          if (c2 && c2 !== "New piece") return;
          setPath(D, enPath, data.title);
          var ti = document.querySelector('#inspector input[data-path="' + enPath + '"]');
          if (ti && (!ti.value || ti.value === "New piece")) ti.value = data.title;
          var sy = scrollWrap ? scrollWrap.scrollTop : 0; renderCanvas(); if (scrollWrap) scrollWrap.scrollTop = sy;
          status("Pulled the title from YouTube ✓", "ok"); History.commit();
        })
        .catch(function () {});
    }, 500);
  }

  function liveUpdate(t) {
    var path = t.getAttribute("data-path"); if (!path) return;
    var v = t.value, type = t.getAttribute("data-type");
    if (type === "list") v = v.split(",").map(function (x) { return x.trim(); }).filter(Boolean);
    else if (type === "num") v = parseFloat(v);
    setPath(D, path, v);
    // Pasting a video link auto-sets the card shape (Shorts → 9:16, else 16:9)
    // and pulls the YouTube title into an empty title.
    if (/^works\..+\.video$/.test(path)) {
      if (/\/shorts\//.test(v)) setPath(D, path.replace(/\.video$/, ".ratio"), "9 / 16");
      else if (/(youtube\.com|youtu\.be|vimeo\.com)/.test(v)) setPath(D, path.replace(/\.video$/, ".ratio"), "16 / 9");
      fetchYtTitle(path, v);
    }
    if (t.type === "range") { var lbl = t.parentNode.querySelector(".st-rangeval"); if (lbl) lbl.textContent = v + "px"; }
    // Layout sizes apply through CSS variables — no need to rebuild the canvas
    // (smoother while dragging); everything else re-renders to reflect the edit.
    if (path.indexOf("layout.") === 0) { applyLayoutVars(); studioMasonry(); }
    else { var sy = scrollWrap ? scrollWrap.scrollTop : 0; renderCanvas(); if (scrollWrap) scrollWrap.scrollTop = sy; }
  }
  // Sub-category dropdown: pick an existing group, or "+ New group…" to make one.
  function chooseSub(sel, path) {
    var v = sel.value;
    if (v === "__newsub__") {
      v = (window.prompt("New group name (the filter chip on the category page):", "") || "").trim();
      if (!v) { renderInspector(); return; }   // cancelled — restore the dropdown to its saved value
    }
    var sy = scrollWrap ? scrollWrap.scrollTop : 0;
    setPath(D, path, v);
    renderCanvas(); renderInspector();
    if (scrollWrap) scrollWrap.scrollTop = sy;
  }
  el("inspector").addEventListener("input", function (e) { liveUpdate(e.target); });
  el("inspector").addEventListener("change", function (e) {
    if (e.target.getAttribute && e.target.getAttribute("data-pageassign") != null) { assignPage(e.target.getAttribute("data-pageassign"), e.target.checked); return; }
    if (e.target.getAttribute && e.target.getAttribute("data-subselect") != null) { chooseSub(e.target, e.target.getAttribute("data-subselect")); return; }
    if (e.target.tagName === "SELECT") liveUpdate(e.target);
  });
  el("inspector").addEventListener("click", function (e) {
    var addBtn = e.target.closest("[data-act]"); if (addBtn && addBtn.getAttribute("data-act").indexOf("add-") === 0) { addAction(addBtn.getAttribute("data-act")); return; }
    var up = e.target.closest("[data-upload]"); if (up) { startUpload(up.getAttribute("data-upload"), up.getAttribute("data-kind")); return; }
    var clr = e.target.closest("[data-clear]"); if (clr) { setPath(D, clr.getAttribute("data-clear"), ""); renderCanvas(); renderInspector(); return; }
    var sv = e.target.closest("[data-setview]"); if (sv) { var pw = curPageItem(); if (pw) { pw.defaultView = sv.getAttribute("data-setview"); renderCanvas(); renderInspector(); } return; }
    var sg = e.target.closest("[data-setgrid]"); if (sg) { var pg2 = curPageItem(); if (pg2) { pg2.gridMode = sg.getAttribute("data-setgrid"); renderCanvas(); renderInspector(); } return; }
    var sgm = e.target.closest("[data-setgmode]"); if (sgm) { var gw = curPageItem(); if (gw && selected && selected.kind === "block") { var gb = gw.body[+selected.loc]; if (gb && gb.type === "gallery") { gb.mode = sgm.getAttribute("data-setgmode"); renderCanvas(); renderInspector(); } } return; }
    var spv = e.target.closest("[data-setpageview]"); if (spv) { var pw3 = curPageItem(); if (pw3) { pw3.view = spv.getAttribute("data-setpageview"); renderCanvas(); renderInspector(); } return; }
    var spm = e.target.closest("[data-setpagegmode]"); if (spm) { var pw4 = curPageItem(); if (pw4) { pw4.gridMode = spm.getAttribute("data-setpagegmode"); renderCanvas(); renderInspector(); } return; }
    var sal = e.target.closest("[data-setalign]"); if (sal) { var ab = curTextBlock(); if (ab) { ab.align = sal.getAttribute("data-setalign"); renderCanvas(); renderInspector(); } return; }
    var sdir = e.target.closest("[data-setdir]"); if (sdir) { var db = curTextBlock(); if (db) { db.dir = sdir.getAttribute("data-setdir"); renderCanvas(); renderInspector(); } return; }
    var sfmt = e.target.closest("[data-setfmt]"); if (sfmt) { var fb = curTextBlock(); if (fb) { var fk = sfmt.getAttribute("data-setfmt"); fb[fk] = !fb[fk]; renderCanvas(); renderInspector(); } return; }
    var scol = e.target.closest("[data-setcolor]"); if (scol) { var cb = curTextBlock(); if (cb) { var cv = scol.getAttribute("data-setcolor"); if (cv) cb.color = cv; else delete cb.color; renderCanvas(); renderInspector(); } return; }
    var scm = e.target.closest("[data-setcatmode]"); if (scm) { var ci = +scm.getAttribute("data-ci"); var cc2 = D.categories[ci]; if (cc2) { cc2.mode = scm.getAttribute("data-setcatmode"); if (cc2.mode === "gallery") ensureGalleryPage(cc2.slug); if (cc2.slug === workCat) { goCat(workCat); showWork(); } else { renderCanvas(); renderInspector(); } } return; }
    var galAdd = e.target.closest("[data-galadd]"); if (galAdd) { galleryAction("add", null, galAdd.getAttribute("data-galadd")); return; }
    var galDel = e.target.closest("[data-galdel]"); if (galDel) { galleryAction("del", +galDel.getAttribute("data-galdel")); return; }
    var bact = e.target.closest("[data-bact]"); if (bact) { postBodyAction(bact.getAttribute("data-bact"), +bact.getAttribute("data-bidx")); return; }
    var badd = e.target.closest("[data-baddtype]"); if (badd) { addBlock(badd.getAttribute("data-baddtype")); return; }
    var ia = e.target.closest("[data-iact]"); if (ia) { inspectorAction(ia.getAttribute("data-iact"), ia.getAttribute("data-idx")); }
  });

  /* ---------- drag-to-reorder: posts on the canvas, content blocks in the inspector --- */
  function clearDragOver(root) { [].forEach.call(root.querySelectorAll(".drag-over"), function (n) { n.classList.remove("drag-over"); }); }
  var dragPost = null, dragBlk = null, dragWork = null, dragGrid = null;
  var canvasEl = el("canvas"), inspEl = el("inspector");

  // Auto-scroll the canvas while dragging a card/post near the top or bottom
  // edge, so you can drop it far from where you grabbed it.
  var scrollWrap = document.querySelector(".st-canvas-wrap");
  var dragY = 0, autoScrollTimer = null;
  function autoScrollTick() {
    if (dragPost == null && dragWork == null && dragGrid == null) { stopAutoScroll(); return; }
    if (!scrollWrap) return;
    var r = scrollWrap.getBoundingClientRect(), edge = 80, maxSpeed = 16, dy = 0;
    if (dragY < r.top + edge) dy = -maxSpeed * Math.min(1, (r.top + edge - dragY) / edge);
    else if (dragY > r.bottom - edge) dy = maxSpeed * Math.min(1, (dragY - (r.bottom - edge)) / edge);
    if (dy) scrollWrap.scrollTop += dy;
  }
  function startAutoScroll() { if (autoScrollTimer == null) autoScrollTimer = setInterval(autoScrollTick, 16); }
  function stopAutoScroll() { if (autoScrollTimer != null) { clearInterval(autoScrollTimer); autoScrollTimer = null; } }
  if (scrollWrap) scrollWrap.addEventListener("dragover", function (e) {
    if (dragPost == null && dragWork == null && dragGrid == null) return;
    dragY = e.clientY; e.preventDefault();
  });

  canvasEl.addEventListener("dragstart", function (e) {
    var gh = e.target.closest(".pg-gdrag");
    if (gh) { dragGrid = { j: +gh.getAttribute("data-gloc"), k: gh.hasAttribute("data-gitem") ? +gh.getAttribute("data-gitem") : null }; dragY = e.clientY; startAutoScroll(); e.dataTransfer.effectAllowed = "move"; try { e.dataTransfer.setData("text/plain", "g"); } catch (_) {} return; }
    var h = e.target.closest(".cv-drag"); if (!h) return;
    var it = h.closest(".cv-item"); if (!it) return;
    var kind = it.getAttribute("data-kind");
    if (kind === "post") dragPost = +it.getAttribute("data-loc");
    else if (kind === "work") dragWork = +String(it.getAttribute("data-loc")).split(".")[1];
    else return;
    dragY = e.clientY; startAutoScroll();
    e.dataTransfer.effectAllowed = "move"; try { e.dataTransfer.setData("text/plain", "1"); } catch (_) {}
  });
  canvasEl.addEventListener("dragover", function (e) {
    if (dragGrid) { var gt = e.target.closest(".pg-gmedia, .pg-gspan"); if (!gt) return; e.preventDefault(); if (!gt.classList.contains("drag-over")) { clearDragOver(canvasEl); gt.classList.add("drag-over"); } return; }
    var kind = dragWork != null ? "work" : (dragPost != null ? "post" : null); if (!kind) return;
    var t = e.target.closest('.cv-item[data-kind="' + kind + '"]'); if (!t) return;
    e.preventDefault();
    if (!t.classList.contains("drag-over")) { clearDragOver(canvasEl); t.classList.add("drag-over"); }
  });
  canvasEl.addEventListener("drop", function (e) {
    if (dragGrid) {
      var gt = e.target.closest(".pg-gmedia, .pg-gspan"); clearDragOver(canvasEl);
      if (gt) { e.preventDefault(); gridReorder(dragGrid, { j: +gt.getAttribute("data-loc"), k: gt.hasAttribute("data-gitem") ? +gt.getAttribute("data-gitem") : null }); }
      dragGrid = null; selected = null; renderCanvas(); renderInspector(); return;
    }
    if (dragWork != null) {
      var tw = e.target.closest('.cv-item[data-kind="work"]'); clearDragOver(canvasEl);
      if (tw) {
        e.preventDefault();
        var tow = +String(tw.getAttribute("data-loc")).split(".")[1], lst = D.works[workCat];
        if (lst && tow !== dragWork && dragWork < lst.length) { var mv = lst.splice(dragWork, 1)[0]; lst.splice(tow, 0, mv); }
      }
      dragWork = null; selected = null; renderCanvas(); renderInspector(); return;
    }
    if (dragPost != null) {
      var t = e.target.closest('.cv-item[data-kind="post"]'); clearDragOver(canvasEl);
      if (t) { e.preventDefault(); var to = +t.getAttribute("data-loc"); if (to !== dragPost) { var it = D.posts.splice(dragPost, 1)[0]; D.posts.splice(to, 0, it); } }
      dragPost = null; selected = null; renderCanvas(); renderInspector();
    }
  });
  canvasEl.addEventListener("dragend", function () { dragPost = null; dragWork = null; dragGrid = null; clearDragOver(canvasEl); stopAutoScroll(); });

  inspEl.addEventListener("dragstart", function (e) {
    var h = e.target.closest(".st-blk__drag"); if (!h) return;
    var row = h.closest(".st-blk"); if (!row) return;
    dragBlk = +row.getAttribute("data-bidx");
    e.dataTransfer.effectAllowed = "move"; try { e.dataTransfer.setData("text/plain", String(dragBlk)); } catch (_) {}
  });
  inspEl.addEventListener("dragover", function (e) {
    if (dragBlk == null) return;
    var t = e.target.closest(".st-blk"); if (!t) return;
    e.preventDefault();
    if (!t.classList.contains("drag-over")) { clearDragOver(inspEl); t.classList.add("drag-over"); }
  });
  inspEl.addEventListener("drop", function (e) {
    if (dragBlk == null) return;
    var t = e.target.closest(".st-blk"); clearDragOver(inspEl);
    if (t) { e.preventDefault(); moveBlockTo(dragBlk, +t.getAttribute("data-bidx")); }
    dragBlk = null;
  });
  inspEl.addEventListener("dragend", function () { dragBlk = null; clearDragOver(inspEl); });

  el("st-connect").addEventListener("click", connect);
  el("st-save").addEventListener("click", save);
  var _stMz; window.addEventListener("resize", function () { clearTimeout(_stMz); _stMz = setTimeout(studioMasonry, 120); });

  /* ---------- edit history: Undo / Redo ------------------------------
     A change history for the *content* (the D object that holds the whole
     editable site). After every settled edit we snapshot D; Undo/Redo step
     through those snapshots and re-render. Snapshots are compared by their
     JSON signature, so selecting a tile, navigating, or clicking empty space
     never adds an entry — only a real change does. (Separate from the
     pushHistory() above, which only drives the browser Back / Forward.) */
  function isTextTarget(t) {
    if (!t) return false;
    var tag = (t.tagName || "").toLowerCase();
    return tag === "input" || tag === "textarea" || tag === "select" || t.isContentEditable === true;
  }
  var History = (function () {
    var stack = [], ptr = -1, lastSig = "", CAP = 60, timer = null;
    function sig() { return JSON.stringify(D); }
    function buttons() {
      var u = el("st-undo"), r = el("st-redo");
      if (u) u.disabled = ptr <= 0;
      if (r) r.disabled = ptr >= stack.length - 1;
    }
    function commit() {
      if (timer) { clearTimeout(timer); timer = null; }
      var s = sig();
      if (s === lastSig) return;          // nothing actually changed
      stack = stack.slice(0, ptr + 1);    // a fresh edit drops any redo branch
      stack.push(s);
      if (stack.length > CAP) stack.shift();
      ptr = stack.length - 1;
      lastSig = s; buttons();
    }
    function commitSoon() { if (timer) clearTimeout(timer); timer = setTimeout(commit, 350); }
    function sanitizeNav() {
      // The snapshot may predate whatever page / post / discipline is open now.
      if (!D.categories.some(function (c) { return c.slug === workCat; }))
        workCat = (D.categories.filter(function (c) { return !c.parent; })[0] || D.categories[0] || {}).slug || "";
      workSub = "__all__";
      var list = D.works[workCat];
      if (openPage != null && !(list && list[openPage] && list[openPage].type === "page")) openPage = null;
      if (openPost != null && !(D.posts && D.posts[openPost])) { openPost = null; fullEdit = false; }
      selected = (page === "about") ? { kind: "about", loc: "profile" } : null;
    }
    function reRender() {
      sanitizeNav();
      renderSubbar(); renderCanvas(); renderInspector();
      var pe = el("postedit");
      if (fullEdit && openPost != null && D.posts && D.posts[openPost]) { if (pe) pe.hidden = false; renderPostEdit(); }
      else if (pe) { pe.hidden = true; pe.classList.remove("pe-show-settings"); }
      applyLayoutVars(); studioMasonry();
    }
    function go(delta) {
      var n = ptr + delta;
      if (n < 0 || n >= stack.length) return;
      ptr = n; D = JSON.parse(stack[ptr]); lastSig = stack[ptr];
      reRender(); buttons();
      status(delta < 0 ? "↶ Undone" : "↷ Redone", "ok");
    }
    return {
      init: function () { stack = [sig()]; ptr = 0; lastSig = stack[0]; buttons(); },
      commit: commit, commitSoon: commitSoon,
      undo: function () { go(-1); }, redo: function () { go(1); }
    };
  })();

  // Snapshot after any settled edit inside the editing surfaces. We let the
  // existing handlers run first (they're bound earlier), so D is already
  // changed by the time we read it; the signature check ignores no-op events.
  ["canvas", "inspector", "postedit", "st-subbar"].forEach(function (id) {
    var node = el(id); if (!node) return;
    node.addEventListener("input", History.commitSoon, false);   // typing / sliders → debounced
    node.addEventListener("change", function () { History.commit(); }, false);
    node.addEventListener("focusout", function () { History.commit(); }, false);
    node.addEventListener("click", function () { History.commit(); }, false);
    node.addEventListener("drop", function () { History.commit(); }, false);
    node.addEventListener("dragend", function () { History.commit(); }, false);
  });
  document.addEventListener("keydown", function (e) {
    if (!(e.ctrlKey || e.metaKey)) return;
    var k = (e.key || "").toLowerCase();
    var redo = (k === "z" && e.shiftKey) || k === "y", undo = k === "z" && !e.shiftKey;
    if (!undo && !redo) return;
    if (isTextTarget(e.target)) return;   // inside a text box: use the browser's own undo
    e.preventDefault();
    redo ? History.redo() : History.undo();
  });

  // Undo/Redo live behind one History button (a popover), so the toolbar
  // stays uncluttered — you only see the controls when you want them.
  (function historyPopover() {
    var wrap = document.querySelector(".st-history-wrap"), btn = el("st-history"), pop = el("st-history-pop");
    if (!wrap || !btn || !pop) return;
    function open() { pop.hidden = false; btn.classList.add("is-open"); btn.setAttribute("aria-expanded", "true"); }
    function close() { pop.hidden = true; btn.classList.remove("is-open"); btn.setAttribute("aria-expanded", "false"); }
    btn.addEventListener("click", function (e) { e.stopPropagation(); pop.hidden ? open() : close(); });
    el("st-undo").addEventListener("click", function () { History.undo(); });   // popover stays open for repeat undos
    el("st-redo").addEventListener("click", function () { History.redo(); });
    document.addEventListener("click", function (e) { if (!pop.hidden && !wrap.contains(e.target)) close(); });
    document.addEventListener("keydown", function (e) { if (e.key === "Escape" && !pop.hidden) close(); });
  })();

  /* ---------- boot ---------------------------------------------------- */
  if (!FS_SUPPORTED || location.protocol === "file:") {
    var banner = el("st-banner"); banner.hidden = false;
    banner.innerHTML = !FS_SUPPORTED
      ? "This editor needs <b>Chrome</b> or <b>Edge</b> on a computer to save. You can look around, but Save/Upload won't work here."
      : "Open the Studio with the <b>Start-Studio</b> launcher (it runs at <code>http://localhost</code>). Opened as a file, saving is blocked.";
  }
  restore();
  setPage("home");
  pushHistory(true);
  History.init();
})();
