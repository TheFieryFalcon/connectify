/**
 * Connectify Theme: saved custom themes
 *
 * Persists user-created themes in localStorage and extension storage, registers them with the
 * theme registry on load and re-applies the active one. Extends window.ConnectifyThemeRegistry.
 */
(() => {
  'use strict';

  const registry = window.ConnectifyThemeRegistry;
  const tokens = window.ConnectifyThemeTokens;
  if (!registry || !tokens) return;

  const STORAGE_CUSTOM_THEMES_LIST = 'connectea:custom_themes_list';
  const extensionStorage = () => (typeof chrome !== 'undefined' && chrome.storage?.local) || null;
  // Version 2 themes were saved with the 20-token Full mode. Older ones never let the user edit these
  // six, so their stored values are inherited preset leftovers (e.g. a near-black input background on a
  // light theme): drop them and let theme-token-derive.js derive them from the theme's own colours.
  const TOKEN_VERSION = 2;
  const PRE_V2_HIDDEN = ['inputBg', 'inputBorder', 'surfaceHover', 'borderStrong', 'buttonText', 'textMuted'];

  function migrate(theme) {
    if (!theme?.colors || (theme.tokenVersion || 1) >= TOKEN_VERSION) return theme;
    const colors = { ...theme.colors };
    for (const key of PRE_V2_HIDDEN) delete colors[key];
    return { ...theme, colors };
  }

  function getCustomThemes() {
    try {
      const stored = localStorage.getItem(STORAGE_CUSTOM_THEMES_LIST);
      return stored ? JSON.parse(stored).map(migrate) : [];
    } catch { return []; }
  }

  function writeCustomThemes(list) {
    try {
      localStorage.setItem(STORAGE_CUSTOM_THEMES_LIST, JSON.stringify(list));
    } catch {
      // Over quota: keep the themes and drop only their large wallpapers from localStorage
      const safeList = list.map(t => (t.wallpaper && t.wallpaper.length > 50000 ? { ...t, wallpaper: null } : t));
      try { localStorage.setItem(STORAGE_CUSTOM_THEMES_LIST, JSON.stringify(safeList)); } catch {}
    }
    try { extensionStorage()?.set({ [STORAGE_CUSTOM_THEMES_LIST]: JSON.stringify(list) }); } catch {}
  }

  function isActiveCustomTheme(theme) {
    return Boolean(theme && (theme.isCustom || theme.id === 'custom'));
  }

  function loadSavedCustomThemes() {
    for (const t of getCustomThemes()) {
      if (t && t.id) registry.registerTheme(t);
    }
    const store = extensionStorage();
    if (!store) return;
    try {
      store.get([STORAGE_CUSTOM_THEMES_LIST], res => {
        const raw = res?.[STORAGE_CUSTOM_THEMES_LIST];
        if (!raw) return;
        try {
          const list = typeof raw === 'string' ? JSON.parse(raw) : raw;
          if (Array.isArray(list)) list.forEach(t => { if (t?.id) registry.registerTheme(migrate(t)); });
        } catch {}
        // A custom theme only known to extension storage could not be applied at startup
        const active = registry.getThemeDefinition(registry.getTheme());
        if (active?.isCustom && document.documentElement?.dataset.connecteaTheme !== active.id) registry.setTheme(active.id);
        else if (active?.isCustom) tokens.setThemeBackground(registry.themeWallpaper(active)); // a wallpaper only extension storage held
      });
    } catch {}
  }

  function saveCustomTheme(themeDef) {
    if (!themeDef) return null;
    const name = (themeDef.name || 'Custom Theme').trim();
    const existingList = getCustomThemes();
    // Saving under an existing name (case-insensitive) overwrites that theme in place
    const existing = themeDef.id
      ? existingList.find(t => t.id === themeDef.id)
      : existingList.find(t => t.name && t.name.trim().toLowerCase() === name.toLowerCase());

    const id = themeDef.id || (existing ? existing.id : `custom_${Date.now()}`);
    const entry = {
      id,
      name,
      icon: themeDef.icon || (existing ? existing.icon : '🎨'),
      isDark: themeDef.isDark !== false,
      isCustom: true,
      tokenVersion: TOKEN_VERSION,
      liquidGlass: Boolean(themeDef.liquidGlass),
      glassBlur: typeof themeDef.glassBlur === 'number' ? themeDef.glassBlur : (existing?.glassBlur ?? 12),
      glassOpacity: typeof themeDef.glassOpacity === 'number' ? themeDef.glassOpacity : (existing?.glassOpacity ?? 0.65),
      overlayBlurFloor: typeof themeDef.overlayBlurFloor === 'boolean' ? themeDef.overlayBlurFloor : existing?.overlayBlurFloor !== false,
      wallpaper: themeDef.wallpaper !== undefined ? themeDef.wallpaper : (existing ? existing.wallpaper : null),
      wallpaperPreset: themeDef.wallpaperPreset !== undefined ? themeDef.wallpaperPreset : (existing?.wallpaperPreset ?? null),
      swatch: Array.isArray(themeDef.swatch) ? themeDef.swatch : [
        themeDef.colors?.canvas || '#1e2632',
        themeDef.colors?.surface || '#283444',
        themeDef.colors?.accent || '#3b82f6'
      ],
      colors: themeDef.colors || {}
    };
    registry.registerTheme(entry);
    writeCustomThemes([...existingList.filter(t => t.id !== id), entry]);
    return entry;
  }

  function deleteCustomTheme(themeId) {
    if (!themeId || themeId === 'light' || themeId === 'dark') return false;
    registry.unregisterTheme(themeId);
    // Both stores must drop it, or the extension-storage copy re-registers it on the next page load
    writeCustomThemes(getCustomThemes().filter(t => t.id !== themeId));
    if (registry.getTheme() === themeId) registry.setTheme('dark');
    registry.notifyThemeListeners();
    return true;
  }

  Object.assign(registry, { getCustomThemes, saveCustomTheme, deleteCustomTheme, writeCustomThemes });

  loadSavedCustomThemes();
  if (typeof document !== 'undefined') {
    const current = registry.getThemeDefinition(registry.getTheme());
    tokens.setThemeBackground(registry.themeWallpaper(current)); // the active theme's own wallpaper, else the student's
    tokens.restoreBackgroundFromExtensionStorage();
    if (isActiveCustomTheme(current)) tokens.applyCustomTokens(current.colors || tokens.getCustomColors(), current.liquidGlass ? { opacity: current.glassOpacity } : null);
  }
})();
