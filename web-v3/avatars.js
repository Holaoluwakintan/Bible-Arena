/* Chever avatar faces: forty flat faces in web-v3/avatars (face-01 .. face-40, SVG with a 256 px PNG copy).
   A player's avatar is stored as the id ("face-03"). Older players may still hold an emoji from the first lobby set;
   avatarHTML shows those as text, as before. Nothing here reads the server except the id list it already sends. */
(function (root) {
  var IDS = [];
  for (var i = 1; i <= 40; i++) IDS.push("face-" + (i < 10 ? "0" : "") + i);
  function isFace(a) { return typeof a === "string" && /^face-(0[1-9]|[1-2]\d|3\d|40)$/.test(a); }
  function src(a) { return "/v3/avatars/" + a + ".svg"; }
  // size is any CSS length; the face fills the box, and a text avatar keeps its own size.
  function avatarHTML(a, size) {
    if (isFace(a)) {
      var s = size || "1.5em";
      return '<img src="' + src(a) + '" alt="" width="256" height="256" style="display:inline-block;width:' + s + ';height:' + s + ';border-radius:50%;vertical-align:middle">';
    }
    return a == null ? "" : String(a);
  }
  root.BAFace = { ids: IDS, isFace: isFace, src: src, html: avatarHTML };
})(typeof window !== "undefined" ? window : globalThis);
