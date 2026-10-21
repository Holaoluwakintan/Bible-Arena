import { describe, it, expect } from "vitest";
import { makeRelay } from "../server/v3/ads";

const N = "0123456789abcdef0123456789abcdef";
describe("v3.8.3 rewarded-ad relay", () => {
  it("accepts only valid nonces and states", () => {
    const r = makeRelay();
    expect(r.set("short", "reward")).toBe(null);
    expect(r.set(N, "granted")).toBe(null);
    expect(r.set(N + "!", "reward")).toBe(null);
    expect(r.get(N)).toBe(null);
  });
  it("open -> reward is final; late open/dismiss never undo a reward", () => {
    const r = makeRelay();
    expect(r.set(N, "open")).toBe("open");
    expect(r.get(N)).toBe("open");
    expect(r.set(N, "reward")).toBe("reward");
    expect(r.set(N, "dismiss")).toBe("reward");
    expect(r.set(N, "open")).toBe("reward");
    expect(r.get(N)).toBe("reward");
  });
  it("an ending is not overwritten by a late open", () => {
    const r = makeRelay();
    r.set(N, "dismiss");
    expect(r.set(N, "open")).toBe("dismiss");
    expect(r.get(N)).toBe("dismiss");
  });
  it("expires after 15 minutes and stays bounded", () => {
    const r = makeRelay();
    r.set(N, "reward", "hint", 1000);
    expect(r.get(N, 1000 + 14 * 60_000)).toBe("reward");
    expect(r.get(N, 1000 + 16 * 60_000)).toBe(null);
    for (let i = 0; i < 5200; i++) r.set(String(i).padStart(16, "x"), "open", "hint", 2_000_000);
    expect(r.size()).toBeLessThanOrEqual(5000);
  });
});
