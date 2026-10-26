/**
 * Connectify Goals: storage
 *
 * Saved Target Grade / Target ATAR goals per account (`connectify:goals:<account>`), the conflict rules (one
 * active goal per subject, one active ATAR goal), finishing, and the frozen per-task verdicts of finished goals
 * (`connectify:goal_verdicts:<account>`, a cache: Clear Cache drops it, goals stay).
 * Exposes window.ConnectifyGoalStore.
 */
(() => {
  'use strict';

  if (window.ConnectifyGoalStore) return;

  const VERSION = 1;
  const GOALS_PREFIX = 'connectify:goals:';
  const VERDICTS_PREFIX = 'connectify:goal_verdicts:';
  const account = () => window.ConnectifyUtils.accountKey();
  const goalsKey = () => `${GOALS_PREFIX}${account()}`;
  const verdictsKey = () => `${VERDICTS_PREFIX}${account()}`;

  /** A class's subject key: the planners' course id (atar-scraper's cleanCourseName, lower case). */
  const subjectKey = name => window.ConnectifyUtils.normalize(
    String(name || '')
      .replace(/\s*[-–—]\s*Semester\s*[12].*$/i, '')
      .replace(/\bATAR\b/gi, '')
      .replace(/\bYear\s*\d+\b/gi, '')
  ).toLowerCase();

  function readJson(key) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }

  const writeJson = (key, value) => {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch (err) { console.warn('Connectify could not save goals:', err); }
  };

  // Unknown versions read as no goals; unknown fields on a goal are kept when it is saved again
  function all() {
    const data = readJson(goalsKey());
    return data?.version === VERSION && Array.isArray(data.goals) ? data.goals.filter(g => g && g.id) : [];
  }

  const writeAll = goals => {
    writeJson(goalsKey(), { version: VERSION, goals });
    window.dispatchEvent(new CustomEvent('connectify-goals-changed'));
  };

  const active = () => all().filter(g => g.status === 'active');
  const past = () => all().filter(g => g.status !== 'active' && !g.parent);
  const byId = id => all().find(g => g.id === id) || null;
  const childrenOf = id => all().filter(g => g.parent === id);
  const newId = () => `g${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;

  /** The subject keys a goal holds: its subject, or an ATAR goal's four subjects. */
  const subjectsOf = goal => (goal.kind === 'atar' ? (goal.topFour || []) : [goal.subject]).filter(Boolean);

  /** The active goal holding a subject (an ATAR child resolves to its ATAR goal), or null. */
  function activeFor(subject) {
    const key = subjectKey(subject);
    return active().find(g => !g.parent && subjectsOf(g).includes(key)) || null;
  }

  /**
   * What stops a goal being saved: `{ subject, goal }` for each active goal already holding one of its subjects
   * (the goal being edited, and its own children, never count), and `atar` when another ATAR goal is active.
   */
  function conflicts(goal) {
    const others = active().filter(g => !g.parent && g.id !== goal.id);
    const subjects = subjectsOf(goal);
    return {
      subjects: others.flatMap(g => subjectsOf(g).filter(s => subjects.includes(s)).map(subject => ({ subject, goal: g }))),
      atar: goal.kind === 'atar' ? others.find(g => g.kind === 'atar') || null : null
    };
  }

  /** Saves a new goal or an edit (same id, revision + 1). An ATAR goal's children are rewritten from `topFour`. */
  function save(goal) {
    const goals = all();
    const existing = goals.find(g => g.id === goal.id);
    const saved = {
      ...(existing || {}),
      ...goal,
      id: goal.id || newId(),
      revision: (existing?.revision || 0) + 1,
      status: 'active',
      createdAt: existing?.createdAt || goal.createdAt || new Date().toISOString()
    };
    delete saved.childSliders;
    let next = goals.filter(g => g.id !== saved.id && g.parent !== saved.id);
    if (saved.kind === 'atar') {
      const previous = goals.filter(g => g.parent === saved.id);
      for (const subject of saved.topFour || []) {
        const before = previous.find(c => c.subject === subject);
        next.push({
          ...(before || {}), id: before?.id || newId(), kind: 'grade', parent: saved.id, subject, status: 'active',
          end: saved.end, sliders: goal.childSliders?.[subject] || before?.sliders || {}, revision: (before?.revision || 0) + 1, createdAt: saved.createdAt,
          priorMarked: saved.priorMarked || []
        });
      }
    }
    next.push(saved);
    writeAll(next);
    return saved;
  }

  /** Changes stored fields without counting as an edit (tiers, celebration flags, solved child targets). */
  function patch(id, fields) {
    const goals = all();
    const goal = goals.find(g => g.id === id);
    if (!goal) return null;
    Object.assign(goal, fields);
    writeAll(goals);
    return goal;
  }

  /** Deletes a goal, its children and its frozen verdicts. */
  function remove(id) {
    writeAll(all().filter(g => g.id !== id && g.parent !== id));
    const verdicts = readJson(verdictsKey()) || {};
    if (verdicts[id]) {
      delete verdicts[id];
      writeJson(verdictsKey(), verdicts);
    }
  }

  /** Ends a goal (and its children) as Achieved or Missed, freezing its judged tasks' verdicts. */
  function finish(id, status, { finalValue = null, verdicts = {}, progress = null } = {}) {
    const goals = all();
    const finishedAt = new Date().toISOString();
    for (const g of goals) {
      if (g.id !== id && g.parent !== id) continue;
      Object.assign(g, { status, finishedAt });
      if (g.id === id) Object.assign(g, { finalValue, finalProgress: progress });
    }
    writeAll(goals);
    const stored = readJson(verdictsKey()) || {};
    stored[id] = verdicts;
    writeJson(verdictsKey(), stored);
  }

  /** Frozen verdicts: `{ goalId: { taskId: { required, mark, perfTier, progress, goalTier } } }`. */
  const verdicts = () => readJson(verdictsKey()) || {};

  const clearVerdicts = () => window.ConnectifyUtils.removeStorageKeys(key => key.startsWith(VERDICTS_PREFIX));

  /** Every goal and verdict, for the new-year archive; then the list starts empty. */
  function takeAll() {
    const taken = { goals: all(), verdicts: verdicts() };
    localStorage.removeItem(goalsKey());
    localStorage.removeItem(verdictsKey());
    window.dispatchEvent(new CustomEvent('connectify-goals-changed'));
    return taken;
  }

  window.ConnectifyGoalStore = {
    VERSION, GOALS_PREFIX, VERDICTS_PREFIX, subjectKey, all, active, past, byId, childrenOf, subjectsOf, activeFor,
    conflicts, save, patch, remove, finish, verdicts, clearVerdicts, takeAll
  };
})();
