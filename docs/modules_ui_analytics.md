# Connectify UI & Analytics Modules Reference

This document covers the user interface and analytics modules, including target planners, progress graphs, weakness radar, and the Grade & ATAR Predictor.

---

## 2. Module Reference: UI & Analytics

### ATAR & Target Planning User Interface

#### [`target-atar-ui.js`](file:///Users/uwong/Downloads/2.1.14_0/target-atar-ui.js) (330 lines)
- **Role**: Builds and updates the Target ATAR Planner interface.
- **Key Functions**: `createPlannerView(ctx)` constructs target score input, top-4 subject checkboxes, and difficulty toggle. `renderTargetOutput(viewRefs, ctx)` solves and renders per-task score requirement breakdown.
- **Export**: `window.ConnectifyTargetAtarUI`.

#### [`target-grade-ui.js`](file:///Users/uwong/Downloads/2.1.14_0/target-grade-ui.js) (207 lines)
- **Role**: Builds and updates the Target Grade Planner interface.
- **Key Functions**: `createGradeView(ctx)` constructs subject dropdown selector, target input, and prior performance adjustment checkbox. `renderGradeOutput(viewRefs, ctx)` computes required average and per-task baseline adjustments.
- **Export**: `window.ConnectifyTargetGradeUI`.

#### [`target-planner-ui.js`](file:///Users/uwong/Downloads/2.1.14_0/target-planner-ui.js) (16 lines)
- **Role**: Lightweight backward-compatibility facade delegating to `ConnectifyTargetAtarUI` and `ConnectifyTargetGradeUI`.
- **Export**: `window.ConnectifyTargetPlannerUI`.

#### [`atar-ui.js`](file:///Users/uwong/Downloads/2.1.14_0/atar-ui.js) (336 lines)
- **Role**: Coordinates the main calculator modal (`#connectea-atar`), tab switching, semester toggling, and data synchronization.
- **Key Functions**:
  - Builds calculator modal shell, title, methodology accordion, and reset button.
  - `selectTab(mode)`: Switches between `'estimate'`, `'target'`, and `'grade'`.
  - `updateResults()`: Updates Semester 1 & 2 buttons with clean styling (ATAR text eliminated in grade mode).
  - `openCalculator(mode)` / `closeCalculator()`: Handles modal visibility, accessibility focus, and Escape key dismissal.
- **Export**: `window.ConnectifyAtar`.

---

### Progress Tracking & Historical Progression

#### [`progress-math.js`](file:///Users/uwong/Downloads/2.1.14_0/progress-math.js) (184 lines)
- **Role**: Mathematical progression modeling across assessments and calendar time.
- **Key Functions**:
  - `history(subjects)`: Reconstructs cumulative historical ATAR projection at each sequential assessment milestone.
  - `aggregateMonthlyPoints(points)`: Groups sequential steps into monthly averages for smooth calendar-based trajectory plotting.
  - `computeYBounds(points, isHistory)`: Dynamically calculates Y-axis min/max bounds and grid tick intervals.
- **Export**: `window.ConnectifyProgressMath`.

#### [`progress-chart.js`](file:///Users/uwong/Downloads/2.1.14_0/progress-chart.js) (340 lines)
- **Role**: Native SVG polyline chart generator.
- **Key Functions**:
  - `renderChart(container, options)`: Generates responsive SVG line chart with dual polylines (blue: student score, red: cohort mean), grid lines, value ticks, interactive data points with hover tooltips, and plotted data detail table.
  - Supports custom week timestamp overrides and uncompleted task display directly within the plotted data table.
- **Export**: `window.ConnectifyProgressChart`.

#### [`progress-graph.js`](file:///Users/uwong/Downloads/2.1.14_0/progress-graph.js) (265 lines)
- **Role**: Progress Graph modal controller (`#connectify-progress`).
- **Key Functions**:
  - Builds subject selector chips and "ATAR Progression" selector.
  - `render(data)`: Delegates plotting to `progress-chart.js`.
  - `cleanupImprovementArrows()`: Purges obsolete improvement indicators and un-nests panels.
- **Export**: `window.ConnectifyProgress`.

#### [`compound-progress.js`](file:///Users/uwong/Downloads/2.1.14_0/compound-progress.js) (292 lines)
- **Role**: Injects multi-category weighted completion progress bars into each subject card header.
- **Key Functions**:
  - Renders horizontal segmented bar (`.cx-compound-bar`) across generic tile containers (`.eds-c-tile, .cvr-c-tile, [data-subject-card], .c-tile`). Partitions Semester 1 vs Semester 2 chronologically and mutes during accordion animations.
  - Reactive updates on `connectify-task-type-changed` and `connectify-settings-updated` without page reloads.
- **Export**: `window.ConnectifyCompoundProgress`.

---

### Advanced Analytics & Sidebar Tools

