/**
 * Connectify ATAR Calculator Engine
 *
 * Course state modeling, scaled score projections, TEA summation,
 * Year 11 TEA scaling adjustments, and score override persistence.
 */
(() => {
  'use strict';

  if (window.ConnectifyAtarCalc) return;

  const account = new URL(location.href).searchParams.get('coisp') || 'current';
  const storageKey = `connectea:atar:2025:${account}:${new Date().getFullYear()}`;
  let savedPreferences = {};

  try {
    const stored = JSON.parse(localStorage.getItem(storageKey) || '{}');
    if (stored && typeof stored === 'object' && !Array.isArray(stored)) {
      savedPreferences = stored;
    }
  } catch {}

  function reloadPreferences() {
    const rawPrefs = localStorage.getItem('connectea:preferences');
    if (rawPrefs) {
      try {
        const parsed = JSON.parse(rawPrefs);
        for (const key in parsed) savedPreferences[key] = parsed[key];
      } catch (e) {}
    }
  }

  function persistPreferences() {
    try {
      localStorage.setItem(storageKey, JSON.stringify(savedPreferences));
    } catch {}
  }

  function resetPreferencesForSemester(semesterCourses, semesterIdx) {
    for (const r of semesterCourses || []) {
      delete savedPreferences[`${semesterIdx}:${r.id}`];
    }
    persistPreferences();
  }

  function getCourseState(row, semesterIdx, coursesList = []) {
    const entry = savedPreferences[`${semesterIdx}:${row.id}`];
    const calibration = savedPreferences[`sem1_calibration:${row.id}`];
    const math = window.ConnectifyMath || {};

    let finalScore;
    if (entry?.score !== undefined) {
      finalScore = entry.score; // Fallback to manual override
    } else if (row.mark !== undefined) {
      const knownSem1Raw = calibration?.raw !== undefined
        ? calibration.raw
        : (semesterIdx === 1 ? coursesList[0]?.find(r => r.id === row.id)?.mark : undefined);
      const knownSem1Scaled = calibration?.scaled;
      if (math.calculateShiftedScaledScore) {
        finalScore = math.calculateShiftedScaledScore(row.name, row.mark, knownSem1Raw, knownSem1Scaled, 2025);
      } else {
        finalScore = row.mark;
      }
    }

    return {
      ...row,
      include: entry?.include ?? row.mark !== undefined,
      score: math.wholeScore ? math.wholeScore(finalScore) : (finalScore !== undefined ? Math.round(finalScore) : undefined)
    };
  }

  function calculateResults(courses) {
    const math = window.ConnectifyMath || {};
    const calculate = math.calculate;
    const convertTEAtoATAR = math.convertTEAtoATAR;
    const round = v => (Number.isFinite(v) ? Math.round(v * 10) / 10 : '—');

    const results = [0, 1].map(i => {
      if (!calculate || !courses[i]) return { error: 'Calculator unavailable' };
      return calculate(courses[i].map(row => getCourseState(row, i, courses)));
    });

    const titles = Array.from(document.querySelectorAll('.eds-c-tile__title')).map(el => el.textContent || '');
    const hasYear12 = titles.some(t => /\b(?:year\s*12|12)\b/i.test(t) || /\bAT[A-Z]{3}\b/.test(t));
    const hasYear11 = titles.some(t => /\b(?:year\s*11|11)\b/i.test(t) || /\bAE[A-Z]{3}\b/.test(t));
    const teaAdjustment = 0; // Year 11 TEA scaling adjustment penalty removed

    return results.map(result => {
      if (!result || result.error) {
        return { ...result, finalTEA: 0, finalAtar: '—', detailText: result?.error || 'Unavailable' };
      }
      const finalTEA = Math.max(0, result.tea + teaAdjustment);
      const finalAtar = convertTEAtoATAR ? convertTEAtoATAR(finalTEA) : '—';
      const detailText =
        `TEA ${round(finalTEA)} = best four ${round(result.base)} + bonuses ${round(
          result.bonus
        )}. Best four: ${result.top.map(x => x.name).join(', ')}.`;

      return {
        ...result,
        finalTEA,
        finalAtar,
        detailText,
        yearLevel
      };
    });
  }

  function renderCourseList(container, courses, activeSemester, onChange) {
    const math = window.ConnectifyMath || {};
    const wholeScore = math.wholeScore || (v => (Number.isFinite(Number(v)) ? Math.round(Number(v)) : undefined));
    const scoreValue = math.scoreValue || (v => {
      const n = Number(v);
      return Number.isFinite(n) ? n : undefined;
    });

    container.replaceChildren();

    const semesterCourses = courses[activeSemester] || [];
    if (!semesterCourses.length) {
      const p = document.createElement('p');
      p.textContent = 'No ATAR subjects found for this semester. Ensure classes are visible in Connect.';
      container.append(p);
      return;
    }

    for (const course of semesterCourses) {
      const entry = savedPreferences[`${activeSemester}:${course.id}`] || {};
      const state = getCourseState(course, activeSemester, courses);

      const wrapper = document.createElement('div');
      wrapper.className = 'cta-course';

      const label = document.createElement('label');
      label.className = 'cta-include';

      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.className = 'connectea-subject-checkbox';
      checkbox.checked = state.include;

      const span = document.createElement('span');
      span.textContent = course.name;
      label.append(checkbox, span);

      const estMark = state.score !== undefined ? state.score : course.mark;

      const input = document.createElement('input');
      input.type = 'number';
      input.className = 'cta-score';
      input.min = '0';
      input.max = '100';
      input.step = 'any';
      input.placeholder = estMark !== undefined ? String(estMark) : '';
      input.value = entry.score !== undefined ? entry.score : '';
      input.disabled = !checkbox.checked;
      input.setAttribute('aria-label', `${course.name} semester ${activeSemester + 1} estimated scaled score`);

      const source = document.createElement('small');
      source.textContent = course.mark === undefined ? 'No school mark' : `School ${Math.round(course.mark * 10) / 10}%`;

      const updateCourse = () => {
        savedPreferences[`${activeSemester}:${course.id}`] = {
          include: checkbox.checked,
          score: scoreValue(input.value)
        };
        input.setAttribute('aria-invalid', String(checkbox.checked && scoreValue(input.value) === undefined));
        persistPreferences();
        if (typeof onChange === 'function') onChange();
      };

      checkbox.addEventListener('change', () => {
        updateCourse();
        input.disabled = !checkbox.checked;
      });

      input.addEventListener('input', updateCourse);
      input.addEventListener('change', () => {
        const score = wholeScore(input.value);
        if (score !== undefined) {
          input.value = score;
          updateCourse();
        }
      });

      wrapper.append(label, input, source);
      container.append(wrapper);
    }
  }

  window.ConnectifyAtarCalc = {
    getPreferences: () => savedPreferences,
    reloadPreferences,
    persistPreferences,
    resetPreferencesForSemester,
    getCourseState,
    calculateResults,
    renderCourseList
  };
})();
