# ASCII Studio

A local image-to-ASCII converter. The web interface and the Android shell use the same React application and standalone TypeScript core.

| Project | Purpose |
| --- | --- |
| apps/web | File selection, presets, Canvas preview and PNG export |
| packages/ascii-core | Reusable pixel-to-ASCII conversion |
| android | Capacitor app with native PNG saving through Android's document picker |

## Try on the web

With Node.js 24, run:

```sh
npm ci
npm run dev
```

Open the URL Vite prints. Try the built-in cosmic sample or choose a PNG, JPEG or WebP file. Adjust the ASCII preview and export a PNG. Input files stay on the device. `npm run build` creates the static site in `dist/`.

## Build Android

Use JDK 21 and Android SDK Platform 36 with Build Tools 36.0.0.

```sh
npm ci
npm run android:sync
cd android
./gradlew :app:assembleDebug
```

The debug APK is at `android/app/build/outputs/apk/debug/app-debug.apk` from the repository root. The GitHub Actions run also uploads a ZIP containing the APK. Open the synced Android project in Android Studio to install it on a test device. The document picker asks where to save the PNG.

## Implementation order

1. Build and test the core package in isolation. Verify that a separate project can install the packed package and import its API and TypeScript types.
2. Decode supported images locally to RGBA, bound the conversion input size, and pass the pixels to the core. Check sample rendering, custom settings, invalid files and PNG output.
3. Serve the same static build as a private web preview. Verify desktop and phone-sized layouts and the upload-to-export flow.
4. Bundle the web build in Capacitor. Compile an Android debug APK and verify file selection, conversion, saving and cancellation on a physical device before release.
5. Evaluate video decoding and encoding independently on web and Android. Define format and audio support once the export path has been measured.

Run `npm test` to check the conversion core. [Architecture](ARCHITECTURE.md) and [core integration](packages/ascii-core/README.md) describe the design and API.
