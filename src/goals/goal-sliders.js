/**
 * Connectify Goals: effort sliders
 *
 * Five-notch effort sliders (Much less … Much more) in the planners: one per remaining task in Target Grade
 * (with its required mark and tier) and one per top-four subject in Target ATAR. Notches are drafts kept per
 * subject until a goal is saved (or loaded for editing); toggling the performance checkbox resets them.
 * Exposes window.ConnectifyGoalSliders.
 */
(() => {
  'use strict';

  if (window.ConnectifyGoalSliders) return;

  const M = () => window.ConnectifyGoalModal;
  const P = () => window.ConnectifyGoalPlan;
  const D = () => window.ConnectifyGoalDifficulty;

  // Task notches per subject key (Target Grade, and an ATAR goal's subjects), subject notches (Target ATAR)
  let taskNotches = {};
  let subjectNotches = {};
  let focusKey = null;

  const gradeSliders = subject => (taskNotches[subject] = taskNotches[subject] || {});
  const setGrade = (subject, sliders) => { taskNotches[subject] = { ...(sliders || {}) }; };
  const atarSliders = () => subjectNotches;
  const setAtar = sliders => { subjectNotches = { ...(sliders || {}) }; };
  /** Every subject's task notches, for an ATAR goal's linked subjects. */
  const childSliders = subjects => Object.fromEntries(subjects.map(s => [s, { ...gradeSliders(s) }]));

  /** Back to Normal: Target Grade's task sliders (`grade`) or Target ATAR's subject and task sliders (`atar`). */
  function reset(kind, subjects = []) {
    if (kind === 'atar') {
      subjectNotches = {};
      for (const s of subjects) taskNotches[s] = {};
    } else taskNotches = {};
  }

  /** One slider: `<label class="cx-goal-effort">` with a range input and the notch name. */
  function control(key, value, onChange) {
    const label = M().el('label', 'cx-goal-effort');
    const input = M().el('input', 'cx-goal-slider');
    Object.assign(input, { type: 'range', min: '-2', max: '2', step: '1' });
    input.value = String(Number(value) || 0);
    const name = M().el('span', 'cx-goal-notch', P().notchName(value));
    input.setAttribute('aria-valuetext', P().notchName(value));
    input.setAttribute('aria-label', 'Effort');
    input.dataset.goalKey = key;
    // While dragging only the notch name follows; the planner re-renders on release (`change`, also each
    // key press), since replacing the slider mid-drag drops the drag and selects text instead
    input.addEventListener('input', () => {
      const notch = Number(input.value);
      name.textContent = P().notchName(notch);
      input.setAttribute('aria-valuetext', P().notchName(notch));
    });
    input.addEventListener('change', () => {
      focusKey = document.activeElement === input ? key : null;
      onChange(Number(input.value));
    });
    label.append(input, name);
    return label;
  }

  // A re-render replaces the sliders, so the one being moved by keyboard gets focus back
  function refocus(container) {
    if (!focusKey) return;
    const input = Array.from(container.querySelectorAll('.cx-goal-slider')).find(i => i.dataset.goalKey === focusKey);
    if (input) requestAnimationFrame(() => input.focus());
  }

  let subjectsMemo = null;
  const allSubjects = () => {
    if (!subjectsMemo) {
      try { subjectsMemo = window.ConnectifyData?.collect?.(true) || []; } catch { subjectsMemo = []; }
      setTimeout(() => { subjectsMemo = null; }, 0);
    }
    return subjectsMemo;
  };

  /**
   * Target Grade: a table of the remaining weighted tasks: effort slider (unless `readOnly`), required mark and
   * tier. `onChange()` re-renders the planner after a notch moves.
   */
  function renderGradeTasks(container, { course, plan, onChange, readOnly = false }) {
    const tasks = (course.progress?.tasks || []).filter(t => t.weight > 0);
    if (!tasks.length || plan.error || plan.finished) return null;
    const sliders = gradeSliders(course.id);
    const table = M().el('table', 'cta-grade-table cx-goal-tasks');
    const head = M().el('tr');
    ['Assessment', 'Effort', 'Needs', 'Difficulty'].forEach(t => head.append(M().el('th', '', t)));
    table.append(head);
    for (const task of tasks) {
      const key = task.id || task.name;
      const required = plan.impossible ? null : P().requiredOf(plan, key);
      const tier = D().taskTier(required, D().predictionFor(course.subject || course.name, task, allSubjects()));
      const row = M().el('tr');
      const effort = M().el('td', 'cx-goal-tasks__effort');
      if (readOnly) effort.textContent = P().notchName(sliders[key]);
      else {
        effort.append(control(key, sliders[key], notch => {
          if (notch) sliders[key] = notch;
          else delete sliders[key];
          onChange();
        }));
      }
      const tierCell = M().el('td');
      tierCell.append(M().tierLabel(tier));
      row.append(M().el('td', '', task.name), effort, M().el('td', '', Number.isFinite(required) ? `${M().round1(required)}%` : '—'), tierCell);
      table.append(row);
    }
    container.append(table);
    refocus(container);
    return table;
  }

  /**
   * Target ATAR: a subject's effort slider, the mark it needs and its tier, added to its breakdown block.
   * `target` is the subject's solved final mark.
   */
  function renderSubject(block, { course, target, onChange }) {
    const line = M().el('div', 'cx-goal-subject-effort');
    line.append(control(`subject:${course.id}`, subjectNotches[course.id], notch => {
      if (notch) subjectNotches[course.id] = notch;
      else delete subjectNotches[course.id];
      onChange();
    }));
    if (Number.isFinite(target)) {
      const tasks = (course.tasks || []).filter(t => t.weight > 0);
      const range = D().projectTasks(course.subject || course.name, tasks, P().isMarked, allSubjects());
      line.append(M().el('span', 'cx-goal-subject-needs', `Needs ${M().round1(target)}%`), M().tierLabel(D().tierFor({ chance: D().chance(target, range) })));
    }
    block.append(line);
    refocus(block.parentElement || block);
    return line;
  }

  window.ConnectifyGoalSliders = { gradeSliders, setGrade, atarSliders, setAtar, childSliders, reset, control, renderGradeTasks, renderSubject };
})();
