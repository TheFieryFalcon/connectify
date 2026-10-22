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
  - `assessment-parse-helpers.js` / `assessment-parser.js`: order hints, cohort mean, weighted mean, `taskSemester` (Semester 1 = before Term 2 Week 7, order < 19; Semester 2 panels list Semester 1 tasks too); card metadata, task rows, marks and weights.
  - `class-semesters.js`: class registry per semester (each card read once, re-read when scraped); `detectSemester()` (2 only once a class shows a final A–E grade; marks never count, as Semester 2 panels list the Semester 1 tasks and a cumulative percent from day one; a page showing only some known classes, e.g. a Connect filter, proves only Semester 2, else the registry decides); a wholly new class set goes to `ConnectifyYearRollover.handleClassChange` first.
  - `semester-filter.js`: "Show this semester's classes only" (off by default; always the detected semester): other semester's tiles get `.cx-semester-hidden` (only changed tiles are written), only allowed cards refresh the cache (the other semester stays frozen), `filterSubjects` / `filterCourses` for tools. When every outline in view is hidden, `semester-filter-notice.js` puts `#cx-semester-notice` before the first one (an empty state: no panel, theme ink, "← Back to All" whenever Connect's top-level All filter is present).
  - `assessment-expand-progress.js`: `#cx-expand-progress` pill and scroll freeze (`start()` → `{ update, finish }`).
  - `assessment-accordion-watch.js`: single-accordion animation guard (450ms) and refresh of the opened card.
  - `assessment-expand.js`: paced `expandAll` (one heading per card, 65ms apart), instant collapse, staged finalization (90% -> 95% -> 98% -> 100%); every exit cancels its own 10s safety timer.
  - `assessment-scrape.js`: per-card task scraping and chronological order resolution. Cohort statistics survive scraping before charts are stamped: a cached task missing `mean`/`stats` is filled from a later read, a same-id copy without them keeps the cached ones, and `formatCollectedSubjects` derives a missing mean from the task's boxplot or the stats cache (frozen hidden-semester tasks too).
- **Key Functions**:
  - `collect(includePending)`: Records the class registry, then scrapes cards (only the semester filter's allowed cards; a stale class on a hidden card never forces a full read); caches results in `subjectsCache` (Map) to prevent data loss on collapse. A warm cache is used without DOM reads, except expanded cards never read (row count differs from the last scrape, `needsScrape`), so subjects opened by Expand All join a cache that already held others; Expand All re-collects 200ms after finishing.
  - `triggerAccordionAnimationGuard(duration)`: Sets `window.ConnectifyIsAccordionAnimating` (450ms) to mute background observers.
  - `collectClasses(includePending)`: `collect()` through `filterSubjects`; every sidebar tool (Predictor, Weakness, Progress, Settings) reads this, page features use `collect()`.
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
- **Role**: Renders each task row's statistics panel (prediction panel when unmarked), `Type:` dropdown and outcome meter.
- **Submodules** (manifest order):
  - `cohort-outcome.js`: outcome meter segments (0..5), 18px x 56px bar, secret purple breakout ($> 1.10 \times \text{High}$), singleton tooltip.
  - `cohort-row-readers.js` (`ConnectifyCohortRows`): `readMark(row)` (`%` and `X Out of Y`), `readStats(row)` (dataset bridge, then Highcharts, then stats cache), DOM helpers.
  - `cohort-panel.js`: `.connectea-panel`, `.connectea-row-wrapper`, `'Type: '` dropdown, cohort size input and `noticeText()`.
  - `cohort-outcome-eval.js`: builds the predictor task from a row (semester, row position, week override, weight); hides the meter on a subject's first marked result (no earlier marked task row, from its own `card._cxDetailRows`: cohort-stats' `_cxTaskRows` holds the overall row, whose mark never counts; for a Semester 2 task no marked Semester 1 result) without a numeric subject baseline; `precacheUpcoming` returns an unmarked row's prediction (cached, else computed and cached).
  - `cohort-forecast.js` (`ConnectifyCohortForecast`): unmarked rows show a one-line `.connectea-panel.connectea-forecast` before the Type dropdown (Low • **Mid** • High in the Predictor pills' colours for light, dark and light-tone themes, Low and High semibold (600) under the 700 Mid; or what the prediction needs; breakout never shown; styles in `cohort-forecast.css`); hidden once marked. A row without a prediction yet sets `_memo.retry`, so the next pass re-evaluates it.
  - `cohort-upcoming.js` (`ConnectifyCohortUpcoming`): the overall row of a class with no final A–E letter shows the class's predicted final mark (`.connectea-panel.connectea-upcoming`, Low • Mid • High to 1 decimal place from `projectSubjectGrades`, or what it needs); hidden once a letter shows; `signature()` (letter state and task marks) joins the overall row's memo (`pendingSig`). Styles: `cohort-upcoming.css`.
  - `cohort-subject-average.js` (`ConnectifyCohortSubjectAverage`): Connect sometimes renders a card's "Semester N Cumulative Percent" heading with an empty container under it (Economics, with or without Connectify; a dropped class with no marks also has one and is left alone). `sync(card)` (first thing in `pass()` per card) fills Connect's container (`summarySlot`: the `.v-csslayout` after the heading) with `.connectea-subject-average-row`, a row in Connect's native summary markup (two `.cvr-c-task__mark` cells, percent to 1 decimal place, no chart: Connect gives no cohort data) plus a note that Connectify worked it out: the weight-weighted mean of the marked task rows (percent x what the weighted-mark cell is out of; plain mean when a weight is missing), or of the cached tasks up to the card's semester while collapsed. The overall panel, class prediction, registry and grade snapshot read it like Connect's row; it is removed once Connect renders its own. Observer ignores it as Connectify's own node; note styles in `cohort-subject-average.css`.
  - `cohort-panel-view.js` (`ConnectifyPanelView`) / `cohort-expanded.js` (`ConnectifyCohortExpanded`): Settings "Statistics Panels" (`connectify:panel_view`, read once per load): `compact` (default), `subjects` (overall rows) or `all`. An expanded panel is a wide, short card (`.connectea-panel--expanded`, `<dl>` cells, never `.v-label`): one row of Score / Rank / Average and Minimum / Lower Quartile / Median / Upper Quartile / Maximum with the meter at its end (`.connectea-xp-stats`, one column grid shared by rows via subgrid), then `SD · Z-Score · standing` and the Type dropdown (unavailable values `—`). The highest quantile the result has reached gets `.connectea-xp-cell--reached` (accent 5% tint on `::before`). Overall cards show four quartile cells (`xp.first` 1: Lower Quartile to Maximum; below Q1 the tint stays on Q1), with `Minimum · SD · Z-Score · standing` and the cohort input in the footer; with a class prediction (`.connectea-xp-prediction`, no title, no `.connectea-upcoming` line) Predicted Low / Mid / High sit under wider Score / Rank / Average and the quartile cells sit two by two (head and prediction wrappers `display: contents`, rows via subgrid); unmarked rows are one line (`.connectea-xp-forecast`): Low / Mid / High beside the prediction's `basis`, naming only what fed it ("From your previous-year Exam and Literature averages", "From your 3 previous Exam results and your 5 previous Literature results"). The Score is coloured by `data-cx-score-step` (0–10 from the meter's Low–High, the class projection on overall rows, 5 with neither; `breakout` on task breakouts: brightest plus a static pastel purple glow); the meter tooltip explains it (`SCORE_NOTE`). Styles: `cohort-expanded.css`.
