/**
 * Connectify Theme: theme file import
 *
 * Imports .ctme theme files (and older .json ones) from the theme menu's Import Theme and the customizer.
 * sanitize(raw) keeps only the valid fields of an untrusted theme object; pick() opens a file picker and
 * importFile(file) saves the theme as a custom theme (a theme of the same name is updated) and applies it.
 * wallpaperFields(url) stores a preset wallpaper by id (wallpaperPreset), any other image as it is.
 * Exposes window.ConnectifyThemeImport.
 */
(() => {
  'use strict';

  const BASIC = ['canvas', 'surface', 'button', 'border', 'accent', 'textPrimary'];
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  const presets = () => window.ConnectifyWallpaperPresets;

  /** { wallpaper, wallpaperPreset } for a wallpaper URL: one of the six presets is named by id, never stored. */
  function wallpaperFields(url) {
    const preset = url ? presets()?.find(url) : null;
    return preset ? { wallpaper: null, wallpaperPreset: preset.id } : { wallpaper: url || null, wallpaperPreset: null };
  }

  /** Only strings, numbers in range, valid colours, a known preset id and image data URLs are taken. */
  function sanitize(raw) {
    if (!raw || typeof raw !== 'object') throw new Error('Not a theme');
    const out = {};
    if (typeof raw.name === 'string' && raw.name.trim()) out.name = raw.name.trim().slice(0, 60);
    if (typeof raw.icon === 'string' && raw.icon.trim()) out.icon = raw.icon.trim().slice(0, 8);
    if (raw.liquidGlass !== undefined) out.liquidGlass = Boolean(raw.liquidGlass);
    if (Number.isFinite(raw.glassBlur)) out.glassBlur = clamp(raw.glassBlur, 0, 40);
    if (Number.isFinite(raw.glassOpacity)) out.glassOpacity = clamp(raw.glassOpacity, 0.1, 1);
    if (raw.colors && typeof raw.colors === 'object') out.colors = window.ConnectifyThemeColors.pickColors(raw.colors);
    // A preset wallpaper is kept as its id
    const preset = presets()?.byId(raw.wallpaperPreset);
    if (preset) Object.assign(out, { wallpaper: null, wallpaperPreset: preset.id });
    else if (raw.wallpaper === null || (typeof raw.wallpaper === 'string' && raw.wallpaper.startsWith('data:image/'))) {
      Object.assign(out, wallpaperFields(raw.wallpaper));
    }
    return out;
  }

  /** Saves a theme file as a custom theme and applies it; resolves with the saved theme. */
  async function importFile(file) {
    const theme = sanitize(await window.ConnectifyThemeCtme.unpackFile(file));
    if (!theme.colors || !Object.keys(theme.colors).length) throw new Error('The theme has no colours');
    const fit = window.ConnectifyWallpaperFit;
    if (fit?.needsFit(theme.wallpaper)) theme.wallpaper = await fit.fromDataUrl(theme.wallpaper).catch(() => theme.wallpaper);
    const reg = window.ConnectifyThemeRegistry;
    // Missing Basic tokens come from Dark, as in the customizer; everything else derives from the theme's own
    const dark = window.ConnectifyThemeColors.pickColors(reg.getPresetPalettes?.().dark);
    const colors = { ...Object.fromEntries(BASIC.filter(k => dark[k]).map(k => [k, dark[k]])), ...theme.colors };
    const saved = reg.saveCustomTheme({
      name: theme.name || 'Imported Theme', icon: theme.icon || '🎨',
      liquidGlass: Boolean(theme.liquidGlass), glassBlur: theme.glassBlur ?? 12, glassOpacity: theme.glassOpacity ?? 0.65,
      wallpaper: theme.wallpaper ?? null, wallpaperPreset: theme.wallpaperPreset ?? null,
      swatch: [colors.canvas, colors.surface, colors.accent], colors
    });
    if (saved) reg.setTheme(saved.id);
    return saved;
  }

  /** Opens the file picker; the chosen theme is saved and applied, an unreadable file is reported. */
  function pick() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.ctme,.json';
    input.onchange = () => {
      const file = input.files?.[0];
      if (file) importFile(file).catch(() => alert('Invalid theme file.'));
    };
    input.click();
  }

  window.ConnectifyThemeImport = { sanitize, wallpaperFields, importFile, pick };
})();
