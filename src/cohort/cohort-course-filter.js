/**
 * Connectify Cohort: ignore Certificate and General courses
 *
 * The Settings option (connectify:hide_course_stats, on by default, 'false' once turned off) leaves every class with
 * Certificate, Cert or General in its name as Connect drew it: no statistics or prediction panels, Type dropdowns,
 * meters or goal bars on its rows, and no restored overall row. It is also no option in any Connectify tool: every list
 * tools read (collectClasses, readCourses) and Jump To leave it out. Exposes window.ConnectifyCourseFilter.
 */
(() => {
  'use strict';

  const KEY = 'connectify:hide_course_stats';
  const COURSE = /\b(?:certificate|cert|general)\b/i;
  const CARD = '.eds-c-tile, .cvr-c-tile, [data-subject-card], .c-tile';
  const TITLE = '.eds-c-tile__title, .cvr-c-tile__title, [class*="tile__title"], [class*="card-title"], h1, h2, h3, h4, .c-tile__title, .eds-c-heading';
  const OWN_UI = '.connectea-row-wrapper, .connectea-panel, .connectea-subject-average-row, .connectea-xp-fit-probe';

  function isEnabled() {
    try {
      return localStorage.getItem(KEY) !== 'false';
    } catch {
      return true;
    }
  }

  function save(enabled) {
    try { localStorage.setItem(KEY, enabled ? 'true' : 'false'); } catch {}
  }

  const matches = title => COURSE.test(title || '');

  /** Whether a class of this name is left out, with the option on. */
  const ignores = name => isEnabled() && matches(name);

  /** Whether this card's rows stay as Connect drew them. */
  const hides = card => ignores(card.querySelector(TITLE)?.textContent);

  const hidesRow = row => {
    const card = row.closest(CARD);
    return Boolean(card) && hides(card);
  };

  /** Subjects (collect() records) without the ignored classes. */
  const filterSubjects = subjects => (isEnabled() && Array.isArray(subjects) ? subjects.filter(s => !matches(s?.name)) : subjects);

  /** readCourses() [[Semester 1], [Semester 2]] without the ignored classes. */
  const filterCourses = courses => (isEnabled() && Array.isArray(courses) ? courses.map(list => (list || []).filter(c => !matches(c.name))) : courses);

  /** Removes what Connectify added to a card's rows (the option was turned on with the outlines open). */
  function clear(card) {
    card.querySelectorAll(OWN_UI).forEach(el => el.remove());
  }

  window.ConnectifyCourseFilter = { KEY, isEnabled, save, matches, ignores, hides, hidesRow, filterSubjects, filterCourses, clear };
})();