- **Key Functions**: `render(...)`: distribution, $z$-score, standing, rank and outcome bar; memoised per row (`ui._memo`: mark, stats, cohort size, baselines signature, taskType, types version).
- **Export**: `window.ConnectifyCohortView`.

#### [`cohort-stats.js`](file:///Users/uwong/Downloads/2.1.14_0/src/cohort/cohort-stats.js) & Submodules
- **Role**: Controller: styles, pass scheduling and page lifecycle.
- **Submodules**: `cohort-styles.js` (component CSS `#connectea-style`); `cohort-observer.js` (MutationObserver, events, 8s heartbeat, `--cx-display-scale`).
- **Key Functions**:
  - `pass()`: unifies cohort estimates across Semester 1 and 2 cards, then renders every row. Caches `card._cxTaskRows` and `card._cxCohortKey`.
  - `schedule(immediate)`: 250ms trailing debounce into `requestAnimationFrame`; `runPass()` drains queued re-passes.
  - Observer: task rows added, mark text edits inside rows, and stats stamped on charts (`data-connectify-stats`, `data-highcharts-chart`); Connectify's own nodes and accordion animations are ignored. A Type change or baseline save with a prediction refresh queued leaves the pass to `connectify-predictions-updated` (one pass, never one with stale predictions).
- **Export**: `window.ConnectifyCohort`.

---

### Assessment Types & Categorization

#### [`task-types.js`](file:///Users/uwong/Downloads/2.1.14_0/src/cohort/task-types.js) & `task-type-select.js`
- **Role**: Assessment categories (defaults from `category-store.js`: Exam, Test, Application, Essay, Take-Home), student overrides, category colours, and class custom categories shared across Semesters 1 and 2. Categories are read live from `window.cxCategories`, so saved keywords apply at once.
- **Key Functions**:
  - `categorizeTask(taskName, allLabels)`: keyword then regex match on the name, then the labels; defaults to `'Take-Home'`.
  - `saveTaskTypeOverride(...)` / `getEffectiveType(subjectName, task, labelsKey)`: override wins over detection; saving refreshes the prediction cache.
  - `getCustomCategoriesForClass` / `addCustomCategoryForClass`: per-class custom categories. Names failing `ConnectifyCategoryStore.isCategoryName` (blank, `undefined`, `null`) are never stored or listed, and such an override reads as Auto.
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

#### [`atar-scraper.js`](file:///Users/uwong/Downloads/2.1.14_0/src/atar/atar-scraper.js)
- **Role**: ATAR courses for the sidebar tools, from the centralized cache only.
- **Key Functions**:
  - `isAtarEligible()`: Year 11/12 or ATAR in registry class titles, else the page text.
  - `readCourses(atarOnly)`: `collect(true)`, then `[Semester1Courses, Semester2Courses]` from the class registry (mark, final letter, each outline's own tasks from the subjects cache) plus grade-cache classes; passed through `filterCourses`.
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
