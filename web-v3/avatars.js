/* Chever avatars:
   - 8 custom illustrated Chever visual-pack avatars (avatar-01 .. avatar-08, WebP in /v3/assets/visual-pack/avatars/)
   - Uploaded square compressed player photo (data:image/(webp|jpeg|png);base64,..., <= 45 KB)
   - Legacy 40 flat faces in /v3/avatars/ (face-01 .. face-40, SVG)
   - Fallback circular navy+gold initials badge. */
(function (root) {
  var IDS = [];
  for (var i = 1; i <= 40; i++) IDS.push("face-" + (i < 10 ? "0" : "") + i);

  var PRESETS = [
    { id: "avatar-01", label: "Lion Crest", image: "/v3/assets/visual-pack/avatars/avatar-01.webp" },
    { id: "avatar-02", label: "Peace Dove", image: "/v3/assets/visual-pack/avatars/avatar-02.webp" },
    { id: "avatar-03", label: "Royal Crown", image: "/v3/assets/visual-pack/avatars/avatar-03.webp" },
    { id: "avatar-04", label: "Golden Harp", image: "/v3/assets/visual-pack/avatars/avatar-04.webp" },
    { id: "avatar-05", label: "Scroll & Quill", image: "/v3/assets/visual-pack/avatars/avatar-05.webp" },
    { id: "avatar-06", label: "Shield of Faith", image: "/v3/assets/visual-pack/avatars/avatar-06.webp" },
    { id: "avatar-07", label: "Glowing Lamp", image: "/v3/assets/visual-pack/avatars/avatar-07.webp" },
    { id: "avatar-08", label: "Compass Star", image: "/v3/assets/visual-pack/avatars/avatar-08.webp" }
  ];

  var MAX_PHOTO_BYTES = 45 * 1024;
  var FACE_RE = /^face-(0[1-9]|[1-2]\d|3\d|40)$/;
  var PRESET_RE = /^avatar-0[1-8]$/;
  var PHOTO_RE = /^data:image\/(?:webp|jpeg|png);base64,[A-Za-z0-9+/=]+$/;

  function isFace(a) { return typeof a === "string" && FACE_RE.test(a); }
  function isPreset(a) { return typeof a === "string" && PRESET_RE.test(a); }
  function isPhotoData(d) { return typeof d === "string" && d.length <= MAX_PHOTO_BYTES && PHOTO_RE.test(d); }

  function src(a) {
    if (isPreset(a)) return "/v3/assets/visual-pack/avatars/" + a + ".webp";
    return "/v3/avatars/" + a + ".svg";
  }

  function initialOf(name) {
    var m = String(name == null ? "" : name).trim().match(/[A-Za-z0-9\u00C0-\u024F]/);
    return m ? m[0].toUpperCase() : "?";
  }

  function initialHTML(name, size, extraClass) {
    var s = size || "1.5em";
    var cls = "ba-init" + (extraClass ? " " + extraClass : "");
    return '<span class="' + cls + '" aria-hidden="true" style="display:inline-grid;place-items:center;width:' + s + ';height:' + s + ';border-radius:50%;background:#0B1F4B;color:#FFC300;border:1.5px solid #FFC300;box-sizing:border-box;font:800 calc(' + s + ' * .46)/1 system-ui,sans-serif;vertical-align:middle;flex:none">' + initialOf(name) + '</span>';
  }

  function imgHTML(url, size, extraClass) {
    var s = size || "1.5em";
    var cls = "ba-av-img" + (extraClass ? " " + extraClass : "");
    return '<img class="' + cls + '" src="' + url + '" alt="" width="256" height="256" style="display:inline-block;width:' + s + ';height:' + s + ';border-radius:50%;object-fit:cover;vertical-align:middle;flex:none">';
  }

  function avatarHTML(a, size, name, extraClass) {
    if (a && typeof a === "object") return profileHTML(a, size, name, extraClass);
    if (isPhotoData(a)) return imgHTML(a, size, extraClass);
    if (isPreset(a) || isFace(a)) return imgHTML(src(a), size, extraClass);
    return initialHTML(name, size, extraClass);
  }

  function profileHTML(av, size, name, extraClass) {
    if (av && typeof av === "object") {
      if (av.avatarType === "photo" && isPhotoData(av.avatarData)) {
        return imgHTML(av.avatarData, size, extraClass);
      }
      if (av.avatarType === "preset" && (isPreset(av.avatarId) || isFace(av.avatarId))) {
        return imgHTML(src(av.avatarId), size, extraClass);
      }
      if (!av.avatarType && isPhotoData(av.avatarData)) return imgHTML(av.avatarData, size, extraClass);
      if (!av.avatarType && (isPreset(av.avatarId) || isFace(av.avatarId))) return imgHTML(src(av.avatarId), size, extraClass);
    }
    return initialHTML(name, size, extraClass);
  }

  function getLocal() {
    try {
      var st = JSON.parse(localStorage.getItem("ba3:v1") || "{}") || {};
      if (st.avatarType === "photo" && isPhotoData(st.avatarData)) {
        return { avatarType: "photo", avatarId: null, avatarData: st.avatarData };
      }
      if (st.avatarType === "preset" && (isPreset(st.avatarId) || isFace(st.avatarId))) {
        return { avatarType: "preset", avatarId: st.avatarId, avatarData: null };
      }
      if (st.avatarType === "none") {
        return { avatarType: "none", avatarId: null, avatarData: null };
      }
    } catch (e) {}
    try {
      var me = JSON.parse(localStorage.getItem("bal:me") || "{}") || {};
      if (isPreset(me.avatar) || isFace(me.avatar)) {
        return { avatarType: "preset", avatarId: me.avatar, avatarData: null };
      }
    } catch (e) {}
    return { avatarType: "none", avatarId: null, avatarData: null };
  }

  root.BAFace = {
    ids: IDS,
    presets: PRESETS,
    isFace: isFace,
    isPreset: isPreset,
    isPhotoData: isPhotoData,
    src: src,
    html: avatarHTML,
    profileHTML: profileHTML,
    initial: initialHTML,
    getLocal: getLocal
  };
})(typeof window !== "undefined" ? window : globalThis);
