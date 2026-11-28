import { describe, expect, it } from "vitest";
import { sanitizeProfileAvatar } from "../server/v3/avatar";
import { mergeStats } from "../server/v3/merge";

describe("profileAvatar server validation & merge (preview safety)", () => {
  it("accepts valid Chever presets, legacy faces, and none", () => {
    expect(sanitizeProfileAvatar({ avatarType: "preset", avatarId: "avatar-01" })).toEqual({
      ok: true, value: { avatarType: "preset", avatarId: "avatar-01" },
    });
    expect(sanitizeProfileAvatar({ avatarType: "preset", avatarId: "avatar-08" })).toEqual({
      ok: true, value: { avatarType: "preset", avatarId: "avatar-08" },
    });
    expect(sanitizeProfileAvatar({ avatarType: "preset", avatarId: "face-12" })).toEqual({
      ok: true, value: { avatarType: "preset", avatarId: "face-12" },
    });
    expect(sanitizeProfileAvatar({ avatarType: "none" })).toEqual({
      ok: true, value: { avatarType: "none", avatarId: null },
    });
  });

  it("rejects server photo uploads and raw avatarData in preview", () => {
    expect(sanitizeProfileAvatar({ avatarType: "photo", avatarData: "data:image/webp;base64,AAAA" })).toEqual({
      ok: false, error: "photo_sync_disabled_in_preview",
    });
    expect(sanitizeProfileAvatar({ avatarType: "preset", avatarId: "avatar-01", avatarData: "data:image/png;base64,AAAA" })).toEqual({
      ok: false, error: "photo_sync_disabled_in_preview",
    });
  });

  it("rejects unknown preset IDs or invalid types", () => {
    expect(sanitizeProfileAvatar({ avatarType: "preset", avatarId: "avatar-99" }).ok).toBe(false);
    expect(sanitizeProfileAvatar({ avatarType: "preset", avatarId: "../etc/passwd" }).ok).toBe(false);
    expect(sanitizeProfileAvatar({ avatarType: "svg" }).ok).toBe(false);
  });

  it("merges preset profileAvatar safely without overwriting an account preset", () => {
    const merged1 = mergeStats({}, { profileAvatar: { avatarType: "preset", avatarId: "avatar-03" } });
    expect(merged1.profileAvatar).toEqual({ avatarType: "preset", avatarId: "avatar-03" });

    const merged2 = mergeStats(
      { profileAvatar: { avatarType: "preset", avatarId: "avatar-02" } },
      { profileAvatar: { avatarType: "preset", avatarId: "avatar-05" } },
    );
    expect(merged2.profileAvatar).toEqual({ avatarType: "preset", avatarId: "avatar-02" });
  });
});
