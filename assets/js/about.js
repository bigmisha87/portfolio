/* About — fills the hero, portrait, bio, stats and "What I do" columns. */
window.PAGE_INIT = function () {
  var S = window.DC.data, esc = window.DC.esc, accentize = window.DC.accentize, el = window.DC.el;
  var p = S.profile;

  el("about-headline").textContent = p.aboutHeadline;

  // Portrait (image or placeholder)
  el("portrait-frame").innerHTML = p.portrait
    ? '<img src="' + esc(p.portrait) + '" alt="' + esc(p.name) + '">'
    : '<span class="ph">[ portrait ]</span>';
  el("portrait-name").textContent = p.name;

  // Bio
  el("bio-lead").innerHTML = accentize(p.bioLead);
  el("bio-body").innerHTML = (p.bio || []).map(function (para) {
    return '<p>' + esc(para) + '</p>';
  }).join("");

  // Stats
  el("stats").innerHTML = (p.stats || []).map(function (s) {
    return '<div class="stat"><div class="stat__num">' + esc(s.num) + '</div>' +
           '<div class="stat__label">' + esc(s.label) + '</div></div>';
  }).join("");

  // What I do
  el("do-grid").innerHTML = (p.skillGroups || []).map(function (g) {
    var items = g.items.map(function (k) { return '<span>' + esc(k) + '</span>'; }).join("");
    return '<div class="do-col">' +
             '<span class="do-col__label">' + esc(g.label) + '</span>' +
             '<div class="do-col__rule"></div>' +
             '<div class="do-col__items">' + items + '</div>' +
           '</div>';
  }).join("");
};