#### [`weakness-radar.js`](file:///Users/uwong/Downloads/2.1.14_0/weakness-radar.js) (340 lines)
- **Role**: Implements the Weakness Analyzer native SVG spider/radar chart.
- **Key Functions**:
  - Plots multi-axis polygonal radar chart of student performance grouped by assessment type or subject.
  - Interactive subject filtering checkboxes (`#cx-weakness-checkboxes`) and Expand All Outlines button (`#cx-weakness-expand-all`).
  - Persists deselected subjects in `connectify:weakness_disabled_subjects`.
- **Export**: `window.ConnectifyWeakness`.

#### [`scaling-calibration.js`](file:///Users/uwong/Downloads/2.1.14_0/scaling-calibration.js) (126 lines)
- **Role**: Implements the Semester 1 Scaled Scores calibration table in Settings.
- **Key Functions**:
  - `renderCalibTable(panel)`: Generates editable table of enrolled subjects with Semester 1 School Raw (%) and Semester 1 Scaled Mark inputs.
  - Saves calibration offsets to `localStorage` under `connectea:preferences` (`sem1_calibration:<courseId>`).
- **Export**: `window.ConnectifyCalibration`.

#### [`category-settings.js`](file:///Users/uwong/Downloads/2.1.14_0/category-settings.js) (390 lines)
- **Role**: Settings panel controller managing General Preferences, Cohort Estimation defaults, Scaling Calibration, and Assessment Categories.
- **Key Functions**:
  - General Preferences: "Auto-expand class tabs on page load" toggle (`connectify:auto_expand`), "General Cohort Size" input (default 500), and "ATAR Percentage" input (default 60%).
  - Renders category keyword inputs, `+ Add Category` button, and custom category deletion.
  - Synchronizes custom categories with `browser.storage.local` and `localStorage` (`cx-categories`).
  - Automatically triggers `rescanAllAutoAssessments()` and updates prediction cache upon saving. Save Changes matches Baselines in `#2563eb`.
- **Export**: `window.ConnectifyCategorySettings`.

#### [`predictor-math.js`](file:///Users/uwong/Downloads/2.1.14_0/predictor-math.js)
- **Role**: Mathematical modeling engine for predictions, baselines, headroom compression, outcome evaluation, and Grade/ATAR projections.
- **Key Functions**:
  - `applyLogarithmicCeiling(baseScore, delta)`: Tapers gains above 80% proportionally to headroom $\frac{100 - \text{Score}}{20}$.
  - `predictTask(subjectName, task, historical, baselines)`: Predicts Low/Mid/High and 10% breakout threshold ($1.10 \times \text{High}$).
  - `populateChronologicalPredictions(subjects, force)` / `updatePredictionCache(subject)`: Pre-populates and synchronizes prediction cache across category, baseline, and grade updates.
  - `getOrComputeTaskPrediction(subjectName, task, allSubjects)`: On-demand chronological computation for newly arrived tasks.
  - `evaluateOutcome(score, prediction)`: Maps score against predictions ($0..5$ segments). $>1.10\times\text{High}$ triggers secret Purple breakout.
  - `projectSubjectGrades(subjects)`: Deduplicates tasks, strictly hides 0% and NaN% tasks, prioritizes custom dates (`connectea:`, `connectify:`), suppresses unparsable dates, and projects marks.
  - `projectATAR(projectedSubjects)`: Aggregates projections into Low, Mid, High ATAR and TEA.
- **Export**: `window.ConnectifyPredictorMath`.

#### [`predictor-ui.js`](file:///Users/uwong/Downloads/2.1.14_0/predictor-ui.js)
- **Role**: Sidebar tool panel controller (`#connectify-predictor`) with button `Predictor`.
- **Key Functions**:
  - `createPredictorPanel()`: Builds two-tab Predictor interface (Grade Predictor & ATAR Predictor).
  - Grade Predictor: Up to 6 subject sub-tabs with guidance cards, upcoming task predictions, secret purple breakout, and persistent horizontal scroll position across tab switches.
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

#### [`sidebar.js`](file:///Users/uwong/Downloads/2.1.14_0/sidebar.js)
- **Role**: Slide-out drawer hosting all Connectify tools with responsive workspace expansion.
- **Key Functions**:
  - Injects toggle handle (`#connectify-sidebar-handle`) and drawer (`#connectify-sidebar`).
  - Canonical launcher buttons: Target ATAR, Target Grade, Predictor, Progress Graph, ATAR Estimate, Weakness Analyzer, Settings.
  - Proactive tool initialization: ensures Weakness Analyzer and Settings panels are created.
  - Centralized delegated click handling: dispatches tool opening and synchronizes `aria-pressed`.
  - Workspace Drawer Expansion: opening any tool expands drawer to 900px (`.cx-tool-active`) with `← Back to Menu` navigation.
- **Export**: `window.ConnectifyInitSidebar`.

---

*Back to [Overview](file:///Users/uwong/Downloads/2.1.14_0/overview.md)*
