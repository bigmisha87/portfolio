/* Home — renders the top-level discipline grid (sub-categories live inside
   their parent and are not shown here). */
window.PAGE_INIT = function () {
  var S = window.DC.data, esc = window.DC.esc;

  var tops = (S.categories || []).filter(function (c) { return !c.parent; });
  var html = tops.map(function (c) {
    var media = c.image
      ? '<img src="' + esc(c.image) + '" alt="' + esc(c.name) + '">'
      : '<span class="ph">[ thumbnail ]</span>';
    return '' +
      '<a class="cat-card" href="category.html?cat=' + esc(c.slug) + '">' +
        '<div class="cat-card__media">' + media + '</div>' +
        '<div class="cat-card__row">' +
          '<span class="cat-card__name">' + esc(c.name) + '</span>' +
        '</div>' +
        '<div class="cat-card__kind">' + esc(c.kind) + '</div>' +
      '</a>';
  }).join("");

  window.DC.el("home-grid").innerHTML = html;
};
