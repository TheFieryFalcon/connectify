/**
 * Connectify Goals: Goals dialog (#cx-goals-dialog)
 *
 * Every active goal as a card (target and end, tier, progress so far, Edit / Delete; an ATAR goal lists its
 * four subjects' targets) and finished goals under Past goals (Achieved / Missed, final mark, date, Delete).
 * Read-only off the Assessment Outlines page. A goal that finished with no toast to celebrate it celebrates
 * here, and a just-completed goal's card glows. Exposes window.ConnectifyGoalListUI.
 */
(() => {
  'use strict';

  if (window.ConnectifyGoalListUI) return;

  const M = () => window.ConnectifyGoalModal;
  const P = () => window.ConnectifyGoalPlan;
  const store = () => window.ConnectifyGoalStore;
  const stateOf = goal => window.ConnectifyGoalEvents?.stateOf(goal) || window.ConnectifyGoalReplay.evaluate(goal);

  const goalTitle = goal => (goal.kind === 'atar' ? 'ATAR' : goal.name || goal.subject);
  const order = (a, b) => (a.kind === 'atar' ? -1 : 0) - (b.kind === 'atar' ? -1 : 0) || (P().semesterOf(a) - P().semesterOf(b)) ||
    ((a.end?.week ?? 99) - (b.end?.week ?? 99));
  const finalText = goal => (Number.isFinite(goal.finalValue)
    ? (goal.kind === 'atar' ? `ATAR ${Number(goal.finalValue).toFixed(2)}` : `${M().round1(goal.finalValue)}%`)
    : '');
  const dateText = iso => {
    const d = new Date(iso);
    return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
  };

  /** Delete ✕ that asks first, inline. */
  function deleteButton(goal, rerender) {
    const btn = M().el('button', 'cx-goal-card__delete', '✕');
    btn.type = 'button';
    btn.setAttribute('aria-label', `Delete ${goalTitle(goal)} goal`);
    btn.addEventListener('click', () => {
      const ask = M().el('span', 'cx-goal-card__confirm', 'Delete this goal? ');
      const yes = M().el('button', 'cx-goal-link', 'Delete');
      const no = M().el('button', 'cx-goal-link', 'Keep');
      yes.type = no.type = 'button';
      yes.addEventListener('click', () => { store().remove(goal.id); rerender(); });
      no.addEventListener('click', rerender);
      ask.append(yes, ' ', no);
      btn.replaceWith(ask);
      yes.focus();
    });
    return btn;
  }

  function card(goal, close, rerender, readOnly) {
    const state = stateOf(goal) || {};
    const node = M().el('div', 'cx-goal-card');
    node.dataset.goalId = goal.id;
    if (goal.glowPending) {
      node.classList.add('cx-goal-card--celebrate');
      store().patch(goal.id, { glowPending: false });
    }
    const head = M().el('div', 'cx-goal-card__head');
    head.append(M().el('strong', 'cx-goal-card__title', P().title(goal)), M().tierLabel(state.tier));
    if (!readOnly) {
      const edit = M().el('button', 'cx-goal-card__edit', '✎');
      edit.type = 'button';
      edit.setAttribute('aria-label', `Edit ${goalTitle(goal)} goal`);
      edit.addEventListener('click', () => { close(); window.ConnectifyGoalEditor?.edit(goal); });
      head.append(edit);
    }
    head.append(deleteButton(goal, rerender));
    node.append(head, M().progressBar(state.progress, state.tier));
    if (goal.kind !== 'atar') node.append(M().el('span', 'cx-goal-points', M().pointsText(state.progress)));
    else {
      const kids = Object.values(state.children || {}).map(c => `${c.name} ${M().round1(c.target)}%`).join(' · ');
      if (kids) node.append(M().el('span', 'cx-goal-card__children', kids));
    }
    return node;
  }

  function pastRow(goal, rerender) {
    const row = M().el('div', 'cx-goal-past');
    const verdict = goal.status === 'achieved' ? 'achieved' : 'missed';
    const final = finalText(goal);
    row.append(
      M().el('span', 'cx-goal-past__title', P().title(goal)),
      M().tierLabel(verdict),
      M().el('span', 'cx-goal-past__final', [final, dateText(goal.finishedAt)].filter(Boolean).join(' · ')),
      deleteButton(goal, rerender)
    );
    return row;
  }

  /** Opens the Goals dialog; a goal that finished with no toast celebrates now. */
  function open(opener) {
    const readOnly = !window.ConnectifyUtils.isOutlinesPage();
    M().open({
      id: 'cx-goals-dialog',
      title: 'Goals',
      opener,
      build: (body, close) => {
        const render = () => {
          const active = store().active().filter(g => !g.parent).sort(order);
          const past = store().past().sort((a, b) => String(b.finishedAt).localeCompare(String(a.finishedAt)));
          const list = M().el('div', 'cx-goal-list');
          for (const goal of active) list.append(card(goal, close, render, readOnly));
          if (!active.length) list.append(M().el('p', 'cx-goal-empty', 'No active goals.'));
          body.replaceChildren(list);
          if (past.length) {
            const details = M().el('details', 'cx-goal-past-list');
            details.append(M().el('summary', '', `Past goals (${past.length})`));
            for (const goal of past) details.append(pastRow(goal, render));
            body.append(details);
          }
          if (!active.length && !past.length) close();
        };
        render();
        window.ConnectifyGoalEvents?.celebratePending?.();
      }
    });
  }

  window.ConnectifyGoalListUI = { open };
})();
