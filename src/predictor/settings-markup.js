/**
 * Connectify Settings: panel markup
 *
 * Static HTML for the Settings panel: general preferences, scaling calibration, previous-year
 * baselines, assessment categories and developer settings. The theme options are filled in from the
 * theme registry when the panel opens. Exposes window.ConnectifySettingsMarkup.
 */
(() => {
  'use strict';

  const panelHtml = () => `
      <header style="margin-bottom:20px;"><strong style="font-size:18px;">Settings</strong></header>
      <section class="cx-settings-section" style="margin-bottom:28px;">
        <header style="margin-bottom:8px;"><strong>General Preferences</strong></header>
        <label style="display:flex;align-items:center;gap:8px;font-size:12px;font-weight:600;cursor:pointer;user-select:none;margin-top:8px;">
          <input type="checkbox" id="cx-auto-expand-toggle" style="width:16px;height:16px;cursor:pointer;"> Auto-expand class tabs on page load
        </label>
        <p class="cx-settings-desc" style="margin:4px 0 0 24px;">When enabled, Connectify automatically expands course outlines on load to scrape assessment data.</p>

        <div class="cx-settings-divider" style="display:flex;flex-wrap:wrap;gap:18px;align-items:flex-start;margin-top:14px;padding-top:12px;">
          <div>
            <label for="cx-general-cohort-input" class="cx-settings-label">General Cohort Size</label>
            <div style="display:flex;align-items:center;gap:6px;">
              <input type="number" id="cx-general-cohort-input" class="cx-settings-number-input" min="1" step="1" placeholder="500" style="box-sizing:border-box;width:80px;padding:3px 6px;border-radius:4px;font-size:12px;">
              <span class="cx-settings-hint">(default: 500)</span>
            </div>
            <p class="cx-settings-desc">Estimated total students in this year level.</p>
          </div>
          <div>
            <label for="cx-atar-percentage-input" class="cx-settings-label">ATAR Percentage</label>
            <div style="display:flex;align-items:center;gap:6px;">
              <input type="number" id="cx-atar-percentage-input" class="cx-settings-number-input" min="1" max="100" step="1" placeholder="60" style="box-sizing:border-box;width:75px;padding:3px 6px;border-radius:4px;font-size:12px;">
              <span class="cx-settings-hint">% (default: 60%)</span>
            </div>
            <p class="cx-settings-desc">Proportion enrolled in the ATAR pathway.</p>
          </div>
          <div>
            <label for="cx-theme-select-input" class="cx-settings-label">Color Theme</label>
            <div style="display:flex;align-items:center;gap:6px;">
              <select id="cx-theme-select-input" class="cx-settings-select" style="box-sizing:border-box;padding:3px 8px;border-radius:4px;font-size:12px;cursor:pointer;">
              </select>
            </div>
            <p class="cx-settings-desc">Interface theme and visual palette.</p>
          </div>
          <div id="cx-bg-settings-container" style="flex:1 1 100%;display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-top:6px;padding-top:10px;border-top:1px solid rgba(255,255,255,0.08);">
            <label class="cx-settings-label" style="margin:0;">Custom Wallpaper:</label>
            <input type="file" id="cx-bg-upload-input" accept="image/*" style="display:none;">
            <button type="button" id="cx-bg-upload-btn" class="eds-c-button" style="background:#2563eb;color:#fff;border:none;padding:3px 10px;border-radius:4px;cursor:pointer;font-size:11px;font-weight:600;">🖼 Upload Background</button>
            <button type="button" id="cx-bg-remove-btn" class="eds-c-button" style="display:none;background:#64748b;color:#fff;border:none;padding:3px 10px;border-radius:4px;cursor:pointer;font-size:11px;font-weight:600;">✕ Remove</button>
            <span id="cx-bg-status-label" class="cx-settings-hint" style="font-size:11px;">No custom background set</span>
          </div>
        </div>
      </section>

      <section class="cx-settings-section" style="margin-bottom:28px;border-top:1px solid #d8e3ee;padding-top:20px;">
        <header style="margin-bottom:8px;"><strong>Semester 1 Scaling Calibration</strong></header>
        <p class="cx-settings-desc" style="font-size:12px;margin:0 0 14px 0;">Enter your school's Semester 1 scaled scores to calibrate the model to your cohort's historical distribution.</p>
        <div id="cx-calibration-table" style="display:grid;grid-template-columns:minmax(140px, 220px) 85px 85px;gap:10px 14px;align-items:center;margin-top:12px;"></div>
      </section>

      <section class="cx-settings-section" style="margin-bottom:28px;border-top:1px solid #d8e3ee;padding-top:20px;">
        <header style="margin-bottom:8px;"><strong>Previous Year Baselines (Cold-Start)</strong></header>
        <p class="cx-settings-desc" style="font-size:12px;margin:0 0 14px 0;">Enter your previous year's assessment type averages and subject final marks to jumpstart the Grade and ATAR Predictors early in the year.</p>
        <div id="cx-baselines-container"></div>
      </section>

      <section class="cx-settings-section" style="margin-top:36px;border-top:1px solid #d8e3ee;padding-top:24px;">
        <header style="margin-bottom:8px;display:flex;justify-content:space-between;align-items:center;">
          <strong>Assessment Categories</strong>
          <button type="button" id="cx-cat-add" class="eds-c-button" style="background:#2563eb;color:#fff;border:none;padding:5px 12px;border-radius:4px;cursor:pointer;font-size:12px;font-weight:600;">+ Add Category</button>
        </header>
        <p class="cx-settings-desc" style="font-size:12px;margin:0 0 16px 0;">Customize the comma-separated keywords used to automatically detect your assessment types:</p>
        <div id="cx-categories-inputs"></div>
        <div style="margin-top:16px;display:flex;gap:10px;align-items:center;">
           <button type="button" id="cx-cat-save" class="eds-c-button" style="background:#2563eb;color:#fff;border:none;padding:6px 14px;border-radius:4px;cursor:pointer;font-weight:600;">Save Changes</button>
           <button type="button" id="cx-cat-reset" class="eds-c-button" style="background:#4b5563;color:#fff;border:none;padding:6px 14px;border-radius:4px;cursor:pointer;font-weight:600;">Reset Defaults</button>
        </div>
      </section>

      <section class="cx-settings-section" style="margin-top:36px;border-top:1px solid #d8e3ee;padding-top:24px;">
        <header style="margin-bottom:8px;"><strong>Developer Settings</strong></header>
        <p class="cx-settings-desc" style="font-size:12px;margin:0 0 16px 0;">Reset local caches and saved student assessment data.</p>
        <div style="display:flex;align-items:center;gap:10px;">
          <button type="button" id="cx-clear-cache-btn" class="eds-c-button cx-clear-cache-btn" style="background:#e74c3c;color:#fff;border:none;padding:6px 14px;border-radius:4px;cursor:pointer;font-weight:600;">Clear Cache</button>
          <span id="cx-clear-cache-feedback" style="display:none;font-size:12px;color:#27ae60;font-weight:600;">Cache cleared!</span>
        </div>
      </section>
  `;

  window.ConnectifySettingsMarkup = { panelHtml };
})();
