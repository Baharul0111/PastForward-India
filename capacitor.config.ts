import type { CapacitorConfig } from '@capacitor/cli';

/**
 * PastForward India — Android wrapper.
 *
 * This is NOT a static-export app: the Next.js server renders the pages AND
 * serves the generated reels out of /public/reels. So the APK is a thin shell
 * that points a WebView at the Next dev/prod server running on the laptop over
 * the LAN. `server.url` wins at runtime and the bundled assets are never read.
 *
 * IMPORTANT: `webDir` deliberately points at the tiny `android/webshell` folder,
 * NOT at `public/`. Pointing it at `public/` makes `cap sync` copy ~280 MB of
 * rendered reels and image assets into the APK for nothing.
 *
 * LAN IP: 10.24.164.170  (laptop, en0 — detected via `ipconfig getifaddr en0`)
 * Start the backend with:  npm run dev:lan   (binds 0.0.0.0, not just localhost)
 * Phone and laptop MUST be on the same Wi-Fi network.
 *
 * If the laptop's IP changes (new network / DHCP lease), update LAN_URL below,
 * re-run `npx cap sync android`, and rebuild the APK.
 */

const LAN_URL = 'http://10.24.164.170:3000';

const config: CapacitorConfig = {
  appId: 'in.pastforward.app',
  appName: 'PastForward India',
  webDir: 'android/webshell',
  server: {
    // Point the WebView at the Next server on the laptop.
    url: LAN_URL,
    // Plain HTTP over the LAN — required, Android blocks cleartext by default.
    cleartext: true,
    androidScheme: 'http',
  },
  android: {
    // Show a normal WebView error page instead of a blank screen if the laptop
    // server is unreachable — makes "wrong Wi-Fi" obvious during the demo.
    allowMixedContent: true,
  },
  plugins: {
    Camera: {
      // Permissions are declared in AndroidManifest.xml; nothing to configure
      // here, but keeping the key documents that the plugin is in use.
    },
  },
};

export default config;
