const { themeColors } = require("./theme.config.js");

/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,jsx,ts,tsx}",
    "./components/**/*.{js,jsx,ts,tsx}",
    "./hooks/**/*.{js,jsx,ts,tsx}",
  ],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        primary: themeColors.primary.dark,
        background: themeColors.background.dark,
        surface: themeColors.surface.dark,
        foreground: themeColors.foreground.dark,
        muted: themeColors.muted.dark,
        border: themeColors.border.dark,
        success: themeColors.success.dark,
        warning: themeColors.warning.dark,
        error: themeColors.error.dark,
      },
    },
  },
  plugins: [],
};
