# Connectify Core Modules Reference

This document covers data ingestion, cohort distribution math, dynamic cohort size estimation, task categorization, and the core ATAR projection engine.

---

## 2. Module Reference: Core Systems

### Data Ingestion & Cross-World Bridge

#### [`data.js`](file:///Users/uwong/Downloads/2.1.14_0/src/system/data.js) (161 lines)
- **Role**: `MAIN` execution world bridge between Connect's internal `window.Highcharts` instances and the `ISOLATED` world.
- **Key Functions**:
  - `syncChartData(host)`: Extracts 5-number boxplot quantiles (`[min, q1, median, q3, max]`) and sample size `n` from `Highcharts.charts[chartIndex]`.
  - Serializes data onto `host.dataset.connectifyStats` and `host.dataset.connectifyN`.
  - Listens for `'connectify-render-radar'` and `'connectify-destroy-radar'` custom events.
- **DOM Bindings**: `document.documentElement.dataset.connectifyMainBridge = 'ready'`. Debounces `syncAllCharts` via `requestAnimationFrame` and filters chart node additions.

#### [`assessment-data.js`](file:///Users/uwong/Downloads/2.1.14_0/src/assessment/assessment-data.js) & Submodules
- **Role**: Scrapes assessment task rows, scores, weights, dates, and order hints from Connect DOM cards (`.eds-c-tile`), orchestrating submodules and managing persistent stats and subsystem cache invalidations.
- **Submodules** (manifest order):
  - `cache-versions.js`: `ConnectifyCache` versions, keys and isolated per-subsystem clearing; runs `checkAndInvalidateAll()` first.
  - `assessment-cache.js`: in-memory `subjectsCache` and persistent stats cache (`connectify:stats_cache:`, `connectify:subjects_cache:`).
  - `assessment-parse-helpers.js` / `assessment-parser.js`: order hints, cohort mean, weighted mean; card metadata, task rows, marks and weights.
  - `assessment-expand-progress.js`: `#cx-expand-progress` pill and scroll freeze (`start()` → `{ update, finish }`).
  - `assessment-accordion-watch.js`: single-accordion animation guard (450ms) and refresh of the opened card.
  - `assessment-expand.js`: paced `expandAll` (one heading per card, 65ms apart), instant collapse, staged finalization (90% -> 95% -> 98% -> 100%); every exit cancels its own 10s safety timer.
  - `assessment-scrape.js`: per-card task scraping and chronological order resolution.
- **Key Functions**:
  - `collect(includePending)`: Scrapes all cards; caches results in `subjectsCache` (Map) to prevent data loss on collapse. A warm cache is used without DOM reads, except expanded cards never read (row count differs from the last scrape, `needsScrape`), so subjects opened by Expand All join a cache that already held others; Expand All re-collects 200ms after finishing.
  - `triggerAccordionAnimationGuard(duration)`: Sets `window.ConnectifyIsAccordionAnimating` (450ms) to mute background observers.
  - `cancelPendingNotify()`: Expand All drops a queued per-card update before its own statistics pass.
  - `ConnectifyCache`: `VERSIONS`, `KEYS`, `clearPredictorCache`, `clearResultsCache`, `clearSettingsCache`, `clearCohortCache`, `checkAndInvalidateAll`.
- **Export**: `window.ConnectifyData`, `window.ConnectifyCache`.

---

### Cohort Statistics & Rank Estimation

#### [`cohort-math.js`](file:///Users/uwong/Downloads/2.1.14_0/src/cohort/cohort-math.js) (177 lines)
- **Role**: Pure mathematical modeling for cohort distributions.
- **Key Functions**:
  - `percentile(stats, mark, cohortSize)`: Monotone Piecewise Cubic Hermite Interpolation (PCHIP) across the 5 boxplot quantiles with Fritsch-Carlson harmonic interior slopes and clamped boundaries.
  - `summary(stats, mark, cohortSize)`: Calculates weighted mean, integrated interval variance, standard deviation ($SD$), cumulative percentile $p$, estimated rank, and $z$-score.
  - `standing(p)`: Formats standing text (e.g., "Top 5%", "Top of cohort", "Bottom 20%").
- **Export**: `window.ConnectifyCohortMath`.

