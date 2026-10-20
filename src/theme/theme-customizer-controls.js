/**
 * Connectify Theme Customizer: picker, wallpaper (upload or preset), .ctme import/export and preview tooltip
 *
 * Wires the interactive controls of an open customizer. bind(ctx) receives the customizer context:
 * { state, modal, refresh, syncPicker, renderMockup, syncControls }.
 * Exposes window.ConnectifyThemeCustomizerControls.
 */
(() => {
  'use strict';

  const colors = window.ConnectifyThemeColors;

  function bindPicker(ctx) {
    const { state, modal } = ctx;
    const svBox = modal.querySelector('#cx-picker-sv');
    const hueInput = modal.querySelector('#cx-picker-hue');
    const hexInput = modal.querySelector('#cx-picker-hex');

    const updateColorFromPicker = () => {
      const rgb = colors.hsvToRgb(state.pickerH, state.pickerS, state.pickerV);
      const hex = colors.toHex(rgb.r, rgb.g, rgb.b);
      window.ConnectifyCustomizerTokens.set(state, state.activeToken, hex);
      if (hexInput !== document.activeElement) hexInput.value = hex;
      ctx.refresh();
    };
    const handleSV = e => {
      const rect = svBox.getBoundingClientRect();
      state.pickerS = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
      state.pickerV = Math.max(0, Math.min(1, 1 - (e.clientY - rect.top) / rect.height));
      const cursor = modal.querySelector('#cx-picker-cursor');
      if (cursor) { cursor.style.left = `${state.pickerS * 100}%`; cursor.style.top = `${(1 - state.pickerV) * 100}%`; }
      updateColorFromPicker();
    };
    // The drag is captured by the box (no window listeners) and its default is cancelled, so sweeping out past a
    // corner never starts a text selection, which made the page select text and auto-scroll
    svBox.onpointerdown = e => {
      if (e.button !== 0) return;
      e.preventDefault();
      svBox.setPointerCapture?.(e.pointerId);
      handleSV(e);
    };
    svBox.onpointermove = e => { if (svBox.hasPointerCapture?.(e.pointerId)) handleSV(e); };

    hueInput.oninput = () => {
      state.pickerH = parseInt(hueInput.value, 10);
      svBox.style.backgroundColor = `hsl(${state.pickerH}, 100%, 50%)`;
      updateColorFromPicker();
    };
    const setActiveColor = value => {
      window.ConnectifyCustomizerTokens.set(state, state.activeToken, value);
      ctx.syncPicker();
      ctx.refresh();
    };
    hexInput.onchange = () => {
      const val = hexInput.value.trim();
      if (/^#[a-f0-9]{6}$/i.test(val)) setActiveColor(val);
    };
    modal.querySelectorAll('.cx-swatch-chip').forEach(chip => {
      chip.onclick = () => setActiveColor(chip.dataset.color);
    });
  }

  /** Status text, ✕ and the pressed preset thumbnail follow state.wallpaper. */
  function showWallpaper(ctx, text) {
    const { state, modal } = ctx;
    const preset = window.ConnectifyWallpaperPresets?.find(state.wallpaper);
    modal.querySelector('#cx-bg-status').textContent = text || (preset ? `Preset: ${preset.name}` : state.wallpaper ? 'Wallpaper active' : 'Default background');
    modal.querySelector('#cx-clear-bg-btn').disabled = !state.wallpaper;
    modal.querySelectorAll('.cx-bg-preset').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.preset === preset?.id)));
  }

  function bindWallpaper(ctx) {
    const { state, modal } = ctx;
    const fileInput = modal.querySelector('#cx-bg-file-input');
    const status = modal.querySelector('#cx-bg-status');
    const clearBtn = modal.querySelector('#cx-clear-bg-btn');
    // The six preset wallpapers; a theme saves the one picked by id (wallpaperPreset)
    window.ConnectifyWallpaperPresets?.mount(modal.querySelector('#cx-bg-presets'), p => {
      state.wallpaper = p.url;
      showWallpaper(ctx);
      ctx.renderMockup();
    });
    showWallpaper(ctx);
    modal.querySelector('#cx-upload-bg-btn').onclick = () => fileInput.click();
    fileInput.onchange = () => {
      const file = fileInput.files?.[0];
      if (!file) return;
      fileInput.value = ''; // picking the same file again must fire change
      // Cropped and scaled to the screen first (theme-wallpaper-fit.js), so huge photos never lag the page
      status.textContent = 'Preparing wallpaper...';
      window.ConnectifyWallpaperFit.fromFile(file).then(dataUrl => {
        state.wallpaper = dataUrl;
        showWallpaper(ctx, file.name);
        ctx.renderMockup();
      }).catch(err => { status.textContent = window.ConnectifyWallpaperFit.errorText(err); });
    };
    clearBtn.onclick = () => {
      state.wallpaper = null;
      showWallpaper(ctx);
      ctx.renderMockup();
    };
  }

  // A .ctme theme file (theme-ctme.js): theme.json plus the wallpaper image, named after the theme
  function exportTheme(state) {
    const data = {
      version: 1, name: state.name, icon: state.emoji, liquidGlass: state.liquidGlass,
      glassBlur: state.glassBlur, glassOpacity: state.glassOpacity,
      ...window.ConnectifyThemeImport.wallpaperFields(state.wallpaper), // a preset ships as its id, no image
      swatch: [state.tokens.canvas, state.tokens.surface, state.tokens.accent],
      colors: window.ConnectifyCustomizerTokens.savedColors(state)
    };
    const ctme = window.ConnectifyThemeCtme;
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([ctme.pack(data)], { type: 'application/zip' }));
    a.download = ctme.fileName(state.name);
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 0);
  }

  // Imported files are untrusted: only what ConnectifyThemeImport.sanitize keeps is taken
  function importTheme(state, imp) {
    const t = window.ConnectifyThemeImport.sanitize(imp);
    if (t.name) state.name = t.name;
    if (t.icon) state.emoji = t.icon;
    if (t.liquidGlass !== undefined) state.liquidGlass = t.liquidGlass;
    if (t.glassBlur !== undefined) state.glassBlur = t.glassBlur;
    if (t.glassOpacity !== undefined) state.glassOpacity = t.glassOpacity;
    if (t.colors) state.tokens = { ...state.tokens, ...t.colors };
    if (t.wallpaperPreset) state.wallpaper = window.ConnectifyWallpaperPresets.byId(t.wallpaperPreset).url;
    if (t.wallpaper === undefined || t.wallpaperPreset) return null;
    // A large imported wallpaper is fitted to the screen before it is previewed or saved (returned for bindJson)
    if (window.ConnectifyWallpaperFit?.needsFit(t.wallpaper)) return t.wallpaper;
    state.wallpaper = t.wallpaper;
    return null;
  }

  function fitImportedWallpaper(ctx, url) {
    const { state, modal } = ctx;
    const status = modal.querySelector('#cx-bg-status');
    const before = state.wallpaper;
    status.textContent = 'Preparing wallpaper...';
    window.ConnectifyWallpaperFit.fromDataUrl(url).then(dataUrl => {
      if (state.wallpaper !== before) return; // replaced or cleared meanwhile
      state.wallpaper = dataUrl;
      showWallpaper(ctx);
      ctx.renderMockup();
    }).catch(() => { status.textContent = 'That image could not be read'; });
  }

  function bindJson(ctx) {
    const { state, modal } = ctx;
    modal.querySelector('#cx-export-btn').onclick = () => exportTheme(state);
    const importFile = modal.querySelector('#cx-import-file');
    modal.querySelector('#cx-import-btn').onclick = () => importFile.click();
    importFile.onchange = async () => {
      const file = importFile.files?.[0];
      if (!file) return;
      importFile.value = ''; // picking the same file again must fire change
      const tokenSet = window.ConnectifyCustomizerTokens;
      let largeWallpaper;
      try {
        const theme = await window.ConnectifyThemeCtme.unpackFile(file);
        // Imported colours merge over this theme's own (Basic + overrides); imported Full tokens become overrides
        state.tokens = tokenSet.savedColors(state);
        largeWallpaper = importTheme(state, theme);
        tokenSet.track(state, tokenSet.overridesOf(state.tokens));
      } catch (err) {
        tokenSet.apply(state);
        alert(window.ConnectifyThemeImport.failText(err));
        return;
      }
      ctx.syncControls();
      ctx.refresh();
      ctx.syncPicker();
      showWallpaper(ctx);
      if (largeWallpaper) fitImportedWallpaper(ctx, largeWallpaper);
    };
  }

  /** The text node whose glyphs sit under the pointer, or null when the pointer is over a bare fill. */
  function textUnderPointer(e) {
    let node, offset;
    if (document.caretPositionFromPoint) {
      const pos = document.caretPositionFromPoint(e.clientX, e.clientY);
      node = pos?.offsetNode; offset = pos?.offset;
    } else if (document.caretRangeFromPoint) {
      const range = document.caretRangeFromPoint(e.clientX, e.clientY);
      node = range?.startContainer; offset = range?.startOffset;
    }
    if (!node || node.nodeType !== 3 || !node.textContent.trim()) return null;
    // The caret snaps to the nearest character, so check the glyph on either side really is under the pointer
    const glyph = document.createRange();
    for (const start of [offset - 1, offset]) {
      if (start < 0 || start >= node.length) continue;
      glyph.setStart(node, start); glyph.setEnd(node, start + 1);
      for (const r of glyph.getClientRects()) {
        if (e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom) return node;
      }
    }
    return null;
  }

  function bindPreviewTooltip(modal) {
    const preview = modal.querySelector('#cx-customizer-preview');
    const tooltip = modal.querySelector('#cx-preview-tooltip');
    if (!preview || !tooltip) return;
    const row = (label, value) => `<div class="cx-tooltip-token">${label}: ${colors.escapeHtml(value)}</div>`;
    preview.onmousemove = e => {
      const textEl = textUnderPointer(e)?.parentElement?.closest('[data-cx-text]');
      const target = textEl?.closest('[data-cx-elem]') || e.target.closest('[data-cx-elem]');
      if (!target) { tooltip.style.display = 'none'; return; }
      const fillEl = e.target.closest('[data-cx-fill]');
      tooltip.innerHTML = `<div class="cx-tooltip-elem">Element: ${colors.escapeHtml(target.getAttribute('data-cx-elem'))}</div>` +
        (textEl ? row('Text', textEl.getAttribute('data-cx-text')) : '') +
        (fillEl ? row('Fill', fillEl.getAttribute('data-cx-fill')) : '');
      tooltip.style.display = 'block';
      const rect = preview.getBoundingClientRect();
      let x = e.clientX - rect.left + 12, y = e.clientY - rect.top + 12;
      if (x + 320 > rect.width) x = e.clientX - rect.left - 330;
      if (y + 70 > rect.height) y = e.clientY - rect.top - 70;
      tooltip.style.left = `${Math.max(4, x)}px`;
      tooltip.style.top = `${Math.max(4, y)}px`;
    };
    preview.onmouseleave = () => { tooltip.style.display = 'none'; };
  }

  function bind(ctx) {
    bindPicker(ctx);
    bindWallpaper(ctx);
    bindJson(ctx);
    bindPreviewTooltip(ctx.modal);
    window.ConnectifyCustomizerPopover?.bind(ctx.modal);
  }

  window.ConnectifyThemeCustomizerControls = { bind, importTheme };
})();
