/**
 * apiBase.ts — owned by AGENT-APP.
 *
 * Single source of truth for where the backend lives.
 *
 * - Web build (`npm run dev` / `next build`): NEXT_PUBLIC_API_BASE is unset, so
 *   API_BASE === "" and every helper returns the path unchanged (relative URL,
 *   same-origin). Nothing changes for the browser.
 * - Android build (Capacitor): the app is wrapped around http://<lan-ip>:3000,
 *   so NEXT_PUBLIC_API_BASE is baked in at build time and every request/media
 *   URL becomes absolute against the laptop on the LAN.
 *
 * NOTE: `process.env.NEXT_PUBLIC_API_BASE` MUST be written as a literal member
 * expression (not destructured, not dynamic) so Next.js can statically inline
 * it into the client bundle at build time.
 */

function stripTrailingSlashes(value: string): string {
  return value.replace(/\/+$/, "");
}

/**
 * Base origin of the backend, e.g. "http://192.168.1.7:3000".
 * Empty string on the web build → all helpers produce relative URLs.
 */
export const API_BASE: string = stripTrailingSlashes(
  (process.env.NEXT_PUBLIC_API_BASE ?? "").trim()
);

/** True when the app was built to talk to a remote backend (Android wrapper). */
export function hasRemoteBase(): boolean {
  return API_BASE.length > 0;
}

function isAbsoluteUrl(path: string): boolean {
  return /^(https?:)?\/\//i.test(path) || /^(data|blob|file):/i.test(path);
}

function join(base: string, path: string): string {
  if (!path) return base || "/";

  // Absolute or already-qualified URLs (and data:/blob:) pass through untouched.
  if (isAbsoluteUrl(path)) return path;

  // No base configured → return the path as-is (relative, same-origin).
  if (!base) return path.startsWith("/") ? path : `/${path}`;

  // Exactly one slash at the seam.
  const suffix = path.startsWith("/") ? path : `/${path}`;
  return `${base}${suffix}`;
}

/**
 * Build an API endpoint URL.
 *   apiUrl("/api/generate")  → "/api/generate"                         (web)
 *   apiUrl("/api/generate")  → "http://192.168.1.7:3000/api/generate"  (android)
 */
export function apiUrl(path: string): string {
  return join(API_BASE, path);
}

/**
 * Build a media/static asset URL (reels, posters, images).
 * Absolute http(s):// URLs and data: URLs pass through unchanged, so this is
 * safe to call on values that may already be fully qualified (e.g. Wikimedia).
 *   mediaUrl("/reels/x.mp4")        → "/reels/x.mp4"                        (web)
 *   mediaUrl("/reels/x.mp4")        → "http://192.168.1.7:3000/reels/x.mp4" (android)
 *   mediaUrl("https://a/b.jpg")     → "https://a/b.jpg"
 *   mediaUrl("data:image/png;...")  → unchanged
 */
export function mediaUrl(path: string): string {
  return join(API_BASE, path);
}
