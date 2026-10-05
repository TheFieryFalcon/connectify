---
trigger: always_on
---

# Connectify UI & Analytics Modules Reference

This document covers the user interface and analytics modules, including target planners, progress graphs, weakness radar, and the Grade & ATAR Predictor.

---

## 2. Module Reference: UI & Analytics

### ATAR & Target Planning User Interface

#### [`target-atar-ui.js`](file:///Users/uwong/Downloads/2.1.14_0/target-atar-ui.js)
- **Role**: Builds and updates the Target ATAR Planner interface.
- **Key Functions**: `createPlannerView(ctx)` constructs target score input, top-4 subject checkboxes, and difficulty toggle. `renderTargetOutput(viewRefs, ctx)` solves and renders per-task score requirement breakdown.
- **Export**: `window.ConnectifyTargetAtarUI`.

#### [`target-grade-ui.js`](file:///Users/uwong/Downloads/2.1.14_0/target-grade-ui.js)
- **Role**: Builds and updates the Target Grade Planner interface.
- **Key Functions**: `createGradeView(ctx)` constructs subject dropdown selector, target input, and prior performance adjustment checkbox. `renderGradeOutput(viewRefs, ctx)` computes required average and per-task baseline adjustments.
- **Export**: `window.ConnectifyTargetGradeUI`.

#### [`target-planner-ui.js`](file:///Users/uwong/Downloads/2.1.14_0/target-planner-ui.js)
- **Role**: Lightweight backward-compatibility facade delegating to `ConnectifyTargetAtarUI` and `ConnectifyTargetGradeUI`.
- **Export**: `window.ConnectifyTargetPlannerUI`.

#### [`atar-ui.js`](file:///Users/uwong/Downloads/2.1.14_0/atar-ui.js)
- **Role**: Coordinates the main calculator modal (`#connectea-atar`), tab switching, semester toggling, and data synchronization.
- **Key Functions**:
  - Builds calculator modal shell, title, methodology accordion, and reset button.
  - `selectTab(mode)`: Switches between `'estimate'`, `'target'`, and `'grade'`.
  - `updateResults()`: Updates Semester 1 & 2 buttons with clean styling (ATAR text eliminated in grade mode).
  - `openCalculator(mode)` / `closeCalculator()`: Handles modal visibility, accessibility focus, and Escape key dismissal.
- **Export**: `window.ConnectifyAtar`.

---

### Progress Tracking & Historical Progression

#### [`progress-math.js`](file:///Users/uwong/Downloads/2.1.14_0/progress-math.js)
- **Role**: Mathematical progression modeling across assessments and calendar time.
- **Key Functions**:
  - `history(subjects)`: Reconstructs cumulative historical ATAR projection at each sequential assessment milestone.
  - `aggregateMonthlyPoints(points)`: Groups sequential steps into monthly averages for smooth calendar-based trajectory plotting.
  - `computeYBounds(points, isHistory)`: Dynamically calculates Y-axis min/max bounds and grid tick intervals.
- **Export**: `window.ConnectifyProgressMath`.

#### [`progress-chart.js`](file:///Users/uwong/Downloads/2.1.14_0/progress-chart.js)
- **Role**: Native SVG polyline chart generator.
- **Key Functions**:
  - `renderChart(container, options)`: Generates responsive SVG line chart with dual polylines (blue: student score, red: cohort mean), grid lines, value ticks, interactive data points with hover tooltips, and plotted data detail table.
  - Supports custom week timestamp overrides (focus-protected editing, commit on Enter/blur) and uncompleted task display directly within the plotted data table.
- **Export**: `window.ConnectifyProgressChart`.

#### [`progress-graph.js`](file:///Users/uwong/Downloads/2.1.14_0/progress-graph.js)
- **Role**: Progress Graph modal controller (`#connectify-progress`).
- **Key Functions**:
  - Builds subject selector chips and "ATAR Progression" selector.
  - `render(data)`: Delegates plotting to `progress-chart.js`. `refresh(force)` guards against re-rendering while editing.
  - `cleanupImprovementArrows()`: Purges obsolete improvement indicators and un-nests panels.
- **Export**: `window.ConnectifyProgress`.

#### [`compound-progress.js`](file:///Users/uwong/Downloads/2.1.14_0/compound-progress.js)
- **Role**: Injects multi-category weighted completion progress bars into each subject card header.
- **Key Functions**:
  - Renders horizontal segmented bar (`.cx-compound-bar`) across generic tile containers (`.eds-c-tile, .cvr-c-tile, [data-subject-card], .c-tile`). Partitions Semester 1 vs Semester 2 chronologically and mutes during accordion animations.
  - Reactive updates on `connectify-task-type-changed` and `connectify-settings-updated` without page reloads.
- **Export**: `window.ConnectifyCompoundProgress`.

---

### Advanced Analytics & Sidebar Tools

#### [`weakness-radar.js`](file:///Users/uwong/Downloads/2.1.14_0/weakness-radar.js)
- **Role**: Implements the Weakness Analyzer native SVG spider/radar chart.
- **Key Functions**:
  - Plots multi-axis polygonal radar chart of student performance grouped by assessment type or subject.
  - Interactive subject filtering checkboxes (`#cx-weakness-checkboxes`) and Expand All Outlines button (`#cx-weakness-expand-all`).
  - Persists deselected subjects in `connectify:weakness_disabled_subjects`.
- **Export**: `window.ConnectifyWeakness`.

