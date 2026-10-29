# Connectify UI & Analytics Modules Reference

This document covers the user interface and analytics modules, including target planners, progress graphs, weakness radar, and Predictions (Predict Grade, Predict ATAR).

---

## 2. Module Reference: UI & Analytics

### ATAR & Target Planning User Interface

#### [`target-atar-ui.js`](file:///Users/uwong/Downloads/2.1.14_0/src/atar/target-atar-ui.js)
- **Role**: Builds and updates the Target ATAR Planner interface.
- **Key Functions**: `createPlannerView(ctx)` constructs target score input, top-4 subject checkboxes, and difficulty toggle. `renderTargetOutput(viewRefs, ctx)` solves the plan; `target-atar-breakdown.js` renders the banner and per-task requirements. Shared planner helpers (preferences, Expand Subject Outlines button): `target-ui-helpers.js`.
- **Export**: `window.ConnectifyTargetAtarUI`.

#### [`target-grade-ui.js`](file:///Users/uwong/Downloads/2.1.14_0/src/atar/target-grade-ui.js)
- **Role**: Builds and updates the Target Grade Planner interface.
- **Key Functions**: `createGradeView(ctx)` constructs subject dropdown selector, target input, and prior performance adjustment checkbox. `renderGradeOutput(viewRefs, ctx)` computes required average and per-task baseline adjustments (passing the subject so type overrides apply).
- **Export**: `window.ConnectifyTargetGradeUI`.

#### [`target-planner-ui.js`](file:///Users/uwong/Downloads/2.1.14_0/src/atar/target-planner-ui.js)
- **Role**: Lightweight backward-compatibility facade delegating to `ConnectifyTargetAtarUI` and `ConnectifyTargetGradeUI`.
- **Export**: `window.ConnectifyTargetPlannerUI`.

