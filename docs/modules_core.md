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
- **Role**: Fills the caches (tasks, scores, weights, dates, order hints, boxplots) from Connect's API records on the outlines page (`.eds-c-tile` cards only when the API is unavailable), orchestrating submodules and managing persistent stats and subsystem cache invalidations.
- **Submodules** (manifest order):
  - `cache-versions.js`: `ConnectifyCache` versions, keys and isolated per-subsystem clearing; runs `checkAndInvalidateAll()` first.
  - `assessment-cache.js`: in-memory `subjectsCache` and persistent stats cache (`connectify:stats_cache:`, `connectify:subjects_cache:`).
  - `school-terms.js` (`ConnectifySchoolTerms`, before the parser in both groups): the generated WA term calendar (see `modules_ui_analytics.md`), `earlyEaster(year)` / `setEarlyEaster` (`connectify:school_terms`, else the export's older choice, else automatic) and `orderOf(date)`: a date's term and week in 12 slots per term (holidays count on from the term before, capped at 12).
  - `assessment-parse-helpers.js` / `assessment-parser.js`: `cardTaskIds(card)` (each row's id: labels and out-of mark, then how many earlier rows share both; the parser and `cohort-outcome-eval.js` both use it, so a row finds its own cached task and prediction; `statsKey`: the stats cache key, the task name or, when an earlier row has the same name, the id, read by the parser, scraper, row readers and spread pool), `readTaskMark`, order hints (`orderHint`: a term/week caption, else `dateOrder`: a date caption's real term and week via `orderOf`; `resolveTaskOrder` re-reads date captions after the week override, so caches and Early Easter changes stay current; week overrides and week captions go through `normalizeOrder`, so a week past its term's end is the next term's (Early Easter: Term 1 Week 10 is Term 2 Week 1), while date captions keep `orderOf`'s holiday weeks), cohort mean, weighted mean, `taskSemester` (the task's own week override, term/week caption or date caption, never the card alone, so a dated Semester 1 task read only from a Semester 2 card stays Semester 1; Semester 2 from canonical school week 17: `semesterTwoOrder()` = `weekOrder(17)`, Term 2 Week 7 (order 19), Week 8 (20) under Early Easter; Semester 2 panels list Semester 1 tasks too); card metadata, task rows, marks and weights.
  - `outline-api.js` (`ConnectifyOutlineApi`): `load()` once per outlines page: `default_student`, `assessmentOutlines` (every class's Semester 1 / 2 groups) and one `assessmentOutlines/chart` per group (quantiles by task id, so a Semester 1 task on a Semester 2 outline gets Semester 1's; rounded to 4 places), POSTs with `X-XSRF-TOKEN` = `CONNECT_XSRF` (Firefox: `content.fetch`); records `{ apiOutline, title, subject, semester, staff, school, statusLine, mark, grade, stats, percent, outlines: [{ code, tasks }] }`; `records`, `version`, `isSettled`, `recordOf(card)` (a record, or a drawn tile's `_cxOutline`); fires `connectify-outlines-loaded` (every tool refreshes) / `-failed`. `drawable()`: the records, else the outlines as far as their boxplots have arrived (rebuilt per chart, `connectify-outlines-preview`; an unchanged record keeps its object, also across a reload), drawn only: caches and startup auto-expand wait for the load. `assessment-api-parse.js` (`ConnectifyApiParse`): labels `[type, when, name]` and mark / weight texts as the old rows showed them, numbered by `assignTaskIds` (shared with `cardTaskIds`), so ids, labels keys and stats keys match the scraped ones; `parse(record, tile)` -> parser tasks (`taskRecord`), `markedIds`, `overallMark`, `hasFinalLetter`. `collect()` rescrapes every record when `version()` changes; scraping a record stores its task boxplots and `Overall S<n>`.
  - `legacy-outlines.js` (`ConnectifyLegacyOutlines`, markup `legacy-outlines-markup.js`): each `cnt-sao-card` Connect shows (its filter menu decides) with a record is drawn again inside `#cx-legacy-outlines` (`.v-app.connect-vr.assessmentoutlinesui`) in Connect's order and Connect's slot gets `.cx-legacy-hidden`; until Connect renders (no `cnt-sao-card` or `cnt-category-bar`; its boxplots load one by one for ~13s) every drawable record is drawn in the API's order into `#ng-zone__student-assessment-outline`; a changed record redraws its tile, held while Expand All runs; Show / Hide Details adds and removes `.eds-c-accordion__panel` (task rows after each group's heading bar); boxplots are SVG with Highcharts' fills (`data-connectify-stats` set); teacher / school clicks go to Connect's own links; `tileFor(record)`.
  - `class-semesters.js`: class registry per semester (each card read once, re-read when scraped); `detectSemester()` (2 only once a class shows a final A–E grade; marks never count, as Semester 2 panels list the Semester 1 tasks and a cumulative percent from day one; a page showing only some known classes, e.g. a Connect filter, proves only Semester 2, else the registry decides); a wholly new class set goes to `ConnectifyYearRollover.handleClassChange` first.
  - `semester-filter.js`: "Show this semester's classes only" (off by default; always the detected semester): other semester's tiles get `.cx-semester-hidden` (only changed tiles are written), only allowed cards refresh the cache (the other semester stays frozen), `filterSubjects` / `filterCourses` for tools. When every outline in view is hidden, `semester-filter-notice.js` puts `#cx-semester-notice` before the first one (an empty state: no panel, theme ink, "← Back to All" whenever Connect's top-level All filter is present).
  - `assessment-expand-progress.js`: `#cx-expand-progress` pill and scroll freeze (`start()` → `{ update, finish }`).
  - `assessment-accordion-watch.js`: single-accordion animation guard (450ms) and refresh of the opened card.
  - `assessment-expand.js`: paced `expandAll` (one heading per card, 65ms apart), instant collapse, staged finalization (90% -> 95% -> 98% -> 100%); every exit cancels its own 10s safety timer.
  - `assessment-scrape.js`: per-card task scraping and chronological order resolution. A name listed twice on one card (each semester's exam "Close reading") is two tasks, told apart by id; a name listed once is still merged with a same-named task from the other outline. Cohort statistics survive scraping before charts are stamped: a cached task missing `mean`/`stats` is filled from a later read, a same-id copy without them keeps the cached ones, and `formatCollectedSubjects` derives a missing mean from the task's boxplot or the stats cache (frozen hidden-semester tasks too).
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
- **Role**: Cohort size per subject: a sample count on the chart if present, else the typical size for the subject and year level (`cohort-size-baselines.js` table, scaled from General Cohort Size 500 and ATAR 60%), refined by the subject's boxplot spreads: baseline $\times \text{clamp}(\overline{\text{range}/\text{IQR}} / 3.2,\ 0.75,\ 1.25)$. The spread pool (`spreadPool(subject)`, both semesters) is seeded from every cached boxplot (`connectify:stats_cache:`) and keyed like that cache (task name, `Overall S1`, a repeated name's id; never Connectify's panel text), so a refreshed page shows its settled estimate at once. With no cached boxplot for a marked row, the subject waits up to `CHART_WAIT_MS` (10s after load) for its charts (`chartsPending(card)`): no estimate, no rank, an empty placeholder; never the plain typical size first.
- **Key Functions**: `subjectKey(card)` (student, year, subject), `observeSpreads(card)`, `estimateCohortSize(card)`, `loadCohortSize(key)` / `saveCohortSize(key, size)` (per-class overrides).
- **Export**: `window.ConnectifyCohortEstimator`, `window.ConnectifyCohortSizeBaselines`.

#### [`cohort-view.js`](file:///Users/uwong/Downloads/2.1.14_0/src/cohort/cohort-view.js) & Submodules
- **Role**: Renders each task row's statistics panel (prediction panel when unmarked), `Type:` dropdown and outcome meter.
- **Submodules** (manifest order):
  - `cohort-outcome.js`: outcome meter segments (0..5), 18px x 56px bar, secret purple breakout ($> 1.10 \times \text{High}$), singleton tooltip.
  - `cohort-row-readers.js` (`ConnectifyCohortRows`): `readMark(row)` (`%` and `X Out of Y`), `readStats(row)` (dataset bridge, then Highcharts, then stats cache), DOM helpers.
  - `cohort-panel.js`: `.connectea-panel`, `.connectea-row-wrapper`, `'Type: '` dropdown, cohort size input and `noticeText()`.
  - `cohort-outcome-eval.js`: builds the predictor task from a row (the parser's id via `cardTaskIds`, semester, row position, week override, weight); hides the meter on a subject's first marked result (no earlier marked task row, from its own `card._cxDetailRows`: cohort-stats' `_cxTaskRows` holds the overall row, whose mark never counts; for a Semester 2 task no marked Semester 1 result) without a numeric subject baseline; `precacheUpcoming` returns an unmarked row's prediction (cached, else computed and cached).
  - `cohort-forecast.js` (`ConnectifyCohortForecast`): unmarked rows show a one-line `.connectea-panel.connectea-forecast` before the Type dropdown (Low • **Mid** • High in the Predictor pills' colours for light, dark and light-tone themes, Low and High semibold (600) under the 700 Mid; or what the prediction needs; breakout never shown; styles in `cohort-forecast.css`); hidden once marked. A row without a prediction yet sets `_memo.retry`, so the next pass re-evaluates it.
  - `cohort-upcoming.js` (`ConnectifyCohortUpcoming`): the overall row of a class with no final A–E letter shows the class's predicted final mark (`.connectea-panel.connectea-upcoming`, Low • Mid • High to 1 decimal place from `projectSubjectGrades`, or what it needs); hidden once a letter shows; `signature()` (letter state and task marks) joins the overall row's memo (`pendingSig`); every subject is projected once per pass (keyed on the pass's collected list), not once per overall row. Styles: `cohort-upcoming.css`.
  - `cohort-subject-average.js` (`ConnectifyCohortSubjectAverage`): Connect sometimes renders a card's "Semester N Cumulative Percent" heading with an empty container under it (Economics, with or without Connectify; a dropped class with no marks also has one and is left alone). `sync(card)` (first thing in `pass()` per card) fills Connect's container (`summarySlot`: the `.v-csslayout` after the heading) with `.connectea-subject-average-row`, a row in Connect's native summary markup (two `.cvr-c-task__mark` cells, percent to 1 decimal place, no chart: Connect gives no cohort data) plus a note that Connectify worked it out: the weight-weighted mean of the marked task rows (percent x what the weighted-mark cell is out of; plain mean when a weight is missing), or of the cached tasks up to the card's semester while collapsed. The overall panel, class prediction, registry and grade snapshot read it like Connect's row; it is removed once Connect renders its own. Observer ignores it as Connectify's own node; note styles in `cohort-subject-average.css`.
  - `cohort-grade-range.js` (`ConnectifyCohortGradeRange`): for a class without a final A–E letter, `forRow(row, mark)` gives `{ low, high }`: Connect's mark with every unmarked weighted task at 0% / 100% (`ConnectifyGradeEstimate.estimate`, the marked tasks as one block), from the cached tasks up to the card's semester (collapsed cards too); null once every task is marked. Expanded overall cards show Lowest / Highest Possible cells closing the row (one column beside the quartiles, which then sit 2x2 with or without a class prediction, so the card fits at 1280px; `cohort-grade-range.css`), compact overall panels end their result line with `Lowest possible X% • Highest possible Y%` (`compactText`); joins the overall row's memo (`rangeSig`).
  - `cohort-panel-view.js` (`ConnectifyPanelView`) / `cohort-expanded.js` (`ConnectifyCohortExpanded`): Settings "Statistics Panels" (`connectify:panel_view`, read once per load): `compact` (default), `subjects` (overall rows) or `all`. An expanded panel is a wide, short card (`.connectea-panel--expanded`, `<dl>` cells, never `.v-label`): one row of Score / Rank / Average and Minimum / Lower Quartile / Median / Upper Quartile / Maximum with the meter at its end (`.connectea-xp-stats`, one column grid shared by rows via subgrid), then `SD · Z-Score · standing` and the Type dropdown (unavailable values `—`). The highest quantile the result has reached gets `.connectea-xp-cell--reached` (accent 5% tint on `::before`); below Q1 the tint stays on Q1 unless the result is at the minimum (task cards then tint Minimum). Overall cards show four quartile cells (`xp.first` 1: Lower Quartile to Maximum; below Q1 the tint stays on Q1), with `Minimum · SD · Z-Score · standing` and the cohort input in the footer; with a class prediction (`.connectea-xp-prediction`, no title, no `.connectea-upcoming` line) Predicted Low / Mid / High sit under wider Score / Rank / Average and the quartile cells sit two by two (head and prediction wrappers `display: contents`, rows via subgrid); unmarked rows are one line (`.connectea-xp-forecast`): Low / Mid / High beside the prediction's `basis`, naming only what fed it, the subject without course type, year level or semester ("From your previous-year Exam and Literature averages", "From your 3 previous Exam results and your 5 previous Literature results"). The Score is coloured by `data-cx-score-step` (0–10 from the meter's Low–High, the class projection on overall rows, 5 with neither; `breakout` on task breakouts: brightest plus a static pastel purple glow); the meter tooltip explains it (`SCORE_NOTE`). Styles: `cohort-expanded.css`.
- **Key Functions**: `render(...)`: distribution, $z$-score, standing, rank (compact: `Top of assessment` / `Bottom of assessment`, `subject` on overall rows, else `rank / ~size`; expanded cards always `rank / ~size`) and outcome bar; memoised per row (`ui._memo`: mark, stats, cohort size, baselines signature, taskType, types version); a shown panel has no inline `display` (only hiding writes `none`), so the stylesheet lays out expanded cards as grid / flex (Test 228).
- **Export**: `window.ConnectifyCohortView`.

#### [`cohort-stats.js`](file:///Users/uwong/Downloads/2.1.14_0/src/cohort/cohort-stats.js) & Submodules
- **Role**: Controller: styles, pass scheduling and page lifecycle.
- **Submodules**: `cohort-styles.js` (component CSS `#connectea-style`); `cohort-observer.js` (MutationObserver, events, 8s heartbeat, `--cx-display-scale`).
- **Key Functions**:
  - `pass()`: adds every card's spreads first, then one estimate per subject for both semester cards (none while `chartsPending`, never taken back once shown; one re-pass when the wait ends), then renders every row. Caches `card._cxTaskRows` and `card._cxCohortKey`.
  - `schedule(immediate)`: 250ms trailing debounce into `requestAnimationFrame`; `runPass()` drains queued re-passes.
  - Observer: task rows added, mark text edits inside rows, and stats stamped on charts (`data-connectify-stats`, `data-highcharts-chart`); Connectify's own nodes and accordion animations are ignored. A Type change or baseline save with a prediction refresh queued leaves the pass to `connectify-predictions-updated` (one pass, never one with stale predictions).
- **Export**: `window.ConnectifyCohort`.

---

### Assessment Types & Categorization

#### [`task-types.js`](file:///Users/uwong/Downloads/2.1.14_0/src/cohort/task-types.js) & `task-type-select.js`
- **Role**: Assessment categories (defaults from `category-store.js`: Exam, Test, Application, Essay, Take-Home), student overrides, category colours, and class custom categories shared across Semesters 1 and 2. Categories are read live from `window.cxCategories`, so saved keywords apply at once.
- **Key Functions**:
  - `categorizeTask(taskName, allLabels)`: keyword then regex match on the name, then the labels; defaults to `'Take-Home'`.
  - `saveTaskTypeOverride(...)` / `getEffectiveType(subjectName, task, labelsKey)`: override wins over detection; saving refreshes the prediction cache. Cached tasks carry `labelsKey` (every label, set by the parser; older caches read it from the task id), so tools type them like the Type dropdown without the DOM.
  - `getCustomCategoriesForClass` / `addCustomCategoryForClass`: per-class custom categories. Names failing `ConnectifyCategoryStore.isCategoryName` (blank, `undefined`, `null`) are never stored or listed, and such an override reads as Auto. New names (row `+ Custom...`, Settings `+ Add Category`) go through `promptName`: at most `MAX_NAME_LENGTH` (16) characters, asked again when longer (older, longer names are kept).
  - `task-type-select.js`: `getTaskMeta(row)`, `updateTypeSelect(select, ...)` (the dropdown sizes to the chosen type, `field-sizing: content`, capped at 160px with an ellipsis, so a long name never widens the row on an iPad), `rescanAllAutoAssessments()` (also on `connectify-rescan-auto-types`, fired when extension storage returns different categories).
- **Export**: `window.ConnectifyTaskTypes`.

---

### ATAR Calculation & Projection Engine

#### [`scaling-data.js`](file:///Users/uwong/Downloads/2.1.14_0/src/atar/scaling-data.js) (2 lines)
- **Role**: Static 2025 (and 2023/2024) TISC scaled-score statistics per WA ATAR course: mean, SD, min, max, percentiles, populations.
- **Export**: `window.ConnectifyScalingData`.

#### [`atar-math.js`](file:///Users/uwong/Downloads/2.1.14_0/src/atar/atar-math.js) (220 lines)
- **Role**: Calculates ATAR from TEA, computes 10% TEA bonuses, and estimates TISC scaled scores (Average Marks Scaling) with school calibration shift.
- **Key Functions**:
  - `convertTEAtoATAR(tea)`: Interpolates aggregate TEA across the published 50-point TISC table (down to `<30` and up to `99.95`).
  - `bonusType(name)`: Detects eligibility for the 10% TEA bonus (Mathematics Methods, Mathematics Specialist, or approved Languages).
  - `calculate(rows, options)`: Selects top 4 ATAR subjects, computes base TEA, adds the TEA bonus, and returns estimated ATAR. Supports `fixedBonus` option.
  - `teaBonus(rows)`: 10% of each of the best two of Methods, Specialist and the best language (also used by the Target ATAR solver).
  - `estimateScaledScore(name, rawMark)`: TISC Average Marks Scaling (`average-marks-scaling.pdf`, eq. 2), linear per course: scaled $= \mu_c + \sigma_c z$, $\mu_c$ / $\sigma_c$ the course's published scaled mean and SD, $z = (\text{raw} - 60)/14$ (SCSA standardises combined marks to mean 60, SD 14); clamped 0–100; courses without statistics keep the raw mark.
  - `calculateShiftedScaledScore(name, liveRawMark, knownSem1Raw, knownSem1Scaled, year)`: that model shifted by the school's Semester 1 calibration ($\text{shift} = \text{actualScaled} - \text{modelScaled}$).
- **Export**: `window.ConnectifyMath`.

#### [`target-solver.js`](file:///Users/uwong/Downloads/2.1.14_0/src/atar/target-solver.js) & `target-difficulty.js`
- **Role**: Target ATAR and Target Grade solvers.
- **Key Functions**:
  - `parseAssessment(rawScore, weightedMark, name)` / `taskProgress(tasks, mark, semesterNumber)`: parse tasks; earned, remaining and completed weight; with Connect's mark, earned = that mark over the marked weight (schools may adjust it away from the task marks: Biology 71.8% over tasks averaging 66.3%), else the task marks (goal replays pass none); Semester 2 weights must total 100.
  - `gradePlan(progress, target, { difficultyWeighted, subjectName })`: uniform or difficulty-weighted score needed on remaining tasks (subject name lets type overrides apply).
  - `targetPlan(rows, target, options)`: bisects one effort value across the top four to reach the target ATAR, holding the current TEA bonus fixed.
  - `target-difficulty.js` (`ConnectifyTargetDifficulty`): task baseline = the student's average on that type in the course (else halfway to that type's average across courses, else the course average, clamped 30–99.5); effort $t \in [-1, 1]$ closes $t$ of the gap to 100 or scales the baseline down.
- **Export**: `window.ConnectifyTargetSolver` (also merged into `window.ConnectifyMath`).

#### [`atar-scraper.js`](file:///Users/uwong/Downloads/2.1.14_0/src/atar/atar-scraper.js)
- **Role**: ATAR courses for the sidebar tools, from the centralized cache only.
- **Key Functions**:
  - `isAtarEligible()`: Year 11/12 or ATAR in registry class titles, else the page text.
  - `readCourses(atarOnly)`: `collect(true)`, then `[Semester1Courses, Semester2Courses]` from the class registry (mark, final letter, each outline's own tasks from the subjects cache as `tasks` and through `taskProgress` as `progress`) plus grade-cache classes; passed through `filterCourses`.
  - `scanOutlineDetails()`: Safe no-op complying with Rule 7; users are prompted via explicit "Expand Subject Outlines" buttons.
- **Export**: `window.ConnectifyAtarScraper`.

#### [`atar-calculator.js`](file:///Users/uwong/Downloads/2.1.14_0/src/atar/atar-calculator.js) (209 lines)
- **Role**: State manager for ATAR calculations and school mark overrides.
- **Key Functions**:
  - `getCourseState(row, semesterIdx, coursesList)`: Returns course inclusion state, `raw` (the typed school mark, else Connect's) and `score` (that mark scaled, calibration shift included; a scaled `score` saved before school marks were typed still wins until the row is edited).
  - `calculateResults(courses)`: Calculates ATAR for Semester 1 and Semester 2 with -15 TEA adjustment for Year 11 unscaled courses.
  - `renderCourseList(container, courses, activeSemester, onChange)`: Renders each course with an include checkbox, a school mark input (placeholder: Connect's mark; saved as `raw`; no spin arrows, like every `.cta-score`) and the scaled score under the course name (`Scaled 86`, updated as the student types); the mark is left-aligned like every calculator input.
- **Export**: `window.ConnectifyAtarCalc`.

---

*Back to [Overview](file:///Users/uwong/Downloads/2.1.14_0/overview.md)*
