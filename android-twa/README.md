# Bible Arena Android app (Trusted Web Activity)

A tiny Android wrapper that opens https://bible-arena.onrender.com full screen in Chrome (android-browser-helper LauncherActivity).
Because it is the live site, web updates reach the app without a new APK.

- Package: `com.holaoluwakintan.biblearena` · versionCode 1 · versionName 1.0.0 · minSdk 23 · targetSdk 35 · compileSdk 36
- AGP 8.12.0, Gradle 9.3.1 wrapper
- Signed v1+v2+v3. No native libs, so one universal APK fits every phone.
- Opens `https://bible-arena.onrender.com/?app=android`
- Signing cert SHA-256: `C7:DB:5D:12:4B:86:E5:4F:F7:42:F0:0F:7E:EE:DC:A6:2E:FF:9F:81:2A:A8:05:8E:95:39:EC:63:39:A3:B6:29`
- Site side (in this branch): `GET /.well-known/assetlinks.json` (override with env `ANDROID_CERT_SHA256` / `ANDROID_PACKAGE_NAME`),
  `GET /download/bible-arena.apk` (+ `/download`, `/app`, `/android`) redirects to `ANDROID_APK_URL`
  (default https://bible-arena-app.vercel.app/bible-arena.apk), plus a "Get the Android app" card on Home and a row in Profile > Preferences.

## Build
1. Create `local.properties` with `sdk.dir=/path/to/android-sdk` (not committed).
2. `./gradlew --no-daemon :app:assembleRelease`
3. `zipalign -p 4` the unsigned APK, then `apksigner sign --ks <your keystore> --v1-signing-enabled true --v2-signing-enabled true --v3-signing-enabled true ...`

## Signing key
The release keystore and its passwords are NOT in this repo on purpose. Keep them safe and private:
every future update must be signed with the same key, and the site's `/.well-known/assetlinks.json`
must list that key's SHA-256 fingerprint, or the app falls back to showing a browser URL bar.

To update the app shell: bump versionCode, rebuild, re-sign with the SAME keystore, re-upload the APK.
