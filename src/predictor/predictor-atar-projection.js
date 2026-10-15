/**
 * Connectify Predictor: ATAR projection
 *
 * Projects low / mid / high subject marks to scaled scores, a TEA and an ATAR.
 * Exposes window.ConnectifyPredictorProjection.projectATAR.
 */
(() => {
  'use strict';

  const engine = () => window.ConnectifyPredictorEngine;
  const round = (...args) => engine().round(...args);
  const getAccountKey = (...args) => engine().getAccountKey(...args);
  const projectSubjectGrades = (...args) => window.ConnectifyPredictorProjection.projectSubjectGrades(...args);

  // --- ATAR PROJECTION AGGREGATOR ---
  function projectATAR(projectedSubjectsList) {
    const math = window.ConnectifyMath;
    if (!math || !math.calculate) {
      return { error: 'Connectify ATAR Math engine not loaded.' };
    }

    const projectedSubjects = projectedSubjectsList || projectSubjectGrades();
    const eligibleCourses = projectedSubjects.filter(s =>
      !/\bGeneral\b|\bmathematics essentials?\b/i.test(s.cleanName)
    );

    if (eligibleCourses.length < 4) {
      return {
        error: 'At least four ATAR courses are required to project ATAR.',
        eligibleCount: eligibleCourses.length
      };
    }

    let preferences = {};
    try {
      if (window.ConnectifyAtarCalc?.getPreferences) {
        preferences = window.ConnectifyAtarCalc.getPreferences() || {};
      } else {
        const account = getAccountKey();
        const storageKey = `connectea:atar:2025:${account}:${new Date().getFullYear()}`;
        preferences = JSON.parse(localStorage.getItem(storageKey) || '{}');
        const rawPrefs = localStorage.getItem('connectea:preferences');
        if (rawPrefs) {
          preferences = { ...preferences, ...JSON.parse(rawPrefs) };
        }
      }
    } catch {}

    let sem1Courses = [];
    if (window.ConnectifyAtarScraper?.readCourses) {
      try {
        const read = window.ConnectifyAtarScraper.readCourses(true);
        sem1Courses = read[0] || [];
      } catch {}
    }

    const scenarios = ['low', 'mid', 'high'];
    const atarResults = {};

    for (const scenario of scenarios) {
      const coursesForCalc = eligibleCourses.map(course => {
        const rawScore = course.projected[scenario] ?? course.runningMark ?? course.baselineMark;
        const courseId = course.cleanName.toLowerCase();
        const calibration = preferences[`sem1_calibration:${courseId}`];
        const knownSem1Raw = calibration?.raw !== undefined
          ? calibration.raw
          : sem1Courses.find(r => r.id === courseId)?.mark;
        const knownSem1Scaled = calibration?.scaled;

        let scaledScore = rawScore;
        if (math.calculateShiftedScaledScore && Number.isFinite(rawScore)) {
          const shifted = math.calculateShiftedScaledScore(course.cleanName, rawScore, knownSem1Raw, knownSem1Scaled, 2025);
          if (Number.isFinite(shifted)) scaledScore = shifted;
        }

        const roundedScore = math.wholeScore
          ? math.wholeScore(scaledScore)
          : (Number.isFinite(scaledScore) ? Math.round(scaledScore) : undefined);

        return {
          name: course.cleanName,
          id: courseId,
          mark: rawScore !== null && Number.isFinite(rawScore) ? round(rawScore, 1) : rawScore,
          score: roundedScore,
          include: Number.isFinite(roundedScore)
        };
      });

      const res = math.calculate(coursesForCalc);
      const teaAdjustment = 0; // Year 11 TEA scaling adjustment penalty removed

      if (res && !res.error) {
        const finalTEA = Math.max(0, res.tea + teaAdjustment);
        const finalAtar = math.convertTEAtoATAR ? math.convertTEAtoATAR(finalTEA) : '—';
        atarResults[scenario] = {
          atar: finalAtar,
          tea: round(finalTEA, 1),
          baseTEA: round(res.base, 1),
          bonusTEA: round(res.bonus, 1),
          topCourses: res.top || [],
          courses: coursesForCalc,
          yearAdjustment: 0
        };
      } else {
        atarResults[scenario] = {
          atar: '—',
          tea: 0,
          error: res?.error || 'Unable to calculate'
        };
      }
    }

    return {
      low: atarResults.low,
      mid: atarResults.mid,
      high: atarResults.high,
      courses: eligibleCourses
    };
  }

  window.ConnectifyPredictorProjection = { ...window.ConnectifyPredictorProjection, projectATAR };
})();
