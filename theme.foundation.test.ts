import { describe, expect, it } from "vitest";

import { themeColors } from "../theme.config";

describe("Bible Arena design foundation", () => {
  it("defines a complete light and dark palette for the mobile UI", () => {
    const requiredTokens = [
      "primary",
      "background",
      "surface",
      "foreground",
      "muted",
      "border",
      "success",
      "warning",
      "error",
    ] as const;

    for (const token of requiredTokens) {
      expect(themeColors[token].light).toMatch(/^#/);
      expect(themeColors[token].dark).toMatch(/^#/);
    }
  });

  it("keeps the brand contrast direction intact", () => {
    expect(themeColors.background.dark).not.toBe(themeColors.surface.dark);
    expect(themeColors.primary.dark).not.toBe(themeColors.background.dark);
    expect(themeColors.foreground.dark).not.toBe(themeColors.background.dark);
  });
});
