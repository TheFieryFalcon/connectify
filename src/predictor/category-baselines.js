/**
 * Connectify Category & Subject Baselines Editor
 *
 * Renders the assessment type averages and subject final grade baselines
 * for cold-starting grade and ATAR predictors.
 * Exposes window.ConnectifyCategoryBaselines.
 */
(() => {
  'use strict';

  try {
    function renderBaselines(catPanel, renderCategoryInputsCallback) {
      if (!catPanel) return;
      const container = catPanel.querySelector('#cx-baselines-container');
      if (!container) return;

      const currentTypeValues = {};
      const currentSubjValues = {};
      container.querySelectorAll('.cx-baseline-type-input').forEach(inp => {
        if (inp.dataset.type && inp.value !== '') {
          currentTypeValues[inp.dataset.type] = inp.value;
        }
      });
      container.querySelectorAll('.cx-baseline-subj-input').forEach(inp => {
        if (inp.dataset.subject && inp.value !== '') {
          currentSubjValues[inp.dataset.subject] = inp.value;
        }
      });

      container.innerHTML = '';

      const baselines = window.ConnectifyPredictorMath?.getBaselines
        ? window.ConnectifyPredictorMath.getBaselines()
        : { types: {}, subjects: {} };

      // 1. Assessment Type Baselines:
      const typeHeading = document.createElement('strong');
      typeHeading.className = 'cx-settings-heading';
      typeHeading.textContent = 'Assessment Type Baselines (%)';

      const typeDesc = document.createElement('p');
      typeDesc.className = 'cx-settings-desc';
      typeDesc.style.margin = '0 0 10px 0';
      typeDesc.textContent = 'Your historical or expected percentage average for each assessment category:';

      const typeGrid = document.createElement('div');
      typeGrid.style.display = 'grid';
      typeGrid.style.gridTemplateColumns = 'repeat(auto-fill, minmax(130px, 1fr))';
      typeGrid.style.gap = '10px';
      typeGrid.style.marginBottom = '18px';

      const defaultCategories = {
        Exam: { color: '#e74c3c' },
        Test: { color: '#2ecc71' },
        Application: { color: '#3498db' },
        Essay: { color: '#9b59b6' },
        'Take-Home': { color: '#f1c40f' }
      };

      const allCatsSet = new Set(Object.keys(defaultCategories));
      if (window.cxCategories) {
        Object.keys(window.cxCategories).forEach(c => allCatsSet.add(c));
      }
      try {
        const stored = localStorage.getItem('connectea:categories') || localStorage.getItem('cx-categories');
        if (stored) {
          const parsed = JSON.parse(stored);
          if (parsed && typeof parsed === 'object') {
            Object.keys(parsed).forEach(c => allCatsSet.add(c));
          }
        }
      } catch {}
      if (baselines.types) {
        Object.keys(baselines.types).forEach(c => allCatsSet.add(c));
      }
      try {
        for (let i = 0; i < localStorage.length; i++) {
          const k = localStorage.key(i);
          if (k && k.startsWith('connectea:class_categories:')) {
            const arr = JSON.parse(localStorage.getItem(k));
            if (Array.isArray(arr)) {
              arr.forEach(c => {
                if (c && typeof c === 'string' && c.trim()) allCatsSet.add(c.trim());
              });
            }
          }
        }
      } catch {}

      const categories = Array.from(allCatsSet);
      for (const cat of categories) {
        const catColor = (window.cxCategories?.[cat]?.color) ||
                         (window.ConnectifyTaskTypes?.getCategoryColor ? window.ConnectifyTaskTypes.getCategoryColor(cat) : '#3498db');

        const field = document.createElement('div');
        field.style.display = 'flex';
        field.style.flexDirection = 'column';
        field.style.gap = '3px';

        const label = document.createElement('label');
        label.className = 'cx-settings-label';
        label.style.fontSize = '11.5px';
        label.textContent = cat;
        label.title = cat;
        label.style.overflow = 'hidden';
        label.style.textOverflow = 'ellipsis';
        label.style.whiteSpace = 'nowrap';
        label.style.color = catColor;

        const input = document.createElement('input');
        input.type = 'number';
        input.min = '0';
        input.max = '100';
        input.step = '0.5';
        input.placeholder = 'e.g. 75';
        input.className = 'cx-baseline-type-input cx-settings-number-input';
        input.dataset.type = cat;
        input.style.boxSizing = 'border-box';
        input.style.width = '100%';
        input.style.padding = '4px 6px';
        input.style.borderRadius = '4px';
        input.style.fontSize = '12px';

        if (currentTypeValues[cat] !== undefined) {
          input.value = currentTypeValues[cat];
        } else if (baselines.types && baselines.types[cat] !== undefined) {
          input.value = baselines.types[cat];
        }

        field.append(label, input);
        typeGrid.append(field);
      }

      // 2. Subject Grade Baselines:
      const subjHeading = document.createElement('strong');
      subjHeading.className = 'cx-settings-heading';
      subjHeading.textContent = 'Previous Year Subject Grade Baselines (%)';

      const subjDesc = document.createElement('p');
      subjDesc.className = 'cx-settings-desc';
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
        emptyNote.className = 'cx-settings-desc';
        emptyNote.style.fontSize = '11.5px';
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
          label.className = 'cx-settings-label';
          label.style.fontSize = '11.5px';
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
          input.className = 'cx-baseline-subj-input cx-settings-number-input';
          input.dataset.subject = sName;
          input.style.boxSizing = 'border-box';
          input.style.width = '100%';
          input.style.padding = '4px 6px';
          input.style.borderRadius = '4px';
          input.style.fontSize = '12px';

          if (currentSubjValues[sName] !== undefined) {
            input.value = currentSubjValues[sName];
          } else if (baselines.subjects && baselines.subjects[sName] !== undefined) {
            input.value = baselines.subjects[sName];
          }

          field.append(label, input);
          subjGrid.append(field);
        }
      }

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

        if (window.cxCategories) {
          let updated = false;
          for (const catName of Object.keys(newTypes)) {
            if (!window.cxCategories[catName]) {
              const color = window.ConnectifyTaskTypes?.getCategoryColor
                ? window.ConnectifyTaskTypes.getCategoryColor(catName)
                : '#3498db';
              window.cxCategories[catName] = {
                color,
                keywords: [catName.toLowerCase()]
              };
              updated = true;
            }
          }
          if (updated) {
            try {
              localStorage.setItem('cx-categories', JSON.stringify(window.cxCategories));
              localStorage.setItem('connectea:categories', JSON.stringify(window.cxCategories));
            } catch {}
            if (typeof renderCategoryInputsCallback === 'function') {
              renderCategoryInputsCallback();
            }
          }
        }

        const origText = saveBtn.textContent;
        saveBtn.textContent = '✓ Saved Baselines!';
        setTimeout(() => { saveBtn.textContent = origText; }, 2000);
      };

      actions.append(saveBtn);
      container.append(typeHeading, typeDesc, typeGrid, subjHeading, subjDesc, subjGrid, actions);
    }

    window.ConnectifyCategoryBaselines = {
      renderBaselines
    };
  } catch (err) {
    console.error('Connectify error in category-baselines.js:', err);
  }
})();
