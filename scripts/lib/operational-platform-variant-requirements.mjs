export const REQUIRED_BROWSER_DIMENSIONS = new Set([
  "chromium",
  "firefox",
  "webkit",
  "reduced-motion",
  "color-scheme",
  "timezone",
  "locale",
  "device-scale-factor",
  "mobile-viewport",
  "tablet-viewport",
  "desktop-viewport",
]);

export const REQUIRED_WEBVIEW_PLATFORMS = new Set(["ios-wkwebview", "android-webview"]);
export const REQUIRED_WEBVIEW_CONSTRAINTS = new Set(["storage", "cookies", "redirects", "downloads", "file_uploads"]);

export const REQUIRED_INPUT_VARIANTS = new Set([
  "keyboard",
  "pointer",
  "touch",
  "screen-reader-semantics",
  "ime-input",
  "paste",
  "drag-drop",
  "high-contrast",
  "platform-permissions",
]);

export const REQUIRED_DOWNLOAD_CLASSES = new Set([
  "csv",
  "pdf",
  "generated-reports",
  "signed-links",
  "browser-download-names",
  "content-type",
  "content-disposition",
]);
