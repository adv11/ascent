(function () {
  // Falls back to the pre-rename key because this classic script runs before
  // main.js's migrateLocalStorageKeys() ever gets a chance to run — without the
  // fallback, existing users would see one flash of the default theme on their
  // first post-rename load.
  var stored = localStorage.getItem('ascent-theme') || localStorage.getItem('switchprep-theme');
  var theme = stored || (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
  document.documentElement.dataset.theme = theme;

  // issue #495 — same synchronous-before-CSS-load reasoning as theme above,
  // just for the root font-size scale instead of color, so a reload never
  // shows a moment of default-sized text before snapping to the saved size.
  var textSize = localStorage.getItem('ascent-text-size');
  if (textSize === 'large' || textSize === 'largest') {
    document.documentElement.dataset.textSize = textSize;
  }
  if (localStorage.getItem('ascent-animations-off') === 'true') {
    document.documentElement.setAttribute('data-animations-off', '');
  }
})();