#### [`scaling-calibration.js`](file:///Users/uwong/Downloads/2.1.14_0/scaling-calibration.js)
- **Role**: Implements the Semester 1 Scaled Scores calibration table in Settings.
- **Key Functions**:
  - `renderCalibTable(panel)`: Generates editable table of enrolled subjects with Semester 1 School Raw (%) and Semester 1 Scaled Mark inputs.
  - Saves calibration offsets to `localStorage` under `connectea:preferences` (`sem1_calibration:<courseId>`).
- **Export**: `window.ConnectifyCalibration`.

#### [`category-settings.js`](file:///Users/uwong/Downloads/2.1.14_0/category-settings.js) & Submodules
- **Role**: Settings panel controller managing preferences, cohort defaults, calibration, categories, and baselines.
- **Submodules**:
  - [`category-baselines.js`](file:///Users/uwong/Downloads/2.1.14_0/category-baselines.js): Manages previous-year baseline averages by type and subject with legacy key purging.
- **Key Functions**:
  - Preferences (`connectify:auto_expand`), Cohort Size (default 500), and ATAR Percentage (default 60%).
  - Synchronizes custom categories with `browser.storage.local` and `localStorage` (`cx-categories`).
  - Triggers `rescanAllAutoAssessments()` and prediction cache sync upon save.
- **Export**: `window.ConnectifyCategorySettings`.

#### [`predictor-math.js`](file:///Users/uwong/Downloads/2.1.14_0/predictor-math.js) & Submodules
- **Role**: Mathematical modeling engine for predictions, baselines, headroom compression, and Grade/ATAR projections.
- **Submodules**:
  - [`predictor-engine.js`](file:///Users/uwong/Downloads/2.1.14_0/predictor-engine.js): Core prediction formulas, logarithmic headroom compression above 80%, calibrated variance scaling, and outcome segment evaluation.
  - [`predictor-dates.js`](file:///Users/uwong/Downloads/2.1.14_0/predictor-dates.js): Chronological task ordering, date parsing, and custom date override resolution.
  - [`predictor-cache.js`](file:///Users/uwong/Downloads/2.1.14_0/predictor-cache.js): In-memory Map cache (`predictionMemoryCache`) and persistent prediction storage (`connectify:prediction:`).
- **Key Functions**:
  - `predictTask(subjectName, task, historical, baselines)`: Predicts Low/Mid/High and 10% breakout ($1.10 \times \text{High}$).
  - `populateChronologicalPredictions(subjects, force)`: Pre-populates prediction cache across updates.
  - `projectSubjectGrades(subjects)` & `projectATAR(projectedSubjects)`: Aggregates projections into Low/Mid/High marks, TEA, and ATAR.
- **Export**: `window.ConnectifyPredictorMath`.

#### [`predictor-ui.js`](file:///Users/uwong/Downloads/2.1.14_0/predictor-ui.js) & Submodules
- **Role**: Sidebar tool panel controller (`#connectify-predictor`) with button `Predictor`.
- **Submodules**:
  - [`predictor-grade-view.js`](file:///Users/uwong/Downloads/2.1.14_0/predictor-grade-view.js): Renders subject sub-tabs, guidance cards, upcoming task predictions, and horizontal scroll preservation.
- **Key Functions**:
  - `createPredictorPanel()`: Builds two-tab Predictor interface (Grade Predictor & ATAR Predictor).
  - ATAR Predictor: Displays Low, Mid, High predicted ATAR hero cards, TEA breakdown, and contributing ATAR courses table.
- **Export**: `window.ConnectifyPredictorUI`.

#### [`atar-features.js`](file:///Users/uwong/Downloads/2.1.14_0/atar-features.js)
- **Role**: Coordinates sidebar tool buttons, floating controls, countdown, and periodic synchronization.
- **Key Functions**:
  - Injects fixed floating "Expand All" and "Collapse All" buttons (`#cx-expand-btn`).
  - Mounts Weakness Analyzer and Settings toggles into `#connectify-sidebar`.
  - Coordinates periodic refresh loops respecting `ConnectifyIsUserActive()`.
- **Export**: `window.ConnectifySync`, `window.ConnectifyInitSidebar`.

#### [`wace-countdown.js`](file:///Users/uwong/Downloads/2.1.14_0/wace-countdown.js)
- **Role**: Displays days remaining until WACE examinations.
- **Key Functions**:
  - Automatically detects Year 12 ATAR enrolment.
  - Computes remaining days to late October (~Oct 28) and injects `#connectify-wace-countdown` banner.
- **Export**: `window.ConnectifyCountdown`.

#### [`sidebar.js`](file:///Users/uwong/Downloads/2.1.14_0/sidebar.js) & Submodules
- **Role**: Slide-out drawer hosting all Connectify tools with responsive workspace expansion.
- **Submodules**:
  - [`sidebar-handle.js`](file:///Users/uwong/Downloads/2.1.14_0/sidebar-handle.js): Dynamic toggle handle (`#connectify-sidebar-handle`) anchoring to Connect sidebar or centering below top navigation.
- **Key Functions**:
  - Drawer slide synchronization and 900px workspace expansion (`.cx-tool-active`) with `← Back to Menu` navigation.
  - Canonical launcher buttons: Target ATAR, Target Grade, Predictor, Year in Progress, ATAR Estimate, Weakness Analyzer, Settings.
  - Centralized delegated click handling and single active tool policy.
- **Export**: `window.ConnectifyInitSidebar`.

---

*Back to [Overview](file:///Users/uwong/Downloads/2.1.14_0/overview.md)*
