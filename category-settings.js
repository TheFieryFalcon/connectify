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
    'Take-Home': { color: '#f1c40f', keywords: ['take-home', 'assignment', 'project', 'extended', 'presentation', 'oral', 'creative'] }
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
        <header style="margin-bottom:8px;"><strong>Semester 1 Scaling Calibration</strong></header>
        <p style="font-size:12px;color:#788896;margin:0 0 14px 0;">Enter your school's Semester 1 scaled scores to calibrate the model to your cohort's historical distribution.</p>
        <div id="cx-calibration-table" style="display:grid;grid-template-columns:minmax(140px, 220px) 85px 85px;gap:10px 14px;align-items:center;margin-top:12px;"></div>
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

    function renderCalib() {
      if (window.ConnectifyCalibration?.renderCalibTable) {
        window.ConnectifyCalibration.renderCalibTable(catPanel);
      }
    }

    function openCategories() {
      catPanel.hidden = false;
      catBtn.setAttribute('aria-pressed', 'true');
      window.dispatchEvent(new CustomEvent('connectify-open', { detail: 'categories' }));
      resolveCategories();
      renderCategoryInputs(catPanel);
      renderCalib();
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
