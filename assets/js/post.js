/* Single blog post — renders a full article (title, meta, cover, body blocks).
   Body blocks come from data.js: {type:"h"|"p"|"img"|"video"|"quote"|"file", ...}. */
window.PAGE_INIT = function () {
  var S = window.DC.data, esc = window.DC.esc, el = window.DC.el;
  var slug = new URLSearchParams(location.search).get("slug") || "";
  var post = (S.posts || []).filter(function (p) { return p.slug === slug; })[0];

  if (!post) {
    el("pv-title").textContent = "Post not found";
    el("pv-body").innerHTML = '<p><a href="blog.html">← Back to all posts</a></p>';
    return;
  }

  document.title = post.t + " — " + S.profile.brand;
  el("pv-tag").textContent = post.tag || "";
  el("pv-title").textContent = post.t;
  el("pv-meta").innerHTML =
    '<span class="post__date">' + esc(post.d || "") + "</span>";

  el("pv-cover").innerHTML = post.cover ? '<img src="' + esc(post.cover) + '" alt="">' : "";

  var body = post.body || [];
  if (!body.length) {
    el("pv-body").innerHTML = post.url
      ? '<p class="pv-note" dir="auto">המאמר המלא עדיין מועתק לאתר. בינתיים אפשר לקרוא אותו במקור: <a href="' + esc(post.url) + '" target="_blank" rel="noopener">לפתיחת המאמר</a></p>'
      : '<p class="pv-note">Content coming soon.</p>';
    return;
  }

  function ta(b) {
    var dir = (b.dir && b.dir !== "auto") ? b.dir : "auto";
    var st = (b.align ? "text-align:" + b.align + ";" : "") + (b.size ? "font-size:" + b.size + "px;" : "") + (b.bold ? "font-weight:700;" : "") + (b.italic ? "font-style:italic;" : "") + (b.underline ? "text-decoration:underline;" : "") + (b.color ? "color:" + b.color + ";" : "");
    return ' dir="' + dir + '"' + (st ? ' style="' + st + '"' : '');
  }
  el("pv-body").innerHTML = body.map(function (b) {
    if (b.type === "h") return '<h2' + ta(b) + '>' + (b.text || "") + "</h2>";
    if (b.type === "p") return '<p' + ta(b) + '>' + (b.text || "") + "</p>";
    if (b.type === "quote") return '<blockquote' + ta(b) + '>' + (b.text || "") + "</blockquote>";
    if (b.type === "img") return '<figure><img src="' + esc(window.DC.imgSrc(b)) + '" alt="' + esc(b.alt || "") + '" loading="lazy"></figure>';
    if (b.type === "video") {
      var v = b.url || b.src || "", emb = window.DC.videoEmbed(v);
      if (!v) return "";
      return emb
        ? '<figure class="pv-video"><iframe src="' + esc(emb) + '" title="' + esc(b.alt || "video") + '" loading="lazy" allow="autoplay; fullscreen; picture-in-picture" allowfullscreen></iframe></figure>'
        : '<figure class="pv-video pv-video--file"><video src="' + esc(v) + '" controls playsinline preload="metadata"></video></figure>';
    }
    if (b.type === "file") return '<p class="pv-file" dir="auto"><a href="' + esc(b.href || "#") + '" download="' + esc(b.name || b.text || "") + '"><span class="pv-file__ico">⬇</span> ' + esc(b.text || "Download") + "</a></p>";
    return "";
  }).join("");
};
