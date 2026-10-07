/**
 * Connectify Category Settings & Customizer
 *
 * Implements assessment category customizer (+ Add Category, custom keywords, color themes)
 * and hosts the Settings panel.
 * Provides `window.ConnectifyCategorySettings`.
 */
(() => {
  'use strict';

  if (window.ConnectifyCategorySettings) return;

  const defaultCategories = {
    Exam: { color: '#e74c3c', keywords: ['exam', 'semester'] },
    Test: { color: '#2ecc71', keywords: ['test', 'quiz', 'in-class', 'in class'] },
    Application: { color: '#3498db', keywords: ['application', 'investigation', 'portfolio', 'validation', 'practical', 'speaking', 'listening', 'dictation'] },
    Essay: { color: '#9b59b6', keywords: ['essay', 'short answer', 'written response', 'close reading'] },
    'Take-Home': { color: '#f1c40f', keywords: ['take-home', 'assignment', 'project', 'presentation', 'oral', 'creative'] }
  };

  if (!window.cxCategories) {
    window.cxCategories = defaultCategories;
  }

  const getStorageApi = () => (typeof browser !== 'undefined' && browser?.storage)
    ? browser
    : (typeof chrome !== 'undefined' && chrome?.storage ? chrome : null);

  const safeStorageGet = (keys, cb) => {
    try {
      const api = getStorageApi();
      if (!api?.storage?.local) return;
      let handled = false;
      const callback = res => {
        if (handled) return;
        handled = true;
        if (res) cb(res);
      };
      const p = api.storage.local.get(keys, callback);
      if (p && typeof p.then === 'function') p.then(callback).catch(() => {});
    } catch (e) {}
  };

  const safeStorageSet = obj => {
    try {
      const api = getStorageApi();
      if (!api?.storage?.local) return;
      const p = api.storage.local.set(obj);
      if (p && typeof p.catch === 'function') p.catch(() => {});
    } catch (e) {}
  };

  const safeStorageRemove = key => {
    try {
      const api = getStorageApi();
      if (!api?.storage?.local) return;
      const p = api.storage.local.remove(key);
      if (p && typeof p.catch === 'function') p.catch(() => {});
    } catch (e) {}
  };

  const resolveCategories = () => {
    try {
      const stored = localStorage.getItem('connectea:categories') || localStorage.getItem('cx-categories');
      if (stored) window.cxCategories = JSON.parse(stored);
    } catch (e) {}
    safeStorageGet(['cx-categories'], res => {
      if (res && res['cx-categories']) {
        window.cxCategories = res['cx-categories'];
        try {
          localStorage.setItem('cx-categories', JSON.stringify(window.cxCategories));
          localStorage.setItem('connectea:categories', JSON.stringify(window.cxCategories));
        } catch (e) {}
      }
    });
    if (window.cxCategories?.['Take-Home']?.keywords) {
      window.cxCategories['Take-Home'].keywords = window.cxCategories['Take-Home'].keywords.filter(
        k => k.toLowerCase() !== 'extended'
      );
    }
  };
  resolveCategories();

  function renderCategoryInputs(panel, onCategoryChange) {
    const inputContainer = panel.querySelector('#cx-categories-inputs');
    if (!inputContainer) return;
    inputContainer.innerHTML = '';

    const currentCats = window.cxCategories || defaultCategories;
    for (const [cat, data] of Object.entries(currentCats)) {
      const wrap = document.createElement('div');
      wrap.className = 'cx-cat-wrap';
      wrap.style.cssText = 'display:flex;align-items:center;margin-bottom:10px;gap:8px;';

      const label = document.createElement('label');
      label.className = 'cx-cat-name-label';
      label.textContent = cat;
      label.title = cat;
      label.style.setProperty('--cx-cat-color', data.color || '#3498db');
      label.style.cssText = `width:90px;font-size:12px;font-weight:600;color:${data.color || '#3498db'};--cx-cat-color:${data.color || '#3498db'};overflow:hidden;text-overflow:ellipsis;white-space:nowrap;`;

      const input = document.createElement('input');
      input.type = 'text';
      input.className = 'cx-cat-keyword-input';
      input.id = `cx-cat-input-${cat.replace(/\s+/g, '_')}`;
      input.value = Array.isArray(data.keywords) ? data.keywords.join(', ') : '';
      input.style.cssText = 'flex:1;padding:4px 8px;border:1px solid #ccc;border-radius:4px;';

      wrap.append(label, input);

      if (!defaultCategories[cat]) {
        const delBtn = document.createElement('button');
        delBtn.type = 'button';
        delBtn.textContent = '✕';
        delBtn.title = `Delete category "${cat}"`;
        delBtn.style.cssText = 'background:transparent;color:#e74c3c;border:1px solid #e74c3c;border-radius:4px;cursor:pointer;padding:2px 7px;font-size:11px;';
        delBtn.onclick = () => {
          delete window.cxCategories[cat];
          try {
            localStorage.setItem('cx-categories', JSON.stringify(window.cxCategories));
            localStorage.setItem('connectea:categories', JSON.stringify(window.cxCategories));
          } catch {}
          safeStorageSet({ 'cx-categories': window.cxCategories });
          wrap.remove();
          if (typeof onCategoryChange === 'function') onCategoryChange();
        };
        wrap.append(delBtn);
      }

      inputContainer.append(wrap);
    }
  }

  function createSettingsPanel() {
    if (window.ConnectifyCategorySettings?.panelRefs) {
      return window.ConnectifyCategorySettings.panelRefs;
    }

    const catBtn = document.getElementById('connectify-categories-toggle') || document.createElement('button');
    catBtn.textContent = 'Settings';
    catBtn.type = 'button';
    catBtn.id = 'connectify-categories-toggle';

    const catPanel = document.getElementById('connectify-categories') || document.createElement('section');
    catPanel.id = 'connectify-categories';
    catPanel.hidden = true;
    catPanel.className = 'cx-workspace-panel';
    catPanel.innerHTML = `
      <header style="margin-bottom:20px;">
        <strong style="font-size:18px;">Settings</strong>
      </header>

      <section class="cx-settings-section" style="margin-bottom:28px;">
        <header style="margin-bottom:8px;"><strong>General Preferences</strong></header>
        <label style="display:flex;align-items:center;gap:8px;font-size:12px;font-weight:600;cursor:pointer;user-select:none;margin-top:8px;">
          <input type="checkbox" id="cx-auto-expand-toggle" style="width:16px;height:16px;cursor:pointer;">
          Auto-expand class tabs on page load
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
                <option value="dark">☾ Dark (v3.2.1 Parity)</option>
                <option value="quantum">⚛ Quantum Dark (Legacy &le;3.1.14)</option>
                <option value="amoled">🌑 AMOLED Black</option>
                <option value="midnight">🌌 Midnight Navy</option>
                <option value="forest">🌲 Emerald Forest</option>
                <option value="sunset">🌅 Twilight Plum</option>
              </select>
            </div>
            <p class="cx-settings-desc">Interface theme and visual palette.</p>
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
          <button type="button" id="cx-cat-add" class="eds-c-button" style="background:#3498db;color:#fff;border:none;padding:5px 12px;border-radius:4px;cursor:pointer;font-size:12px;font-weight:600;">+ Add Category</button>
        </header>
        <p class="cx-settings-desc" style="font-size:12px;margin:0 0 16px 0;">Customize the comma-separated keywords used to automatically detect your assessment types:</p>
        <div id="cx-categories-inputs"></div>
        <div style="margin-top:16px;display:flex;gap:10px;align-items:center;">
           <button type="button" id="cx-cat-save" class="eds-c-button" style="background:#2563eb;color:#fff;border:none;padding:6px 14px;border-radius:4px;cursor:pointer;font-weight:600;">Save Changes</button>
           <button type="button" id="cx-cat-reset" class="eds-c-button" style="background:#95a5a6;color:#fff;border:none;padding:6px 14px;border-radius:4px;cursor:pointer;">Reset Defaults</button>
        </div>
      </section>

      <section class="cx-settings-section" style="margin-top:36px;border-top:1px solid #d8e3ee;padding-top:24px;">
        <header style="margin-bottom:8px;">
          <strong>Developer Settings</strong>
        </header>
        <p class="cx-settings-desc" style="font-size:12px;margin:0 0 16px 0;">Reset local caches and saved student assessment data.</p>
        <div style="display:flex;align-items:center;gap:10px;">
          <button type="button" id="cx-clear-cache-btn" class="eds-c-button cx-clear-cache-btn" style="background:#e74c3c;color:#fff;border:none;padding:6px 14px;border-radius:4px;cursor:pointer;font-weight:600;">Clear Cache</button>
          <span id="cx-clear-cache-feedback" style="display:none;font-size:12px;color:#27ae60;font-weight:600;">Cache cleared!</span>
        </div>
      </section>
    `;

    const clearCacheBtn = catPanel.querySelector('#cx-clear-cache-btn');
    if (clearCacheBtn) {
      clearCacheBtn.addEventListener('click', () => {
        try {
          if (window.ConnectifyCache?.clearResultsCache) window.ConnectifyCache.clearResultsCache();
          if (window.ConnectifyCache?.clearCohortCache) window.ConnectifyCache.clearCohortCache();
          if (window.ConnectifyCache?.clearPredictorCache) window.ConnectifyCache.clearPredictorCache();
          if (window.ConnectifyData?.clearCache) window.ConnectifyData.clearCache();
          try { localStorage.removeItem('connectify:stale_subjects'); } catch {}
          const feedback = catPanel.querySelector('#cx-clear-cache-feedback');
          if (feedback) {
            feedback.style.display = 'inline';
            setTimeout(() => { feedback.style.display = 'none'; }, 3000);
          }
        } catch (e) {
          console.warn('Failed to clear cache:', e);
        }
      });
    }

    catPanel.querySelector('#cx-cat-add').onclick = () => {
      const catName = prompt('Enter new assessment category name (e.g. Practical, Investigation):');
      if (!catName || !catName.trim()) return;
      const cleanName = catName.trim();
      if (!window.cxCategories) {
        window.cxCategories = JSON.parse(JSON.stringify(defaultCategories));
      }
      const currentCats = window.cxCategories;
      const exists = Object.keys(currentCats).some(k => k.toLowerCase() === cleanName.toLowerCase());
      if (exists) {
        alert(`Category "${cleanName}" already exists!`);
        return;
      }

      const color = window.ConnectifyTaskTypes?.getCategoryColor
        ? window.ConnectifyTaskTypes.getCategoryColor(cleanName)
        : '#3498db';

      window.cxCategories[cleanName] = {
        color,
        keywords: [cleanName.toLowerCase()]
      };

      try {
        localStorage.setItem('cx-categories', JSON.stringify(window.cxCategories));
        localStorage.setItem('connectea:categories', JSON.stringify(window.cxCategories));
      } catch (e) {}
      safeStorageSet({ 'cx-categories': window.cxCategories });

      renderCategoryInputs(catPanel, () => renderBaselines());
      renderBaselines();
      const newInput = catPanel.querySelector(`#cx-cat-input-${cleanName.replace(/\s+/g, '_')}`);
      if (newInput) newInput.focus();
    };

    const autoExpandToggle = catPanel.querySelector('#cx-auto-expand-toggle');
    if (autoExpandToggle) {
      autoExpandToggle.checked = localStorage.getItem('connectify:auto_expand') !== 'false';
      autoExpandToggle.addEventListener('change', () => {
        try { localStorage.setItem('connectify:auto_expand', String(autoExpandToggle.checked)); } catch (e) {}
        window.dispatchEvent(new CustomEvent('connectify-settings-updated'));
      });
    }

    const generalCohortInput = catPanel.querySelector('#cx-general-cohort-input');
    if (generalCohortInput) {
      const saved = localStorage.getItem('connectify:general_cohort_size');
      if (saved) generalCohortInput.value = saved;
      generalCohortInput.addEventListener('input', () => {
        try {
          const val = generalCohortInput.value.trim();
          if (val && Number(val) > 0) localStorage.setItem('connectify:general_cohort_size', val);
          else localStorage.removeItem('connectify:general_cohort_size');
        } catch (e) {}
        window.dispatchEvent(new CustomEvent('connectify-settings-updated'));
      });
    }

    const atarPctInput = catPanel.querySelector('#cx-atar-percentage-input');
    if (atarPctInput) {
      const saved = localStorage.getItem('connectify:atar_percentage');
      if (saved) atarPctInput.value = saved;
      atarPctInput.addEventListener('input', () => {
        try {
          const val = atarPctInput.value.trim();
          if (val && Number(val) > 0 && Number(val) <= 100) localStorage.setItem('connectify:atar_percentage', val);
          else localStorage.removeItem('connectify:atar_percentage');
        } catch (e) {}
        window.dispatchEvent(new CustomEvent('connectify-settings-updated'));
      });
    }

    const themeSelectInput = catPanel.querySelector('#cx-theme-select-input');
    if (themeSelectInput) {
      const rawTheme = window.ConnectifyTheme ? window.ConnectifyTheme.getTheme() : (localStorage.getItem('connectea:theme:id') || 'dark');
      themeSelectInput.value = (rawTheme === 'light' || rawTheme === 'custom') ? (localStorage.getItem('connectea:theme:restore_theme') || 'dark') : rawTheme;
      if (!themeSelectInput.value) themeSelectInput.value = 'dark';
      themeSelectInput.addEventListener('change', () => {
        if (window.ConnectifyTheme) window.ConnectifyTheme.setTheme(themeSelectInput.value);
      });
    }

    function renderCalib() {
      if (window.ConnectifyCalibration?.renderCalibTable) window.ConnectifyCalibration.renderCalibTable(catPanel);
    }

    function renderBaselines() {
      if (window.ConnectifyCategoryBaselines?.renderBaselines) {
        window.ConnectifyCategoryBaselines.renderBaselines(catPanel, () => renderCategoryInputs(catPanel, () => renderBaselines()));
      }
    }

    function openCategories() {
      catPanel.hidden = false;
      catBtn.setAttribute('aria-pressed', 'true');
      window.dispatchEvent(new CustomEvent('connectify-open', { detail: 'categories' }));
      try {
        if (autoExpandToggle) autoExpandToggle.checked = localStorage.getItem('connectify:auto_expand') !== 'false';
        if (generalCohortInput) generalCohortInput.value = localStorage.getItem('connectify:general_cohort_size') || '';
        if (atarPctInput) atarPctInput.value = localStorage.getItem('connectify:atar_percentage') || '';
        if (themeSelectInput && window.ConnectifyTheme) themeSelectInput.value = window.ConnectifyTheme.getTheme();
        resolveCategories();
      } catch (e) {
        console.warn('Connectify settings preferences error:', e);
      }
      try { renderCategoryInputs(catPanel, () => renderBaselines()); } catch (e) { console.warn('renderCategoryInputs error:', e); }
      try { renderCalib(); } catch (e) { console.warn('renderCalib error:', e); }
      try { renderBaselines(); } catch (e) { console.warn('renderBaselines error:', e); }
    }

    function closeCategories() {
      catPanel.hidden = true;
      catBtn.setAttribute('aria-pressed', 'false');
    }

    catBtn.onclick = e => {
      if (e) e.stopPropagation();
      if (catPanel.hidden) {
        openCategories();
      } else {
        closeCategories();
        window.dispatchEvent(new CustomEvent('connectify-open', { detail: 'home' }));
      }
    };

    window.addEventListener('connectify-open', e => {
      if (e.detail === 'categories') {
        if (catPanel.hidden) openCategories();
      } else {
        closeCategories();
      }
    });

    catPanel.querySelector('#cx-cat-save').onclick = () => {
      const wraps = catPanel.querySelectorAll('.cx-cat-wrap');
      const updatedCats = {};

      wraps.forEach(wrap => {
        const cat = wrap.dataset.cat;
        const input = wrap.querySelector('.cx-cat-keyword-input');
        const oldData = (window.cxCategories && window.cxCategories[cat]) || defaultCategories[cat] || {};
        const keywords = input?.value
          ? input.value.split(',').map(s => s.trim().toLowerCase()).filter(Boolean)
          : (oldData.keywords || [cat.toLowerCase()]);
        updatedCats[cat] = {
          color: oldData.color || '#3498db',
          keywords: keywords.length ? keywords : [cat.toLowerCase()]
        };
      });

      window.cxCategories = updatedCats;
      try {
        localStorage.setItem('cx-categories', JSON.stringify(updatedCats));
        localStorage.setItem('connectea:categories', JSON.stringify(updatedCats));
      } catch (e) {}
      safeStorageSet({ 'cx-categories': updatedCats });

      if (window.ConnectifyTaskTypes?.rescanAllAutoAssessments) {
        window.ConnectifyTaskTypes.rescanAllAutoAssessments();
      } else {
        window.dispatchEvent(new CustomEvent('connectify-task-type-changed'));
      }

      if (window.ConnectifyPredictorMath?.updatePredictionCache) {
        try {
          window.ConnectifyPredictorMath.updatePredictionCache();
        } catch {}
      }

      renderBaselines();

      const saveBtn = catPanel.querySelector('#cx-cat-save');
      const origText = saveBtn.textContent;
      saveBtn.textContent = '✓ Saved & Rescanned!';
      setTimeout(() => { saveBtn.textContent = origText; }, 2000);
    };

    catPanel.querySelector('#cx-cat-reset').onclick = () => {
      if (confirm('Reset assessment category keywords to factory defaults?')) {
        safeStorageRemove('cx-categories');
        try {
          localStorage.removeItem('cx-categories');
          localStorage.removeItem('connectea:categories');
        } catch (e) {}
        window.cxCategories = JSON.parse(JSON.stringify(defaultCategories));
        renderCategoryInputs(catPanel, () => renderBaselines());
        renderBaselines();
        if (window.ConnectifyTaskTypes?.rescanAllAutoAssessments) {
          window.ConnectifyTaskTypes.rescanAllAutoAssessments();
        } else {
          window.dispatchEvent(new CustomEvent('connectify-task-type-changed'));
        }
      }
    };

    window.addEventListener('connectify-task-type-changed', () => {
      renderBaselines();
    });

    const refs = {
      catBtn,
      catPanel,
      openCategories,
      closeCategories,
      renderCategoryInputs: () => renderCategoryInputs(catPanel, () => renderBaselines()),
      renderCalibTable: renderCalib,
      renderBaselines
    };
    window.ConnectifyCategorySettings.panelRefs = refs;
    return refs;
  }

  function ensureSettingsPanel() {
    if (!window.ConnectifyCategorySettings.panelRefs) {
      return createSettingsPanel();
    }
    return window.ConnectifyCategorySettings.panelRefs;
  }

  window.ConnectifyCategorySettings = {
    defaultCategories,
    resolveCategories,
    createSettingsPanel,
    ensureSettingsPanel,
    clearSettingsCache: () => window.ConnectifyCache?.clearSettingsCache?.(),
    SETTINGS_ALGO_VERSION: window.ConnectifyCache?.VERSIONS?.SETTINGS || 'v4_20261001_settings'
  };

  try {
    ensureSettingsPanel();
  } catch {}
})();
