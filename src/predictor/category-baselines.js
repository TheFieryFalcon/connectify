/**
 * Connectify Settings: previous-year baselines editor
 *
 * Renders the assessment type averages and previous-year subject grades used to cold-start the
 * Grade and ATAR predictors, and saves them through the predictor baselines store.
 * Exposes window.ConnectifyCategoryBaselines.
 */
(() => {
  'use strict';

  const make = (tag, className, text) => Object.assign(document.createElement(tag), className ? { className } : {}, text ? { textContent: text } : {});

  function heading(title, description) {
    const strong = make('strong', 'cx-settings-heading', title);
    const desc = make('p', 'cx-settings-desc', description);
    desc.style.margin = '0 0 10px 0';
    return [strong, desc];
  }

  function grid(minColumn, marginBottom) {
    const el = make('div');
    Object.assign(el.style, { display: 'grid', gridTemplateColumns: `repeat(auto-fill, minmax(${minColumn}, 1fr))`, gap: '10px', marginBottom });
    return el;
  }

  /** One labelled 0–100 number input; dataset carries the category or subject it belongs to. */
  function baselineField({ name, color, inputClass, dataKey, placeholder, value }) {
    const field = make('div');
    Object.assign(field.style, { display: 'flex', flexDirection: 'column', gap: '3px' });
    const label = make('label', 'cx-settings-label', name);
    label.title = name;
    Object.assign(label.style, { fontSize: '11.5px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' });
    if (color) label.style.color = color;
    const input = Object.assign(make('input', `${inputClass} cx-settings-number-input`), { type: 'number', min: '0', max: '100', step: '0.5', placeholder });
    input.dataset[dataKey] = name;
    Object.assign(input.style, { boxSizing: 'border-box', width: '100%', padding: '4px 6px', borderRadius: '4px', fontSize: '12px' });
    if (value !== undefined) input.value = value;
    field.append(label, input);
    return field;
  }

  // Every category the student has: defaults, saved, class-specific and any with a stored baseline
  function allCategories(baselines) {
    const names = new Set(Object.keys(window.ConnectifyCategoryStore?.defaultCategories || {}));
    Object.keys(window.cxCategories || {}).forEach(c => names.add(c));
    try {
      const stored = JSON.parse(localStorage.getItem('connectea:categories') || localStorage.getItem('cx-categories') || 'null');
      if (stored && typeof stored === 'object') Object.keys(stored).forEach(c => names.add(c));
    } catch {}
    Object.keys(baselines.types || {}).forEach(c => names.add(c));
    for (const key of window.ConnectifyUtils.userKeys(k => k.startsWith('connectea:class_categories:'))) {
      let arr = null;
      try { arr = JSON.parse(localStorage.getItem(key)); } catch {} // one bad entry must not hide the rest
      if (Array.isArray(arr)) arr.forEach(c => { if (typeof c === 'string' && c.trim()) names.add(c.trim()); });
    }
    return Array.from(names).filter(window.ConnectifyCategoryStore.isCategoryName);
  }

  function enrolledSubjects(baselines) {
    const names = new Set();
    const subjects = (window.ConnectifyData?.collectClasses || window.ConnectifyData?.collect || (() => []))(true);
    for (const s of subjects) {
      const clean = window.ConnectifyPredictorMath?.cleanSubject
        ? window.ConnectifyPredictorMath.cleanSubject(s.name)
        : s.name.replace(/\s*[-–—]\s*Semester\s*[12].*$/i, '').trim();
      if (clean) names.add(clean);
    }
    Object.keys(baselines.subjects || {}).forEach(s => { if (s) names.add(s); });
    return Array.from(names);
  }

  function readInputs(container, selector, dataKey) {
    const values = {};
    container.querySelectorAll(selector).forEach(inp => {
      const val = inp.value.trim();
      if (val !== '' && Number.isFinite(Number(val))) values[inp.dataset[dataKey]] = Number(val);
    });
    return values;
  }

  function readDrafts(container, selector, dataKey) {
    const drafts = {};
    container.querySelectorAll(selector).forEach(inp => {
      if (inp.dataset[dataKey] && inp.value !== '') drafts[inp.dataset[dataKey]] = inp.value;
    });
    return drafts;
  }

  function save(container, saveBtn, renderCategoryInputsCallback) {
    const types = readInputs(container, '.cx-baseline-type-input', 'type');
    const subjects = readInputs(container, '.cx-baseline-subj-input', 'subject');
    window.ConnectifyPredictorMath?.saveBaselines?.({ types, subjects });

    // A baseline for an unknown category creates that category (saved to every store, so it survives reload)
    const missing = Object.keys(types).filter(name => !window.cxCategories?.[name]);
    if (missing.length && window.cxCategories) {
      const added = { ...window.cxCategories };
      for (const name of missing) {
        const color = window.ConnectifyTaskTypes?.getCategoryColor ? window.ConnectifyTaskTypes.getCategoryColor(name) : '#3498db';
        added[name] = { color, keywords: [name.toLowerCase()] };
      }
      window.ConnectifyCategoryStore.saveCategories(added);
      if (typeof renderCategoryInputsCallback === 'function') renderCategoryInputsCallback();
    }

    const origText = saveBtn.textContent;
    saveBtn.textContent = '✓ Saved Baselines!';
    setTimeout(() => { saveBtn.textContent = origText; }, 2000);
  }

  function renderBaselines(catPanel, renderCategoryInputsCallback) {
    const container = catPanel?.querySelector('#cx-baselines-container');
    if (!container) return;

    // Keep unsaved typing across re-renders
    const typeDrafts = readDrafts(container, '.cx-baseline-type-input', 'type');
    const subjDrafts = readDrafts(container, '.cx-baseline-subj-input', 'subject');
    container.innerHTML = '';

    const baselines = window.ConnectifyPredictorMath?.getBaselines ? window.ConnectifyPredictorMath.getBaselines() : { types: {}, subjects: {} };

    const typeGrid = grid('130px', '18px');
    for (const cat of allCategories(baselines)) {
      typeGrid.append(baselineField({
        name: cat,
        color: window.cxCategories?.[cat]?.color || (window.ConnectifyTaskTypes?.getCategoryColor ? window.ConnectifyTaskTypes.getCategoryColor(cat) : '#3498db'),
        inputClass: 'cx-baseline-type-input',
        dataKey: 'type',
        placeholder: 'e.g. 75',
        value: typeDrafts[cat] ?? baselines.types?.[cat]
      }));
    }

    const subjGrid = grid('180px', '16px');
    const subjects = enrolledSubjects(baselines);
    if (subjects.length === 0) {
      const emptyNote = make('div', 'cx-settings-desc', 'No enrolled subjects detected yet. Expand course outlines on Connect to populate subject list.');
      Object.assign(emptyNote.style, { fontSize: '11.5px', gridColumn: '1 / -1' });
      subjGrid.append(emptyNote);
    }
    for (const sName of subjects) {
      subjGrid.append(baselineField({
        name: sName,
        inputClass: 'cx-baseline-subj-input',
        dataKey: 'subject',
        placeholder: 'e.g. 78',
        value: subjDrafts[sName] ?? baselines.subjects?.[sName]
      }));
    }

    const actions = make('div');
    Object.assign(actions.style, { display: 'flex', gap: '10px', alignItems: 'center' });
    const saveBtn = Object.assign(make('button', 'eds-c-button', 'Save Baselines'), { type: 'button' });
    Object.assign(saveBtn.style, { background: '#2563eb', color: '#fff', border: 'none', padding: '6px 14px', borderRadius: '4px', cursor: 'pointer', fontWeight: '600' });
    saveBtn.onclick = () => save(container, saveBtn, renderCategoryInputsCallback);
    actions.append(saveBtn);

    container.append(
      ...heading('Assessment Type Baselines (%)', 'Your historical or expected percentage average for each assessment category:'),
      typeGrid,
      ...heading('Previous Year Subject Grade Baselines (%)', 'Your final grade percentage from the previous year for enrolled subjects:'),
      subjGrid,
      actions
    );
  }

  window.ConnectifyCategoryBaselines = { renderBaselines };
})();
