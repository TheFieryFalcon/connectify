/**
 * Connectify Progress Math & Progression Modeling
 *
 * Implements historical ATAR projection modeling, chronological step tracking,
 * month/term/week time formatting, monthly point aggregation, and dynamic axis scaling bounds.
 */
(() => {
  'use strict';

  if (window.ConnectifyProgressMath) return;

  function formatTimestamp(order, fallbackCaption) {
    if (!Number.isFinite(order)) return fallbackCaption || 'Unknown';
    const term = Math.floor((order - 1) / 12) + 1;
    const week = Math.floor((order - 1) % 12) + 1;
    return `Term ${term}, Week ${week}`;
  }

  const getMonthName = (week) => {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const monthIndex = 1 + Math.floor((week - 1) / 4.3);
    return months[Math.max(0, Math.min(11, monthIndex))];
  };

  /**
   * Reconstruct historical running ATAR points at each assessment chronological step.
   *
   * @param {Array<Object>} subjects - Array of subject outline data from ConnectifyData
   * @returns {{points?: Array<Object>, byAssessment?: boolean, error?: string}}
   */
  function history(subjects) {
    if (!Array.isArray(subjects) || !subjects.length) {
      return { error: 'No subject assessment data available yet.' };
    }

    // Exam component rows worth 0% are already represented by the weighted full exam
    const eligible = subjects
      .filter(s => /\bATAR\b/i.test(s.name) && !/\bGeneral\b/i.test(s.name))
      .map(s => ({
        ...s,
        tasks: s.tasks.filter(t => t.weight !== 0)
      }));

    const invalid = eligible.flatMap(s =>
      s.tasks.filter(t => !Number.isFinite(t.weight) || t.weight < 0).map(t => `${s.name}: ${t.name}`)
    );

    if (invalid.length) {
      return {
        error: `Assessment weights are unavailable for: ${invalid.join('; ')}. Expand all outlines and refresh.`
      };
    }

    const byAssessment = eligible.some(s => s.tasks.some(t => !Number.isFinite(t.order)));

    const ordered = eligible.map(s => ({
      ...s,
      tasks: byAssessment
        ? [...s.tasks].sort((a, b) => a.sequence - b.sequence).map((t, i) => ({ ...t, order: i + 1 }))
        : s.tasks
    }));

    const steps = [...new Set(ordered.flatMap(s => s.tasks.map(t => t.order)))].sort((a, b) => a - b);
    const points = [];

    const calcFn = window.ConnectifyAtar?.calculate || window.ConnectifyMath?.calculate;

    for (const step of steps) {
      const rows = ordered.map(s => {
        const completedTasks = s.tasks.filter(t => t.order <= step);
        const totalWeight = completedTasks.reduce((acc, t) => acc + t.weight, 0);

        return {
          name: s.name.replace(/\bATAR\b|\bYear\s*\d+\b/gi, '').trim(),
          include: totalWeight > 0,
          score: (() => {
            if (!totalWeight) return undefined;
            const rawAvg = completedTasks.reduce((acc, t) => acc + t.score * t.weight, 0) / totalWeight;

            const prefsStr = localStorage.getItem('connectea:preferences');
            const savedPrefs = prefsStr ? JSON.parse(prefsStr) : {};
            const courseId = s.name.replace(/\bATAR\b|\bYear\s*\d+\b/gi, '').trim().toLowerCase();
            const calibration = savedPrefs[`sem1_calibration:${courseId}`] || {};

            if (window.ConnectifyMath && window.ConnectifyMath.calculateShiftedScaledScore) {
              return window.ConnectifyMath.calculateShiftedScaledScore(s.name, rawAvg, calibration.raw, calibration.scaled, 2025);
            }
            return rawAvg;
          })()
        };
      });

      if (calcFn) {
        const calculation = calcFn(rows);
        if (calculation && !calculation.error) {
          points.push({
            name: byAssessment ? `Assessment round ${step}` : getMonthName(step),
            caption: '',
            score: calculation.atar === '<30' ? null : Number(calculation.atar),
            display: calculation.atar,
            order: step
          });
        }
      }
    }

    return { points, byAssessment };
  }

  /**
   * Aggregates points by month when plotting ATAR progression over calendar time.
   */
  function aggregateMonthlyPoints(points) {
    const monthGroups = new Map();

    points.forEach(p => {
      if (p.score === null) return;
      const monthIndex = 1 + Math.floor((p.order - 1) / 4.3);
      const mIdx = Math.max(0, Math.min(11, monthIndex));

      if (!monthGroups.has(mIdx)) {
        monthGroups.set(mIdx, {
          name: p.name,
          caption: '',
          sum: 0,
          count: 0,
          orderSum: 0
        });
      }
      const group = monthGroups.get(mIdx);
      group.sum += p.score;
      group.count++;
      group.orderSum += p.order;
    });

    const averagedPoints = [];
    const sortedMonths = Array.from(monthGroups.keys()).sort((a, b) => a - b);
    for (const mIdx of sortedMonths) {
      const group = monthGroups.get(mIdx);
      const avgScore = group.sum / group.count;
      averagedPoints.push({
        name: group.name,
        caption: 'Monthly Average',
        score: avgScore,
        display: avgScore.toFixed(2),
        order: group.orderSum / group.count
      });
    }

    return averagedPoints.length > 0 ? averagedPoints : points;
  }

  /**
   * Determines dynamic Y-axis bounds, range, step size, and scaling function.
   */
  function computeYBounds(points, isHistory) {
    let minY = 0;
    const maxY = 100;

    if (isHistory) {
      const validScores = points.map(p => p.score).filter(Number.isFinite);
      if (validScores.length) {
        const sorted = [...validScores].sort((a, b) => a - b);
        const secondLowest = sorted.length > 1 ? sorted[1] : sorted[0];
        minY = Math.max(0, Math.floor(secondLowest) - 1);
        if (minY >= maxY) minY = maxY - 1;
      }
    }

    const range = maxY - minY;
    const gridStep = !isHistory || range === 100 ? 25 : range > 30 && range % 10 === 0 ? 10 : (range <= 10 ? 1 : 5);
    const yFor = val => 260 - ((val - minY) / range) * 220;

    return { minY, maxY, range, gridStep, yFor };
  }

  window.ConnectifyProgressMath = {
    formatTimestamp,
    getMonthName,
    history,
    aggregateMonthlyPoints,
    computeYBounds
  };
})();
