/**
 * Platform detection & keyboard shortcut utilities.
 *
 * Auto-detects macOS vs Windows/Linux and provides helpers for
 * displaying the correct modifier key symbols in the UI.
 */

function detectPlatform(): "mac" | "windows" | "linux" {
  if (typeof navigator === "undefined") return "windows"; // SSR fallback

  // Modern API (Chromium 93+)
  const uaData = (navigator as Navigator & { userAgentData?: { platform?: string } })
    .userAgentData;
  if (uaData?.platform) {
    const p = uaData.platform.toLowerCase();
    if (p.includes("mac")) return "mac";
    if (p.includes("linux")) return "linux";
    return "windows";
  }

  // Legacy fallback
  const ua = (navigator.platform ?? navigator.userAgent).toLowerCase();
  if (/mac/.test(ua)) return "mac";
  if (/linux/.test(ua)) return "linux";
  return "windows";
}

/** Current platform (computed once on first access). */
export const PLATFORM = detectPlatform();

/** `true` on macOS, `false` on Windows / Linux. */
export const IS_MAC = PLATFORM === "mac";

/**
 * Modifier key symbol for the current platform.
 * - macOS  → `⌘`
 * - Others → `Ctrl`
 */
export const MOD = IS_MAC ? "⌘" : "Ctrl";

/**
 * Shift key symbol for the current platform.
 * - macOS  → `⇧`
 * - Others → `Shift`
 */
export const SHIFT = IS_MAC ? "⇧" : "Shift";

/**
 * Alt / Option key symbol for the current platform.
 * - macOS  → `⌥`
 * - Others → `Alt`
 */
export const ALT = IS_MAC ? "⌥" : "Alt";

/**
 * Delete key label for the current platform.
 * - macOS  → `⌫`
 * - Others → `Del`
 */
export const DEL = IS_MAC ? "⌫" : "Del";

/**
 * Returns `true` when the platform-appropriate modifier key is pressed.
 * - macOS  → `metaKey` (⌘)
 * - Others → `ctrlKey`
 */
export function isModKey(e: KeyboardEvent | React.KeyboardEvent): boolean {
  return IS_MAC ? e.metaKey : e.ctrlKey;
}

