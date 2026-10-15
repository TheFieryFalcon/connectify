/**
 * Connectify Theme Customizer
 * Provides Basic & Full tier customization, in-DOM color picker, static mockup preview, and JSON I/O.
 */
(() => {
  'use strict';

  const getPresets = () => window.ConnectifyThemeRegistry?.getPresetPalettes?.() || {};
  const getDefaultTokens = () => ({ ...(getPresets().dark || {
    name: 'Dark', emoji: '🌙', canvas: '#12171f', canvasSubtle: '#0a0d12', surface: '#1e2632',
    surfaceSecondary: '#18202b', surfaceElevated: '#263242', surfaceHover: '#263344',
    border: '#455a73', borderSubtle: '#2e3c4e', borderStrong: '#5a7391',
    accent: '#3b82f6', accentHover: '#60a5fa', textPrimary: '#f8fafc',
    textSecondary: '#e2e8f0', tileLinkColor: '#f8fafc', button: '#202c3b',
    buttonHover: '#2c3b4e', buttonText: '#f1f5f9', inputBg: '#141a22', inputBorder: '#42556d'
  }) });

  function parseHex(h) {
    if (!h || typeof h !== 'string') return { r: 30, g: 40, b: 50 };
    const m = h.match(/^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i);
    return m ? { r: parseInt(m[1], 16), g: parseInt(m[2], 16), b: parseInt(m[3], 16) } : { r: 30, g: 40, b: 50 };
  }
  function toHex(r, g, b) {
    return '#' + [r, g, b].map(x => Math.max(0, Math.min(255, Math.round(x))).toString(16).padStart(2, '0')).join('');
  }
  function rgbToHsv(r, g, b) {
    r /= 255; g /= 255; b /= 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min;
    let h = 0; const s = max === 0 ? 0 : d / max, v = max;
    if (d !== 0) {
      if (max === r) h = (g - b) / d + (g < b ? 6 : 0);
      else if (max === g) h = (b - r) / d + 2;
      else h = (r - g) / d + 4;
      h /= 6;
    }
    return { h: Math.round(h * 360), s, v };
  }
  function hsvToRgb(h, s, v) {
    const i = Math.floor((h / 360) * 6), f = (h / 360) * 6 - i;
    const p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
    const arr = [[v, t, p], [q, v, p], [p, v, t], [p, q, v], [t, p, v], [v, p, q]][i % 6];
    return { r: Math.round(arr[0] * 255), g: Math.round(arr[1] * 255), b: Math.round(arr[2] * 255) };
  }
  function adjustLightness(hex, pct) {
    const { r, g, b } = parseHex(hex);
    const f = pct >= 0 ? 255 : 0, a = Math.abs(pct) / 100;
    return toHex(r + (f - r) * a, g + (f - g) * a, b + (f - b) * a);
  }

  let modalEl = null, currentMode = 'basic', currentTokens = getDefaultTokens();
  let currentThemeName = 'My Custom Theme', currentEmoji = '🎨', currentLiquidGlass = false, currentWallpaper = null;
  let currentGlassBlur = 16, currentGlassOpacity = 0.65;
  let activeToken = 'canvas', pickerH = 215, pickerS = 0.5, pickerV = 0.5;

  function deriveSecondaryTokens() {
    if (currentMode !== 'basic') return;
    const { canvas, surface, button, border, accent, textPrimary } = currentTokens;
    currentTokens.canvasSubtle = adjustLightness(canvas, -8);
    currentTokens.surfaceSecondary = adjustLightness(surface, -5);
    currentTokens.surfaceElevated = adjustLightness(surface, 8);
    currentTokens.surfaceHover = adjustLightness(surface, 14);
    currentTokens.borderSubtle = adjustLightness(border, -12);
    currentTokens.borderStrong = adjustLightness(border, 15);
    currentTokens.accentHover = adjustLightness(accent, 15);
    const { r, g, b } = parseHex(surface);
    const lum = 0.2126 * (r / 255) + 0.7152 * (g / 255) + 0.0722 * (b / 255);
    if (!textPrimary) currentTokens.textPrimary = lum < 0.4 ? '#f8fafc' : '#0f172a';
    currentTokens.textSecondary = lum < 0.4 ? '#d1d5db' : '#475569';
    currentTokens.tileLinkColor = currentTokens.textPrimary;
    currentTokens.buttonHover = adjustLightness(button, 12);
    const bRgb = parseHex(button);
    const bLum = 0.2126 * (bRgb.r / 255) + 0.7152 * (bRgb.g / 255) + 0.0722 * (bRgb.b / 255);
    currentTokens.buttonText = bLum < 0.45 ? '#ffffff' : '#0f172a';
    currentTokens.inputBg = adjustLightness(canvas, -4);
    currentTokens.inputBorder = border;
  }

  function renderMockup() {
    const preview = modalEl?.querySelector('#cx-customizer-preview');
    if (!preview) return;
    const pVars = {
      '--cx-canvas-bg': currentTokens.canvas, '--cx-canvas-subtle': currentTokens.canvasSubtle || currentTokens.canvas,
      '--cx-surface-bg': currentTokens.surface, '--cx-surface-secondary': currentTokens.surfaceSecondary || currentTokens.surface,
      '--cx-surface-elevated': currentTokens.surfaceElevated || currentTokens.surface,
      '--cx-border': currentTokens.border, '--cx-border-subtle': currentTokens.borderSubtle || currentTokens.border,
      '--cx-accent': currentTokens.accent, '--cx-accent-hover': currentTokens.accentHover || currentTokens.accent,
      '--cx-text-primary': currentTokens.textPrimary, '--cx-text-secondary': currentTokens.textSecondary,
      '--cx-tile-link-color': currentTokens.tileLinkColor || currentTokens.textPrimary,
      '--cx-button-bg': currentTokens.button, '--cx-button-hover': currentTokens.buttonHover || currentTokens.button,
      '--cx-button-text': currentTokens.buttonText || '#ffffff', '--cx-glass-blur': `${currentGlassBlur}px`, '--cx-glass-opacity': `${currentGlassOpacity}`
    };
    for (const [k, v] of Object.entries(pVars)) preview.style.setProperty(k, v);
    preview.style.backgroundImage = currentWallpaper ? `url("${currentWallpaper}")` : 'none';
    const card = preview.querySelector('.cx-mock-card');
    if (card) {
      card.style.borderRadius = currentLiquidGlass ? '16px' : '0px';
      card.style.backdropFilter = currentLiquidGlass ? `blur(${currentGlassBlur}px)` : 'none';
      card.style.backgroundColor = currentLiquidGlass ? `rgba(18, 26, 40, ${currentGlassOpacity})` : currentTokens.surface;
    }
  }

  function open(themeToEdit = null) {
    close();
    if (themeToEdit) {
      currentThemeName = themeToEdit.name || 'Custom Theme';
      currentEmoji = themeToEdit.icon || '🎨';
      currentLiquidGlass = Boolean(themeToEdit.liquidGlass);
      currentGlassBlur = typeof themeToEdit.glassBlur === 'number' ? themeToEdit.glassBlur : 16;
      currentGlassOpacity = typeof themeToEdit.glassOpacity === 'number' ? themeToEdit.glassOpacity : 0.65;
      currentWallpaper = themeToEdit.wallpaper || null;
      currentTokens = { ...getDefaultTokens(), ...(themeToEdit.colors || {}) };
    } else {
      currentThemeName = 'My Theme'; currentEmoji = '🎨'; currentLiquidGlass = false;
      currentGlassBlur = 16; currentGlassOpacity = 0.65;
      currentWallpaper = null; currentTokens = getDefaultTokens();
    }
    deriveSecondaryTokens();

    modalEl = document.createElement('div');
    modalEl.id = 'cx-customizer-modal';
    modalEl.innerHTML = `
      <div id="cx-customizer-dialog" role="dialog" aria-label="Theme Customizer">
        <div class="cx-customizer-header">
          <h2 class="cx-customizer-title"><span id="cx-header-icon">${currentEmoji}</span> Theme Customizer</h2>
          <button class="cx-customizer-close" id="cx-close-btn" aria-label="Close">✕</button>
        </div>
        <div class="cx-customizer-mode-bar">
          <div class="cx-mode-pill-group">
            <button class="cx-mode-tab ${currentMode === 'basic' ? 'is-active' : ''}" id="cx-tab-basic">Basic Mode</button>
            <button class="cx-mode-tab ${currentMode === 'full' ? 'is-active' : ''}" id="cx-tab-full">Full Mode</button>
          </div>
          <div class="cx-preset-picker-wrap">
            <label for="cx-preset-select">Inherit Preset:</label>
            <select class="cx-customizer-select" id="cx-preset-select">
              <option value="">-- Choose Preset --</option>
              ${Object.entries(getPresets()).map(([k, v]) => `<option value="${k}">${v.icon || v.emoji || '🎨'} ${v.name}</option>`).join('')}
            </select>
          </div>
        </div>
        <div class="cx-customizer-body">
          <div class="cx-controls-pane">
            <div class="cx-identity-row">
              <div>
                <label style="font-size: 12px; color: #94a3b8; display: block; margin-bottom: 4px;">Theme Name</label>
                <input class="cx-customizer-input" id="cx-name-input" value="${currentThemeName}" style="width: 100%; box-sizing: border-box;">
              </div>
              <div>
                <label style="font-size: 12px; color: #94a3b8; display: block; margin-bottom: 4px;">Icon</label>
                <input class="cx-customizer-input" id="cx-emoji-input" value="${currentEmoji}" style="width: 48px; text-align: center;">
              </div>
            </div>
            <div class="cx-quick-emojis">
              ${['🎨', '⚡', '🌌', '💎', '🔮', '🪐', '🌿', '🌙', '🌸', '☕'].map(e => `<button class="cx-emoji-btn" data-emoji="${e}">${e}</button>`).join('')}
            </div>
            <div class="cx-token-grid" id="cx-token-grid"></div>
            <div class="cx-color-picker-box" id="cx-picker-box">
              <div style="font-size: 12px; font-weight: 600; color: #cbd5e1; margin-bottom: 8px;">Edit: <span id="cx-active-token-name">${activeToken}</span></div>
              <div class="cx-picker-sv" id="cx-picker-sv"><div class="cx-picker-sv-cursor" id="cx-picker-cursor"></div></div>
              <input type="range" min="0" max="360" class="cx-picker-hue" id="cx-picker-hue">
              <div style="display: flex; gap: 8px; align-items: center;">
                <input class="cx-customizer-input" id="cx-picker-hex" style="width: 90px; font-family: monospace;">
                <div class="cx-picker-swatches">
                  ${['#0f141b', '#1e2632', '#202020', '#32302f', '#000000', '#3b82f6', '#fabd2f', '#10b981', '#f43f5e', '#ffffff'].map(c => `<div class="cx-swatch-chip" data-color="${c}" style="background-color: ${c};"></div>`).join('')}
                </div>
              </div>
            </div>
            <div class="cx-addon-toggles">
              <label class="cx-toggle-label">
                <input type="checkbox" id="cx-glass-toggle" ${currentLiquidGlass ? 'checked' : ''}>
                <span>Frosted Liquid Glass Mode (Diffusion & Rounded Corners)</span>
              </label>
              <div id="cx-glass-sliders-wrap" style="display:${currentLiquidGlass ? 'flex' : 'none'};flex-direction:column;gap:6px;margin:6px 0;padding:6px 8px;background:rgba(0,0,0,0.25);border-radius:6px;">
                <div style="display:flex;justify-content:space-between;align-items:center;font-size:11px;color:#94a3b8;">
                  <span>Blur Strength: <strong id="cx-glass-blur-val" style="color:#e2e8f0;">${currentGlassBlur}px</strong></span>
                  <input type="range" id="cx-glass-blur-slider" min="0" max="40" value="${currentGlassBlur}" style="width:110px;cursor:pointer;">
                </div>
                <div style="display:flex;justify-content:space-between;align-items:center;font-size:11px;color:#94a3b8;">
                  <span>Transparency: <strong id="cx-glass-opacity-val" style="color:#e2e8f0;">${Math.round(currentGlassOpacity * 100)}%</strong></span>
                  <input type="range" id="cx-glass-opacity-slider" min="10" max="100" value="${Math.round(currentGlassOpacity * 100)}" style="width:110px;cursor:pointer;">
                </div>
              </div>
              <div style="display: flex; align-items: center; gap: 10px; margin-top: 4px;">
                <input type="file" id="cx-bg-file-input" accept="image/*" style="display:none">
                <button class="cx-btn cx-btn-secondary" id="cx-upload-bg-btn" style="padding: 4px 10px; font-size: 12px;">🖼 Custom Wallpaper</button>
                <button class="cx-btn cx-btn-secondary" id="cx-clear-bg-btn" style="padding: 4px 8px; font-size: 12px;" ${currentWallpaper ? '' : 'disabled'}>✕</button>
                <span id="cx-bg-status" style="font-size: 11px; color: #94a3b8;">${currentWallpaper ? 'Wallpaper active' : 'Default background'}</span>
              </div>
            </div>
          </div>
          <div class="cx-preview-pane">
            <h3 class="cx-preview-pane-title">Live Preview</h3>
            <div id="cx-customizer-preview">
              <div class="cx-mock-subtle-bar">
                <span>Classes</span> &rsaquo; <span>Assessment Outlines</span>
              </div>
              <div class="cx-mock-card">
                <div class="cx-mock-card-header">
                  <span class="cx-mock-title" id="cx-preview-heading">${currentThemeName}</span>
                  <span class="cx-mock-elevated"><span id="cx-preview-emoji">${currentEmoji}</span> Year 12</span>
                </div>
                <div class="cx-mock-progress-bar">
                  <div class="cx-mock-progress-fill"></div>
                  <div class="cx-mock-accent-indicator"></div>
                </div>
                <div class="cx-mock-meta">Leon Harris &bull; Willetton Senior High School</div>
                <div class="cx-mock-stats-panel">
                  Min 30.2% &bull; Q1 62.3% &bull; <strong>Med 70.8%</strong> &bull; Q3 79.1% &bull; <strong>Max 92.7%</strong>
                  <div class="cx-mock-divider"></div>
                  <strong>Z-Score 0.96</strong> &bull; <strong>Top 15%</strong> &bull; <span>35 / ~234</span>
                </div>
                <div style="display: flex; gap: 8px;">
                  <button class="cx-mock-button">View Tasks</button>
                  <button class="cx-mock-button cx-mock-button-hover">Details</button>
                </div>
              </div>
            </div>
          </div>
        </div>
        <div class="cx-customizer-footer">
          <div class="cx-btn-group">
            <input type="file" id="cx-import-file" accept=".json" style="display:none">
            <button class="cx-btn cx-btn-secondary" id="cx-import-btn">📥 Import JSON</button>
            <button class="cx-btn cx-btn-secondary" id="cx-export-btn">📤 Export JSON</button>
          </div>
          <div class="cx-btn-group">
            <button class="cx-btn cx-btn-secondary" id="cx-cancel-btn">Cancel</button>
            <button class="cx-btn cx-btn-primary" id="cx-save-btn">💾 Save Theme</button>
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(modalEl);
    setupEvents(); renderTokens(); syncPickerToToken(activeToken); renderMockup();
  }

  function close() {
    if (modalEl) { modalEl.remove(); modalEl = null; }
  }

  function renderTokens() {
    const grid = modalEl?.querySelector('#cx-token-grid');
    if (!grid) return;
    const basicKeys = [
      { key: 'canvas', label: 'Canvas Background' }, { key: 'surface', label: 'Panel / Surface' },
      { key: 'textPrimary', label: 'Primary Text' }, { key: 'button', label: 'Button Color' },
      { key: 'border', label: 'Outline / Border' }, { key: 'accent', label: 'Primary Accent' }
    ];
    const fullKeys = [
      { key: 'canvas', label: 'Canvas Background' }, { key: 'canvasSubtle', label: 'Subtle Canvas' },
      { key: 'surface', label: 'Panel / Card Surface' }, { key: 'surfaceSecondary', label: 'Surface Secondary' },
      { key: 'surfaceElevated', label: 'Surface Elevated' }, { key: 'border', label: 'Border / Outline' },
      { key: 'borderSubtle', label: 'Subtle Border' }, { key: 'accent', label: 'Primary Accent' },
      { key: 'accentHover', label: 'Accent Hover' }, { key: 'textPrimary', label: 'Primary Text' },
      { key: 'textSecondary', label: 'Secondary Text' }, { key: 'tileLinkColor', label: 'Tile / Link Color' },
      { key: 'button', label: 'Button Background' }, { key: 'buttonHover', label: 'Button Hover' }
    ];
    grid.innerHTML = (currentMode === 'basic' ? basicKeys : fullKeys).map(t => `
      <div class="cx-token-item ${activeToken === t.key ? 'is-active' : ''}" data-key="${t.key}">
        <span class="cx-token-label">${t.label}</span>
        <div class="cx-token-control-wrap"><span class="cx-token-val">${currentTokens[t.key] || '#000'}</span><div class="cx-token-chip" style="background-color:${currentTokens[t.key] || '#000'};"></div></div>
      </div>
    `).join('');

    grid.querySelectorAll('.cx-token-item').forEach(el => {
      el.onclick = () => {
        activeToken = el.dataset.key;
        grid.querySelectorAll('.cx-token-item').forEach(x => x.classList.remove('is-active'));
        el.classList.add('is-active'); syncPickerToToken(activeToken);
      };
    });
  }

  function syncPickerToToken(key) {
    const val = currentTokens[key] || '#1e2632', rgb = parseHex(val), hsv = rgbToHsv(rgb.r, rgb.g, rgb.b);
    pickerH = hsv.h; pickerS = hsv.s; pickerV = hsv.v;
    const nameEl = modalEl?.querySelector('#cx-active-token-name'); if (nameEl) nameEl.textContent = key;
    const hueInput = modalEl?.querySelector('#cx-picker-hue'); if (hueInput) hueInput.value = pickerH;
    const hexInput = modalEl?.querySelector('#cx-picker-hex'); if (hexInput) hexInput.value = toHex(rgb.r, rgb.g, rgb.b);
    const svBox = modalEl?.querySelector('#cx-picker-sv'); if (svBox) svBox.style.backgroundColor = `hsl(${pickerH}, 100%, 50%)`;
    const cursor = modalEl?.querySelector('#cx-picker-cursor');
    if (cursor) { cursor.style.left = `${pickerS * 100}%`; cursor.style.top = `${(1 - pickerV) * 100}%`; }
  }

  function updateColorFromPicker() {
    const rgb = hsvToRgb(pickerH, pickerS, pickerV);
    const hex = toHex(rgb.r, rgb.g, rgb.b);
    currentTokens[activeToken] = hex;
    const hexInput = modalEl?.querySelector('#cx-picker-hex');
    if (hexInput && hexInput !== document.activeElement) hexInput.value = hex;
    deriveSecondaryTokens(); renderTokens(); renderMockup();
  }

  function setupEvents() {
    if (!modalEl) return;
    modalEl.querySelector('#cx-close-btn').onclick = close;
    modalEl.querySelector('#cx-cancel-btn').onclick = close;

    modalEl.querySelector('#cx-tab-basic').onclick = () => {
      currentMode = 'basic';
      modalEl.querySelector('#cx-tab-basic').classList.add('is-active');
      modalEl.querySelector('#cx-tab-full').classList.remove('is-active');
      deriveSecondaryTokens(); renderTokens(); renderMockup();
    };
    modalEl.querySelector('#cx-tab-full').onclick = () => {
      currentMode = 'full';
      modalEl.querySelector('#cx-tab-full').classList.add('is-active');
      modalEl.querySelector('#cx-tab-basic').classList.remove('is-active');
      renderTokens(); renderMockup();
    };

    modalEl.querySelector('#cx-preset-select').onchange = (e) => {
      const p = getPresets()[e.target.value];
      if (p) {
        currentTokens = { ...p };
        if (p.icon || p.emoji) currentEmoji = p.icon || p.emoji;
        currentLiquidGlass = Boolean(p.liquidGlass);
        modalEl.querySelector('#cx-emoji-input').value = currentEmoji;
        modalEl.querySelector('#cx-header-icon').textContent = currentEmoji;
        modalEl.querySelector('#cx-glass-toggle').checked = currentLiquidGlass;
        deriveSecondaryTokens(); renderTokens(); syncPickerToToken(activeToken); renderMockup();
      }
    };

    const nameInput = modalEl.querySelector('#cx-name-input');
    nameInput.oninput = () => {
      currentThemeName = nameInput.value;
      modalEl.querySelector('#cx-preview-heading').textContent = currentThemeName;
    };
    const emojiInput = modalEl.querySelector('#cx-emoji-input');
    emojiInput.oninput = () => {
      currentEmoji = emojiInput.value || '🎨';
      modalEl.querySelector('#cx-header-icon').textContent = currentEmoji;
      const prevEmoji = modalEl.querySelector('#cx-preview-emoji'); if (prevEmoji) prevEmoji.textContent = currentEmoji;
      renderMockup();
    };
    modalEl.querySelectorAll('.cx-emoji-btn').forEach(btn => {
      btn.onclick = () => {
        currentEmoji = btn.dataset.emoji;
        emojiInput.value = currentEmoji;
        modalEl.querySelector('#cx-header-icon').textContent = currentEmoji;
        const prevEmoji = modalEl.querySelector('#cx-preview-emoji'); if (prevEmoji) prevEmoji.textContent = currentEmoji;
        renderMockup();
      };
    });

    modalEl.querySelector('#cx-glass-toggle').onchange = (e) => {
      currentLiquidGlass = e.target.checked;
      const wrap = modalEl.querySelector('#cx-glass-sliders-wrap');
      if (wrap) wrap.style.display = currentLiquidGlass ? 'flex' : 'none';
      renderMockup();
    };
    const blurSlider = modalEl.querySelector('#cx-glass-blur-slider');
    if (blurSlider) blurSlider.oninput = (e) => {
      currentGlassBlur = parseInt(e.target.value, 10);
      const val = modalEl.querySelector('#cx-glass-blur-val'); if (val) val.textContent = `${currentGlassBlur}px`;
      renderMockup();
    };
    const opSlider = modalEl.querySelector('#cx-glass-opacity-slider');
    if (opSlider) opSlider.oninput = (e) => {
      currentGlassOpacity = parseInt(e.target.value, 10) / 100;
      const val = modalEl.querySelector('#cx-glass-opacity-val'); if (val) val.textContent = `${Math.round(currentGlassOpacity * 100)}%`;
      renderMockup();
    };

    const svBox = modalEl.querySelector('#cx-picker-sv');
    let isDraggingSV = false;
    const handleSVMouse = (e) => {
      const rect = svBox.getBoundingClientRect();
      pickerS = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
      pickerV = Math.max(0, Math.min(1, 1 - (e.clientY - rect.top) / rect.height));
      const cursor = modalEl.querySelector('#cx-picker-cursor');
      if (cursor) { cursor.style.left = `${pickerS * 100}%`; cursor.style.top = `${(1 - pickerV) * 100}%`; }
      updateColorFromPicker();
    };
    svBox.onmousedown = (e) => { isDraggingSV = true; handleSVMouse(e); };
    window.addEventListener('mousemove', e => { if (isDraggingSV) handleSVMouse(e); });
    window.addEventListener('mouseup', () => { isDraggingSV = false; });

    const hueInput = modalEl.querySelector('#cx-picker-hue');
    hueInput.oninput = () => {
      pickerH = parseInt(hueInput.value, 10);
      svBox.style.backgroundColor = `hsl(${pickerH}, 100%, 50%)`;
      updateColorFromPicker();
    };

    const hexInput = modalEl.querySelector('#cx-picker-hex');
    hexInput.onchange = () => {
      const val = hexInput.value.trim();
      if (/^#[a-f0-9]{6}$/i.test(val)) {
        currentTokens[activeToken] = val; syncPickerToToken(activeToken);
        deriveSecondaryTokens(); renderTokens(); renderMockup();
      }
    };
    modalEl.querySelectorAll('.cx-swatch-chip').forEach(ch => {
      ch.onclick = () => {
        currentTokens[activeToken] = ch.dataset.color; syncPickerToToken(activeToken);
        deriveSecondaryTokens(); renderTokens(); renderMockup();
      };
    });

    const bgFile = modalEl.querySelector('#cx-bg-file-input');
    modalEl.querySelector('#cx-upload-bg-btn').onclick = () => bgFile.click();
    bgFile.onchange = (e) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const r = new FileReader();
      r.onload = ev => {
        currentWallpaper = ev.target.result;
        modalEl.querySelector('#cx-bg-status').textContent = file.name;
        modalEl.querySelector('#cx-clear-bg-btn').disabled = false;
        renderMockup();
      };
      r.readAsDataURL(file);
    };
    modalEl.querySelector('#cx-clear-bg-btn').onclick = () => {
      currentWallpaper = null;
      modalEl.querySelector('#cx-bg-status').textContent = 'Default background';
      modalEl.querySelector('#cx-clear-bg-btn').disabled = true;
      renderMockup();
    };

    modalEl.querySelector('#cx-export-btn').onclick = () => {
      const data = {
        version: 1, name: currentThemeName, icon: currentEmoji,
        liquidGlass: currentLiquidGlass, glassBlur: currentGlassBlur, glassOpacity: currentGlassOpacity,
        wallpaper: currentWallpaper,
        swatch: [currentTokens.canvas, currentTokens.surface, currentTokens.accent],
        colors: { ...currentTokens }
      };
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `connectea-theme-${currentThemeName.toLowerCase().replace(/\s+/g, '_')}.json`;
      a.click();
      URL.revokeObjectURL(a.href);
    };

    const importFile = modalEl.querySelector('#cx-import-file');
    modalEl.querySelector('#cx-import-btn').onclick = () => importFile.click();
    importFile.onchange = (e) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const r = new FileReader();
      r.onload = ev => {
        try {
          const imported = JSON.parse(ev.target.result);
          if (imported.name) currentThemeName = imported.name;
          if (imported.icon) currentEmoji = imported.icon;
          if (imported.liquidGlass !== undefined) currentLiquidGlass = Boolean(imported.liquidGlass);
          if (imported.glassBlur !== undefined) currentGlassBlur = imported.glassBlur;
          if (imported.glassOpacity !== undefined) currentGlassOpacity = imported.glassOpacity;
          if (imported.wallpaper !== undefined) currentWallpaper = imported.wallpaper;
          if (imported.colors) currentTokens = { ...currentTokens, ...imported.colors };
          nameInput.value = currentThemeName; emojiInput.value = currentEmoji;
          modalEl.querySelector('#cx-header-icon').textContent = currentEmoji;
          modalEl.querySelector('#cx-glass-toggle').checked = currentLiquidGlass;
          const wrap = modalEl.querySelector('#cx-glass-sliders-wrap');
          if (wrap) wrap.style.display = currentLiquidGlass ? 'flex' : 'none';
          if (blurSlider) blurSlider.value = currentGlassBlur;
          if (modalEl.querySelector('#cx-glass-blur-val')) modalEl.querySelector('#cx-glass-blur-val').textContent = `${currentGlassBlur}px`;
          if (opSlider) opSlider.value = Math.round(currentGlassOpacity * 100);
          if (modalEl.querySelector('#cx-glass-opacity-val')) modalEl.querySelector('#cx-glass-opacity-val').textContent = `${Math.round(currentGlassOpacity * 100)}%`;
          deriveSecondaryTokens(); renderTokens(); syncPickerToToken(activeToken); renderMockup();
        } catch { alert('Invalid theme JSON file.'); }
      };
      r.readAsText(file);
    };

    modalEl.querySelector('#cx-save-btn').onclick = () => {
      deriveSecondaryTokens();
      const finalName = (modalEl.querySelector('#cx-name-input')?.value || currentThemeName || 'Custom Theme').trim();
      const finalIcon = (modalEl.querySelector('#cx-emoji-input')?.value || currentEmoji || '🎨').trim();
      const themeDef = {
        name: finalName,
        icon: finalIcon,
        liquidGlass: currentLiquidGlass,
        glassBlur: currentGlassBlur,
        glassOpacity: currentGlassOpacity,
        wallpaper: currentWallpaper,
        swatch: [currentTokens.canvas, currentTokens.surface, currentTokens.accent],
        colors: { ...currentTokens }
      };
      const reg = window.ConnectifyThemeRegistry;
      if (reg && reg.saveCustomTheme) {
        const saved = reg.saveCustomTheme(themeDef);
        if (saved) reg.setTheme(saved.id);
      }
      close();
    };
  }

  window.ConnectifyThemeCustomizer = {
    open,
    close,
    isOpen: () => modalEl !== null
  };
})();
