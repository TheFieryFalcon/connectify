/**
 * Connectify Goals: bars on assessment rows
 *
 * Beside the outcome meter (18 x 56 each, rows never grow): on a completed task a goal judges, the
 * goal-performance bar (its mark against what it needed just before it was marked: pastel red / orange /
 * yellow / green, plus the secret purple breakout) and the goal-progress bar (weighted points earned of those
 * needed, one smooth fill in the goal's tier colour as of that task); on the overall row of the goal's
 * semester card, progress now. Tasks marked before a goal was set show the last finished goal's frozen
 * verdict. Each bar has its own tooltip (the outcome meter's singleton), numbers only. Exposes window.ConnectifyGoalBars.
 */
(() => {
  'use strict';

  if (window.ConnectifyGoalBars) return;

  const store = () => window.ConnectifyGoalStore;
  const events = () => window.ConnectifyGoalEvents;
  const D = () => window.ConnectifyGoalDifficulty;
  const round1 = v => (Number.isFinite(v) ? (Math.round(v * 10) / 10).toFixed(1) : '—');
  const BANDS = ['red', 'orange', 'yellow', 'green'];

  // A cohort pass asks for every row: goals, verdicts and each card's task ids are read once per pass (the
  // stored JSON and a whole-card scan per row made every pass stutter), dropped after the task or a goal change
  let memo = null;
  function pass() {
    if (!memo) {
      memo = { goals: store().all(), verdicts: null, ids: new Map() };
      setTimeout(() => { memo = null; }, 0);
    }
    return memo;
  }
  window.addEventListener('connectify-goals-changed', () => { memo = null; });

  function taskId(row) {
    const card = row.closest?.('.eds-c-tile, .cvr-c-tile, [data-subject-card], .c-tile');
    if (!card) return null;
    const { ids } = pass();
    if (!ids.has(card)) ids.set(card, window.ConnectifyParseHelpers?.cardTaskIds?.(card) || new Map());
    return ids.get(card).get(row)?.id || null;
  }

  const subjectOfRow = row => window.ConnectifyTaskTypes?.getTaskMeta?.(row)?.subjectName || '';

  /** The latest finished goal's frozen verdict for a task, with that goal. */
  function frozenVerdict(key) {
    const snap = pass();
    const verdicts = (snap.verdicts = snap.verdicts || store().verdicts());
    const past = snap.goals.filter(g => g.status !== 'active' && verdicts[g.id]?.[key])
      .sort((a, b) => String(b.finishedAt).localeCompare(String(a.finishedAt)));
    return past[0] ? { goal: past[0], verdict: verdicts[past[0].id][key] } : null;
  }

  /** What a row shows: `{ perf, progress }` (either may be missing), or null. */
  function rowData(row, isOverall) {
    if (!store() || !events()) return null;
    const subjectName = subjectOfRow(row);
    const subject = store().subjectKey(subjectName);
    const goal = store().activeFor(subjectName, pass().goals);
    const state = goal ? events().stateOf(goal) : null;
    const child = goal?.kind === 'atar' ? state?.children?.[subject] : null;
    if (isOverall) {
      if (!goal || !state) return null;
      const card = row.closest?.('.eds-c-tile, .cvr-c-tile, [data-subject-card], .c-tile');
      const title = card?.querySelector?.('.eds-c-tile__title, .cvr-c-tile__title')?.textContent || '';
      if (title && window.ConnectifyUtils.cardSemester(title) !== window.ConnectifyGoalPlan.semesterOf(goal)) return null;
      const progress = child ? child.progress : state.progress;
      return progress ? { goal, progress: { ...progress, tier: child ? child.tier : state.tier, target: child ? child.target : goal.target } } : null;
    }
    const id = taskId(row);
    if (!id) return null;
    const key = `${subject}::${id}`;
    const live = state?.verdicts?.[key];
    const found = live ? { goal, verdict: live } : frozenVerdict(key);
    if (!found) return null;
    const { verdict } = found;
    const total = verdict.progress?.total;
    return {
      goal: found.goal,
      perf: verdict.perfTier ? { band: verdict.perfTier, required: verdict.required, mark: verdict.mark } : null,
      progress: verdict.progress ? { ...verdict.progress, tier: verdict.goalTier, target: total > 0 ? (verdict.progress.required / total) * 100 : null } : null
    };
  }

  function perfBar(perf) {
    const bar = document.createElement('div');
    bar.className = 'cx-goal-perf';
    const lit = perf.band === 'purple' ? 4 : BANDS.indexOf(perf.band) + 1;
    BANDS.forEach((band, i) => {
      const seg = document.createElement('div');
      seg.className = `cx-goal-seg${i < lit ? ` cx-goal-seg--${band}` : ''}`;
      bar.append(seg);
    });
    if (perf.band === 'purple') {
      const seg = document.createElement('div');
      seg.className = 'cx-goal-seg cx-goal-seg--purple';
      bar.append(seg);
      bar.classList.add('cx-goal-perf--broken');
    }
    return bar;
  }

  function progressBar(progress) {
    const bar = document.createElement('div');
    bar.className = 'cx-goal-progress';
    bar.dataset.tier = progress.tier || '';
    const fill = document.createElement('div');
    fill.className = 'cx-goal-progress__fill';
    const share = progress.required > 0 ? Math.max(0, Math.min(1, progress.earned / progress.required)) : 0;
    fill.style.setProperty('--cx-goal-fill', `${Math.round(share * 1000) / 10}%`);
    bar.append(fill);
    return bar;
  }

  const perfTooltip = perf => `Needed ${round1(perf.required)}%, got ${round1(perf.mark)}%`;

  function progressTooltip(p, goal) {
    const target = goal?.kind === 'atar' ? `ATAR goal ${Number(goal.target).toFixed(2)}, needs ${round1(p.target)}%` : `Goal ${round1(p.target)}%`;
    return `${target}: ${round1(p.earned)} of ${round1(p.required)} weighted points${p.tier ? ` (${D().name(p.tier) || p.tier})` : ''}`;
  }

  /** The bar's own tooltip, in the outcome meter's singleton: each bar says only what it shows. */
  function withTooltip(bar, text) {
    const out = window.ConnectifyCohortOutcome;
    bar.dataset.goalTooltip = text;
    bar.setAttribute('aria-label', text);
    bar.addEventListener('mouseenter', e => out?.showFloatingTooltip?.(e, text));
    bar.addEventListener('mousemove', e => out?.showFloatingTooltip?.(e, text));
    bar.addEventListener('mouseleave', () => out?.hideFloatingTooltip?.());
    return bar;
  }

  /** Memo key of what the row's bars show (joins the row's cohort memo): a row redraws only when they change. */
  function signature(row, isOverall) {
    if (!store() || !pass().goals.length) return '';
    const data = rowData(row, isOverall);
    const texts = data ? [data.perf && perfTooltip(data.perf), data.progress && progressTooltip(data.progress, data.goal)] : [];
    return `${texts.join('|')}|${data?.perf?.band || ''}|${data?.progress?.tier || ''}`;
  }

  /** Draws (or removes) the row's goal bars, right of its outcome meter or at the end of an overall panel. */
  function render(ui, row, isOverall) {
    if (!ui) return;
    const data = store() && pass().goals.length ? rowData(row, isOverall) : null;
    const host = isOverall ? ui.box : ui.outcomeBar?.parentElement;
    let wrap = ui.goalBars;
    if (!data || (!data.perf && !data.progress) || !host) {
      wrap?.remove();
      ui.goalBars = null;
      ui.box?.classList.remove('cx-has-goal-bars');
      return;
    }
    if (!wrap) {
      wrap = document.createElement('div');
      wrap.className = 'cx-goal-bars';
      ui.goalBars = wrap;
    }
    // A redraw can take the bar under the pointer away, and its mouseleave with it
    window.ConnectifyCohortOutcome?.hideFloatingTooltip?.();
    wrap.replaceChildren(...[
      data.perf && withTooltip(perfBar(data.perf), perfTooltip(data.perf)),
      data.progress && withTooltip(progressBar(data.progress), progressTooltip(data.progress, data.goal))
    ].filter(Boolean));
    if (isOverall) {
      ui.box.classList.add('cx-has-goal-bars');
      if (wrap.parentElement !== ui.box) ui.box.append(wrap);
    } else if (wrap.previousElementSibling !== ui.outcomeBar) ui.outcomeBar.insertAdjacentElement('afterend', wrap);
  }

  window.ConnectifyGoalBars = { render, signature, rowData, perfTooltip, progressTooltip };
})();
