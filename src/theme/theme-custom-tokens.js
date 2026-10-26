/**
 * Connectify Theme: custom colour tokens, wallpaper and glass diffusion
 *
 * Writes custom palette tokens inline on <html> and <body>, stores the student's own wallpaper
 * (falling back to extension storage when localStorage is full), shows the active theme's own
 * wallpaper over it without storing it, and toggles Liquid Glass.
 * Exposes window.ConnectifyThemeTokens.
 */
(() => {
  'use strict';

  const STORAGE_CUSTOM_COLORS = 'connectea:theme:custom_colors';
  const STORAGE_CUSTOM_BG = 'connectea:custom_background';
  const DEFAULT_CUSTOM_COLORS = {
    canvas: '#111827',
    surface: '#1f2937',
    border: '#374151',
    accent: '#6366f1',
    textPrimary: '#f9fafb',
    textSecondary: '#d1d5db'
  };
  const TOKEN_PROPS = [
    '--cx-canvas-bg', '--cx-canvas-subtle', '--cx-surface-bg', '--cx-card-bg', '--cx-surface-secondary',
    '--cx-surface-elevated', '--cx-surface-hover', '--cx-nav-bg', '--cx-border', '--cx-border-subtle',
    '--cx-border-strong', '--cx-accent', '--cx-accent-hover', '--cx-text-primary',
    '--cx-text-secondary', '--cx-tile-link-color', '--cx-button-bg', '--cx-button-hover',
    '--cx-button-text', '--cx-input-bg', '--cx-input-border',
    // Derived by theme-token-derive.js
    '--cx-text-muted', '--cx-text-disabled', '--cx-surface-active', '--cx-border-hover', '--cx-border-focus',
    '--cx-accent-active', '--cx-accent-subtle', '--cx-accent-text', '--cx-accent-link', '--cx-nav-border',
    '--cx-nav-text', '--cx-nav-text-hover', '--cx-nav-item-active', '--cx-button-active', '--cx-button-border',
    '--cx-button-border-hover', '--cx-button-text-hover', '--cx-button-primary-bg', '--cx-button-primary-hover',
    '--cx-button-primary-text', '--cx-input-text', '--cx-input-placeholder', '--cx-input-border-focus',
    '--cx-table-header-bg', '--cx-table-row-hover', '--cx-table-row-alt', '--cx-table-border', '--cx-badge-bg',
    '--cx-badge-border', '--cx-badge-text', '--cx-scrollbar-thumb', '--cx-scrollbar-track', '--cx-avatar-bg', '--cx-avatar-text',
    // Liquid Glass custom themes (theme-glass-tokens.js)
    '--cx-shadow-sm', '--cx-shadow-md', '--cx-shadow-lg'
  ];

  const isAuthDisabled = () => Boolean(window.ConnectifyThemeAuth?.isAuthDisabled());
  // Wallpapers too large for localStorage live here (and in extension storage) for the session
  let memoryBackground = null;
  // The active theme's own wallpaper: shown only while that theme is active, never stored over the student's own
  let themeBackground = null;
  const extensionStorage = () => (typeof chrome !== 'undefined' && chrome.storage?.local) || null;

  function getCustomColors() {
    try {
      const stored = localStorage.getItem(STORAGE_CUSTOM_COLORS);
      if (stored) return { ...DEFAULT_CUSTOM_COLORS, ...JSON.parse(stored) };
    } catch {}
    return { ...DEFAULT_CUSTOM_COLORS };
  }

  function storeCustomColors(colors) {
    localStorage.setItem(STORAGE_CUSTOM_COLORS, JSON.stringify(colors));
  }

  // Tokens go on <html> and <body> so a body-level rule can never shadow them
  function tokenTargets() {
    return typeof document === 'undefined' ? [] : [document.documentElement, document.body].filter(Boolean);
  }

  function clearCustomTokens() {
    for (const el of tokenTargets()) for (const prop of TOKEN_PROPS) el.style.removeProperty(prop);
    if (typeof document !== 'undefined') document.documentElement?.removeAttribute('data-connectea-tone');
  }

  /** Dark-classed themes with dark ink (the grey Liquid Glass preset, light custom themes): data colours made for
   *  dark surfaces are re-inked for light surfaces by theme-light-tone.css */
  function markTone(textPrimary) {
    const lum = window.ConnectifyThemeOklch?.luminance;
    if (!lum || !/^#[0-9a-f]{6}$/i.test(textPrimary || '') || lum(textPrimary) >= 0.2) return;
    document.documentElement.setAttribute('data-connectea-tone', 'light');
  }

  /** glass: { opacity } when the theme has Liquid Glass on, so its panels take the translucent glass recipe. */
  function applyCustomTokens(colors, glass = null) {
    const derive = window.ConnectifyThemeDerive;
    const c = derive ? derive.complete(colors || getCustomColors()) : (colors || getCustomColors());
    const tokens = {
      '--cx-canvas-bg': c.canvas, '--cx-canvas-subtle': c.canvasSubtle,
      '--cx-surface-bg': c.surface, '--cx-card-bg': c.surface,
      '--cx-surface-secondary': c.surfaceSecondary, '--cx-surface-elevated': c.surfaceElevated,
      '--cx-surface-hover': c.surfaceHover, '--cx-nav-bg': c.surfaceSecondary || c.surface,
      '--cx-border': c.border, '--cx-border-subtle': c.borderSubtle, '--cx-border-strong': c.borderStrong,
      '--cx-accent': c.accent, '--cx-accent-hover': c.accentHover,
      '--cx-text-primary': c.textPrimary, '--cx-text-secondary': c.textSecondary, '--cx-text-muted': c.textMuted,
      '--cx-tile-link-color': c.tileLinkColor || c.textPrimary,
      '--cx-button-bg': c.button, '--cx-button-hover': c.buttonHover, '--cx-button-text': c.buttonText,
      '--cx-input-bg': c.inputBg, '--cx-input-border': c.inputBorder,
      // Every other token (nav, table, badge, focus, primary buttons ...) derived from the ones above
      ...(derive?.cssProps(c) || {}),
      ...(glass ? window.ConnectifyThemeGlassTokens?.props(c, glass.opacity) || {} : {})
    };
    // Clear first so a token the previous custom theme set but this one omits does not linger
    clearCustomTokens();
    for (const el of tokenTargets()) {
      for (const [prop, value] of Object.entries(tokens)) if (value) el.style.setProperty(prop, value);
    }
    markTone(c.textPrimary);
  }

  function getCustomBackground() {
    try { return localStorage.getItem(STORAGE_CUSTOM_BG) || memoryBackground; } catch { return memoryBackground; }
  }

  const getThemeBackground = () => themeBackground;
  /** The wallpaper on screen: the active theme's own, else the one picked in Settings. */
  const getActiveBackground = () => themeBackground || getCustomBackground();

  function applyCustomBackground(bgUrl = getActiveBackground()) {
    if (typeof document === 'undefined' || !document.documentElement) return;
    const root = document.documentElement;
    if (bgUrl && !isAuthDisabled()) {
      root.setAttribute('data-connectea-has-custom-bg', 'true');
      // Chrome drops CSS url()s over 2 MB: large data URLs are painted through a blob: URL (theme-boot.js)
      root.style.setProperty('--cx-custom-bg-image', `url("${window.ConnectifyThemeBoot?.cssUrl(bgUrl) ?? bgUrl}")`);
    } else {
      root.removeAttribute('data-connectea-has-custom-bg');
      root.style.removeProperty('--cx-custom-bg-image');
    }
    // Dim the wallpaper just enough for white text (theme-wallpaper-dim.js loads after this script and measures on its own)
    window.ConnectifyWallpaperDim?.update(bgUrl && !isAuthDisabled() ? bgUrl : null);
    window.ConnectifyThemeBoot?.save();
  }

  /** Where the wallpaper on screen comes from, for the next page load's boot snapshot (theme-boot.js). */
  function backgroundSource() {
    const url = getActiveBackground();
    if (!url || isAuthDisabled()) return null;
    return window.ConnectifyThemeBoot?.sourceOf(url, Boolean(themeBackground)) || null;
  }

  function clearCustomBackground() {
    memoryBackground = null;
    try { localStorage.removeItem(STORAGE_CUSTOM_BG); } catch {}
    try { extensionStorage()?.remove(STORAGE_CUSTOM_BG); } catch {}
    applyCustomBackground();
  }

  /** Called by the registry on every theme apply: a theme without a wallpaper shows the student's own again. */
  function setThemeBackground(url) {
    themeBackground = url || null;
    applyCustomBackground();
  }

  function setCustomBackground(dataUrl) {
    if (!dataUrl) {
      clearCustomBackground();
      return;
    }
    // Large wallpapers can exceed the localStorage quota; extension storage still keeps them
    memoryBackground = dataUrl;
    try { localStorage.setItem(STORAGE_CUSTOM_BG, dataUrl); } catch {}
    try { extensionStorage()?.set({ [STORAGE_CUSTOM_BG]: dataUrl }); } catch {}
    applyCustomBackground();
  }

  /** Restores a wallpaper that only extension storage could hold. */
  function restoreBackgroundFromExtensionStorage() {
    const store = extensionStorage();
    if (!store || getCustomBackground()) return;
    try {
      store.get([STORAGE_CUSTOM_BG], res => {
        const url = res?.[STORAGE_CUSTOM_BG];
        if (!url || getCustomBackground()) return;
        memoryBackground = url;
        applyCustomBackground();
      });
    } catch {}
  }

  function setGlassDiffusion(enable) {
    if (typeof document === 'undefined' || !document.documentElement) return;
    if (enable) document.documentElement.setAttribute('data-connectea-glass', 'true');
    else document.documentElement.removeAttribute('data-connectea-glass');
  }

  window.ConnectifyThemeTokens = {
    DEFAULT_CUSTOM_COLORS,
    getCustomColors,
    storeCustomColors,
    applyCustomTokens,
    clearCustomTokens,
    tokenTargets,
    getCustomBackground,
    getThemeBackground,
    getActiveBackground,
    setThemeBackground,
    setCustomBackground,
    clearCustomBackground,
    applyCustomBackground,
    backgroundSource,
    restoreBackgroundFromExtensionStorage,
    setGlassDiffusion
  };
})();
