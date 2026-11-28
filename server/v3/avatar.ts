export interface ProfileAvatar {
  avatarType: "preset" | "none";
  avatarId: string | null;
}

const PRESET_AVATAR_RE = /^(?:avatar-0[1-8]|face-(?:0[1-9]|[1-2]\d|3\d|40))$/;
const EMPTY_AVATAR: ProfileAvatar = { avatarType: "none", avatarId: null };

export function sanitizeProfileAvatar(raw: any): { ok: true; value: ProfileAvatar } | { ok: false; error: string } {
  if (!raw || typeof raw !== "object") return { ok: false, error: "invalid_avatar" };
  if (raw.avatarData != null && raw.avatarData !== "") {
    return { ok: false, error: "photo_sync_disabled_in_preview" };
  }
  const t = String(raw.avatarType || "none").trim();
  if (t === "none") return { ok: true, value: { ...EMPTY_AVATAR } };
  if (t === "photo") return { ok: false, error: "photo_sync_disabled_in_preview" };
  if (t === "preset") {
    const id = typeof raw.avatarId === "string" ? raw.avatarId.trim() : "";
    if (!PRESET_AVATAR_RE.test(id)) return { ok: false, error: "invalid_avatar_id" };
    return { ok: true, value: { avatarType: "preset", avatarId: id } };
  }
  return { ok: false, error: "invalid_avatar_type" };
}

export function readProfileAvatar(raw: any): ProfileAvatar {
  const checked = sanitizeProfileAvatar(raw);
  return checked.ok ? checked.value : { ...EMPTY_AVATAR };
}
