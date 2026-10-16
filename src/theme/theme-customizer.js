/**
 * Connectify Theme Customizer
 *
 * In-DOM theme designer with Basic and Full token modes, preset inheritance, a static live preview
 * and saving into the theme registry. Markup, colour maths and the interactive controls live in
 * theme-customizer-markup.js, theme-color-utils.js and theme-customizer-controls.js.
 * Exposes window.ConnectifyThemeCustomizer.
 */
(() => {
  'use strict';

  const colors = window.ConnectifyThemeColors;
  const markup = window.ConnectifyThemeCustomizerMarkup;
  const controls = window.ConnectifyThemeCustomizerControls;

  const getPresets = () => window.ConnectifyThemeRegistry?.getPresetPalettes?.() || {};
  const getDefaultTokens = () => colors.pickColors(getPresets().dark);
  // A theme's own colours, with only missing Basic tokens taken from Dark; every other missing token is
  // derived from the theme's colours (never copied from Dark, which would bring its navy into the theme)
  function themeTokens(own) {
    const dark = getDefaultTokens();
    const basics = Object.fromEntries(['canvas', 'surface', 'button', 'border', 'accent', 'textPrimary'].map(k => [k, dark[k]]));
    const merged = { ...basics, ...colors.pickColors(own) };
    return window.ConnectifyThemeDerive?.complete(merged) || { ...dark, ...merged };
  }

  let modalEl = null;
  const state = {
    mode: 'basic',
    tokens: getDefaultTokens(),
    name: 'My Theme',
    emoji: '🎨',
    liquidGlass: false,
    wallpaper: null,
    glassBlur: 16,
    glassOpacity: 0.65,
    activeToken: 'canvas',
    pickerH: 215,
    pickerS: 0.5,
    pickerV: 0.5
  };

  const $ = selector => modalEl?.querySelector(selector) || null;

  function deriveSecondaryTokens() {
    if (state.mode === 'basic') colors.deriveSecondaryTokens(state.tokens);
  }

  function renderMockup() {
    const preview = $('#cx-customizer-preview');
    if (!preview) return;
    // Same tokens the page gets when the theme is saved (theme-token-derive.js fills what Full mode left out)
    const t = window.ConnectifyThemeDerive?.complete(state.tokens) || state.tokens;
    const vars = {
      '--cx-canvas-bg': t.canvas, '--cx-canvas-subtle': t.canvasSubtle || t.canvas,
      '--cx-surface-bg': t.surface, '--cx-surface-secondary': t.surfaceSecondary || t.surface,
      '--cx-surface-elevated': t.surfaceElevated || t.surface, '--cx-surface-hover': t.surfaceHover || t.surface,
      '--cx-border': t.border, '--cx-border-subtle': t.borderSubtle || t.border, '--cx-border-strong': t.borderStrong || t.border,
      '--cx-accent': t.accent, '--cx-accent-hover': t.accentHover || t.accent, '--cx-text-primary': t.textPrimary,
      '--cx-button-bg': t.button, '--cx-button-hover': t.buttonHover || t.button,
      ...(window.ConnectifyThemeDerive?.cssProps(t) || {}),
      '--cx-glass-blur': `${state.glassBlur}px`, '--cx-glass-opacity': `${state.glassOpacity}`
    };
    for (const [k, v] of Object.entries(vars)) preview.style.setProperty(k, v);
    preview.style.backgroundImage = state.wallpaper ? `url("${state.wallpaper}")` : 'none';
    const card = preview.querySelector('.cx-mock-card');
    if (card) {
      card.style.borderRadius = '16px';
      card.style.backdropFilter = state.liquidGlass ? `blur(${state.glassBlur}px)` : 'none';
      card.style.backgroundColor = state.liquidGlass ? `color-mix(in srgb, ${t.surface} ${Math.round(state.glassOpacity * 100)}%, transparent)` : t.surface;
    }
  }

  function renderTokens() {
    const grid = $('#cx-token-grid');
    if (!grid) return;
    grid.innerHTML = markup.tokenGridHtml(state);
    grid.querySelectorAll('.cx-token-item').forEach(el => {
      el.onclick = () => {
        state.activeToken = el.dataset.key;
        grid.querySelectorAll('.cx-token-item').forEach(x => x.classList.remove('is-active'));
        el.classList.add('is-active');
        syncPickerToToken();
      };
    });
  }

  function refresh() {
    deriveSecondaryTokens();
    renderTokens();
    renderMockup();
  }

  function syncPickerToToken(key = state.activeToken) {
    const rgb = colors.parseHex(state.tokens[key] || '#1e2632');
    const hsv = colors.rgbToHsv(rgb.r, rgb.g, rgb.b);
    state.pickerH = hsv.h; state.pickerS = hsv.s; state.pickerV = hsv.v;
    const nameEl = $('#cx-active-token-name'); if (nameEl) nameEl.textContent = key;
    const hueInput = $('#cx-picker-hue'); if (hueInput) hueInput.value = state.pickerH;
    const hexInput = $('#cx-picker-hex'); if (hexInput) hexInput.value = colors.toHex(rgb.r, rgb.g, rgb.b);
    const svBox = $('#cx-picker-sv'); if (svBox) svBox.style.backgroundColor = `hsl(${state.pickerH}, 100%, 50%)`;
    const cursor = $('#cx-picker-cursor');
    if (cursor) { cursor.style.left = `${state.pickerS * 100}%`; cursor.style.top = `${(1 - state.pickerV) * 100}%`; }
  }

  function showEmoji() {
    $('#cx-header-icon').textContent = state.emoji;
    const previewEmoji = $('#cx-preview-emoji'); if (previewEmoji) previewEmoji.textContent = state.emoji;
  }

  /** Pushes state into the identity and glass controls (after a preset or an import). */
  function syncControls() {
    $('#cx-name-input').value = state.name;
    $('#cx-preview-heading').textContent = state.name;
    $('#cx-emoji-input').value = state.emoji;
    showEmoji();
    $('#cx-glass-toggle').checked = state.liquidGlass;
    $('#cx-glass-sliders-wrap').style.display = state.liquidGlass ? 'flex' : 'none';
    $('#cx-glass-blur-slider').value = state.glassBlur;
    $('#cx-glass-blur-val').textContent = `${state.glassBlur}px`;
    $('#cx-glass-opacity-slider').value = Math.round(state.glassOpacity * 100);
    $('#cx-glass-opacity-val').textContent = `${Math.round(state.glassOpacity * 100)}%`;
  }

  function setMode(mode) {
    state.mode = mode;
    $('#cx-tab-basic').classList.toggle('is-active', mode === 'basic');
    $('#cx-tab-full').classList.toggle('is-active', mode === 'full');
    refresh();
  }

  function bindIdentityAndGlass() {
    $('#cx-close-btn').onclick = close;
    $('#cx-cancel-btn').onclick = close;
    $('#cx-tab-basic').onclick = () => setMode('basic');
    $('#cx-tab-full').onclick = () => setMode('full');

    $('#cx-preset-select').onchange = e => {
      const preset = getPresets()[e.target.value];
      if (!preset) return;
      state.tokens = colors.pickColors(preset);
      state.emoji = preset.icon || preset.emoji || state.emoji;
      state.liquidGlass = Boolean(preset.liquidGlass);
      syncControls();
      refresh();
      syncPickerToToken();
    };

    const nameInput = $('#cx-name-input');
    nameInput.oninput = () => {
      state.name = nameInput.value;
      $('#cx-preview-heading').textContent = state.name;
    };
    const emojiInput = $('#cx-emoji-input');
    emojiInput.oninput = () => {
      state.emoji = emojiInput.value || '🎨';
      showEmoji();
      renderMockup();
    };
    modalEl.querySelectorAll('.cx-emoji-btn').forEach(btn => {
      btn.onclick = () => {
        state.emoji = btn.dataset.emoji;
        emojiInput.value = state.emoji;
        showEmoji();
        renderMockup();
      };
    });

    $('#cx-glass-toggle').onchange = e => {
      state.liquidGlass = e.target.checked;
      $('#cx-glass-sliders-wrap').style.display = state.liquidGlass ? 'flex' : 'none';
      renderMockup();
    };
    $('#cx-glass-blur-slider').oninput = e => {
      state.glassBlur = parseInt(e.target.value, 10);
      $('#cx-glass-blur-val').textContent = `${state.glassBlur}px`;
      renderMockup();
    };
    $('#cx-glass-opacity-slider').oninput = e => {
      state.glassOpacity = parseInt(e.target.value, 10) / 100;
      $('#cx-glass-opacity-val').textContent = `${Math.round(state.glassOpacity * 100)}%`;
      renderMockup();
    };
  }

  function save() {
    deriveSecondaryTokens();
    const themeDef = {
      // An edited theme keeps its id, so renaming it updates it instead of saving a copy
      id: state.editingId || undefined,
      name: ($('#cx-name-input')?.value || state.name || 'Custom Theme').trim(),
      icon: ($('#cx-emoji-input')?.value || state.emoji || '🎨').trim(),
      liquidGlass: state.liquidGlass,
      glassBlur: state.glassBlur,
      glassOpacity: state.glassOpacity,
      wallpaper: state.wallpaper,
      swatch: [state.tokens.canvas, state.tokens.surface, state.tokens.accent],
      colors: { ...state.tokens }
    };
    const reg = window.ConnectifyThemeRegistry;
    const saved = reg?.saveCustomTheme?.(themeDef);
    // setTheme fires connectea:themechange, which the theme engine applies to the page
    if (saved) reg.setTheme(saved.id);
    close();
  }

  function open(themeToEdit = null) {
    close();
    Object.assign(state, {
      editingId: themeToEdit?.isCustom ? themeToEdit.id : null,
      name: themeToEdit ? (themeToEdit.name || 'Custom Theme') : 'My Theme',
      emoji: themeToEdit?.icon || '🎨',
      liquidGlass: Boolean(themeToEdit?.liquidGlass),
      glassBlur: typeof themeToEdit?.glassBlur === 'number' ? themeToEdit.glassBlur : 16,
      glassOpacity: typeof themeToEdit?.glassOpacity === 'number' ? themeToEdit.glassOpacity : 0.65,
      wallpaper: themeToEdit?.wallpaper || null,
      tokens: themeToEdit?.colors ? themeTokens(themeToEdit.colors) : getDefaultTokens()
    });
    deriveSecondaryTokens();

    modalEl = document.createElement('div');
    modalEl.id = 'cx-customizer-modal';
    modalEl.innerHTML = markup.modalHtml(state, getPresets());
    document.body.appendChild(modalEl);

    bindIdentityAndGlass();
    controls.bind({ state, modal: modalEl, refresh, renderMockup, syncControls, syncPicker: () => syncPickerToToken() });
    $('#cx-save-btn').onclick = save;
    renderTokens();
    syncPickerToToken();
    renderMockup();
  }

  function close() {
    if (modalEl) { modalEl.remove(); modalEl = null; }
  }

  window.ConnectifyThemeCustomizer = {
    open,
    close,
    isOpen: () => modalEl !== null
  };
})();
