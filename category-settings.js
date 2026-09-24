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

  const safeStorageGet = (keys, cb) => {
    try {
      const api = (typeof browser !== 'undefined' && browser?.storage)
        ? browser
        : (typeof chrome !== 'undefined' && chrome?.storage ? chrome : null);
      if (!api?.storage?.local) return;
      let handled = false;
      const callback = res => {
        if (handled) return;
        handled = true;
        if (res) cb(res);
      };
      const p = api.storage.local.get(keys, callback);
      if (p && typeof p.then === 'function') {
        p.then(callback).catch(() => {});
      }
    } catch (e) {}
  };

  const safeStorageSet = obj => {
    try {
      const api = (typeof browser !== 'undefined' && browser?.storage)
        ? browser
        : (typeof chrome !== 'undefined' && chrome?.storage ? chrome : null);
      if (!api?.storage?.local) return;
      const p = api.storage.local.set(obj);
      if (p && typeof p.catch === 'function') {
        p.catch(() => {});
      }
    } catch (e) {}
  };

  const safeStorageRemove = key => {
    try {
      const api = (typeof browser !== 'undefined' && browser?.storage)
        ? browser
        : (typeof chrome !== 'undefined' && chrome?.storage ? chrome : null);
      if (!api?.storage?.local) return;
      const p = api.storage.local.remove(key);
      if (p && typeof p.catch === 'function') {
        p.catch(() => {});
      }
    } catch (e) {}
  };

  const resolveCategories = () => {
    try {
      const stored = localStorage.getItem('connectea:categories') || localStorage.getItem('cx-categories');
      if (stored) {
        window.cxCategories = JSON.parse(stored);
      }
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

  function renderCategoryInputs(panel) {
    const inputContainer = panel.querySelector('#cx-categories-inputs');
    if (!inputContainer) return;
    inputContainer.innerHTML = '';

    const currentCats = window.cxCategories || defaultCategories;
    for (const [cat, data] of Object.entries(currentCats)) {
      const wrap = document.createElement('div');
      wrap.className = 'cx-cat-wrap';
      wrap.dataset.cat = cat;
      wrap.style.display = 'flex';
      wrap.style.alignItems = 'center';
      wrap.style.marginBottom = '10px';
      wrap.style.gap = '8px';

      const label = document.createElement('label');
      label.textContent = cat;
      label.style.width = '90px';
      label.style.fontSize = '12px';
      label.style.fontWeight = '600';
      label.style.color = data.color || '#3498db';
      label.style.overflow = 'hidden';
      label.style.textOverflow = 'ellipsis';
      label.style.whiteSpace = 'nowrap';
      label.title = cat;

      const input = document.createElement('input');
      input.type = 'text';
      input.className = 'cx-cat-keyword-input';
      input.id = `cx-cat-input-${cat.replace(/\s+/g, '_')}`;
      input.value = Array.isArray(data.keywords) ? data.keywords.join(', ') : '';
      input.style.flex = '1';
      input.style.padding = '4px 8px';
      input.style.border = '1px solid #ccc';
      input.style.borderRadius = '4px';

      wrap.append(label, input);

      if (!defaultCategories[cat]) {
        const delBtn = document.createElement('button');
        delBtn.type = 'button';
        delBtn.textContent = '✕';
        delBtn.title = `Delete category "${cat}"`;
        delBtn.style.background = 'transparent';
        delBtn.style.color = '#e74c3c';
        delBtn.style.border = '1px solid #e74c3c';
        delBtn.style.borderRadius = '4px';
        delBtn.style.cursor = 'pointer';
        delBtn.style.padding = '2px 7px';
        delBtn.style.fontSize = '11px';
        delBtn.onclick = () => {
          delete window.cxCategories[cat];
          wrap.remove();
        };
        wrap.append(delBtn);
      }

      inputContainer.append(wrap);
    }
  }

  function createSettingsPanel() {
    const catBtn = document.createElement('button');
    catBtn.textContent = 'Settings';
    catBtn.type = 'button';
    catBtn.id = 'connectify-categories-toggle';

    const catPanel = document.createElement('section');
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
        <p style="font-size:11px;color:#788896;margin:4px 0 0 24px;">When enabled, Connectify automatically expands course outlines on load to scrape assessment data.</p>

        <div style="display:flex;flex-wrap:wrap;gap:18px;align-items:flex-start;margin-top:14px;padding-top:12px;border-top:1px solid #d8e3ee;">
          <div>
            <label for="cx-general-cohort-input" style="display:block;font-size:12px;font-weight:600;color:#203c5e;margin-bottom:4px;">
              General Cohort Size
            </label>
            <div style="display:flex;align-items:center;gap:6px;">
              <input type="number" id="cx-general-cohort-input" min="1" step="1" placeholder="500" style="box-sizing:border-box;width:80px;padding:3px 6px;border:1px solid #b9cbe1;border-radius:4px;font-size:12px;color:#203c5e;">
              <span style="font-size:11px;color:#788896;">(default: 500)</span>
            </div>
            <p style="font-size:11px;color:#788896;margin:3px 0 0 0;">Estimated total students in this year level.</p>
          </div>

          <div>
            <label for="cx-atar-percentage-input" style="display:block;font-size:12px;font-weight:600;color:#203c5e;margin-bottom:4px;">
              ATAR Percentage
            </label>
            <div style="display:flex;align-items:center;gap:6px;">
              <input type="number" id="cx-atar-percentage-input" min="1" max="100" step="1" placeholder="60" style="box-sizing:border-box;width:75px;padding:3px 6px;border:1px solid #b9cbe1;border-radius:4px;font-size:12px;color:#203c5e;">
              <span style="font-size:11px;color:#788896;">% (default: 60%)</span>
            </div>
            <p style="font-size:11px;color:#788896;margin:3px 0 0 0;">Proportion enrolled in the ATAR pathway.</p>
          </div>
        </div>
      </section>

      <section class="cx-settings-section" style="margin-bottom:28px;border-top:1px solid #d8e3ee;padding-top:20px;">
        <header style="margin-bottom:8px;"><strong>Semester 1 Scaling Calibration</strong></header>
        <p style="font-size:12px;color:#788896;margin:0 0 14px 0;">Enter your school's Semester 1 scaled scores to calibrate the model to your cohort's historical distribution.</p>
        <div id="cx-calibration-table" style="display:grid;grid-template-columns:minmax(140px, 220px) 85px 85px;gap:10px 14px;align-items:center;margin-top:12px;"></div>
      </section>

      <section class="cx-settings-section" style="margin-bottom:28px;border-top:1px solid #d8e3ee;padding-top:20px;">
        <header style="margin-bottom:8px;"><strong>Previous Year Baselines (Cold-Start)</strong></header>
        <p style="font-size:12px;color:#788896;margin:0 0 14px 0;">Enter your previous year's assessment type averages and subject final marks to jumpstart the Grade and ATAR Predictors early in the year.</p>
        <div id="cx-baselines-container"></div>
      </section>

      <section class="cx-settings-section" style="margin-top:36px;border-top:1px solid #d8e3ee;padding-top:24px;">
        <header style="margin-bottom:8px;display:flex;justify-content:space-between;align-items:center;">
          <strong>Assessment Categories</strong>
          <button type="button" id="cx-cat-add" class="eds-c-button" style="background:#3498db;color:#fff;border:none;padding:5px 12px;border-radius:4px;cursor:pointer;font-size:12px;font-weight:600;">+ Add Category</button>
        </header>
        <p style="font-size:12px;color:#788896;margin:0 0 16px 0;">Customize the comma-separated keywords used to automatically detect your assessment types:</p>
        <div id="cx-categories-inputs"></div>
        <div style="margin-top:16px;display:flex;gap:10px;align-items:center;">
           <button type="button" id="cx-cat-save" class="eds-c-button" style="background:#2ecc71;color:#fff;border:none;padding:6px 14px;border-radius:4px;cursor:pointer;font-weight:600;">Save Changes</button>
           <button type="button" id="cx-cat-reset" class="eds-c-button" style="background:#95a5a6;color:#fff;border:none;padding:6px 14px;border-radius:4px;cursor:pointer;">Reset Defaults</button>
        </div>
      </section>
    `;

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

      renderCategoryInputs(catPanel);
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

    function renderCalib() {
      if (window.ConnectifyCalibration?.renderCalibTable) {
        window.ConnectifyCalibration.renderCalibTable(catPanel);
      }
    }

    function renderBaselines() {
      const container = catPanel.querySelector('#cx-baselines-container');
      if (!container) return;
      container.innerHTML = '';

      const baselines = window.ConnectifyPredictorMath?.getBaselines
        ? window.ConnectifyPredictorMath.getBaselines()
        : { types: {}, subjects: {} };

      // 1. Assessment Type Baselines:
      const typeHeading = document.createElement('strong');
      typeHeading.style.display = 'block';
      typeHeading.style.fontSize = '12px';
      typeHeading.style.color = '#203c5e';
      typeHeading.style.marginBottom = '4px';
      typeHeading.textContent = 'Assessment Type Baselines (%)';

      const typeDesc = document.createElement('p');
      typeDesc.style.fontSize = '11px';
      typeDesc.style.color = '#788896';
      typeDesc.style.margin = '0 0 10px 0';
      typeDesc.textContent = 'Your historical or expected percentage average for each assessment category:';

      const typeGrid = document.createElement('div');
      typeGrid.style.display = 'grid';
      typeGrid.style.gridTemplateColumns = 'repeat(auto-fill, minmax(130px, 1fr))';
      typeGrid.style.gap = '10px';
      typeGrid.style.marginBottom = '18px';

      const categories = Object.keys(window.cxCategories || defaultCategories);
      for (const cat of categories) {
        const field = document.createElement('div');
        field.style.display = 'flex';
        field.style.flexDirection = 'column';
        field.style.gap = '3px';

        const label = document.createElement('label');
        label.style.fontSize = '11.5px';
        label.style.fontWeight = '600';
        label.style.color = '#334155';
        label.textContent = cat;

        const input = document.createElement('input');
        input.type = 'number';
        input.min = '0';
        input.max = '100';
        input.step = '0.5';
        input.placeholder = 'e.g. 75';
        input.className = 'cx-baseline-type-input';
        input.dataset.type = cat;
        input.style.boxSizing = 'border-box';
        input.style.width = '100%';
        input.style.padding = '4px 6px';
        input.style.border = '1px solid #b9cbe1';
        input.style.borderRadius = '4px';
        input.style.fontSize = '12px';

        if (baselines.types && baselines.types[cat] !== undefined) {
          input.value = baselines.types[cat];
        }

        field.append(label, input);
        typeGrid.append(field);
      }

      // 2. Subject Grade Baselines:
      const subjHeading = document.createElement('strong');
      subjHeading.style.display = 'block';
      subjHeading.style.fontSize = '12px';
      subjHeading.style.color = '#203c5e';
      subjHeading.style.marginBottom = '4px';
      subjHeading.textContent = 'Previous Year Subject Grade Baselines (%)';

      const subjDesc = document.createElement('p');
      subjDesc.style.fontSize = '11px';
      subjDesc.style.color = '#788896';
      subjDesc.style.margin = '0 0 10px 0';
      subjDesc.textContent = 'Your final grade percentage from the previous year for enrolled subjects:';

      const subjGrid = document.createElement('div');
      subjGrid.style.display = 'grid';
      subjGrid.style.gridTemplateColumns = 'repeat(auto-fill, minmax(180px, 1fr))';
      subjGrid.style.gap = '10px';
      subjGrid.style.marginBottom = '16px';

      const subjects = window.ConnectifyData?.collect ? window.ConnectifyData.collect(true) : [];
      const cleanNames = new Set();
      for (const s of subjects) {
        const clean = window.ConnectifyPredictorMath?.cleanSubject
          ? window.ConnectifyPredictorMath.cleanSubject(s.name)
          : s.name.replace(/\s*[-–—]\s*Semester\s*[12].*$/i, '').trim();
        if (clean) cleanNames.add(clean);
      }
      for (const sName of Object.keys(baselines.subjects || {})) {
        if (sName) cleanNames.add(sName);
      }

      if (cleanNames.size === 0) {
        const emptyNote = document.createElement('div');
        emptyNote.style.fontSize = '11.5px';
        emptyNote.style.color = '#94a3b8';
        emptyNote.style.gridColumn = '1 / -1';
        emptyNote.textContent = 'No enrolled subjects detected yet. Expand course outlines on Connect to populate subject list.';
        subjGrid.append(emptyNote);
      } else {
        for (const sName of cleanNames) {
          const field = document.createElement('div');
          field.style.display = 'flex';
          field.style.flexDirection = 'column';
          field.style.gap = '3px';

          const label = document.createElement('label');
          label.style.fontSize = '11.5px';
          label.style.fontWeight = '600';
          label.style.color = '#334155';
          label.textContent = sName;
          label.title = sName;
          label.style.overflow = 'hidden';
          label.style.textOverflow = 'ellipsis';
          label.style.whiteSpace = 'nowrap';

          const input = document.createElement('input');
          input.type = 'number';
          input.min = '0';
          input.max = '100';
          input.step = '0.5';
          input.placeholder = 'e.g. 78';
          input.className = 'cx-baseline-subj-input';
          input.dataset.subject = sName;
          input.style.boxSizing = 'border-box';
          input.style.width = '100%';
          input.style.padding = '4px 6px';
          input.style.border = '1px solid #b9cbe1';
          input.style.borderRadius = '4px';
          input.style.fontSize = '12px';

          if (baselines.subjects && baselines.subjects[sName] !== undefined) {
            input.value = baselines.subjects[sName];
          }

          field.append(label, input);
          subjGrid.append(field);
        }
      }

      // Save button
      const actions = document.createElement('div');
      actions.style.display = 'flex';
      actions.style.gap = '10px';
      actions.style.alignItems = 'center';

      const saveBtn = document.createElement('button');
      saveBtn.type = 'button';
      saveBtn.className = 'eds-c-button';
      saveBtn.style.background = '#2563eb';
      saveBtn.style.color = '#fff';
      saveBtn.style.border = 'none';
      saveBtn.style.padding = '6px 14px';
      saveBtn.style.borderRadius = '4px';
      saveBtn.style.cursor = 'pointer';
      saveBtn.style.fontWeight = '600';
      saveBtn.textContent = 'Save Baselines';

      saveBtn.onclick = () => {
        const typeInputs = container.querySelectorAll('.cx-baseline-type-input');
        const subjInputs = container.querySelectorAll('.cx-baseline-subj-input');
        const newTypes = {};
        const newSubjs = {};

        typeInputs.forEach(inp => {
          const val = inp.value.trim();
          if (val !== '' && Number.isFinite(Number(val))) {
            newTypes[inp.dataset.type] = Number(val);
          }
        });

        subjInputs.forEach(inp => {
          const val = inp.value.trim();
          if (val !== '' && Number.isFinite(Number(val))) {
            newSubjs[inp.dataset.subject] = Number(val);
          }
        });

        if (window.ConnectifyPredictorMath?.saveBaselines) {
          window.ConnectifyPredictorMath.saveBaselines({ types: newTypes, subjects: newSubjs });
        }

        const origText = saveBtn.textContent;
        saveBtn.textContent = '✓ Saved Baselines!';
        setTimeout(() => { saveBtn.textContent = origText; }, 2000);
      };

      actions.append(saveBtn);
      container.append(typeHeading, typeDesc, typeGrid, subjHeading, subjDesc, subjGrid, actions);
    }

    function openCategories() {
      catPanel.hidden = false;
      catBtn.setAttribute('aria-pressed', 'true');
      window.dispatchEvent(new CustomEvent('connectify-open', { detail: 'categories' }));
      if (autoExpandToggle) {
        autoExpandToggle.checked = localStorage.getItem('connectify:auto_expand') !== 'false';
      }
      if (generalCohortInput) {
        generalCohortInput.value = localStorage.getItem('connectify:general_cohort_size') || '';
      }
      if (atarPctInput) {
        atarPctInput.value = localStorage.getItem('connectify:atar_percentage') || '';
      }
      resolveCategories();
      renderCategoryInputs(catPanel);
      renderCalib();
      renderBaselines();
    }

    function closeCategories() {
      catPanel.hidden = true;
      catBtn.setAttribute('aria-pressed', 'false');
    }

    catBtn.onclick = () => {
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

      // Rescan every assessment set to Auto immediately!
      if (window.ConnectifyTaskTypes?.rescanAllAutoAssessments) {
        window.ConnectifyTaskTypes.rescanAllAutoAssessments();
      } else {
        window.dispatchEvent(new CustomEvent('connectify-task-type-changed'));
      }

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
        renderCategoryInputs(catPanel);
        if (window.ConnectifyTaskTypes?.rescanAllAutoAssessments) {
          window.ConnectifyTaskTypes.rescanAllAutoAssessments();
        } else {
          window.dispatchEvent(new CustomEvent('connectify-task-type-changed'));
        }
      }
    };

    return {
      catBtn,
      catPanel,
      openCategories,
      closeCategories,
      renderCategoryInputs: () => renderCategoryInputs(catPanel),
      renderCalibTable: renderCalib
    };
  }

  window.ConnectifyCategorySettings = {
    defaultCategories,
    resolveCategories,
    createSettingsPanel
  };
})();
