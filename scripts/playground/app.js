/**
 * Connectify playground: editor
 *
 * Classes, outlines and tasks edited here are written straight into Connectify's caches (subjects cache and
 * class registry, as the scraper would have stored them from Connect), then the same events a newly read
 * outline fires are dispatched, so the sidebar tools, goals and toasts react as they do on Connect.
 */
(() => {
  'use strict';

  const M = window.PlaygroundModel;
  const STATE_KEY = 'connectify-playground:state';
  const list = document.getElementById('pg-classes');
  const status = document.getElementById('pg-status');

  let state = load();
  function load() {
    try {
      const saved = JSON.parse(localStorage.getItem(STATE_KEY));
      if (saved && Array.isArray(saved.classes)) return saved;
    } catch {}
    return { classes: [] };
  }
  const save = () => { try { localStorage.setItem(STATE_KEY, JSON.stringify(state)); } catch {} };

  // --- Connectify ---

  /** Writes the state into Connectify's caches and tells every tool the results changed. */
  function applyToConnectify() {
    const helpers = window.ConnectifyParseHelpers;
    const cache = window.ConnectifyCache;
    const classes = window.ConnectifyClassSemesters;
    if (!helpers || !cache?.subjectsCache || !classes) return console.warn('Connectify playground: Connectify scripts did not load');
    const { subjects, registry } = M.toConnectify(state, helpers);

    cache.subjectsCache.clear();
    for (const [name, tasks] of Object.entries(subjects)) cache.subjectsCache.set(name, new Map(tasks.map(t => [t.id, t])));
    cache.saveSubjectsCache();

    // The registry object is the module's own, so it is replaced in place
    const live = classes.get();
    Object.keys(live).forEach(k => delete live[k]);
    Object.assign(live, registry);
    try { localStorage.setItem(`${classes.PREFIX}${window.ConnectifyUtils.accountKey()}`, JSON.stringify(live)); } catch {}

    try { window.ConnectifyPredictorMath?.updatePredictionCache?.(); } catch (e) { console.warn(e); }
    window.ConnectifyData?.notifyResultsUpdated?.();
    window.dispatchEvent(new CustomEvent('connectify-settings-updated'));
    showStatus();
  }

  let applyTimer = null;
  function commit({ rerender = true } = {}) {
    save();
    if (rerender) scheduleRender();
    clearTimeout(applyTimer);
    applyTimer = setTimeout(applyToConnectify, 250);
  }

  function showStatus() {
    const semester = window.ConnectifyClassSemesters?.detectSemester?.();
    status.textContent = semester ? `Connectify reads Semester ${semester}` : '';
  }

  // --- Rendering ---

  const el = (tag, props = {}, ...children) => {
    const node = document.createElement(tag);
    for (const [k, v] of Object.entries(props)) {
      if (k === 'class') node.className = v;
      else if (k === 'dataset') Object.assign(node.dataset, v);
      else if (k.startsWith('on')) node.addEventListener(k.slice(2), v);
      else if (v !== undefined && v !== null && v !== false) node[k] = v;
    }
    node.append(...children.filter(c => c !== null && c !== undefined));
    return node;
  };

  const numberOrNull = value => (String(value).trim() === '' || !Number.isFinite(Number(value)) ? null : Number(value));
  const clampScore = value => (value === null ? null : Math.max(0, Math.min(100, value)));

  /** An input bound to obj[field]; `key` restores focus after a re-render. */
  function field(obj, name, key, props = {}, parse = v => v) {
    const input = el('input', { value: obj[name] ?? '', dataset: { key }, ...props });
    input.addEventListener('change', () => { obj[name] = parse(input.value); commit(); });
    return input;
  }

  function select(obj, name, key, options, parse = v => v) {
    const node = el('select', { dataset: { key } }, ...options.map(([value, text]) => el('option', { value, textContent: text })));
    node.value = obj[name] ?? '';
    node.addEventListener('change', () => { obj[name] = parse(node.value); commit(); });
    return node;
  }

  function typeOptions() {
    const names = Object.keys(window.cxCategories || {});
    return [...new Set([...M.TYPES, ...names])].map(n => [n, n]);
  }

  function move(cls, task, step) {
    const same = cls.tasks.filter(t => t.semester === task.semester);
    const target = same[same.indexOf(task) + step];
    if (!target) return;
    const a = cls.tasks.indexOf(task);
    const b = cls.tasks.indexOf(target);
    [cls.tasks[a], cls.tasks[b]] = [cls.tasks[b], cls.tasks[a]];
    commit();
  }

  function taskRow(cls, task) {
    const k = f => `${task.uid}:${f}`;
    const weekInput = field(task, 'week', k('week'), { type: 'number', min: 1, max: 11, disabled: !task.term }, v => numberOrNull(v));
    return el('tr', { class: Number.isFinite(task.score) ? 'pg-marked' : '', dataset: { uid: task.uid } },
      el('td', {},
        el('button', { class: 'pg-btn pg-btn--icon', title: 'Move up', textContent: '↑', onclick: () => move(cls, task, -1) }),
        el('button', { class: 'pg-btn pg-btn--icon', title: 'Move down', textContent: '↓', onclick: () => move(cls, task, 1) })),
      el('td', {}, select(task, 'type', k('type'), typeOptions())),
      el('td', {}, field(task, 'name', k('name'), { class: 'pg-name' }, v => v.trim() || 'Untitled task')),
      el('td', {}, select(task, 'term', k('term'), [['', '—'], ['1', '1'], ['2', '2'], ['3', '3'], ['4', '4']], v => numberOrNull(v))),
      el('td', {}, weekInput),
      el('td', {}, field(task, 'weight', k('weight'), { type: 'number', min: 0, max: 100, step: 'any' }, v => numberOrNull(v) ?? 0)),
      el('td', {}, field(task, 'score', k('score'), { type: 'number', min: 0, max: 100, step: 'any', placeholder: '—', class: 'pg-score' }, v => clampScore(numberOrNull(v)))),
      el('td', {}, field(task, 'mean', k('mean'), { type: 'number', min: 0, max: 100, step: 'any', placeholder: '—' }, v => clampScore(numberOrNull(v)))),
      el('td', {}, el('button', {
        class: 'pg-btn pg-btn--icon pg-btn--danger', title: 'Delete task', textContent: '✕',
        onclick: () => { cls.tasks.splice(cls.tasks.indexOf(task), 1); commit(); }
      })));
  }

  function semesterBlock(cls, semester) {
    const tasks = cls.tasks.filter(t => t.semester === semester);
    const auto = M.autoMark(cls, semester);
    const head = el('div', { class: 'pg-sem-head' },
      el('h2', { textContent: `Semester ${semester}` }),
      el('label', {}, 'Final grade', select(cls.letters, String(semester), `${cls.id}:letter${semester}`,
        [['', '—'], ['A', 'A'], ['B', 'B'], ['C', 'C'], ['D', 'D'], ['E', 'E']])),
      el('label', {}, 'Overall %', field(cls.markOverride, String(semester), `${cls.id}:mark${semester}`,
        { type: 'number', min: 0, max: 100, step: 'any', placeholder: auto === null ? '—' : String(auto), title: 'Blank: the weighted mean of the marked tasks' },
        v => clampScore(numberOrNull(v)))));
    const table = el('table', {},
      el('thead', {}, el('tr', {}, ...['', 'Type', 'Name', 'Term', 'Week', 'Weight %', 'Mark %', 'Cohort mean %', ''].map(h => el('th', { textContent: h })))),
      el('tbody', {}, ...tasks.map(t => taskRow(cls, t))));
    const add = el('button', {
      class: 'pg-btn', textContent: '+ Add task',
      onclick: () => {
        const last = tasks[tasks.length - 1];
        cls.tasks.push({ ...M.makeTask(cls, { name: `Task ${cls.tasks.length + 1}`, term: last?.term ?? (semester === 1 ? 1 : 3), week: last?.week ?? 1 }), semester });
        commit();
      }
    });
    return el('section', { class: 'pg-sem' }, head, el('div', { class: 'pg-scroll' }, table), add);
  }

  function classCard(cls) {
    const total = Math.round(M.weightTotal(cls) * 100) / 100;
    const nameInput = field(cls, 'name', `${cls.id}:name`, { class: 'pg-name pg-class-name' }, v => v.trim() || cls.name);
    return el('article', { class: 'pg-class' },
      el('div', { class: 'pg-class-head' }, nameInput,
        el('button', {
          class: 'pg-btn pg-btn--danger', textContent: 'Delete class',
          onclick: () => { if (confirm(`Delete ${cls.name}?`)) { state.classes.splice(state.classes.indexOf(cls), 1); commit(); } }
        })),
      total !== 100 ? el('div', { class: 'pg-warn', textContent: `Weights total ${total}%: Target Grade and goals need 100% across both semesters.` }) : null,
      el('div', { class: 'pg-sems' }, semesterBlock(cls, 1), semesterBlock(cls, 2)));
  }

  let renderQueued = false;
  function scheduleRender() {
    if (renderQueued) return;
    renderQueued = true;
    // After the browser has moved focus (Tab), so the newly focused field can be found again
    requestAnimationFrame(() => { renderQueued = false; render(); });
  }

  function render() {
    const focusKey = document.activeElement?.dataset?.key;
    list.replaceChildren(...(state.classes.length
      ? state.classes.map(classCard)
      : [el('div', { class: 'pg-empty', textContent: 'No classes yet.' })]));
    if (focusKey) list.querySelector(`[data-key="${CSS.escape(focusKey)}"]`)?.focus();
  }

  // --- Toolbar ---

  function flash(uid) {
    requestAnimationFrame(() => requestAnimationFrame(() => {
      const row = list.querySelector(`tr[data-uid="${CSS.escape(uid)}"]`);
      if (!row) return;
      row.classList.add('pg-flash');
      row.scrollIntoView({ block: 'center', behavior: 'smooth' });
      setTimeout(() => row.classList.remove('pg-flash'), 1500);
    }));
  }

  const actions = {
    'add-class': () => {
      state.classes.push(M.generateClass(state.classes.map(c => c.name)));
      commit();
    },
    release: () => {
      const next = M.nextUnmarked(state);
      if (!next) return alert('Every weighted task is marked.');
      // Near the class's average so far, else 75, kept between 40 and 100
      const average = M.weightedMark(next.cls.tasks) ?? 75;
      next.t.score = Math.round(Math.max(40, Math.min(100, average + (Math.random() * 20 - 10))));
      commit();
      flash(next.t.uid);
    },
    reload: () => location.reload(),
    export: () => {
      const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
      const a = el('a', { href: URL.createObjectURL(blob), download: 'connectify-playground.json' });
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    },
    import: () => document.getElementById('pg-import').click(),
    'clear-connectify': () => {
      if (!confirm('Clear every Connectify goal, prediction, setting and cache? Classes stay.')) return;
      Object.keys(localStorage).filter(k => !k.startsWith('connectify-playground:') || k === window.ConnectifyPlaygroundStorageKey)
        .forEach(k => localStorage.removeItem(k));
      location.reload();
    },
    reset: () => {
      if (!confirm('Delete every class and all Connectify data?')) return;
      Object.keys(localStorage).filter(k => k !== 'connectify-playground:styles').forEach(k => localStorage.removeItem(k));
      location.reload();
    }
  };

  document.querySelector('.pg-bar').addEventListener('click', e => {
    const action = e.target.closest('[data-action]')?.dataset.action;
    if (action && actions[action]) actions[action]();
  });

  // Connectify's component stylesheets on or off (index.html applies the choice before the first paint)
  const stylesBox = document.getElementById('pg-styles');
  stylesBox.checked = localStorage.getItem('connectify-playground:styles') !== 'off';
  stylesBox.addEventListener('change', () => {
    try { localStorage.setItem('connectify-playground:styles', stylesBox.checked ? 'on' : 'off'); } catch {}
    document.querySelectorAll('link[data-pg-connectify]').forEach(link => { link.disabled = !stylesBox.checked; });
  });

  document.getElementById('pg-import').addEventListener('change', async e => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      const parsed = JSON.parse(await file.text());
      if (!Array.isArray(parsed?.classes)) throw new Error('no classes');
      state = parsed;
      commit();
    } catch (err) {
      alert(`Not a playground file (${err.message}).`);
    }
  });

  // Editing never counts as a click outside Connectify's drawer, which would close the open tool
  document.getElementById('pg-app').addEventListener('click', e => e.stopPropagation());

  render();
  applyToConnectify();
  window.ConnectifyPlayground = { get state() { return state; }, apply: applyToConnectify, commit };
})();
