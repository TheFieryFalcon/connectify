/**
 * Connectify Settings panel & assessment categories
 *
 * Builds the Settings tool panel (markup in settings-markup.js, general preferences in
 * settings-preferences.js) and owns the assessment category keyword editor.
 * Exposes window.ConnectifyCategorySettings.
 */
(() => {
  'use strict';

  if (window.ConnectifyCategorySettings) return;

  const store = window.ConnectifyCategoryStore;
  const { defaultCategories, resolveCategories } = store;

  function renderCategoryInputs(panel, onCategoryChange) {
    const inputContainer = panel.querySelector('#cx-categories-inputs');
    if (!inputContainer) return;
    inputContainer.innerHTML = '';

    const currentCats = window.cxCategories || defaultCategories;
    for (const [cat, data] of Object.entries(currentCats)) {
      const wrap = document.createElement('div');
      wrap.className = 'cx-cat-wrap';
      wrap.dataset.cat = cat; // Save Changes reads each row's category from here
      wrap.style.cssText = 'display:flex;align-items:center;margin-bottom:10px;gap:8px;';

      const label = document.createElement('label');
      label.className = 'cx-cat-name-label';
      label.textContent = cat;
      label.title = cat;
      label.dataset.cat = cat;
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
        delBtn.className = 'cx-cat-delete-btn';
        delBtn.textContent = '✕';
        delBtn.title = `Delete category "${cat}"`;
        delBtn.style.cssText = 'background:transparent;color:#e74c3c;border:1px solid #e74c3c;border-radius:4px;cursor:pointer;padding:2px 7px;font-size:11px;';
        delBtn.onclick = () => {
          const remaining = { ...window.cxCategories };
          delete remaining[cat];
          store.saveCategories(remaining);
          wrap.remove();
          // Tasks auto-detected as the deleted category need a new type
          window.ConnectifyTaskTypes?.rescanAllAutoAssessments?.();
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
    catPanel.innerHTML = window.ConnectifySettingsMarkup.panelHtml();
    const refreshPreferences = window.ConnectifySettingsPreferences.bind(catPanel);

    catPanel.querySelector('#cx-cat-add').onclick = () => {
      const cleanName = store.promptName('Enter new assessment category name (e.g. Practical, Investigation)');
      if (!cleanName) return;
      if (!window.cxCategories) window.cxCategories = store.copyDefaults();
      if (Object.keys(window.cxCategories).some(k => k.toLowerCase() === cleanName.toLowerCase())) {
        alert(`Category "${cleanName}" already exists!`); return;
      }
      const color = window.ConnectifyTaskTypes?.getCategoryColor ? window.ConnectifyTaskTypes.getCategoryColor(cleanName) : '#3498db';
      store.saveCategories({ ...window.cxCategories, [cleanName]: { color, keywords: [cleanName.toLowerCase()] } });
      renderCategoryInputs(catPanel, () => renderBaselines());
      renderBaselines();
      const newId = `cx-cat-input-${cleanName.replace(/\s+/g, '_')}`;
      const newInput = Array.from(catPanel.querySelectorAll('.cx-cat-keyword-input')).find(el => el.id === newId);
      if (newInput) newInput.focus();
    };

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
      refreshPreferences();
      try { resolveCategories(); } catch {}
      try { renderCategoryInputs(catPanel, () => renderBaselines()); renderCalib(); renderBaselines(); } catch (e) { console.warn('Settings sub-render error:', e); }
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

      store.saveCategories(updatedCats);

      // The rescan re-detects Auto rows and refreshes the prediction cache
      if (window.ConnectifyTaskTypes?.rescanAllAutoAssessments) {
        window.ConnectifyTaskTypes.rescanAllAutoAssessments();
      } else {
        window.dispatchEvent(new CustomEvent('connectify-task-type-changed'));
        try { window.ConnectifyPredictorMath?.updatePredictionCache?.(); } catch {}
      }

      renderBaselines();

      const saveBtn = catPanel.querySelector('#cx-cat-save');
      const origText = saveBtn.textContent;
      saveBtn.textContent = '✓ Saved & Rescanned!';
      setTimeout(() => { saveBtn.textContent = origText; }, 2000);
    };

    catPanel.querySelector('#cx-cat-reset').onclick = () => {
      if (confirm('Reset assessment category keywords to factory defaults?')) {
        store.resetCategories();
        renderCategoryInputs(catPanel, () => renderBaselines());
        renderBaselines();
        if (window.ConnectifyTaskTypes?.rescanAllAutoAssessments) {
          window.ConnectifyTaskTypes.rescanAllAutoAssessments();
        } else {
          window.dispatchEvent(new CustomEvent('connectify-task-type-changed'));
        }
      }
    };

    // Opening Settings renders the baselines, so a hidden panel is left alone
    window.addEventListener('connectify-task-type-changed', () => {
      if (!catPanel.hidden) renderBaselines();
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
