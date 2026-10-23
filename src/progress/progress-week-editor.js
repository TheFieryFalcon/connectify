/**
 * Connectify Progress Chart: school week override editor
 *
 * The "When" cell of a task in the Progress Graph table: the task's week with an edit button, or a
 * week input when no date could be read. Overrides are school weeks of the year, numbered through the term
 * calendar as the Export's term starts are (under Early Easter Term 2 starts at Week 10), saved as "w17"
 * under connectea:time_override:<subject>:<task id or name>; repeated task names each get their own id key.
 * Older bare numbers (10-week terms) are shown as this calendar's week and kept until changed.
 * Exposes window.ConnectifyProgressWeekEditor.
 */
(() => {
  'use strict';

  const createElement = (...args) => window.ConnectifyProgressChart.createElement(...args);
  const thisYear = () => new Date().getFullYear();

  // A saved override as the school week the editor shows ("w10", or an older "11" -> 10 under Early Easter)
  function shownWeek(saved) {
    const order = window.ConnectifyUtils.customWeekOrder(saved);
    const week = order === null ? null : window.ConnectifySchoolTerms.schoolWeek(order);
    return Number.isFinite(week) ? String(week) : '';
  }

  // "Term 1: 1–9, Term 2: 10–20, Term 3: 21–30, Term 4: 31–40" for this year's calendar
  function weekRanges() {
    const terms = window.ConnectifySchoolTerms;
    return terms.terms(thisYear(), terms.earlyEaster(thisYear()))
      .map(t => `Term ${t.term}: ${t.yearWeek}–${t.yearWeek + t.weeks - 1}`).join(', ');
  }

  /** The "When" cell for one task row. */
  function weekCell(point, points, subjectName, onRefresh) {
    const math = window.ConnectifyProgressMath;
    const taskId = point.id;
    const taskName = point.name || '';

    // Check if there are other tasks with the same name in this subject
    const duplicateTasks = points.filter(
      p => (p.name || '').toLowerCase().trim() === taskName.toLowerCase().trim()
    );
    const isDuplicateName = duplicateTasks.length > 1;
    const isFirstOccurrence = !isDuplicateName || (duplicateTasks.length > 0 && duplicateTasks[0] === point);

    // Build specific key using point.id (or sequence if id missing) for duplicate-named tasks
    const disambiguator = taskId || (isDuplicateName && point.sequence !== undefined ? `seq_${point.sequence}` : null);
    const specificKey = disambiguator ? `connectea:time_override:${subjectName}:${disambiguator}` : null;
    const genericKey = `connectea:time_override:${subjectName}:${taskName}`;

    // Retrieve saved custom date:
    // Priority 1: Specific key (exact task instance)
    // Priority 2: Generic key, BUT ONLY for non-duplicates or the first occurrence.
    // This ensures subsequent tasks of the same name (like Row 9 & 10) never inherit the first task's date.
    let savedTime = null;
    if (specificKey) {
      savedTime = localStorage.getItem(specificKey) ||
                  localStorage.getItem(specificKey.replace('connectea:', 'connectify:'));
    }
    if (savedTime === null && isFirstOccurrence && genericKey) {
      savedTime = localStorage.getItem(genericKey) ||
                  localStorage.getItem(genericKey.replace('connectea:', 'connectify:'));
    }

    // Clears this task's override, and the shared name key only when this is the first task of that name
    const removeOverride = () => {
      if (specificKey) {
        localStorage.removeItem(specificKey);
        localStorage.removeItem(specificKey.replace('connectea:', 'connectify:'));
      }
      if (isFirstOccurrence && genericKey) {
        localStorage.removeItem(genericKey);
        localStorage.removeItem(genericKey.replace('connectea:', 'connectify:'));
      }
    };

    const createInputField = (currentVal, showWarning = false) => {
      const wrapper = createElement('div');
      wrapper.style.display = 'flex';
      wrapper.style.flexDirection = 'column';
      wrapper.style.gap = '4px';

      if (showWarning) {
        const example = window.ConnectifyProgressMath.formatTimestamp(window.ConnectifySchoolTerms.weekOrder(17));
        const msg = createElement('small', `No date detected. Enter school week (e.g. 17 for ${example}):`, 'cx-date-warning');
        wrapper.append(msg);
      }

      const inputRow = createElement('div');
      inputRow.style.display = 'flex';
      inputRow.style.gap = '4px';
      inputRow.style.alignItems = 'center';

      const input = createElement('input');
      input.type = 'number';
      input.min = '1';
      input.max = '40';
      input.placeholder = 'Week (e.g. 17)';
      input.title = `School week of the year: ${weekRanges()}`;
      input.style.width = '110px';
      if (currentVal) input.value = currentVal;
      const initialVal = currentVal || '';

      const saveValue = (val) => {
        const targetKey = isDuplicateName && specificKey ? specificKey : (specificKey || genericKey);
        if (val) {
          localStorage.setItem(targetKey, `w${val}`);
        } else {
          removeOverride();
        }
      };

      let committed = false;
      const commit = () => {
        if (committed) return;
        committed = true;
        clearTimeout(window._cxTimeRefresh);
        if (typeof onRefresh === 'function') onRefresh();
      };

      input.addEventListener('input', () => {
        const val = input.value.trim();
        saveValue(val);

        // Avoid premature kick-out / auto-refresh while actively focused and typing.
        // Programmatic/headless inputs (document.activeElement !== input) can refresh after debounce.
        clearTimeout(window._cxTimeRefresh);
        if (document.activeElement !== input) {
          window._cxTimeRefresh = setTimeout(() => {
            commit();
          }, 600);
        }
      });

      input.addEventListener('blur', () => {
        commit();
      });

      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          if (document.activeElement === input && typeof input.blur === 'function') {
            input.blur();
          }
          commit();
        } else if (e.key === 'Escape') {
          e.preventDefault();
          input.value = initialVal;
          // The override as it was saved (an older bare number keeps its own meaning)
          if (savedTime) localStorage.setItem(isDuplicateName && specificKey ? specificKey : (specificKey || genericKey), savedTime);
          else removeOverride();
          if (document.activeElement === input && typeof input.blur === 'function') {
            input.blur();
          }
          commit();
        }
      });

      inputRow.append(input);
      if (currentVal) {
        const clearBtn = createElement('button', '✕', 'cx-time-clear-btn');
        clearBtn.type = 'button';
        clearBtn.title = 'Clear custom time override';
        clearBtn.style.padding = '0 4px';
        clearBtn.style.cursor = 'pointer';
        clearBtn.onmousedown = (e) => {
          if (e && typeof e.preventDefault === 'function') e.preventDefault();
        };
        clearBtn.onclick = () => {
          committed = true;
          clearTimeout(window._cxTimeRefresh);
          removeOverride();
          if (typeof onRefresh === 'function') onRefresh();
        };
        inputRow.append(clearBtn);
      }

      wrapper.append(inputRow);
      return wrapper;
    };

    if (Number.isFinite(point.order)) {
      const text = math.formatTimestamp(point.order, point.caption);
      const containerSpan = createElement('span');
      containerSpan.style.display = 'inline-flex';
      containerSpan.style.alignItems = 'center';
      containerSpan.style.gap = '6px';
      containerSpan.append(createElement('span', text));

      const editBtn = createElement('button', '✏️', savedTime !== null ? 'cx-time-edit-btn' : 'cx-time-edit-btn cx-time-edit-btn--unconfigured');
      editBtn.type = 'button';
      const editLabel = savedTime !== null ? `Custom week ${shownWeek(savedTime)} (click to change)` : 'Edit date (set custom week)';
      editBtn.setAttribute('aria-label', editLabel);
      editBtn.title = editLabel;
      editBtn.style.background = 'none';
      editBtn.style.border = 'none';
      editBtn.style.cursor = 'pointer';
      editBtn.style.fontSize = '12px';
      editBtn.style.padding = '0';
      editBtn.onclick = () => {
        const inputWrapper = createInputField(shownWeek(savedTime), false);
        if (typeof containerSpan.replaceWith === 'function') {
          containerSpan.replaceWith(inputWrapper);
        } else if (containerSpan.parentElement) {
          containerSpan.parentElement.replaceChild(inputWrapper, containerSpan);
        }
        const inputEl = inputWrapper.querySelector('input');
        if (inputEl) {
          if (typeof inputEl.focus === 'function') inputEl.focus();
          if (typeof inputEl.select === 'function') inputEl.select();
        }
      };
      containerSpan.append(editBtn);
      return containerSpan;
    }
    return createInputField(shownWeek(savedTime), true);
  }

  window.ConnectifyProgressWeekEditor = { weekCell };
})();
