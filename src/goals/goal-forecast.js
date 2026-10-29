/**
 * Connectify Goals: goal target on prediction panels
 *
 * An unmarked task a goal covers shows the mark the goal needs on it (the plan's requirement, sliders and
 * difficulty weighting included; the same target the Year Progression chart plots) beside its Low / Mid / High
 * prediction, its text coloured by the task's own difficulty tier (desaturated, goal-forecast.css): a "Goal
 * target" cell after High on expanded cards, "Goal target 86%" at the end of the compact line.
 * Exposes window.ConnectifyGoalForecast.
 */
(() => {
  'use strict';

  if (window.ConnectifyGoalForecast) return;

  const store = () => window.ConnectifyGoalStore;
  const CARD = '.eds-c-tile, .cvr-c-tile, [data-subject-card], .c-tile';
  const round = v => String(Math.round(v));

  // A cohort pass asks for every row: active goals and each card's task ids are read once per pass
  let memo = null;
  function pass() {
    if (!memo) {
      memo = { goals: store()?.all() || [], ids: new Map() };
      setTimeout(() => { memo = null; }, 0);
    }
    return memo;
  }
  window.addEventListener('connectify-goals-changed', () => { memo = null; });

  function taskIdOf(row) {
    const card = row.closest?.(CARD);
    if (!card) return null;
    const { ids } = pass();
    if (!ids.has(card)) ids.set(card, window.ConnectifyParseHelpers?.cardTaskIds?.(card) || new Map());
    return ids.get(card).get(row)?.id || null;
  }

  // The task's weight from the cache (unweighted tasks need nothing); undefined when the cache lacks it
  function weightOf(subjectName, id) {
    const exact = window.ConnectifyCache?.subjectsCache?.get?.(subjectName)?.get?.(id);
    const task = exact || (window.ConnectifyData?.getSubjectTasks?.(subjectName) || []).find(t => t.id === id);
    return task ? Number(task.weight) || 0 : undefined;
  }

  /** `{ required, tier }` the goal asks of an unmarked task row, or null when no active goal covers it. */
  function targetFor(row, prediction) {
    if (!store() || !pass().goals.length) return null;
    const subjectName = window.ConnectifyTaskTypes?.getTaskMeta?.(row)?.subjectName || '';
    const goal = window.ConnectifyProgressGoalLine?.goalFor(subjectName, pass().goals);
    const id = goal && taskIdOf(row);
    if (!id) return null;
    const weight = weightOf(subjectName, id);
    const required = goal.targetOf({ id, pending: true, weight: weight ?? 1 });
    if (!Number.isFinite(required) || weight === 0) return null;
    const D = window.ConnectifyGoalDifficulty;
    const tier = goal.plan.impossible ? 'impossible' : goal.plan.guaranteed ? 'guaranteed' : D?.taskTier(required, prediction) || null;
    return { required: Math.max(0, Math.min(100, required)), tier };
  }

  /** Memo key of what the row shows (joins the row's cohort memo), so a changed target redraws it. */
  function signature(row, isOverall) {
    if (isOverall || !store() || !pass().goals.length) return '';
    const target = targetFor(row, null);
    return target ? `target:${round(target.required)}` : '';
  }

  /** Adds (or removes) the goal target on the row's prediction panel, after cohort-forecast.js filled it. */
  function render(ui, row, prediction) {
    const box = ui?.forecast;
    if (!box) return;
    box.querySelector('.cx-goal-target')?.remove();
    const target = targetFor(row, prediction);
    box.classList.toggle('cx-has-goal-target', Boolean(target));
    if (!target) return;
    const value = `${round(target.required)}%`;
    const tinted = el => { if (target.tier) el.dataset.tier = target.tier; return el; };
    if (ui.xpForecast) {
      const cell = document.createElement('dl');
      cell.className = 'cx-goal-target connectea-xp-grid';
      const wrap = document.createElement('div');
      wrap.className = 'connectea-xp-cell';
      const dt = document.createElement('dt');
      dt.className = 'connectea-xp-label';
      dt.textContent = 'Goal target';
      const dd = document.createElement('dd');
      dd.className = 'connectea-xp-value cx-goal-target__value';
      dd.textContent = value;
      tinted(dd);
      wrap.append(dt, dd);
      cell.append(wrap);
      ui.xpForecast.body.append(cell);
    } else {
      const span = document.createElement('span');
      span.className = 'cx-goal-target';
      const strong = document.createElement('strong');
      strong.className = 'cx-goal-target__value';
      strong.textContent = value;
      span.append('  •  Goal target ', tinted(strong));
      box.append(span);
    }
  }

  window.ConnectifyGoalForecast = { targetFor, signature, render };
})();
