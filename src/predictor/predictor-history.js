/**
 * Connectify Predictor: historical performance
 *
 * Averages completed results per subject and per assessment type (with spread), the history every
 * task prediction is built from, overall or only from results before a given task. Exposes window.ConnectifyPredictorHistory.
 */
(() => {
  'use strict';

  const round = (...args) => window.ConnectifyPredictorEngine.round(...args);
  const cleanSubject = (...args) => window.ConnectifyPredictorEngine.cleanSubject(...args);
  const getTaskChronologicalStamp = (...args) => window.ConnectifyPredictorDates.getTaskChronologicalStamp(...args);

  // --- HISTORICAL PERFORMANCE SCRAPER ---
  function getHistoricalData(subjectList) {
    const subjects = subjectList || (window.ConnectifyData?.collect ? window.ConnectifyData.collect(true) : []);
    const subjectStats = {};
    const typeStats = {};
    const typeCounts = {};
    let totalScoreWeight = 0;
    let totalWeight = 0;
    const allTaskScores = [];

    for (const subj of subjects) {
      const cleanName = cleanSubject(subj.name);
      if (!subjectStats[cleanName]) {
        subjectStats[cleanName] = { earned: 0, weight: 0, tasks: [] };
      }

      for (const t of subj.tasks || []) {
        if (t.weight > 0 && !t.pending && Number.isFinite(t.score)) {
          const earned = (t.score / 100) * t.weight;
          subjectStats[cleanName].earned += earned;
          subjectStats[cleanName].weight += t.weight;
          subjectStats[cleanName].tasks.push(t.score);
          allTaskScores.push(t.score);

          const taskType = window.ConnectifyTaskTypes?.getEffectiveType
            ? window.ConnectifyTaskTypes.getEffectiveType(subj.name, t)
            : 'Take-Home';

          if (!typeStats[taskType]) {
            typeStats[taskType] = { earned: 0, weight: 0 };
            typeCounts[taskType] = 0;
          }
          typeStats[taskType].earned += earned;
          typeStats[taskType].weight += t.weight;
          typeCounts[taskType]++;

          totalScoreWeight += earned;
          totalWeight += t.weight;
        }
      }
    }

    const subjectAverages = {};
    const subjectSpreads = {};
    for (const [name, data] of Object.entries(subjectStats)) {
      if (data.weight > 0) {
        subjectAverages[name] = round((data.earned / data.weight) * 100, 2);
      }
      if (data.tasks.length >= 2 && subjectAverages[name] !== undefined) {
        const mean = subjectAverages[name];
        const sumSq = data.tasks.reduce((acc, s) => acc + Math.pow(s - mean, 2), 0);
        subjectSpreads[name] = Math.sqrt(sumSq / (data.tasks.length - 1));
      }
    }

    const typeAverages = {};
    for (const [type, data] of Object.entries(typeStats)) {
      if (data.weight > 0) {
        typeAverages[type] = round((data.earned / data.weight) * 100, 2);
      }
    }

    const overallAverage = totalWeight > 0 ? round((totalScoreWeight / totalWeight) * 100, 2) : null;

    // Calculate empirical score standard deviation across completed tasks
    let scoreVariance = 0;
    if (allTaskScores.length >= 3 && overallAverage !== null) {
      const sumSq = allTaskScores.reduce((acc, s) => acc + Math.pow(s - overallAverage, 2), 0);
      scoreVariance = Math.sqrt(sumSq / (allTaskScores.length - 1));
    }
    const spread = Math.min(9.0, Math.max(4.0, scoreVariance > 0 ? scoreVariance : 6.5));

    return {
      subjects: subjectAverages,
      subjectSpreads,
      types: typeAverages,
      typeCounts,
      overallAverage,
      spread,
      totalCompletedTasks: allTaskScores.length
    };
  }


  function getHistoricalDataPriorTo(allSubjects, targetSubjectName, targetTask) {
    const rawSubjects = allSubjects || (window.ConnectifyData?.collect ? window.ConnectifyData.collect(true) : []);
    const targetStamp = getTaskChronologicalStamp(targetTask, targetSubjectName);
    const targetSubjClean = cleanSubject(targetSubjectName);
    const targetTaskName = (targetTask?.name || '').trim().toLowerCase();
    const targetTaskId = targetTask?.id;

    const priorCompletedTasks = [];
    for (const subj of rawSubjects) {
      const sName = subj.name;
      const sClean = cleanSubject(sName);
      for (const t of subj.tasks || []) {
        if (t.pending || !Number.isFinite(t.score) || !(t.weight > 0)) continue;

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

        const tStamp = getTaskChronologicalStamp(t, sName);
        if (tStamp < targetStamp) {
          priorCompletedTasks.push({ subjName: sName, task: t });
        }
      }
    }

    const subjectStats = {};
    const typeStats = {};
    const typeCounts = {};
    let totalScoreWeight = 0;
    let totalWeight = 0;
    const allTaskScores = [];

    for (const { subjName, task } of priorCompletedTasks) {
      const cleanName = cleanSubject(subjName);
      if (!subjectStats[cleanName]) {
        subjectStats[cleanName] = { earned: 0, weight: 0, tasks: [] };
      }
      const earned = (task.score / 100) * task.weight;
      subjectStats[cleanName].earned += earned;
      subjectStats[cleanName].weight += task.weight;
      subjectStats[cleanName].tasks.push(task.score);
      allTaskScores.push(task.score);

      const taskType = window.ConnectifyTaskTypes?.getEffectiveType
        ? window.ConnectifyTaskTypes.getEffectiveType(subjName, task)
        : 'Take-Home';

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
    for (const [name, data] of Object.entries(subjectStats)) {
      if (data.weight > 0) {
        subjectAverages[name] = round((data.earned / data.weight) * 100, 2);
      }
      if (data.tasks.length >= 2 && subjectAverages[name] !== undefined) {
        const mean = subjectAverages[name];
        const sumSq = data.tasks.reduce((acc, s) => acc + Math.pow(s - mean, 2), 0);
        subjectSpreads[name] = Math.sqrt(sumSq / (data.tasks.length - 1));
      }
    }

    const typeAverages = {};
    for (const [type, data] of Object.entries(typeStats)) {
      if (data.weight > 0) {
        typeAverages[type] = round((data.earned / data.weight) * 100, 2);
      }
    }

    const overallAverage = totalWeight > 0 ? round((totalScoreWeight / totalWeight) * 100, 2) : null;

    let scoreVariance = 0;
    if (allTaskScores.length >= 3 && overallAverage !== null) {
      const sumSq = allTaskScores.reduce((acc, s) => acc + Math.pow(s - overallAverage, 2), 0);
      scoreVariance = Math.sqrt(sumSq / (allTaskScores.length - 1));
    }
    const spread = Math.min(9.0, Math.max(4.0, scoreVariance > 0 ? scoreVariance : 6.5));

    return {
      subjects: subjectAverages,
      subjectSpreads,
      types: typeAverages,
      typeCounts,
      overallAverage,
      spread,
      totalCompletedTasks: allTaskScores.length
    };
  }

  window.ConnectifyPredictorHistory = { getHistoricalData, getHistoricalDataPriorTo };
})();
