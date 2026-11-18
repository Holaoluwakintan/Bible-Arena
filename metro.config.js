const { getDefaultConfig } = require("expo/metro-config");
const { withNativeWind } = require("nativewind/metro");

const config = getDefaultConfig(__dirname, {
  isCSSEnabled: true,
});

for (const ext of ["sql", "mjs"]) {
  if (!config.resolver.sourceExts.includes(ext)) config.resolver.sourceExts.push(ext);
}

module.exports = withNativeWind(config, { input: "./global.css" });
