/**
 * Connectify Settings: panel markup
 *
 * Static HTML for the Settings panel: general preferences (incl. "Show this semester's classes only"), scaling calibration, previous-year
 * baselines, assessment categories and developer settings. The theme options are filled in from the
 * theme registry when the panel opens. Exposes window.ConnectifySettingsMarkup.
 */
(() => {
  'use strict';

  const panelHtml = () => `
      <header><strong style="font-size:18px;">Settings</strong></header>
      <section class="cx-settings-section">
        <header><strong>General Preferences</strong></header>
        <label class="cx-settings-check">
          <input type="checkbox" id="cx-auto-expand-toggle"> Auto-expand class tabs on page load
        </label>
        <label class="cx-settings-check">
          <input type="checkbox" id="cx-semester-filter-toggle"> Show this semester's classes only
        </label>
        <p class="cx-settings-desc" id="cx-semester-filter-detected"></p>
        <label class="cx-settings-check">
          <input type="checkbox" id="cx-course-filter-toggle"> Ignore Certificate and General courses
        </label>

        <div class="cx-settings-divider cx-settings-fields">
          <div>
            <label for="cx-general-cohort-input" class="cx-settings-label">General Cohort Size</label>
            <div style="display:flex;align-items:center;gap:6px;">
              <input type="number" id="cx-general-cohort-input" class="cx-settings-number-input" min="1" step="1" placeholder="500" style="box-sizing:border-box;width:80px;padding:3px 6px;border-radius:4px;font-size:12px;">
            </div>
          </div>
          <div>
            <label for="cx-atar-percentage-input" class="cx-settings-label">ATAR Percentage</label>
            <div style="display:flex;align-items:center;gap:6px;">
              <input type="number" id="cx-atar-percentage-input" class="cx-settings-number-input" min="1" max="100" step="1" placeholder="60" style="box-sizing:border-box;width:75px;padding:3px 6px;border-radius:4px;font-size:12px;">
              <span class="cx-settings-hint">%</span>
            </div>
          </div>
          <div>
            <label for="cx-theme-select-input" class="cx-settings-label">Color Theme</label>
            <div style="display:flex;align-items:center;gap:6px;">
              <select id="cx-theme-select-input" class="cx-settings-select">
              </select>
            </div>
          </div>
          <div>
            <label for="cx-panel-view-select" class="cx-settings-label">Statistics Panels</label>
            <div style="display:flex;align-items:center;gap:6px;">
              <select id="cx-panel-view-select" class="cx-settings-select">
                <option value="compact">Compact view</option>
                <option value="subjects">Expanded view on subject panels only</option>
                <option value="all">Expanded view on all panels</option>
              </select>
            </div>
            <p class="cx-settings-desc">Takes effect after reload.</p>
          </div>
          <div id="cx-bg-settings-container" style="flex:1 1 100%;display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
            <label class="cx-settings-label" style="margin:0;">Custom Wallpaper:</label>
            <input type="file" id="cx-bg-upload-input" accept="image/*" style="display:none;">
            <button type="button" id="cx-bg-upload-btn" class="eds-c-button" style="background:#2563eb;color:#fff;border:none;padding:3px 10px;border-radius:4px;cursor:pointer;font-size:11px;font-weight:600;">🖼 Upload Background</button>
            <button type="button" id="cx-bg-remove-btn" class="eds-c-button" style="display:none;background:#64748b;color:#fff;border:none;padding:3px 10px;border-radius:4px;cursor:pointer;font-size:11px;font-weight:600;">✕ Remove</button>
            <span id="cx-bg-status-label" class="cx-settings-hint" style="font-size:11px;">No custom background set</span>
            <div style="flex:1 1 100%;display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
              <span class="cx-settings-label" style="margin:0;">Preset Backgrounds:</span>
              <div id="cx-bg-presets" class="cx-bg-presets" role="group" aria-label="Preset backgrounds"></div>
            </div>
          </div>
        </div>
      </section>

      <section class="cx-settings-section">
        <header><strong>Semester 1 Scaling Calibration</strong></header>
        <div id="cx-calibration-table" style="display:grid;grid-template-columns:minmax(140px, 220px) 85px 85px;gap:8px 14px;align-items:center;"></div>
      </section>

      <section class="cx-settings-section">
        <header><strong>Previous Year Baselines</strong></header>
        <div id="cx-baselines-container"></div>
      </section>

      <section class="cx-settings-section">
        <header style="display:flex;justify-content:space-between;align-items:center;">
          <strong>Assessment Categories</strong>
          <button type="button" id="cx-cat-add" class="eds-c-button" style="background:#2563eb;color:#fff;border:none;padding:5px 12px;border-radius:4px;cursor:pointer;font-size:12px;font-weight:600;">+ Add Category</button>
        </header>
        <div id="cx-categories-inputs"></div>
        <div style="margin-top:16px;display:flex;gap:10px;align-items:center;">
           <button type="button" id="cx-cat-save" class="eds-c-button" style="background:#2563eb;color:#fff;border:none;padding:6px 14px;border-radius:4px;cursor:pointer;font-weight:600;">Save Changes</button>
           <button type="button" id="cx-cat-reset" class="eds-c-button" style="background:#4b5563;color:#fff;border:none;padding:6px 14px;border-radius:4px;cursor:pointer;font-weight:600;">Reset Defaults</button>
        </div>
      </section>

      <section class="cx-settings-section">
        <header><strong>Developer Settings</strong></header>
        <div style="display:flex;align-items:center;gap:10px;">
          <button type="button" id="cx-clear-cache-btn" class="eds-c-button cx-clear-cache-btn" style="background:#e74c3c;color:#fff;border:none;padding:6px 14px;border-radius:4px;cursor:pointer;font-weight:600;">Clear Cache</button>
          <span id="cx-clear-cache-feedback" style="display:none;font-size:12px;color:#27ae60;font-weight:600;">Cache cleared!</span>
        </div>
      </section>
  `;

  window.ConnectifySettingsMarkup = { panelHtml };
})();
