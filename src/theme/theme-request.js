/**
 * Connectify Theme: cross-world theme request.
 *
 * Page-world code (the theme audit, or anything else outside the extension) cannot reach
 * window.ConnectifyThemeRegistry, which lives in the isolated world. It sets
 * data-connectify-theme-request="<theme id>" on <html> and dispatches 'connectify-request-theme' on document;
 * the theme is then applied exactly as the menu applies it (glass attribute, derived tokens, wallpaper).
 */
(() => {
  'use strict';

  if (window.ConnectifyThemeRequest) return;
  window.ConnectifyThemeRequest = true;

  document.addEventListener('connectify-request-theme', () => {
    const root = document.documentElement;
    const id = root.getAttribute('data-connectify-theme-request');
    root.removeAttribute('data-connectify-theme-request');
    const registry = window.ConnectifyThemeRegistry;
    if (!id || !registry?.setTheme || !registry.getThemeDefinition?.(id)) return;
    registry.setTheme(id);
  });
})();