#### [`atar-ui.js`](file:///Users/uwong/Downloads/2.1.14_0/src/atar/atar-ui.js)
- **Role**: Coordinates the main calculator modal (`#connectea-atar`), tab switching, semester toggling, and data synchronization.
- **Key Functions**:
  - `atar-ui-markup.js`: panel markup (the Goal Setter and Estimator launchers the sidebar mounts, mode tabs, semester buttons, methodology), `GROUPS` (`goals`: `grade`, `target`; `estimator`: `grade-estimate`, `estimate`), `MODES` (tabs `Target Grade` / `Target ATAR`, `Estimate Grade` / `Estimate ATAR`, Grade first), `paintModeTabs`, semester labels and closing rules.
  - `selectTab(mode)`: Switches between `'target'`, `'grade'`, `'estimate'` and `'grade-estimate'`: heading = launcher name, `aria-label` = mode title, only the group's tabs shown.
  - `grade-estimate.js` (`ConnectifyGradeEstimate`): `parseMark(text)` (percent, `a/b`, `a Out of b`), `estimate(tasks, entered, mark)` -> `{ current, estimate, entered, pending, complete }`: Connect's mark as one block at the marked weight plus typed marks at theirs; blanks and (when any task is weighted) unweighted tasks are left out. `grade-estimate-ui.js` (`ConnectifyGradeEstimateUI`): class select, task table rebuilt only when the class or tasks change (typing keeps focus), marks saved per class in the calculator preferences. Styles: `atar-estimator.css`.
  - `updateResults()`: Updates Semester 1 & 2 buttons with clean styling (ATAR text eliminated in grade mode). A semester whose A–E grades are final is Closed (`.cta-semester-closed`, disabled) in every mode, Estimate included; unselected and closed buttons keep a whole 1px border (text aligned with the indicator's 4px bar by padding).
  - `openCalculator(groupOrMode)` / `closeCalculator()`: a group opens on its Grade mode, then its last mode; Handles modal visibility, accessibility focus, and Escape key dismissal.
- **Export**: `window.ConnectifyAtar`.

---

### Progress Tracking & Historical Progression

#### [`progress-math.js`](file:///Users/uwong/Downloads/2.1.14_0/src/progress/progress-math.js)
- **Role**: Mathematical progression modeling across assessments and calendar time.
- **Key Functions**:
  - `history(subjects)`: Reconstructs cumulative historical ATAR projection at each sequential assessment milestone.
  - `aggregateMonthlyPoints(points)`: Groups sequential steps into monthly averages for smooth calendar-based trajectory plotting.
  - `computeYBounds(points, isHistory)`: Y-axis bounds, grid step and scale. Subject charts run 50–100% (grid every 10), or from the lowest plotted mark or cohort mean below 50% rounded down to the nearest 10; ATAR charts start just under the second-lowest estimate.
- **Export**: `window.ConnectifyProgressMath`.

#### [`progress-chart.js`](file:///Users/uwong/Downloads/2.1.14_0/src/progress/progress-chart.js)
- **Role**: Native SVG polyline chart generator.
- **Key Functions**:
  - `renderChart(container, options)`: Generates responsive SVG line chart with dual polylines (blue: student score, red: cohort mean), grid lines, value ticks, interactive data points (solid dots, no white ring) with hover tooltips, and plotted data detail table.
  - `progress-semester-divider.js` (`ConnectifyProgressSemesterDivider`: `taskSemester`, `commonSemester`, `boundaryX`, `render`): a dashed vertical line (`.cx-semester-divider`, labelled `Semester 1` / `Semester 2` either side, drawn under the series) on every chart. Subject charts: halfway between the last Semester 1 task and the first Semester 2 task (a task's week decides, before `semesterTwoOrder()`: school week 17, Term 2 Week 7 or Week 8 under Early Easter; never later than its outline; undated tasks take their outline's); calendar ATAR charts: at school week 17's start on the time axis; assessment rounds: each round's semester from its tasks' real weeks (`history` keeps them as `source`), a round spanning both left between. None on a chart within one semester.
  - `progress-modes.js` (`ConnectifyProgressModes`): "Show:" dropdown on subject views (`connectify:progress_mode`): Single tasks, Weighted average (running weight-weighted mean of completed tasks) or Rolling average (weight-weighted mean of the last 3); the cohort mean is averaged alike, unknown weights count as the mean known weight, all-zero weights fall back to a plain mean. Average modes rename the legend, tooltips and table headers; averaged points keep the task's own mark (`ownScore`). Beside it, `progress-early-easter.js` (`ConnectifyEarlyEaster`) puts the year's Early Easter checkbox, the same one the export shows: a change sets `connectify:school_terms` and fires `connectify-terms-updated` (graph, export, compound bars); predictions are refreshed only when the tasks' chronological order changes (`taskOrder()`), and `connectify-settings-updated` (every row redrawn) only when a task changes semester; a recompute works out each task's stamp once (`withStampMemo`); the graph's data signature includes the choice, so either view redraws the other. `formatTimestamp` reads weeks through `normalizeOrder`, so the table, the export and the Predictor name the same week.
  - `progress-week-editor.js` (`ConnectifyProgressWeekEditor.weekCell`): custom school week overrides (school weeks of the year through the term calendar, saved as `w17`, hints and ranges from this year's terms; older bare numbers (saved before Early Easter was known) are the same school week, `17` = `w17`; focus-protected editing, commit on Enter/blur, Escape restores) and uncompleted task display in the plotted data table.
- **Export**: `window.ConnectifyProgressChart`.

#### [`progress-graph.js`](file:///Users/uwong/Downloads/2.1.14_0/src/progress/progress-graph.js)
- **Role**: Progress Graph modal controller (`#connectify-progress`); launcher and panel markup in `progress-panel.js`.
- **Key Functions**:
  - Builds subject selector chips and "ATAR Progression" selector.
  - `render(data)`: Delegates plotting to `progress-chart.js`. `refresh(force)` guards against re-rendering while editing.
  - `cleanupImprovementArrows()`: Purges obsolete improvement indicators and un-nests panels.
  - Export (`export-view.js`, `#cx-export-toggle` / `#cx-export-view`, styles `export-view.css`): swaps the graph for the term starts (a cell per term: `Term 2` over `20 Apr (Week 10)`, its first school week of the year) and every unmarked task by subject (`export-rows.js`: tick, Mon–Fri day per subject and per task (`Default (Mon)` follows the subject), export date; with merging on (both files, default on) a semester's 2+ ticked Exam-type tasks are one `Semester N Exam` and their rows show no tick or day, tagged `In Semester N Exam`), downloading `connectify_assessments_<year>.ics` (Google Calendar; stable UIDs, the merged exam one span) or `.csv` (Notion: Name, Date, Subject, Type, Weight (%), Term / Week; the merged exam one row dated `June 8, 2026 → June 19, 2026`). Labels reset Connect's `.eds.cvr label` margin and size, so every row's cells share one centre line. Week: the Progress graph's own `order` (week override, else caption), decoded by `ConnectifyProgressMath.termWeek` (also behind `formatTimestamp`); none or past Term 4 is listed as left out. `src/assessment/school-terms.js` (also places date captions in the graph): Term 1 = Monday 1–4 Feb, else Wednesday 31 Jan–3 Feb (Week 1 Wed–Fri); 10-week terms, 2-week breaks; Early Easter (auto when Easter Monday is in Term 1 Week 10) makes Term 1 9 weeks and Term 2 11; a week past its term spills into the next.
- **Export**: `window.ConnectifyProgress`.

#### [`compound-progress.js`](file:///Users/uwong/Downloads/2.1.14_0/src/progress/compound-progress.js)
- **Role**: Injects multi-category weighted completion progress bars into each subject card header.
- **Key Functions**:
  - Renders horizontal segmented bar (`.cx-compound-bar`, styles in `compound-progress.css`) across generic tile containers (`.eds-c-tile, .cvr-c-tile, [data-subject-card], .c-tile`). Partitions Semester 1 vs Semester 2 chronologically and mutes during accordion animations.
  - `subjectForCard(title, subjects)`: one subject per card (exact cleaned name, then full name, then closest partial), so similar names never redraw each other's bars.
  - Reactive updates on `connectify-task-type-changed` and `connectify-settings-updated` without page reloads.
- **Export**: `window.ConnectifyCompoundProgress`.

---

### Advanced Analytics & Sidebar Tools

#### [`weakness-radar.js`](file:///Users/uwong/Downloads/2.1.14_0/src/progress/weakness-radar.js)
- **Role**: Implements the Weaknesses native SVG spider/radar chart.
- **Key Functions**:
  - Plots multi-axis polygonal radar chart of student performance grouped by assessment type or subject (SVG, escaped labels and panel markup in `weakness-radar-view.js`) (labels sit 12px past each spoke's end, baselines set by `y` since Firefox does not pass `dominant-baseline` to the score `<tspan>`; 760-wide viewBox, `overflow: visible`, so long labels never clip; `Group by:` and the subject checkboxes drop Connect's `.eds.cvr label` margin) from the cache only (`collectClasses`; types from each task's stored `labelsKey`, never its row); skips rendering while hidden and redraws while open on `connectify-task-type-changed` / `connectify-results-updated`. The dark plot surface and message colours live in `sidebar-weakness-types.css` (`.cx-radar-message`, `.cx-radar-warning`), so light-tone themes can clear it.
  - Interactive subject filtering checkboxes (`#cx-weakness-checkboxes`) and Expand All Outlines button (`#cx-weakness-expand-all`).
  - Persists deselected subjects in `connectify:weakness_disabled_subjects`.
- **Export**: `window.ConnectifyWeakness`.

#### [`scaling-calibration.js`](file:///Users/uwong/Downloads/2.1.14_0/src/atar/scaling-calibration.js)
- **Role**: Implements the Semester 1 Scaled Scores calibration table in Settings.
- **Key Functions**:
  - `renderCalibTable(panel)`: Generates editable table of enrolled subjects with Semester 1 School Raw (%) and Semester 1 Scaled Mark inputs.
  - Saves calibration offsets to `localStorage` under `connectea:preferences` (`sem1_calibration:<courseId>`).
- **Export**: `window.ConnectifyCalibration`.

#### Settings (`src/predictor/`, `src/cohort/category-store.js`)
- `settings-markup.js` (panel HTML; its dropdowns are `.cx-settings-select`, styled like the number inputs in every theme), `settings-semester-filter.js` ("Show this semester's classes only" checkbox, "This semester: Semester N" hint; a change re-hides tiles, re-collects and fires `connectify-settings-updated`), `settings-panel-view.js` (Statistics Panels dropdown: Compact / Expanded on subject panels only / Expanded on all; takes effect after reload), `settings-preferences.js` (auto-expand, cohort size 500, ATAR % 60, theme list rebuilt from the registry on open, wallpaper, cache clearing), `category-settings.js` (`ConnectifyCategorySettings`, category keyword editor; save/delete rescan assessments), `category-baselines.js` (baseline editor), `category-store.js` (`ConnectifyCategoryStore`: defaults and saved categories in `cx-categories` + extension storage; `sanitize` drops entries without a real name and restores missing defaults on every load and save, rewriting a damaged stored set in place. Settings once saved every row as `undefined`: Save Changes reads each row's `wrap.dataset.cat`).

#### Predictor (`src/predictor/`)
- **Model**: `predictor-baselines.js` (baselines store; partial saves keep the other half), `predictor-engine.js` (`predictTask`: Mid = the subject's own results, recency-weighted (0.85 per later result x sqrt(weight)), + half the type shift: every result of the type in every subject against its own subject's average, pooled (never per subject, never confounded by a weak subject); Low / High = Mid -/+ 0.85 sigma_p, sigma blends the subject's spread with the pooled within-subject spread (3 results' worth), widened by sqrt(1 + 1/n_eff); logarithmic headroom above 80%; `basis: { typeSource, typeCount, subjectSource, subjectCount }`: type average from `history`, `baseline` or the `subject`; subject from `history` or `baseline`), `predictor-history.js` (completed-result history, overall and prior to a task: averages, counts, pooled `spread`, and `subjectResults` per subject in date order); marked tasks use the results before them, unmarked tasks every cached result; the stamp is the school week alone, `predictor-dates.js` (chronological order, custom week overrides; the case-insensitive override lookup reads an index of override keys rebuilt only when the key count changes or an override is saved, never a storage scan per task).
- **Cache**: `predictor-store.js` (`predictionMemoryCache`, `connectify:prediction:` keys under each task's own id (`predictionId`), version stamp) and `predictor-cache.js` (`populateChronologicalPredictions`, `getOrComputeTaskPrediction`, `updatePredictionCache`: drops stale predictions at once, then one queued recompute of every task (type averages span courses) and one `connectify-predictions-updated` per task, however many refreshes were requested; `isRefreshPending()`). Type changes refresh where they are made (no second refresh on `connectify-task-type-changed`); hidden Settings is not rebuilt on type changes.
- **Projections**: `predictor-grade-projection.js` (`projectSubjectGrades`) and `predictor-atar-projection.js` (`projectATAR`); `predictor-math.js` (`ConnectifyPredictorMath`) is the facade with `evaluateOutcome` (secret 1.10 x High breakout; returns the prediction's `low` / `high` too).
- **UI**: `predictor-ui.js` (`ConnectifyPredictorUI`, Predict Grade / Predict ATAR tabs, delegated clicks), `predictor-atar-view.js` (shell + ATAR cards/table), `predictor-grade-view.js` (subject sub-tabs, guidance, projected mark), `predictor-tab-scroll.js` (`ConnectifyPredictorTabScroll.attach(bar)`: the tabs hide the native scrollbar, which widens on hover on macOS and ignores `scrollbar-color` in Firefox, for a plain draggable one that never changes on hover; styles `sidebar-predictor-scroll.css`), `predictor-task-cards.js` (upcoming tasks). All names inserted into HTML are escaped (`ConnectifyUtils.escapeHtml`).

#### [`atar-features.js`](file:///Users/uwong/Downloads/2.1.14_0/src/atar/atar-features.js) & `outline-controls.js`
- **Role**: Creates the Predictor, Weakness and Settings panels for `sidebar.js` to mount, runs startup auto-expand (only with `connectify:auto_expand`), and keeps outline controls, countdown and compound progress in sync.
- **Key Functions**: `outline-controls.js` (`ConnectifyOutlineControls`): floating `Expand All` / `Collapse All` (`#cx-expand-btn`) and `#cx-back-to-top-container` after the last tile. `outline-jump.js` (`ConnectifyOutlineJump`, styles `outline-jump.css`): `#cx-jump-subject` above them, a subject dropdown (each shown outline's cleaned name once, in page order; this semester's card when both are shown; hidden outlines left out; options rewritten only when the list changes) and a `Jump To` button (`ConnectifyNewGrade.jumpToSubject`: expands, scrolls, pulses).
- **Export**: `window.ConnectifySync`, `window.ConnectifyInitSidebar` (until `sidebar.js` replaces it).

#### [`wace-countdown.js`](file:///Users/uwong/Downloads/2.1.14_0/src/progress/wace-countdown.js)
- **Role**: Displays days remaining until WACE examinations.
- **Key Functions**:
  - Automatically detects Year 12 ATAR enrolment.
  - Computes remaining days to late October (~Oct 28) and injects `#connectify-wace-countdown` banner.
- **Export**: `window.ConnectifyCountdown`.

#### [`sidebar.js`](file:///Users/uwong/Downloads/2.1.14_0/src/sidebar/sidebar.js) & Submodules
- **Role**: Slide-out drawer hosting all Connectify tools with responsive workspace expansion, on every Connect page: off the outlines page (`.cx-page-limited`) every launcher but Settings is disabled under `.cx-page-notice`; a Connect filter never disables tools (they read the cache).
- **Submodules**:
  - `sidebar-handle-position.js` / `sidebar-handle.js` / `sidebar-hover.js`: handle (`#connectify-sidebar-handle`) anchoring to Connect's sidebar or centring below the top bar, the "just returned to menu" grace period, left-edge expand and hover collapse; a click-close holds the drawer shut until the pointer moves away (`isHoldingClosed`), so hover can't undo the click (Dia).
  - `sidebar-filter.js` (`isOutlinesFilterRestricted` for the year rollover, `clickConnectAllButton`), `sidebar-page-notice.js` (`.cx-page-notice` with an Open Assessment Outlines link; `ANYWHERE_TOOLS`: Settings), `sidebar-tools.js`, `sidebar-shell.js`: launcher/panel mounting (DOM only touched when out of place; launchers pressed only while their panel is open) and the drawer shell.
- **Key Functions**:
  - Drawer slide synchronization and 900px workspace expansion (`.cx-tool-active`) with `← Back to Menu` navigation.
  - Canonical launcher buttons: Goal Setter, Predictor, Year Progression, Estimator, Weakness Analyzer, Settings (`CALCULATOR_GROUPS` maps the two calculator launchers to `openCalculator('goals' | 'estimator')`).
  - Centralized delegated click handling and single active tool policy.
- **Export**: `window.ConnectifyInitSidebar`.

---

*Back to [Overview](file:///Users/uwong/Downloads/2.1.14_0/overview.md)*
