/**
 * nativeCamera.ts — owned by AGENT-APP.
 *
 * Thin, SSR-safe wrapper around @capacitor/camera.
 *
 * On the web this module is inert: `isNative()` returns false and the UI should
 * keep using the plain <input type="file"> path. Inside the Android APK,
 * `pickPhotoNative()` opens the native chooser (CameraSource.Prompt) which lets
 * the user pick "Take Photo" or "Choose from Gallery".
 *
 * The Capacitor plugin modules are loaded via dynamic import() so that nothing
 * from Capacitor is pulled into the server bundle or evaluated during SSR.
 */

/**
 * True only when running inside the Capacitor native shell (the Android APK).
 * Always false in a normal browser and during SSR.
 */
export function isNative(): boolean {
  if (typeof window === "undefined") return false;
  try {
    // Capacitor injects this global in the native WebView.
    const cap = (window as any).Capacitor;
    return Boolean(cap?.isNativePlatform?.());
  } catch {
    return false;
  }
}

/**
 * Open the native photo picker (camera or gallery — the OS prompts the user).
 *
 * @returns a `data:image/jpeg;base64,...` URL ready to drop straight into an
 *          <img src> or POST to the backend, or `null` if the user cancelled
 *          or the native plugin is unavailable.
 */
export async function pickPhotoNative(): Promise<string | null> {
  if (!isNative()) return null;

  try {
    const { Camera, CameraResultType, CameraSource } = await import(
      "@capacitor/camera"
    );

    const photo = await Camera.getPhoto({
      // Prompt => native sheet with "Take Photo" + "Choose from Gallery".
      source: CameraSource.Prompt,
      resultType: CameraResultType.DataUrl,
      // Keep the payload small enough to POST comfortably over the LAN.
      quality: 80,
      width: 1280,
      correctOrientation: true,
      allowEditing: false,
      promptLabelHeader: "Add a photo",
      promptLabelPhoto: "Choose from Gallery",
      promptLabelPicture: "Take Photo",
      promptLabelCancel: "Cancel",
    });

    // dataUrl is present because resultType is DataUrl.
    return photo.dataUrl ?? null;
  } catch (err) {
    // Capacitor throws on user-cancel ("User cancelled photos app") and on
    // permission denial. Neither is an error worth surfacing — treat as no-op.
    return null;
  }
}
