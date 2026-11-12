// Feature flags. A flag is OFF unless this file is changed and shipped.
// Nothing reads an environment variable here, so a flag cannot be turned on by accident on the live site.
export const FEATURE_FLAGS = {
  // Shared reading (partner portions, pairing, reading duels). Step 1: data model and screen stub only.
  // Chever preview flags, turned on for the live build (Michael, 2026-11-12). Also set on window.BA_FLAGS in web-v3/index.html.
  chever2Duels: true,
  sharedReading: true,
} as const;

export type FeatureFlagName = keyof typeof FEATURE_FLAGS;

export function featureOn(name: FeatureFlagName): boolean {
  return FEATURE_FLAGS[name] === true;
}
