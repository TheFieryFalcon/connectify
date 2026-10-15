/**
 * Connectify Theme Customizer: picker, wallpaper, JSON import/export and preview tooltip
 *
 * Wires the interactive controls of an open customizer. bind(ctx) receives the customizer context:
 * { state, modal, refresh, syncPicker, renderMockup, syncControls }.
 * Exposes window.ConnectifyThemeCustomizerControls.
 */
(() => {
  'use strict';

  const colors = window.ConnectifyThemeColors;

  // One pair of window listeners for the whole page; opening the modal only swaps the drag target
  let drag = null;
  window.addEventListener('mousemove', e => { if (drag) drag(e); });
  window.addEventListener('mouseup', () => { drag = null; });

  function bindPicker(ctx) {
    const { state, modal } = ctx;
    const svBox = modal.querySelector('#cx-picker-sv');
    const hueInput = modal.querySelector('#cx-picker-hue');
    const hexInput = modal.querySelector('#cx-picker-hex');

    const updateColorFromPicker = () => {
      const rgb = colors.hsvToRgb(state.pickerH, state.pickerS, state.pickerV);
      const hex = colors.toHex(rgb.r, rgb.g, rgb.b);
      state.tokens[state.activeToken] = hex;
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
    svBox.onmousedown = e => { drag = handleSV; handleSV(e); };

    hueInput.oninput = () => {
      state.pickerH = parseInt(hueInput.value, 10);
      svBox.style.backgroundColor = `hsl(${state.pickerH}, 100%, 50%)`;
      updateColorFromPicker();
    };
    const setActiveColor = value => {
      state.tokens[state.activeToken] = value;
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

  function readFile(input, asText, onLoad) {
    const file = input.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => onLoad(ev.target.result, file);
    if (asText) reader.readAsText(file);
    else reader.readAsDataURL(file);
    input.value = ''; // picking the same file again must fire change
  }

  function bindWallpaper(ctx) {
    const { state, modal } = ctx;
    const fileInput = modal.querySelector('#cx-bg-file-input');
    const status = modal.querySelector('#cx-bg-status');
    const clearBtn = modal.querySelector('#cx-clear-bg-btn');
    modal.querySelector('#cx-upload-bg-btn').onclick = () => fileInput.click();
    fileInput.onchange = () => readFile(fileInput, false, (dataUrl, file) => {
      state.wallpaper = dataUrl;
      status.textContent = file.name;
      clearBtn.disabled = false;
      ctx.renderMockup();
    });
    clearBtn.onclick = () => {
      state.wallpaper = null;
      status.textContent = 'Default background';
      clearBtn.disabled = true;
      ctx.renderMockup();
    };
  }

  function exportTheme(state) {
    const data = {
      version: 1, name: state.name, icon: state.emoji, liquidGlass: state.liquidGlass,
      glassBlur: state.glassBlur, glassOpacity: state.glassOpacity, wallpaper: state.wallpaper,
      swatch: [state.tokens.canvas, state.tokens.surface, state.tokens.accent], colors: { ...state.tokens }
    };
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));
    a.download = `connectea-theme-${String(state.name).toLowerCase().replace(/\s+/g, '_')}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 0);
  }

  // Imported files are untrusted: only strings, numbers in range and valid colour values are taken
  function importTheme(state, imp) {
    if (typeof imp.name === 'string' && imp.name.trim()) state.name = imp.name.trim().slice(0, 60);
    if (typeof imp.icon === 'string' && imp.icon.trim()) state.emoji = imp.icon.trim().slice(0, 8);
    if (imp.liquidGlass !== undefined) state.liquidGlass = Boolean(imp.liquidGlass);
    if (Number.isFinite(imp.glassBlur)) state.glassBlur = Math.max(0, Math.min(40, imp.glassBlur));
    if (Number.isFinite(imp.glassOpacity)) state.glassOpacity = Math.max(0.1, Math.min(1, imp.glassOpacity));
    if (imp.wallpaper === null || (typeof imp.wallpaper === 'string' && imp.wallpaper.startsWith('data:image/'))) state.wallpaper = imp.wallpaper;
    if (imp.colors) state.tokens = { ...state.tokens, ...colors.pickColors(imp.colors) };
  }

  function bindJson(ctx) {
    const { state, modal } = ctx;
    modal.querySelector('#cx-export-btn').onclick = () => exportTheme(state);
    const importFile = modal.querySelector('#cx-import-file');
    modal.querySelector('#cx-import-btn').onclick = () => importFile.click();
    importFile.onchange = () => readFile(importFile, true, text => {
      try {
        importTheme(state, JSON.parse(text));
      } catch {
        alert('Invalid theme JSON file.');
        return;
      }
      ctx.syncControls();
      ctx.refresh();
      ctx.syncPicker();
    });
  }

  function bindPreviewTooltip(modal) {
    const preview = modal.querySelector('#cx-customizer-preview');
    const tooltip = modal.querySelector('#cx-preview-tooltip');
    if (!preview || !tooltip) return;
    preview.onmousemove = e => {
      const target = e.target.closest('[data-cx-elem]');
      if (!target) { tooltip.style.display = 'none'; return; }
      tooltip.innerHTML = `<div class="cx-tooltip-elem">Element: ${colors.escapeHtml(target.getAttribute('data-cx-elem'))}</div>` +
        `<div class="cx-tooltip-token">Token: ${colors.escapeHtml(target.getAttribute('data-cx-token'))}</div>`;
      tooltip.style.display = 'block';
      const rect = preview.getBoundingClientRect();
      let x = e.clientX - rect.left + 12, y = e.clientY - rect.top + 12;
      if (x + 200 > rect.width) x = e.clientX - rect.left - 210;
      if (y + 50 > rect.height) y = e.clientY - rect.top - 50;
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
  }

  window.ConnectifyThemeCustomizerControls = { bind, importTheme };
})();
