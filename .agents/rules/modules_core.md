---
trigger: always_on
---

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
- **Submodules**:
  - [`assessment-cache.js`](file:///Users/uwong/Downloads/2.1.14_0/src/assessment/assessment-cache.js): In-memory `subjectsCache` and persistent stats cache (`connectify:stats_cache:`, `connectify:subjects_cache:`).
  - [`assessment-parser.js`](file:///Users/uwong/Downloads/2.1.14_0/src/assessment/assessment-parser.js): Parses card metadata, task rows, marks, syllabus weights, and chronological order hints.
  - [`assessment-expand.js`](file:///Users/uwong/Downloads/2.1.14_0/src/assessment/assessment-expand.js): Paced accordion expansion (`expandAll`), deduplication by card container, re-entrancy protection, and non-blocking chunked finalization (90% -> 95% -> 98% -> 100%).
- **Key Functions**:
  - `collect(includePending)`: Scrapes all cards; caches results in `subjectsCache` (Map) to prevent data loss on collapse.
  - `triggerAccordionAnimationGuard(duration)`: Sets `window.ConnectifyIsAccordionAnimating` (450ms) to mute background observers.
  - `ConnectifyCache`: Subsystem cache manager (`VERSIONS`, `KEYS`, `clearPredictorCache`, `clearResultsCache`, `clearSettingsCache`, `clearCohortCache`, `checkAndInvalidateAll`).
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

#### [`cohort-estimator.js`](file:///Users/uwong/Downloads/2.1.14_0/src/cohort/cohort-estimator.js) (314 lines)
- **Role**: Dynamically estimates cohort sizes per subject using course baselines, user-configured general cohort size and ATAR percentage, and empirical boxplot IQR spreads.
- **Key Functions**:
  - `subjectKey(card)`: Constructs a unique key scoped by student ID, year, and subject name.
  - `estimateCohortSize(card)`: Computes subject-specific baseline sizes (scaled from General Cohort Size, default 500, and ATAR percentage, default 60%) and refines them using observed IQR ratios ($\text{range} / \text{IQR}$).
  - `loadCohortSize(key)` / `saveCohortSize(key, size)`: Manages user overrides for specific classes in `localStorage`.
- **Export**: `window.ConnectifyCohortEstimator`.

#### [`cohort-view.js`](file:///Users/uwong/Downloads/2.1.14_0/src/cohort/cohort-view.js) & Submodules
- **Role**: Creates and updates the DOM UI for assessment statistics panels and assessment type selector dropdowns.
- **Submodules**:
  - [`cohort-outcome.js`](file:///Users/uwong/Downloads/2.1.14_0/src/cohort/cohort-outcome.js): Evaluates outcome meter segments (0..5), renders 18px x 56px multi-tier outcome bar, and handles secret purple breakout ($> 1.10 \times \text{High}$) with singleton floating tooltip.
  - [`cohort-panel.js`](file:///Users/uwong/Downloads/2.1.14_0/src/cohort/cohort-panel.js): Injects `.connectea-panel`, `.connectea-row-wrapper`, and `.connectea-type-select` DOM nodes.
- **Key Functions**:
  - `readMark(row)`: Parses raw percentage score from `.cvr-c-task__mark` (supporting `%` and `X Out of Y`).
  - `readStats(row)`: Reads boxplot quantiles from DOM dataset bridge or Highcharts instance.
  - `render(...)`: Renders distribution text, $z$-score, standing, rank, and outcome bar. Memoizes row render state (`ui._memo`) to eliminate scroll jank.
- **Export**: `window.ConnectifyCohortView`.

#### [`cohort-stats.js`](file:///Users/uwong/Downloads/2.1.14_0/src/cohort/cohort-stats.js) & Submodules
- **Role**: Controller managing styling, DOM observation, pass scheduling, and page lifecycle.
- **Submodules**:
  - [`cohort-styles.js`](file:///Users/uwong/Downloads/2.1.14_0/src/cohort/cohort-styles.js): Injects component CSS (`#connectea-style`) and handles style helper utilities.
- **Key Functions**:
  - `pass()`: Two-pass coordinator that unifies best cohort estimates across Semester 1 and 2 cards, then renders statistics on each task row. Caches `card._cxTaskRows` to eliminate quadratic DOM queries.
  - `schedule(immediate)`: Trailing debounced runner (120ms) using `requestAnimationFrame` to prevent frame drops during scrolling.
  - `MutationObserver`: Watches `.cvr-c-task` rows and Highcharts attribute mutations.
- **Export**: `window.ConnectifyCohort`.

---

### Assessment Types & Categorization

#### [`task-types.js`](file:///Users/uwong/Downloads/2.1.14_0/src/cohort/task-types.js) (262 lines)
- **Role**: Manages assessment categories (Exam, Test, Application, Essay, Take-Home), student overrides, dynamic category colors, and cross-semester class custom categories.
- **Key Functions**:
  - `categorizeTask(taskName, allLabels)`: Matches keywords against category definitions. Defaults to `'Take-Home'`.
  - `saveTaskTypeOverride(subjectName, taskName, labelsKey, type)`: Updates task category override and synchronizes prediction cache.
  - `getEffectiveType(subjectName, task, labelsKey)`: Returns student manual override if set, otherwise returns automated categorization.
  - `getCustomCategoriesForClass(subjectName)` / `addCustomCategoryForClass(subjectName, categoryName)`: Persists custom categories per class so they appear in all assessment dropdowns in that class across Semesters 1 and 2.
  - `updateTypeSelect(select, ...)`: Updates the `<select class="connectea-type-select">` options and marks overridden selections.
  - `rescanAllAutoAssessments()`: Re-categorizes all assessments set to Auto when categories or keywords change and updates the prediction cache.
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
  - `calculate(rows, options)`: Selects top 4 ATAR subjects, computes base TEA, adds top two 10% bonuses (capped at 2 subjects), and returns estimated ATAR. Supports `fixedBonus` option.
  - `calculateShiftedScaledScore(name, liveRawMark, knownSem1Raw, knownSem1Scaled, year)`: Calibrates base TISC scaled score model using school Semester 1 calibration data ($\text{shift} = \text{actualScaled} - \text{modelScaled}$).
- **Export**: `window.ConnectifyMath`.

#### [`target-solver.js`](file:///Users/uwong/Downloads/2.1.14_0/src/atar/target-solver.js) (304 lines)
- **Role**: Mathematical optimization solver for Target ATAR and Target Grade projections.
- **Key Functions**:
  - `parseAssessment(rawScore, weightedMark, name)`: Validates and parses raw marks, weights, and pending status.
  - `taskProgress(tasks, mark, semesterNumber)`: Computes earned weight, remaining weight, and completed average.
  - `gradePlan(progress, target, options)`: Solves uniform or category difficulty-weighted percentage required on remaining tasks.
  - `targetPlan(rows, target, options)`: Solves required scores across remaining assessments to hit target ATAR. Supports difficulty-weighted optimization and holds current TEA bonus fixed.
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
