/**
 * Connectify Goals: difficulty
 *
 * The chance of reaching a target from a Low / Mid / High projection (about the 20th / 50th / 80th
 * percentiles: a normal on Mid in logit space, sigma from the wider half-range), the seven tiers and their
 * colours, a task's own tier against its prediction, the goal-performance bands, and a projection of a set of
 * tasks (marked ones as they are, the rest from their predictions). Exposes window.ConnectifyGoalDifficulty.
 */
(() => {
  'use strict';

  if (window.ConnectifyGoalDifficulty) return;

  const Z80 = 0.8416;

  // Guaranteed and Impossible are decided by the plan; the five others by the chance of success
  const TIERS = [
    { id: 'guaranteed', name: 'Guaranteed', color: '#15803d' },
    { id: 'trivial', name: 'Trivial', color: '#22c55e', min: 0.9 },
    { id: 'easy', name: 'Easy', color: '#84cc16', min: 0.7 },
    { id: 'medium', name: 'Medium', color: '#eab308', min: 0.4 },
    { id: 'hard', name: 'Hard', color: '#f97316', min: 0.15 },
    { id: 'hell', name: 'Hell', color: '#ef4444', min: 0 },
    { id: 'impossible', name: 'Impossible', color: '#991b1b' }
  ];
  const byId = id => TIERS.find(t => t.id === id) || null;
  const name = id => byId(id)?.name || '';
  // Achieved and Missed goals keep the colours of the tiers that end a goal at once
  const color = id => byId(id === 'achieved' ? 'guaranteed' : id === 'missed' ? 'impossible' : id)?.color || '';

  // Standard normal CDF (Abramowitz and Stegun 7.1.26, error < 1.5e-7)
  function phi(x) {
    const t = 1 / (1 + 0.3275911 * Math.abs(x) / Math.SQRT2);
    const poly = t * (0.254829592 + t * (-0.284496736 + t * (1.421413741 + t * (-1.453152027 + t * 1.061405429))));
    const erf = 1 - poly * Math.exp(-(x * x) / 2);
    return x >= 0 ? (1 + erf) / 2 : (1 - erf) / 2;
  }

  // Marks live between 0 and 100: on the logit scale a spread narrows towards either end by itself
  const logit = v => {
    const p = Math.min(99.95, Math.max(0.05, v)) / 100;
    return Math.log(p / (1 - p));
  };

  /**
   * Chance (0–1) that the outcome reaches `target`, or null without a projection. The spread is the wider
   * half-range on the logit scale: High's logarithmic headroom squeezes the upside near 100 (a 94 average had
   * 95 at the 92nd percentile), while the logit scale still bounds it there.
   */
  function chance(target, range) {
    const { low, mid, high } = range || {};
    if (!Number.isFinite(target) || !Number.isFinite(mid)) return null;
    const halves = [Number.isFinite(low) ? logit(mid) - logit(low) : 0, Number.isFinite(high) ? logit(high) - logit(mid) : 0];
    const sigma = Math.max(...halves) / Z80;
    if (!(sigma > 0)) return target <= mid ? 1 : 0;
    return 1 - phi((logit(target) - logit(mid)) / sigma);
  }

  /** The tier id: Guaranteed / Impossible from the plan, otherwise from the chance (null without one). */
  function tierFor({ guaranteed = false, impossible = false, chance: p = null } = {}) {
    if (impossible) return 'impossible';
    if (guaranteed) return 'guaranteed';
    if (!Number.isFinite(p)) return null;
    return TIERS.find(t => Number.isFinite(t.min) && p >= t.min).id;
  }

  /** A remaining task's tier: the chance of scoring its required mark against its own prediction. */
  function taskTier(required, prediction) {
    if (!Number.isFinite(required)) return null;
    if (required > 100 + 1e-9) return 'impossible';
    if (required <= 0) return 'trivial';
    if (!prediction || prediction.unpredicted) return null;
    return tierFor({ chance: chance(required, prediction) });
  }

  /** Goal-performance band of a mark against what the task needed (R). Purple is the secret breakout. */
  function perfTier(mark, required) {
    if (!Number.isFinite(mark) || !Number.isFinite(required)) return null;
    if (mark < required - 5) return 'red';
    if (mark < required) return 'orange';
    if (mark < required + 5) return 'yellow';
    return mark > 1.1 * required ? 'purple' : 'green';
  }

  const cleanSubject = subject => window.ConnectifyPredictorEngine?.cleanSubject?.(subject) ?? String(subject || '');
  const round1 = v => Math.round(v * 10) / 10;

  /** The task's prediction (cached, else computed and cached), or null. */
  function predictionFor(subject, task, allSubjects) {
    const cache = window.ConnectifyPredictorCache;
    if (!cache?.getOrComputeTaskPrediction) return null;
    try {
      return cache.getOrComputeTaskPrediction(cleanSubject(subject), task.source || task, allSubjects) || null;
    } catch {
      return null;
    }
  }

  /**
   * Low / Mid / High final mark of `tasks` (planner task records) when `isDone(task)` ones keep their marks and
   * the rest score their predictions (unpredicted ones the running mark +- 7), with the Predictor's minimum
   * spread (projectSubjectGrades). Null when there is neither a mark nor a prediction to go on.
   */
  function projectTasks(subject, tasks, isDone, allSubjects) {
    let earned = 0;
    let doneWeight = 0;
    let total = 0;
    const rest = [];
    for (const t of tasks || []) {
      if (!(t.weight > 0)) continue;
      total += t.weight;
      if (isDone(t)) {
        earned += (t.score / 100) * t.weight;
        doneWeight += t.weight;
      } else rest.push(t);
    }
    if (!(total > 0)) return null;
    const running = doneWeight > 0 ? (earned / doneWeight) * 100 : null;
    const sums = { low: 0, mid: 0, high: 0 };
    let predicted = 0;
    for (const t of rest) {
      const p = predictionFor(subject, t, allSubjects);
      const usable = p && !p.unpredicted && Number.isFinite(p.mid);
      const mid = usable ? p.mid : running;
      if (!Number.isFinite(mid)) continue;
      predicted += t.weight;
      sums.low += ((usable ? p.low : Math.max(0, mid - 7)) / 100) * t.weight;
      sums.mid += (mid / 100) * t.weight;
      sums.high += ((usable ? p.high : Math.min(100, mid + 7)) / 100) * t.weight;
    }
    if (doneWeight + predicted <= 0) return null;
    const known = doneWeight + predicted;
    const range = {
      low: round1(((earned + sums.low) / known) * 100),
      mid: round1(((earned + sums.mid) / known) * 100),
      high: round1(((earned + sums.high) / known) * 100)
    };
    if (!rest.length) return range;
    const spread = Math.max(2, round1(7.5 * Math.max(0.15, (total - doneWeight) / total)));
    if (range.mid - range.low < spread) range.low = Math.max(0, round1(range.mid - spread));
    if (range.high - range.mid < spread) {
      const ceil = window.ConnectifyPredictorEngine?.applyLogarithmicCeiling;
      range.high = Math.min(100, round1(ceil ? ceil(range.mid, spread) : range.mid + spread));
    }
    return range;
  }

  window.ConnectifyGoalDifficulty = { TIERS, byId, name, color, phi, chance, tierFor, taskTier, perfTier, predictionFor, projectTasks };
})();
