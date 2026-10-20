/**
 * Connectify Theme Registry
 *
 * Registers themes, persists the active one and applies it to the page (classes, data
 * attributes, glass, custom tokens and wallpaper). Depends on theme-auth.js,
 * theme-custom-tokens.js and theme-palettes.js; theme-custom-themes.js extends it.
 * Exposes window.ConnectifyThemeRegistry.
 */
(() => {
  'use strict';

  const STORAGE_KEY = 'connectea:theme:v1';
  const STORAGE_THEME_ID = 'connectea:theme:id';
  const STORAGE_LAST_THEME = 'connectea:last_theme_id';
  const RESTORE_KEY = 'connectea:theme:restore_dark';

  const auth = window.ConnectifyThemeAuth;
  const tokens = window.ConnectifyThemeTokens;
  const { BUILTIN_PALETTES } = window.ConnectifyThemePalettes;
  const { isLoginUrl, isLogoutUrl, isAuthDisabled } = auth;

  const BUILTIN_THEMES = [
    ...Object.entries(BUILTIN_PALETTES).map(([id, p]) => ({
      id, name: p.name, icon: p.icon, isDark: p.isDark, swatch: p.swatch,
      ...(p.derived ? { liquidGlass: p.liquidGlass, glassBlur: p.glassBlur, glassOpacity: p.glassOpacity, colors: p.colors } : {})
    })),
    { id: 'light', name: 'Default', icon: '☀', isDark: false, swatch: ['#f8fafc', '#ffffff', '#3b82f6'] },
    { id: 'custom', name: 'Custom Theme', icon: '🎨', isDark: true, swatch: ['#111827', '#1f2937', '#6366f1'] }
  ];

  const registry = new Map(BUILTIN_THEMES.map(theme => [theme.id, { ...theme }]));
  const listeners = new Set();

  // Login/logout page: switch everything off (callers first remember or forget the theme to restore)
  function disableForAuthPage() {
    try {
      localStorage.setItem(STORAGE_KEY, 'light');
      localStorage.setItem(STORAGE_THEME_ID, 'light');
    } catch {}
    if (typeof document !== 'undefined' && document.documentElement) {
      auth.markAuthPage();
      tokens.clearCustomTokens();
    }
  }

  if (isAuthDisabled()) {
    try {
      if (localStorage.getItem(STORAGE_KEY) === 'dark' || localStorage.getItem(RESTORE_KEY) === 'true') auth.rememberThemeForLogin();
    } catch {}
    disableForAuthPage();
  }

  function getAvailableThemes() {
    return Array.from(registry.values());
  }

  function getThemeDefinition(themeId) {
    return registry.get(themeId) || null;
  }

  function registerTheme(themeDef) {
    if (!themeDef || typeof themeDef.id !== 'string') return false;
    registry.set(themeDef.id, {
      id: themeDef.id,
      name: themeDef.name || themeDef.id,
      icon: themeDef.icon || '🎨',
      isDark: themeDef.isDark !== false,
      isCustom: Boolean(themeDef.isCustom),
      liquidGlass: Boolean(themeDef.liquidGlass),
      glassBlur: typeof themeDef.glassBlur === 'number' ? themeDef.glassBlur : 12,
      glassOpacity: typeof themeDef.glassOpacity === 'number' ? themeDef.glassOpacity : 0.65,
      wallpaper: themeDef.wallpaper || null,
      wallpaperPreset: typeof themeDef.wallpaperPreset === 'string' ? themeDef.wallpaperPreset : null,
      swatch: Array.isArray(themeDef.swatch) ? themeDef.swatch : ['#1e2632', '#3b82f6'],
      colors: themeDef.colors || null
    });
    return true;
  }

  function unregisterTheme(themeId) {
    return registry.delete(themeId);
  }

  function getTheme() {
    if (isAuthDisabled()) return 'light';
    try {
      const savedId = localStorage.getItem(STORAGE_THEME_ID);
      if (savedId && registry.has(savedId)) return savedId;
      return localStorage.getItem(STORAGE_KEY) === 'dark' ? 'dark' : 'light';
    } catch {
      return 'dark';
    }
  }

  function isCustomTheme(theme) {
    return Boolean(theme && (theme.isCustom || theme.id === 'custom'));
  }

  function setCustomColors(colors) {
    try {
      const merged = { ...tokens.getCustomColors(), ...colors };
      tokens.storeCustomColors(merged);
      if (isCustomTheme(registry.get(getTheme()))) tokens.applyCustomTokens(merged);
      return true;
    } catch { return false; }
  }

  function isDarkMode() {
    if (isAuthDisabled()) return false;
    if (typeof document !== 'undefined' && document.documentElement) {
      return document.documentElement.classList.contains('connectea-dark');
    }
    const theme = registry.get(getTheme());
    return theme ? theme.isDark : true;
  }

  function getLastTheme() {
    try {
      for (const id of [localStorage.getItem(STORAGE_LAST_THEME), localStorage.getItem(STORAGE_THEME_ID)]) {
        if (id && registry.has(id) && id !== 'light') return id;
      }
    } catch {}
    return 'dark';
  }

  function onThemeChange(fn) {
    if (typeof fn === 'function') listeners.add(fn);
  }

  function notifyThemeListeners(themeId = getTheme(), theme = registry.get(themeId)) {
    for (const fn of listeners) {
      try { fn(themeId, theme); } catch {}
    }
  }

  function applyGlass(theme, customColors) {
    const root = document.documentElement;
    if (theme.id === 'liquid-glass' || theme.liquidGlass || customColors?.glassDiffusion) {
      root.setAttribute('data-connectea-glass', 'true');
      root.style.setProperty('--cx-glass-blur', `${theme.glassBlur ?? customColors?.glassBlur ?? 12}px`);
      root.style.setProperty('--cx-glass-opacity', `${theme.glassOpacity ?? customColors?.glassOpacity ?? 0.65}`);
    } else {
      root.removeAttribute('data-connectea-glass');
    }
  }

  /** A theme's own wallpaper: a preset by id (theme-wallpaper-presets.js) wins over a stored image. */
  function themeWallpaper(theme) {
    return window.ConnectifyWallpaperPresets?.byId(theme?.wallpaperPreset)?.url || theme?.wallpaper || null;
  }

  function applyToDocument(theme, customColors) {
    const isDark = theme.isDark;
    for (const el of tokens.tokenTargets()) {
      el.classList.toggle('connectea-dark', isDark);
      if (isDark) el.dataset.connecteaTheme = theme.id;
      else { delete el.dataset.connecteaTheme; el.removeAttribute('data-connectea-theme'); }
    }
    applyGlass(theme, customColors);
    if (isCustomTheme(theme) || customColors || theme.colors) {
      const colors = customColors || theme.colors;
      // Derived presets (Liquid Glass) apply their colours without replacing the stored custom palette
      if (colors && (isCustomTheme(theme) || customColors)) setCustomColors(colors);
      const glass = theme.liquidGlass || customColors?.glassDiffusion ? { opacity: theme.glassOpacity ?? customColors?.glassOpacity ?? 0.65 } : null;
      tokens.applyCustomTokens(colors || tokens.getCustomColors(), glass);
    } else {
      tokens.clearCustomTokens();
    }
    // A theme's own wallpaper shows only while it is active; it never replaces the one picked in Settings
    tokens.setThemeBackground(themeWallpaper(theme));
  }

  function setTheme(themeId, customColors) {
    if (isAuthDisabled()) {
      if (themeId && themeId !== 'light') auth.rememberThemeForLogin(themeId);
      else auth.forgetThemeForLogin();
      disableForAuthPage();
      return false;
    }

    const theme = registry.get(themeId) || registry.get('dark');
    try {
      if (theme.isDark && theme.id !== 'light') localStorage.setItem(STORAGE_LAST_THEME, theme.id);
      localStorage.setItem(STORAGE_KEY, theme.isDark ? 'dark' : 'light');
      localStorage.setItem(STORAGE_THEME_ID, theme.id);
    } catch {}

    if (typeof document !== 'undefined' && document.documentElement) applyToDocument(theme, customColors);

    notifyThemeListeners(theme.id, theme);
    if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function') {
      try {
        window.dispatchEvent(new CustomEvent('connectea:themechange', { detail: { themeId: theme.id, theme } }));
      } catch {}
    }
    return true;
  }

  window.ConnectifyThemeRegistry = {
    isLoginUrl,
    isLogoutUrl,
    isAuthDisabled,
    isLoginOrLogoutUrl: isAuthDisabled,
    isDarkMode,
    getTheme,
    getLastTheme,
    setTheme,
    getAvailableThemes,
    getThemeDefinition,
    registerTheme,
    unregisterTheme,
    notifyThemeListeners,
    getCustomColors: tokens.getCustomColors,
    setCustomColors,
    applyCustomTokens: tokens.applyCustomTokens,
    clearCustomTokens: tokens.clearCustomTokens,
    onThemeChange,
    themeWallpaper,
    getCustomBackground: tokens.getCustomBackground,
    getThemeBackground: tokens.getThemeBackground,
    setCustomBackground: tokens.setCustomBackground,
    clearCustomBackground: tokens.clearCustomBackground,
    applyCustomBackground: tokens.applyCustomBackground,
    setGlassDiffusion: tokens.setGlassDiffusion,
    getPresetPalettes: () => ({ ...BUILTIN_PALETTES }),
    BUILTIN_PALETTES,
    BUILTIN_THEMES
  };
})();