#### [`cohort-estimator.js`](file:///Users/uwong/Downloads/2.1.14_0/src/cohort/cohort-estimator.js) & `cohort-size-baselines.js`
- **Role**: Cohort size per subject: a sample count on the chart if present, else the typical size for the subject and year level (`cohort-size-baselines.js` table, scaled from General Cohort Size 500 and ATAR 60%), refined by observed IQR ratios ($\text{range} / \text{IQR}$, written only when changed).
- **Key Functions**: `subjectKey(card)` (student, year, subject), `estimateCohortSize(card)`, `loadCohortSize(key)` / `saveCohortSize(key, size)` (per-class overrides).
- **Export**: `window.ConnectifyCohortEstimator`, `window.ConnectifyCohortSizeBaselines`.

#### [`cohort-view.js`](file:///Users/uwong/Downloads/2.1.14_0/src/cohort/cohort-view.js) & Submodules
- **Role**: Renders each task row's statistics panel, `Type:` dropdown and outcome meter.
- **Submodules** (manifest order):
  - `cohort-outcome.js`: outcome meter segments (0..5), 18px x 56px bar, secret purple breakout ($> 1.10 \times \text{High}$), singleton tooltip.
  - `cohort-row-readers.js` (`ConnectifyCohortRows`): `readMark(row)` (`%` and `X Out of Y`), `readStats(row)` (dataset bridge, then Highcharts, then stats cache), DOM helpers.
  - `cohort-panel.js`: `.connectea-panel`, `.connectea-row-wrapper`, `'Type: '` dropdown, cohort size input and `noticeText()`.
  - `cohort-outcome-eval.js`: builds the predictor task from a row (semester, row position, week override, weight); hides the meter on a subject's first marked result (no earlier marked row; for Semester 2 no marked Semester 1 result) without a numeric subject baseline; pre-caches predictions for unmarked rows.
- **Key Functions**: `render(...)`: distribution, $z$-score, standing, rank and outcome bar; memoised per row (`ui._memo`: mark, stats, cohort size, baselines signature, taskType, types version).
- **Export**: `window.ConnectifyCohortView`.

#### [`cohort-stats.js`](file:///Users/uwong/Downloads/2.1.14_0/src/cohort/cohort-stats.js) & Submodules
- **Role**: Controller: styles, pass scheduling and page lifecycle.
- **Submodules**: `cohort-styles.js` (component CSS `#connectea-style`); `cohort-observer.js` (MutationObserver, events, 8s heartbeat, `--cx-display-scale`).
- **Key Functions**:
  - `pass()`: unifies cohort estimates across Semester 1 and 2 cards, then renders every row. Caches `card._cxTaskRows` and `card._cxCohortKey`.
  - `schedule(immediate)`: 250ms trailing debounce into `requestAnimationFrame`; `runPass()` drains queued re-passes.
  - Observer: task rows added, mark text edits inside rows, and stats stamped on charts (`data-connectify-stats`, `data-highcharts-chart`); Connectify's own nodes and accordion animations are ignored.
- **Export**: `window.ConnectifyCohort`.

---

### Assessment Types & Categorization

#### [`task-types.js`](file:///Users/uwong/Downloads/2.1.14_0/src/cohort/task-types.js) & `task-type-select.js`
- **Role**: Assessment categories (defaults from `category-store.js`: Exam, Test, Application, Essay, Take-Home), student overrides, category colours, and class custom categories shared across Semesters 1 and 2. Categories are read live from `window.cxCategories`, so saved keywords apply at once.
- **Key Functions**:
  - `categorizeTask(taskName, allLabels)`: keyword then regex match on the name, then the labels; defaults to `'Take-Home'`.
  - `saveTaskTypeOverride(...)` / `getEffectiveType(subjectName, task, labelsKey)`: override wins over detection; saving refreshes the prediction cache.
  - `getCustomCategoriesForClass` / `addCustomCategoryForClass`: per-class custom categories.
  - `task-type-select.js`: `getTaskMeta(row)`, `updateTypeSelect(select, ...)`, `rescanAllAutoAssessments()` (also on `connectify-rescan-auto-types`, fired when extension storage returns different categories).
- **Export**: `window.ConnectifyTaskTypes`.

---

### ATAR Calculation & Projection Engine

