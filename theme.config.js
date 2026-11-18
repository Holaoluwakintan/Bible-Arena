const brand = require("./constants/chever-brand.json");

/** @type {const} */
const themeColors = {
  primary: { light: brand.gold, dark: brand.gold },
  background: { light: brand.night, dark: brand.night },
  surface: { light: brand.nightCard, dark: brand.nightCard },
  foreground: { light: brand.white, dark: brand.white },
  muted: { light: brand.nightMuted, dark: brand.nightMuted },
  border: { light: "#22304A", dark: "#22304A" },
  success: { light: "#34D399", dark: "#34D399" },
  warning: { light: "#FBBF24", dark: "#FBBF24" },
  error: { light: "#F87171", dark: "#F87171" },
};

module.exports = { themeColors };
