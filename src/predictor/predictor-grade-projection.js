/**
 * Connectify Predictor: subject grade projection
 *
 * Aggregates task predictions into low / mid / high projected marks for each subject.
 * Exposes window.ConnectifyPredictorProjection.projectSubjectGrades.
 */
(() => {
  'use strict';

  const engine = () => window.ConnectifyPredictorEngine;
  const dates = () => window.ConnectifyPredictorDates;

  const round = (...args) => engine().round(...args);
  const cleanSubject = (...args) => engine().cleanSubject(...args);
  const applyLogarithmicCeiling = (...args) => engine().applyLogarithmicCeiling(...args);
  const getBaselines = (...args) => engine().getBaselines(...args);
  const getHistoricalData = (...args) => engine().getHistoricalData(...args);
  const resolveCustomDate = (...args) => dates().resolveCustomDate(...args);
  const formatCustomWeek = (...args) => dates().formatCustomWeek(...args);
  const hasParsableDate = (...args) => dates().hasParsableDate(...args);
  const getOrComputeTaskPrediction = (...args) => window.ConnectifyPredictorCache.getOrComputeTaskPrediction(...args);

  // --- SUBJECT GRADE PROJECTIONS ---
  function projectSubjectGrades(subjectsList) {
    const rawSubjects = subjectsList || (window.ConnectifyData?.collect ? window.ConnectifyData.collect(true) : []);
    const baselines = getBaselines();
    const historical = getHistoricalData(rawSubjects);
    const results = [];

    // Group subjects by clean name so Semester 1 and Semester 2 outlines are unified per subject course
    const subjectsMap = new Map();
    for (const s of rawSubjects) {
      const cleanName = cleanSubject(s.name);
      if (!subjectsMap.has(cleanName)) {
        subjectsMap.set(cleanName, {
          name: cleanName,
          tasks: []
        });
      }
      const entry = subjectsMap.get(cleanName);
      if (Array.isArray(s.tasks)) {
        entry.tasks.push(...s.tasks);
      }
    }
    const subjects = Array.from(subjectsMap.values());

    for (const subj of subjects) {
      const cleanName = subj.name;
      let completedEarned = 0;
      let completedWeight = 0;
      const completedTasks = [];
      const upcomingTasks = [];
      const seenUpcomingTaskNames = new Set();

      for (const t of subj.tasks || []) {
        if (t.weight > 0 && !t.pending && Number.isFinite(t.score)) {
          completedEarned += (t.score / 100) * t.weight;
          completedWeight += t.weight;
          completedTasks.push(t);
        } else {
          // Unfinished task candidate:
          // Strictly exclude tasks with 0% weight, non-positive weight, or non-finite weight (e.g. NaN%):
          if (!t.weight || t.weight <= 0 || !Number.isFinite(t.weight)) {
            continue;
          }

          const normName = cleanSubject(t.name).toLowerCase();

          // Deduplication: skip if already seen in upcoming or already completed in this subject
          if (seenUpcomingTaskNames.has(normName)) continue;
          if (completedTasks.some(ct => cleanSubject(ct.name).toLowerCase() === normName)) continue;

          // Check if custom date is set in Progress Graph:
          const customTime = resolveCustomDate(subj.name, t);
          if (customTime !== null) {
            if (customTime === '') {
              // Explicitly cleared or suppressed by user
              continue;
            }
            const formatted = formatCustomWeek(customTime);
            if (formatted) {
              t.order = formatted.order;
              t.caption = formatted.display;
              t.customDate = formatted.display;
              t.dateDisplay = formatted.display;
            } else {
              // Invalid custom date format
              continue;
            }
          }

          // If date cannot be parsed and no valid custom date set, do not predict in the predictor
          if (!hasParsableDate(t, subj.name)) {
            continue;
          }

          if (!Number.isFinite(t.order)) {
            const parsed = formatCustomWeek(t.caption);
            if (parsed && Number.isFinite(parsed.order)) {
              t.order = parsed.order;
            }
          }
          if (!t.dateDisplay && Number.isFinite(t.order) && window.ConnectifyProgressMath?.formatTimestamp) {
            t.dateDisplay = window.ConnectifyProgressMath.formatTimestamp(t.order, t.caption);
          }

          seenUpcomingTaskNames.add(normName);
          upcomingTasks.push(t);
        }
      }

      const runningMark = completedWeight > 0 ? (completedEarned / completedWeight) * 100 : null;
      const baselineMark = baselines.subjects[cleanName] !== undefined ? Number(baselines.subjects[cleanName]) : null;
      const hasSubjectAverage = runningMark !== null || baselineMark !== null;

      let upcomingLowEarned = 0;
      let upcomingMidEarned = 0;
      let upcomingHighEarned = 0;
      let predictedUpcomingWeight = 0;
      let unpredictedUpcomingWeight = 0;

      const upcomingPredictions = [];

      for (const task of upcomingTasks) {
        const taskWeight = task.weight || 0;
        if (taskWeight <= 0 || !Number.isFinite(taskWeight)) continue;

        const pred = getOrComputeTaskPrediction(subj.name, task, rawSubjects) || {
          unpredicted: true,
          reason: 'Prediction unavailable',
          taskType: window.ConnectifyTaskTypes?.getEffectiveType ? window.ConnectifyTaskTypes.getEffectiveType(subj.name, task) : 'Take-Home'
        };

        if (!pred.unpredicted) {
          upcomingLowEarned += (pred.low / 100) * taskWeight;
          upcomingMidEarned += (pred.mid / 100) * taskWeight;
          upcomingHighEarned += (pred.high / 100) * taskWeight;
          predictedUpcomingWeight += taskWeight;
        } else {
          unpredictedUpcomingWeight += taskWeight;
          // If subject has a running or baseline mark, fallback unpredicted task to subject baseline for projection:
          const fallbackScore = runningMark ?? baselineMark;
          if (fallbackScore !== null) {
            upcomingLowEarned += (Math.max(0, fallbackScore - 7) / 100) * taskWeight;
            upcomingMidEarned += (fallbackScore / 100) * taskWeight;
            upcomingHighEarned += (Math.min(100, fallbackScore + 7) / 100) * taskWeight;
          }
        }

        upcomingPredictions.push({
          task,
          prediction: pred
        });
      }

      const totalSubjectWeight = completedWeight + predictedUpcomingWeight + unpredictedUpcomingWeight;
      let projectedLow = null;
      let projectedMid = null;
      let projectedHigh = null;

      if (hasSubjectAverage && totalSubjectWeight > 0) {
        projectedLow = round(((completedEarned + upcomingLowEarned) / totalSubjectWeight) * 100, 1);
        projectedMid = round(((completedEarned + upcomingMidEarned) / totalSubjectWeight) * 100, 1);
        projectedHigh = round(((completedEarned + upcomingHighEarned) / totalSubjectWeight) * 100, 1);

        // Ensure distinct scenario bounds for subject projections
        const remainingRatio = Math.max(0.15, (predictedUpcomingWeight + unpredictedUpcomingWeight) / totalSubjectWeight);
        const minSubjectSpread = Math.max(2.0, round(7.5 * remainingRatio, 1));
        if (projectedMid - projectedLow < minSubjectSpread) {
          projectedLow = Math.max(0, round(projectedMid - minSubjectSpread, 1));
        }
        if (projectedHigh - projectedMid < minSubjectSpread) {
          projectedHigh = Math.min(100, round(applyLogarithmicCeiling(projectedMid, minSubjectSpread), 1));
        }
      } else if (hasSubjectAverage && completedWeight > 0) {
        const midScore = round(runningMark, 1);
        projectedMid = midScore;
        projectedLow = Math.max(0, round(midScore - 2.5, 1));
        projectedHigh = Math.min(100, round(applyLogarithmicCeiling(midScore, 2.5), 1));
      } else if (hasSubjectAverage && baselineMark !== null) {
        const baseScore = round(baselineMark, 1);
        projectedMid = baseScore;
        projectedLow = Math.max(0, round(baseScore - 4.0, 1));
        projectedHigh = Math.min(100, round(applyLogarithmicCeiling(baseScore, 4.0), 1));
      }

      results.push({
        rawName: subj.name,
        cleanName,
        runningMark: runningMark !== null ? round(runningMark, 1) : null,
        baselineMark: baselineMark !== null ? round(baselineMark, 1) : null,
        hasSubjectAverage,
        completedWeight: round(completedWeight, 1),
        completedCount: completedTasks.length,
        upcomingCount: upcomingTasks.length,
        projected: {
          low: projectedLow,
          mid: projectedMid,
          high: projectedHigh
        },
        upcomingPredictions
      });
    }

    return results;
  }

  window.ConnectifyPredictorProjection = { ...window.ConnectifyPredictorProjection, projectSubjectGrades };
})();
