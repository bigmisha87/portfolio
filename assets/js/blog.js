/* Blog — tag filter + live search over the posts in data.js. */
window.PAGE_INIT = function () {
  var S = window.DC.data, esc = window.DC.esc, el = window.DC.el;
  var state = { tag: "All", query: "" };

  var tagsEl   = el("blog-tags");
  var gridEl   = el("blog-grid");
  var emptyEl  = el("blog-empty");
  var searchEl = el("blog-search");

  function postCard(p) {
    var c = window.DC.coverOf(p);
    var cover = c ? '<img src="' + esc(c) + '" alt="">' : '[ cover image ]';
    // Migrated posts (have a body) open inside the site; others open the
    // original article until they're migrated.
    var migrated = p.slug && p.body && p.body.length;
    var href = migrated ? "post.html?slug=" + esc(p.slug) : (p.url ? esc(p.url) : "#");
    var ext = !migrated && p.url ? ' target="_blank" rel="noopener"' : "";
    return '' +
      '<a class="post" href="' + href + '"' + ext + (href === "#" ? ' onclick="return false"' : "") + '>' +
        '<div class="post__cover">' + cover + '</div>' +
        '<div class="post__tag">' + esc(p.tag) + '</div>' +
        '<div class="post__title" dir="auto">' + esc(p.t) + '</div>' +
        '<div class="post__excerpt" dir="auto">' + esc(p.excerpt) + '</div>' +
        '<div class="post__meta">' +
          '<span class="post__date">' + esc(p.d) + '</span>' +
        '</div>' +
      '</a>';
  }

  function renderTags() {
    tagsEl.innerHTML = S.blogTags.map(function (t) {
      var on = state.tag === t ? " is-on" : "";
      return '<button class="tag' + on + '" data-tag="' + esc(t) + '">' + esc(t) + '</button>';
    }).join("");
  }

  function renderPosts() {
    var q = state.query.trim().toLowerCase();
    var list = S.posts.filter(function (p) {
      var tagOk = state.tag === "All" || p.tag === state.tag;
      var qOk = !q || p.t.toLowerCase().indexOf(q) >= 0 || p.excerpt.toLowerCase().indexOf(q) >= 0;
      return tagOk && qOk;
    });
    gridEl.innerHTML = list.map(postCard).join("");
    if (list.length === 0) {
      emptyEl.textContent = 'No posts match "' + state.query + '".';
      emptyEl.hidden = false;
    } else {
      emptyEl.hidden = true;
    }
  }

  // Events
  tagsEl.addEventListener("click", function (e) {
    var b = e.target.closest(".tag");
    if (!b) return;
    state.tag = b.getAttribute("data-tag");
    renderTags();
    renderPosts();
  });
  searchEl.addEventListener("input", function (e) {
    state.query = e.target.value;
    renderPosts();
  });

  renderTags();
  renderPosts();
};
