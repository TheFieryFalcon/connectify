/**
 * Connectify: assessment category store
 *
 * The default assessment categories (colour and detection keywords) and the user's saved categories,
 * kept in localStorage (cx-categories, legacy connectea:categories) and mirrored to extension storage.
 * The live set is window.cxCategories. Exposes window.ConnectifyCategoryStore.
 */
(() => {
  'use strict';

  if (window.ConnectifyCategoryStore) return;

  const defaultCategories = {
    Exam: { color: '#e74c3c', keywords: ['exam', 'semester'] },
    Test: { color: '#2ecc71', keywords: ['test', 'quiz', 'in-class', 'in class'] },
    Application: { color: '#3498db', keywords: ['application', 'investigation', 'portfolio', 'validation', 'practical', 'speaking', 'listening', 'dictation'] },
    Essay: { color: '#9b59b6', keywords: ['essay', 'short answer', 'written response', 'close reading'] },
    'Take-Home': { color: '#f1c40f', keywords: ['take-home', 'assignment', 'project', 'presentation', 'oral', 'creative'] }
  };
  const copyDefaults = () => JSON.parse(JSON.stringify(defaultCategories));

  // Settings once saved every category under the key "undefined" (the save read a data-cat its rows never
  // had), so "undefined" and "null" are never category names, wherever they were stored
  const isCategoryName = name => typeof name === 'string' && !!name.trim() && !/^(?:undefined|null)$/i.test(name.trim());

  /**
   * A usable category set from stored data: entries without a real name or settings are dropped and missing
   * defaults come back (Settings cannot delete a default, so a set without one was damaged). Null if unusable.
   */
  function sanitize(categories) {
    if (!categories || typeof categories !== 'object' || Array.isArray(categories)) return null;
    const clean = {};
    for (const [name, data] of Object.entries(categories)) {
      if (isCategoryName(name) && data && typeof data === 'object') clean[name] = data;
    }
    for (const [name, data] of Object.entries(defaultCategories)) {
      if (!clean[name]) clean[name] = JSON.parse(JSON.stringify(data));
    }
    return clean;
  }

  const getStorageApi = () => (typeof browser !== 'undefined' && browser?.storage) ? browser : (typeof chrome !== 'undefined' && chrome?.storage ? chrome : null);
  const extensionGet = (keys, cb) => {
    try {
      const api = getStorageApi();
      if (!api?.storage?.local) return;
      let handled = false;
      const callback = res => { if (!handled && res) { handled = true; cb(res); } };
      const p = api.storage.local.get(keys, callback);
      if (p && typeof p.then === 'function') p.then(callback).catch(() => {});
    } catch {}
  };
  const extensionSet = obj => { try { const p = getStorageApi()?.storage?.local?.set(obj); if (p?.catch) p.catch(() => {}); } catch {} };
  const extensionRemove = key => { try { const p = getStorageApi()?.storage?.local?.remove(key); if (p?.catch) p.catch(() => {}); } catch {} };

  function writeLocal(categories) {
    try {
      localStorage.setItem('cx-categories', JSON.stringify(categories));
      localStorage.setItem('connectea:categories', JSON.stringify(categories));
    } catch {}
  }

  // 'extended' was once a Take-Home keyword and wrongly matched "extended response" tasks
  function dropRetiredKeywords() {
    const takeHome = window.cxCategories?.['Take-Home'];
    if (takeHome?.keywords) takeHome.keywords = takeHome.keywords.filter(k => k.toLowerCase() !== 'extended');
  }

  /** Loads saved categories into window.cxCategories (localStorage now, extension storage when it answers). */
  function resolveCategories() {
    try {
      const stored = localStorage.getItem('connectea:categories') || localStorage.getItem('cx-categories');
      const parsed = stored ? JSON.parse(stored) : null;
      const clean = sanitize(parsed);
      if (clean) window.cxCategories = clean;
      // A damaged set is repaired in place, so every later read gets the repaired one
      if (parsed && JSON.stringify(clean) !== stored) writeLocal(clean || copyDefaults());
    } catch {}
    extensionGet(['cx-categories'], res => {
      const raw = res?.['cx-categories'];
      const saved = sanitize(raw);
      if (!saved) return;
      if (JSON.stringify(saved) !== JSON.stringify(raw)) extensionSet({ 'cx-categories': saved });
      const changed = JSON.stringify(saved) !== JSON.stringify(window.cxCategories);
      window.cxCategories = saved;
      dropRetiredKeywords();
      writeLocal(saved);
      // Extension storage answers after the page has rendered: re-detect Auto rows with the saved keywords
      if (changed) window.dispatchEvent(new CustomEvent('connectify-rescan-auto-types'));
    });
    dropRetiredKeywords();
  }

  function saveCategories(categories) {
    categories = sanitize(categories) || copyDefaults();
    window.cxCategories = categories;
    writeLocal(categories);
    extensionSet({ 'cx-categories': categories });
  }

  function resetCategories() {
    extensionRemove('cx-categories');
    try {
      localStorage.removeItem('cx-categories');
      localStorage.removeItem('connectea:categories');
    } catch {}
    window.cxCategories = copyDefaults();
  }

  // A copy, so editing the live set can never change the factory defaults
  if (!window.cxCategories) window.cxCategories = copyDefaults();
  resolveCategories();

  window.ConnectifyCategoryStore = { defaultCategories, copyDefaults, isCategoryName, sanitize, resolveCategories, saveCategories, resetCategories };
})();
