/**
 * Connectify Predictor: historical performance
 *
 * Averages and counts completed results per subject and per assessment type, plus each subject's own
 * results in date order (score, weight, type), the history every task prediction is built from, overall or
 * only from results before a given task. Exposes window.ConnectifyPredictorHistory.
 */
(() => {
  'use strict';

  const round = (...args) => window.ConnectifyPredictorEngine.round(...args);
  const cleanSubject = (...args) => window.ConnectifyPredictorEngine.cleanSubject(...args);
  const getTaskChronologicalStamp = (...args) => window.ConnectifyPredictorDates.getTaskChronologicalStamp(...args);

  const isCompletedResult = t => t && !t.pending && Number.isFinite(t.score) && t.weight > 0;
  const typeOf = (subjName, t) => (window.ConnectifyTaskTypes?.getEffectiveType
    ? window.ConnectifyTaskTypes.getEffectiveType(subjName, t)
    : 'Take-Home');

  /** Summarises completed results ({ subjName, task, stamp }) into the history object predictTask reads. */
  function summarize(completed) {
    const subjectStats = {};
    const typeStats = {};
    const typeCounts = {};
    const subjectResults = {};
    let totalScoreWeight = 0;
    let totalWeight = 0;

    for (const { subjName, task, stamp } of completed) {
      const cleanName = cleanSubject(subjName);
      const taskType = typeOf(subjName, task);
      const earned = (task.score / 100) * task.weight;
      if (!subjectStats[cleanName]) subjectStats[cleanName] = { earned: 0, weight: 0, tasks: [] };
      subjectStats[cleanName].earned += earned;
      subjectStats[cleanName].weight += task.weight;
      subjectStats[cleanName].tasks.push(task.score);
      (subjectResults[cleanName] = subjectResults[cleanName] || []).push({ score: task.score, weight: task.weight, type: taskType, stamp });

      if (!typeStats[taskType]) {
        typeStats[taskType] = { earned: 0, weight: 0 };
        typeCounts[taskType] = 0;
      }
      typeStats[taskType].earned += earned;
      typeStats[taskType].weight += task.weight;
      typeCounts[taskType]++;
      totalScoreWeight += earned;
      totalWeight += task.weight;
    }

    const subjectAverages = {};
    const subjectSpreads = {};
    const subjectCounts = {};
    // Spread within each subject, pooled: a student's gap between subjects is not task-to-task variation
    let pooledSq = 0;
    let pooledDf = 0;
    for (const [name, data] of Object.entries(subjectStats)) {
      subjectCounts[name] = data.tasks.length;
      subjectResults[name].sort((a, b) => a.stamp - b.stamp);
      if (data.weight > 0) subjectAverages[name] = round((data.earned / data.weight) * 100, 2);
      if (data.tasks.length >= 2 && subjectAverages[name] !== undefined) {
        const mean = subjectAverages[name];
        const sumSq = data.tasks.reduce((acc, s) => acc + Math.pow(s - mean, 2), 0);
        subjectSpreads[name] = Math.sqrt(sumSq / (data.tasks.length - 1));
        pooledSq += sumSq;
        pooledDf += data.tasks.length - 1;
      }
    }

    const typeAverages = {};
    for (const [type, data] of Object.entries(typeStats)) {
      if (data.weight > 0) typeAverages[type] = round((data.earned / data.weight) * 100, 2);
    }

    const overallAverage = totalWeight > 0 ? round((totalScoreWeight / totalWeight) * 100, 2) : null;
    const pooled = pooledDf >= 2 ? Math.sqrt(pooledSq / pooledDf) : 0;
    const spread = Math.min(14, Math.max(4, pooled > 0 ? pooled : 8));

    return {
      subjects: subjectAverages,
      subjectSpreads,
      subjectCounts,
      subjectResults,
      types: typeAverages,
      typeCounts,
      overallAverage,
      spread,
      totalCompletedTasks: completed.length
    };
  }

  const subjectsOrCache = list => list || (window.ConnectifyData?.collect ? window.ConnectifyData.collect(true) : []);

  // --- HISTORICAL PERFORMANCE SCRAPER ---
  function getHistoricalData(subjectList) {
    const completed = [];
    for (const subj of subjectsOrCache(subjectList)) {
      for (const t of subj.tasks || []) {
        if (isCompletedResult(t)) completed.push({ subjName: subj.name, task: t, stamp: getTaskChronologicalStamp(t, subj.name) });
      }
    }
    return summarize(completed);
  }

  function getHistoricalDataPriorTo(allSubjects, targetSubjectName, targetTask) {
    const targetStamp = getTaskChronologicalStamp(targetTask, targetSubjectName);
    const targetSubjClean = cleanSubject(targetSubjectName);
    const targetTaskName = (targetTask?.name || '').trim().toLowerCase();
    const targetTaskId = targetTask?.id;

    const completed = [];
    for (const subj of subjectsOrCache(allSubjects)) {
      const sClean = cleanSubject(subj.name);
      for (const t of subj.tasks || []) {
        if (!isCompletedResult(t)) continue;

        // Strictly exclude the target task itself
        const tName = (t.name || '').trim().toLowerCase();
        if (
          sClean === targetSubjClean &&
          (t === targetTask ||
            (targetTaskId && t.id === targetTaskId) ||
            (tName && targetTaskName && tName === targetTaskName && t.sequence === targetTask.sequence))
        ) {
          continue;
        }

        const stamp = getTaskChronologicalStamp(t, subj.name);
        if (stamp < targetStamp) completed.push({ subjName: subj.name, task: t, stamp });
      }
    }
    return summarize(completed);
  }

  window.ConnectifyPredictorHistory = { getHistoricalData, getHistoricalDataPriorTo };
})();
