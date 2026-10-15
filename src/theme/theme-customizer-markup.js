/**
 * Connectify Theme Customizer: modal markup
 *
 * Builds the customizer dialog and token grid HTML from the customizer state. Every user-supplied
 * value (theme name, icon, imported colours) is escaped. Exposes window.ConnectifyThemeCustomizerMarkup.
 */
(() => {
  'use strict';

  const { escapeHtml: esc } = window.ConnectifyThemeColors;

  const QUICK_EMOJIS = ['🎨', '⚡', '🌌', '💎', '🔮', '🪐', '🌿', '🌙', '🌸', '☕'];
  const SWATCHES = ['#0f141b', '#1e2632', '#202020', '#32302f', '#000000', '#3b82f6', '#fabd2f', '#10b981', '#f43f5e', '#ffffff'];

  const BASIC_TOKENS = [
    { key: 'canvas', label: 'Canvas Background' }, { key: 'surface', label: 'Panel / Surface' },
    { key: 'textPrimary', label: 'Primary Text' }, { key: 'button', label: 'Button Color' },
    { key: 'border', label: 'Outline / Border' }, { key: 'accent', label: 'Primary Accent' }
  ];
  const FULL_TOKENS = [
    { key: 'canvas', label: 'Canvas Background' }, { key: 'canvasSubtle', label: 'Subtle Canvas' },
    { key: 'surface', label: 'Panel / Card Surface' }, { key: 'surfaceSecondary', label: 'Surface Secondary' },
    { key: 'surfaceElevated', label: 'Surface Elevated' }, { key: 'border', label: 'Border / Outline' },
    { key: 'borderSubtle', label: 'Subtle Border' }, { key: 'accent', label: 'Primary Accent' },
    { key: 'accentHover', label: 'Accent Hover' }, { key: 'textPrimary', label: 'Primary Text' },
    { key: 'textSecondary', label: 'Secondary Text' }, { key: 'tileLinkColor', label: 'Tile / Link Color' },
    { key: 'button', label: 'Button Background' }, { key: 'buttonHover', label: 'Button Hover' }
  ];

  function tokenGridHtml(state) {
    return (state.mode === 'basic' ? BASIC_TOKENS : FULL_TOKENS).map(t => {
      const value = esc(state.tokens[t.key] || '#000');
      return `
      <div class="cx-token-item ${state.activeToken === t.key ? 'is-active' : ''}" data-key="${t.key}">
        <span class="cx-token-label">${t.label}</span>
        <div class="cx-token-control-wrap"><span class="cx-token-val">${value}</span><div class="cx-token-chip" style="background-color:${value};"></div></div>
      </div>`;
    }).join('');
  }

  function identityAndPickerHtml(s) {
    return `
            <div class="cx-identity-row">
              <div><label style="font-size: 12px; color: #94a3b8; display: block; margin-bottom: 4px;">Theme Name</label><input class="cx-customizer-input" id="cx-name-input" value="${esc(s.name)}" style="width: 100%; box-sizing: border-box;"></div>
              <div><label style="font-size: 12px; color: #94a3b8; display: block; margin-bottom: 4px;">Icon</label><input class="cx-customizer-input" id="cx-emoji-input" value="${esc(s.emoji)}" style="width: 48px; text-align: center;"></div>
            </div>
            <div class="cx-quick-emojis">
              ${QUICK_EMOJIS.map(e => `<button class="cx-emoji-btn" data-emoji="${e}">${e}</button>`).join('')}
            </div>
            <div class="cx-token-grid" id="cx-token-grid"></div>
            <div class="cx-color-picker-box" id="cx-picker-box">
              <div style="font-size: 12px; font-weight: 600; color: #cbd5e1; margin-bottom: 8px;">Edit: <span id="cx-active-token-name">${esc(s.activeToken)}</span></div>
              <div class="cx-picker-sv" id="cx-picker-sv"><div class="cx-picker-sv-cursor" id="cx-picker-cursor"></div></div>
              <input type="range" min="0" max="360" class="cx-picker-hue" id="cx-picker-hue">
              <div style="display: flex; gap: 8px; align-items: center;">
                <input class="cx-customizer-input" id="cx-picker-hex" style="width: 90px; font-family: monospace;">
                <div class="cx-picker-swatches">
                  ${SWATCHES.map(c => `<div class="cx-swatch-chip" data-color="${c}" style="background-color: ${c};"></div>`).join('')}
                </div>
              </div>
            </div>`;
  }

  function addonsHtml(s) {
    const opacityPct = Math.round(s.glassOpacity * 100);
    return `
            <div class="cx-addon-toggles">
              <label class="cx-toggle-label">
                <input type="checkbox" id="cx-glass-toggle" ${s.liquidGlass ? 'checked' : ''}>
                <span>Frosted Liquid Glass Mode (Diffusion & Rounded Corners)</span>
              </label>
              <div id="cx-glass-sliders-wrap" style="display:${s.liquidGlass ? 'flex' : 'none'};flex-direction:column;gap:6px;margin:6px 0;padding:6px 8px;background:rgba(0,0,0,0.25);border-radius:6px;">
                <div style="display:flex;justify-content:space-between;align-items:center;font-size:11px;color:#94a3b8;"><span>Blur Strength: <strong id="cx-glass-blur-val" style="color:#e2e8f0;">${s.glassBlur}px</strong></span><input type="range" id="cx-glass-blur-slider" min="0" max="40" value="${s.glassBlur}" style="width:110px;cursor:pointer;"></div>
                <div style="display:flex;justify-content:space-between;align-items:center;font-size:11px;color:#94a3b8;"><span>Transparency: <strong id="cx-glass-opacity-val" style="color:#e2e8f0;">${opacityPct}%</strong></span><input type="range" id="cx-glass-opacity-slider" min="10" max="100" value="${opacityPct}" style="width:110px;cursor:pointer;"></div>
              </div>
              <div style="display: flex; align-items: center; gap: 10px; margin-top: 4px;">
                <input type="file" id="cx-bg-file-input" accept="image/*" style="display:none">
                <button class="cx-btn cx-btn-secondary" id="cx-upload-bg-btn" style="padding: 4px 10px; font-size: 12px;">🖼 Custom Wallpaper</button>
                <button class="cx-btn cx-btn-secondary" id="cx-clear-bg-btn" style="padding: 4px 8px; font-size: 12px;" ${s.wallpaper ? '' : 'disabled'}>✕</button>
                <span id="cx-bg-status" style="font-size: 11px; color: #94a3b8;">${s.wallpaper ? 'Wallpaper active' : 'Default background'}</span>
              </div>
            </div>`;
  }

  // Static mockup: each element names itself and the token that colours it for the hover tooltip
  function previewHtml(s) {
    return `
          <div class="cx-preview-pane">
            <h3 class="cx-preview-pane-title">Live Preview</h3>
            <div id="cx-customizer-preview" data-cx-elem="Canvas Background" data-cx-token="--cx-canvas-bg (canvas)">
              <div class="cx-mock-subtle-bar" data-cx-elem="Subtle Bar" data-cx-token="--cx-canvas-subtle, --cx-text-secondary">
                <span>Classes</span> &rsaquo; <span>Assessment Outlines</span>
              </div>
              <div class="cx-mock-card" data-cx-elem="Card Surface" data-cx-token="--cx-surface-bg (surface), --cx-border">
                <div class="cx-mock-card-header">
                  <span class="cx-mock-title" id="cx-preview-heading" data-cx-elem="Card Title" data-cx-token="--cx-tile-link-color (tileLinkColor)">${esc(s.name)}</span>
                  <span class="cx-mock-elevated" data-cx-elem="Elevated Badge" data-cx-token="--cx-surface-elevated (surfaceElevated)"><span id="cx-preview-emoji">${esc(s.emoji)}</span> Year 12</span>
                </div>
                <div class="cx-mock-progress-bar" data-cx-elem="Progress Track" data-cx-token="--cx-surface-secondary">
                  <div class="cx-mock-progress-fill" data-cx-elem="Progress Fill" data-cx-token="--cx-accent (accent)"></div>
                  <div class="cx-mock-accent-indicator" data-cx-elem="Accent Indicator" data-cx-token="--cx-accent-hover (accentHover)"></div>
                </div>
                <div class="cx-mock-meta" data-cx-elem="Secondary Text" data-cx-token="--cx-text-secondary (textSecondary)">Leon Harris &bull; Willetton Senior High School</div>
                <div class="cx-mock-stats-panel" data-cx-elem="Statistics Panel" data-cx-token="--cx-surface-secondary, --cx-border">
                  Min 30.2% &bull; Q1 62.3% &bull; <strong>Med 70.8%</strong> &bull; Q3 79.1% &bull; <strong>Max 92.7%</strong>
                  <div class="cx-mock-divider"></div>
                  <strong>Z-Score 0.96</strong> &bull; <strong>Top 15%</strong> &bull; <span>35 / ~234</span>
                </div>
                <div style="display: flex; gap: 8px;">
                  <button class="cx-mock-button" data-cx-elem="Action Button" data-cx-token="--cx-button-bg (button), --cx-button-text">View Tasks</button>
                  <button class="cx-mock-button cx-mock-button-hover" data-cx-elem="Button Hover" data-cx-token="--cx-button-hover, --cx-button-text">Details</button>
                </div>
              </div>
              <div id="cx-preview-tooltip" class="cx-preview-tooltip" style="display:none;"></div>
            </div>
          </div>`;
  }

  function modalHtml(s, presets) {
    const presetOptions = Object.entries(presets)
      .map(([k, v]) => `<option value="${esc(k)}">${esc(v.icon || v.emoji || '🎨')} ${esc(v.name)}</option>`).join('');
    return `
      <div id="cx-customizer-dialog" role="dialog" aria-label="Theme Customizer">
        <div class="cx-customizer-header">
          <h2 class="cx-customizer-title"><span id="cx-header-icon">${esc(s.emoji)}</span> Theme Customizer</h2>
          <button class="cx-customizer-close" id="cx-close-btn" aria-label="Close">✕</button>
        </div>
        <div class="cx-customizer-mode-bar">
          <div class="cx-mode-pill-group">
            <button class="cx-mode-tab ${s.mode === 'basic' ? 'is-active' : ''}" id="cx-tab-basic">Basic Mode</button>
            <button class="cx-mode-tab ${s.mode === 'full' ? 'is-active' : ''}" id="cx-tab-full">Full Mode</button>
          </div>
          <div class="cx-preset-picker-wrap">
            <label for="cx-preset-select">Inherit Preset:</label>
            <select class="cx-customizer-select" id="cx-preset-select">
              <option value="">-- Choose Preset --</option>
              ${presetOptions}
            </select>
          </div>
        </div>
        <div class="cx-customizer-body">
          <div class="cx-controls-pane">${identityAndPickerHtml(s)}${addonsHtml(s)}
          </div>${previewHtml(s)}
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
  }

  window.ConnectifyThemeCustomizerMarkup = { modalHtml, tokenGridHtml };
})();
