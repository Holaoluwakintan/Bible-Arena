/* Chever avatar faces: forty flat faces in web-v3/avatars (face-01 .. face-40, SVG with a 256 px PNG copy).
   A player's avatar is stored as the id ("face-03"). Older players may still hold an emoji from the first lobby set;
   avatarHTML draws those (and a missing avatar) as the player's initial in a circle. Nothing here reads the server except the id list it already sends. */
(function (root) {
  var IDS = [];
  for (var i = 1; i <= 40; i++) IDS.push("face-" + (i < 10 ? "0" : "") + i);
  function isFace(a) { return typeof a === "string" && /^face-(0[1-9]|[1-2]\d|3\d|40)$/.test(a); }
  function src(a) { return "/v3/avatars/" + a + ".svg"; }
  // size is any CSS length; the face fills the box. Anything that is not a face id (an empty value, or an emoji from the
  // first lobby set) is drawn as the player's initial in a flat navy circle with a gold letter, never as raw text.
  function initialOf(name) {
    var m = String(name == null ? "" : name).trim().match(/[A-Za-z0-9\u00C0-\u024F]/);
    return m ? m[0].toUpperCase() : "?";
  }
  function initialHTML(name, size) {
    var s = size || "1.5em";
    return '<span class="ba-init" aria-hidden="true" style="display:inline-grid;place-items:center;width:' + s + ';height:' + s + ';border-radius:50%;background:#0B1F4B;color:#FFC300;border:1px solid #FFC300;box-sizing:border-box;font:800 calc(' + s + ' * .5)/1 system-ui,sans-serif;vertical-align:middle">' + initialOf(name) + '</span>';
  }
  function avatarHTML(a, size, name) {
    if (isFace(a)) {
      var s = size || "1.5em";
      return '<img src="' + src(a) + '" alt="" width="256" height="256" style="display:inline-block;width:' + s + ';height:' + s + ';border-radius:50%;vertical-align:middle">';
    }
    return initialHTML(name, size);
  }
  root.BAFace = { ids: IDS, isFace: isFace, src: src, html: avatarHTML, initial: initialHTML };
})(typeof window !== "undefined" ? window : globalThis);