#### [`scaling-data.js`](file:///Users/uwong/Downloads/2.1.14_0/src/atar/scaling-data.js) (2 lines)
- **Role**: Static dataset containing 2025 TISC scaling curve polynomials and percentile-to-scaled-score tables for all WA ATAR courses.
- **Export**: `window.ConnectifyScalingData`.

#### [`atar-math.js`](file:///Users/uwong/Downloads/2.1.14_0/src/atar/atar-math.js) (234 lines)
- **Role**: Calculates ATAR from TEA, computes 10% TEA bonuses, and interpolates TISC scaled scores with school calibration shift.
- **Key Functions**:
  - `convertTEAtoATAR(tea)`: Interpolates aggregate TEA across the published 50-point TISC table (down to `<30` and up to `99.95`).
  - `bonusType(name)`: Detects eligibility for the 10% TEA bonus (Mathematics Methods, Mathematics Specialist, or approved Languages).
  - `calculate(rows, options)`: Selects top 4 ATAR subjects, computes base TEA, adds the TEA bonus, and returns estimated ATAR. Supports `fixedBonus` option.
  - `teaBonus(rows)`: 10% of each of the best two of Methods, Specialist and the best language (also used by the Target ATAR solver).
  - `calculateShiftedScaledScore(name, liveRawMark, knownSem1Raw, knownSem1Scaled, year)`: Calibrates base TISC scaled score model using school Semester 1 calibration data ($\text{shift} = \text{actualScaled} - \text{modelScaled}$).
- **Export**: `window.ConnectifyMath`.

#### [`target-solver.js`](file:///Users/uwong/Downloads/2.1.14_0/src/atar/target-solver.js) & `target-difficulty.js`
- **Role**: Target ATAR and Target Grade solvers.
- **Key Functions**:
  - `parseAssessment(rawScore, weightedMark, name)` / `taskProgress(tasks, mark, semesterNumber)`: parse tasks; earned, remaining and completed weight.
  - `gradePlan(progress, target, { difficultyWeighted, subjectName })`: uniform or difficulty-weighted score needed on remaining tasks (subject name lets type overrides apply).
  - `targetPlan(rows, target, options)`: bisects one effort value across the top four to reach the target ATAR, holding the current TEA bonus fixed.
  - `target-difficulty.js` (`ConnectifyTargetDifficulty`): task baseline = the student's average on that type in the course (else halfway to that type's average across courses, else the course average, clamped 30–99.5); effort $t \in [-1, 1]$ closes $t$ of the gap to 100 or scales the baseline down.
- **Export**: `window.ConnectifyTargetSolver` (also merged into `window.ConnectifyMath`).

#### [`atar-scraper.js`](file:///Users/uwong/Downloads/2.1.14_0/src/atar/atar-scraper.js) (115 lines)
- **Role**: Scrapes course titles, semester cards, assessment tasks, and marks specifically for ATAR calculation.
- **Key Functions**:
  - `isAtarEligible()`: Checks whether student is enrolled in Year 11/12 ATAR subjects across tiles and DOM.
  - `readCourses(atarOnly)`: Reads courses grouped into `[Semester1Courses, Semester2Courses]` from `.eds-c-tile` and `.cvr-c-tile`; falls back to cached tasks for collapsed cards.
  - `scanOutlineDetails()`: Safe no-op complying with Rule 7; users are prompted via explicit "Expand Subject Outlines" buttons.
- **Export**: `window.ConnectifyAtarScraper`.

#### [`atar-calculator.js`](file:///Users/uwong/Downloads/2.1.14_0/src/atar/atar-calculator.js) (201 lines)
- **Role**: State manager for ATAR calculations and score overrides.
- **Key Functions**:
  - `getCourseState(row, semesterIdx, coursesList)`: Returns course inclusion state and score (with manual override or calibrated scaled score).
  - `calculateResults(courses)`: Calculates ATAR for Semester 1 and Semester 2 with -15 TEA adjustment for Year 11 unscaled courses.
  - `renderCourseList(container, courses, activeSemester, onChange)`: Renders list of courses with include checkboxes, manual score inputs, and school mark indicators.
- **Export**: `window.ConnectifyAtarCalc`.

---

*Back to [Overview](file:///Users/uwong/Downloads/2.1.14_0/overview.md)*
