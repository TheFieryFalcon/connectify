/**
 * Connectify Semester 1 Scaling Calibration
 *
 * Implements the Semester 1 scaled scores calibration table editor in Settings,
 * allowing students to calibrate TISC scaling projections against their school's
 * actual historical distribution.
 * Provides `window.ConnectifyCalibration`.
 */
(() => {
  'use strict';

  if (window.ConnectifyCalibration) return;

  function renderCalibTable(panel) {
    const table = panel.querySelector('#cx-calibration-table');
    if (!table) return;
    table.innerHTML = '';

    const readCoursesFn = window.ConnectifyAtar?.readCourses;
    let courses = null;
    if (readCoursesFn) {
      courses = readCoursesFn(false);
    }

    const courseList = new Map();
    if (courses) {
      for (const course of [...(courses[0] || []), ...(courses[1] || [])]) {
        if (course.name && !courseList.has(course.id || course.name)) {
          courseList.set(course.id || course.name, course);
        }
      }
    }
    if (courseList.size === 0 && window.ConnectifyData?.collect) {
      const collected = window.ConnectifyData.collect(true);
      collected.forEach(c => {
        if (c.name && !courseList.has(c.name)) {
          courseList.set(c.name, { id: c.name.toLowerCase(), name: c.name, mark: c.score });
        }
      });
    }

    if (courseList.size === 0) {
      table.innerHTML = '<div style="font-size:12px;color:#8fa6bd;grid-column:1/-1;">Expand course outlines in Connect to load subjects for calibration.</div>';
      return;
    }

    const hSubject = document.createElement('span');
    hSubject.textContent = 'Subject';
    hSubject.style.fontSize = '11px';
    hSubject.style.fontWeight = '700';
    hSubject.style.color = '#788896';

    const hRaw = document.createElement('span');
    hRaw.textContent = 'Sem 1 Raw (%)';
    hRaw.style.fontSize = '11px';
    hRaw.style.fontWeight = '700';
    hRaw.style.color = '#788896';

    const hScaled = document.createElement('span');
    hScaled.textContent = 'Sem 1 Scaled';
    hScaled.style.fontSize = '11px';
    hScaled.style.fontWeight = '700';
    hScaled.style.color = '#788896';

    table.append(hSubject, hRaw, hScaled);

    const prefsStr = localStorage.getItem('connectea:preferences');
    const savedPrefs = prefsStr ? JSON.parse(prefsStr) : {};

    for (const course of courseList.values()) {
      const calibEntry = savedPrefs[`sem1_calibration:${course.id}`] || savedPrefs[`sem1_calibration:${course.name}`] || {};
      const knownSem1Raw = calibEntry.raw !== undefined ? calibEntry.raw : (course.mark !== undefined ? Math.round(course.mark * 10) / 10 : '');

      const nameLabel = document.createElement('span');
      nameLabel.textContent = course.name;
      nameLabel.style.fontSize = '12px';
      nameLabel.style.fontWeight = '600';

      const rawInput = document.createElement('input');
      rawInput.type = 'number';
      rawInput.placeholder = 'Raw';
      rawInput.title = 'Semester 1 School Raw Mark (%)';
      rawInput.value = knownSem1Raw !== undefined ? knownSem1Raw : '';
      rawInput.style.width = '85px';
      rawInput.style.padding = '5px 8px';
      rawInput.style.borderRadius = '6px';
      rawInput.style.border = '1px solid #bacddd';
      rawInput.style.boxSizing = 'border-box';

      const scaledInput = document.createElement('input');
      scaledInput.type = 'number';
      scaledInput.placeholder = 'Scaled';
      scaledInput.title = 'Semester 1 School Scaled Mark';
      scaledInput.value = calibEntry.scaled !== undefined ? calibEntry.scaled : '';
      scaledInput.style.width = '85px';
      scaledInput.style.padding = '5px 8px';
      scaledInput.style.borderRadius = '6px';
      scaledInput.style.border = '1px solid #bacddd';
      scaledInput.style.boxSizing = 'border-box';

      table.append(nameLabel, rawInput, scaledInput);

      const updateCalib = () => {
        const currentPrefsStr = localStorage.getItem('connectea:preferences');
        const prefs = currentPrefsStr ? JSON.parse(currentPrefsStr) : {};
        const key = `sem1_calibration:${course.id}`;
        prefs[key] = {
          raw: rawInput.value !== '' ? Number(rawInput.value) : undefined,
          scaled: scaledInput.value !== '' ? Number(scaledInput.value) : undefined
        };
        if (course.name && course.name !== course.id) {
          prefs[`sem1_calibration:${course.name}`] = prefs[key];
        }
        localStorage.setItem('connectea:preferences', JSON.stringify(prefs));
        window.dispatchEvent(new CustomEvent('connectify-settings-updated'));
      };

      rawInput.addEventListener('input', updateCalib);
      scaledInput.addEventListener('input', updateCalib);
    }
  }

  window.ConnectifyCalibration = {
    renderCalibTable
  };
})();
