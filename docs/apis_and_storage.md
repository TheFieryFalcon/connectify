# Connectify APIs, Storage & Events Reference

This document indexes global namespace APIs, persistent storage keys, custom DOM events, and critical DOM selectors used by the Connectify extension.

---

## 3. Global Namespaces & API Index

| Global Object | Module | Primary Purpose |
|---|---|---|
| `window.ConnectifyData` | `assessment-data.js` | Scrapes assessment cards, caches tasks, and expands accordions |
| `window.ConnectifyCache` | `assessment-data.js` | Subsystem cache versioning (predictor, results, settings, cohort) and clearing |
| `window.ConnectifyCohortMath` | `cohort-math.js` | PCHIP cubic Hermite interpolation, variance, z-score |
| `window.ConnectifyCohortEstimator` | `cohort-estimator.js` | Baseline and empirical cohort size estimation |
| `window.ConnectifyCohortView` | `cohort-view.js` | Injects stats panels and type selectors into assessment rows |
| `window.ConnectifyCohort` | `cohort-stats.js` | Controller orchestrating passes, mutation observer, styles |
| `window.ConnectifyTaskTypes` | `task-types.js` | Category keyword detection, overrides, class category sharing |
| `window.ConnectifyScalingData` | `scaling-data.js` | 2025 TISC scaling curves |
| `window.ConnectifyMath` | `atar-math.js` | TEA-to-ATAR conversion, 10% bonus rules, scaled score model |
| `window.ConnectifyTargetSolver` | `target-solver.js` | Target Grade and difficulty-weighted Target ATAR solver |
| `window.ConnectifyAtarScraper` | `atar-scraper.js` | Scrapes course titles and semester groupings |
| `window.ConnectifyAtarCalc` | `atar-calculator.js` | Course state modeling and ATAR calculation results |
| `window.ConnectifyTargetAtarUI` | `target-atar-ui.js` | Target ATAR planner modal form and breakdown view |
| `window.ConnectifyTargetGradeUI` | `target-grade-ui.js` | Target Grade planner modal form and breakdown view |
| `window.ConnectifyTargetPlannerUI` | `target-planner-ui.js` | Planner facade delegating to Atar and Grade UI modules |
| `window.ConnectifyAtar` | `atar-ui.js` | Calculator modal shell and tab coordinator |
| `window.ConnectifyProgressMath` | `progress-math.js` | Historical ATAR trajectory and monthly aggregation |
| `window.ConnectifyProgressChart` | `progress-chart.js` | SVG polyline line chart and plotted data table renderer |
| `window.ConnectifyProgress` | `progress-graph.js` | Progress graph modal controller |
| `window.ConnectifyCompoundProgress` | `compound-progress.js` | Weighted category progress bars on subject cards |
| `window.ConnectifyWeakness` | `weakness-radar.js` | SVG spider/radar chart analyzer |
| `window.ConnectifyCalibration` | `scaling-calibration.js` | Semester 1 scaled scores calibration table |
| `window.ConnectifyCategorySettings` | `category-settings.js` | Category keyword settings and custom category management |
| `window.ConnectifyPredictorMath` | `predictor-math.js` | Logarithmic ceiling modeling, task prediction, outcome evaluation, ATAR projections |
| `window.ConnectifyPredictorUI` | `predictor-ui.js` | Predictor sidebar tool panel coordinator (Grade & ATAR Predictors) |
| `window.ConnectifyCountdown` | `wace-countdown.js` | Year 12 WACE exam countdown timer |
| `window.ConnectifyNotifications` | `notifications.js` | Universal toast and vertical stacked notifications engine |
| `window.ConnectifyNewGrade` | `new-grade.js` | Grade change detection, auto-expansion, and jump-to-card navigation |
| `window.ConnectifyDomSweeper` | `dom-sweeper.js` | DOM health monitor and component restoration |
| `window.ConnectifyIsUserActive` | `navigation.js` | Returns boolean indicating recent user interaction (<90s) |

---

## 4. Storage Key Taxonomy

| Key Pattern | Storage Type | Module | Description |
|---|---|---|---|
| `connectea:theme:v1` | `localStorage` | `theme.js` | Current theme (`'dark'` or `'light'`) |
| `connectea:theme:id` | `localStorage` | `theme-registry.js` | Active theme identifier (`'dark'`, `'quantum'`, `'amoled'`, `'midnight'`, `'forest'`, `'sunset'`, `'light'`, `'custom'`) |
| `connectea:theme:restore_dark` | `localStorage` | `theme.js` | Flag to restore dark mode after navigating away from login page |
| `connectea:theme:restore_theme` | `localStorage` | `theme-registry.js` | Saved theme ID to restore after navigating away from login page |
| `connectea:theme:custom_colors` | `localStorage` | `theme-registry.js` | Custom theme JSON palette (`canvas`, `surface`, `accent`) |
| `connectea:cohort:v3:<student>:<year>:<subject>` | `localStorage` | `cohort-estimator.js` | Custom user-override cohort size |
| `connectea:observed_spreads:<key>` | `sessionStorage` | `cohort-estimator.js` | Cached empirical IQR ratios |
| `connectea:task_type_overrides` | `localStorage` | `task-types.js` | Map of assessment manual category overrides |
| `connectea:class_categories:<subjectKey>` | `localStorage` | `task-types.js` | Custom categories shared across Sem 1 & 2 for a class |
| `cx-categories` / `connectea:categories` | `localStorage` & `browser.storage.local` | `category-settings.js` | Custom category definitions, keywords, colors |
| `connectea:atar:2025:<account>:<year>` | `localStorage` | `atar-calculator.js` | ATAR score adjustments, top four selections, targets |
| `connectea:preferences` | `localStorage` | `scaling-calibration.js` | Calibration table (`sem1_calibration:<courseId>`) |
| `connectify:weakness_disabled_subjects` | `localStorage` | `weakness-radar.js` | Array of subjects excluded from Weakness Analyzer |
| `connectea:time_override:<subject>:<task|taskId>` | `localStorage` | `progress-chart.js` | Manual school week overrides for assessments (disambiguated by task ID for duplicate names) |
| `connectify:auto_expand` | `localStorage` | `category-settings.js` / `atar-features.js` | Boolean setting to auto-expand course outlines on load |
| `connectify:stale_subjects` | `localStorage` | `assessment-data.js` / `new-grade.js` | Set of subjects whose collapsed grade/stats changed, awaiting targeted re-scrape upon expansion |
| `connectify:subjects_cache:<student>` | `localStorage` | `assessment-data.js` | Persisted scraped subjects and tasks for instant collection without DOM rescrape |
| `connectify:general_cohort_size` | `localStorage` | `category-settings.js` / `cohort-estimator.js` | Estimated year level cohort size (default: 500) |
| `connectify:atar_percentage` | `localStorage` | `category-settings.js` / `cohort-estimator.js` | Estimated ATAR pathway participation percentage (default: 60) |
| `connectify:grade_cache:<student>` | `localStorage` | `new-grade.js` | Cached running subject average marks for grade update notifications |
| `connectify:baseline:types:<account>` | `localStorage` | `category-settings.js` / `predictor-math.js` | Previous-year assessment category percentage averages |
| `connectify:baseline:subjects:<account>` | `localStorage` | `category-settings.js` / `predictor-math.js` | Previous-year enrolled subject final grade averages |
| `connectify:prediction:<account>:<subject>:<taskId>` | `localStorage` | `predictor-math.js` / `cohort-view.js` | Cached task prediction object (`{ low, mid, high, breakoutScore, type }`) |
| `connectify:prediction_version` | `localStorage` | `predictor-math.js` | Calculation version incrementer tracking when chronological prediction cache must be re-populated |
| `connectify:cache_version:<subsystem>` | `localStorage` | `assessment-data.js` | Independent invalidation keys (`predictor`, `results`, `settings`, `cohort`) |
| `connectify:stats_cache:<student>:<subject>:<task>` | `localStorage` | `assessment-data.js` | Cached 5-number boxplot quantiles and sample size |
| `cx-autologin-enabled` | `browser.storage.local` | `auto-login.js` | Boolean flag for auto-login on sign-in page |
| `cx-session-expired` | `browser.storage.local` | `navigation.js` / `auto-login.js` | Flag set when user session expires while idle |
| `cx-manual-logout` | `browser.storage.local` | `navigation.js` / `auto-login.js` | Flag set when user explicitly clicks logout |
| `cx-last-autologin` | `browser.storage.local` | `auto-login.js` | Timestamp to prevent rapid login loops (<30s) |

---

## 5. Custom DOM Events

| Event Name | Dispatcher | Listener(s) | Payload / Purpose |
|---|---|---|---|
| `connectify-open` | Tool toggles / sidebar | Tool panels | `detail: 'calculator' \| 'progress' \| 'weakness' \| 'categories' \| 'predictor' \| 'home'` — enforces single active tool |
| `connectify-baselines-updated` | `category-settings.js` / `predictor-math.js` | `predictor-ui.js` | Emitted when previous-year baseline averages are saved in Settings |
| `connectify-task-type-changed` | `task-types.js` | `cohort-stats.js`, `compound-progress.js`, `weakness-radar.js` | Dispatched when assessment category override changes |
| `connectify-settings-updated` | `scaling-calibration.js` | `atar-ui.js`, `compound-progress.js`, `progress-graph.js` | Dispatched when calibration scores or categories change |
| `connectify-cohort-invalidated` | `assessment-data.js` | `cohort-stats.js` | Dispatched when cohort caches are cleared to trigger refresh |
| `connectify-render-radar` | `weakness-radar.js` | `data.js` (`MAIN` world) | Highcharts chart options payload |
| `connectify-destroy-radar` | `weakness-radar.js` | `data.js` (`MAIN` world) | Cleans up Highcharts radar instance |

---

## 6. Critical DOM Selectors & Anchors

- **Course Tile**: `.eds-c-tile` (contains `.eds-c-tile__title`, `.eds-c-tile__header`, `.eds-c-accordion__section-heading`).
- **Assessment Task Row**: `.cvr-c-task` (overall row is outside `.cvr-c-tasks`; individual tasks are inside `.cvr-c-tasks`).
- **Task Details & Marks**:
  - Marks cell: `.cvr-c-task__marks .cvr-c-task__mark`
  - Highcharts host: `[data-highcharts-chart]` or `.cvr-c-task__chart`
  - Task labels: `.cvr-c-task__details .v-label`
- **Injected Containers**:
  - `#connectify-sidebar` & `#connectify-sidebar-handle`
  - `.connectea-panel` & `.connectea-row-wrapper`
  - `#cx-expand-progress` (Animated bulk outline expansion loading pill)
  - `#connectea-atar` (Calculator modal)
  - `#connectify-progress` (Progress graph modal)
  - `#connectify-weakness` (Weakness Analyzer panel)
  - `#connectify-categories` (Settings & Calibration panel)
  - `#connectify-wace-countdown` (Year 12 countdown banner)
  - `.cx-compound-progress-container` (Subject header progress bar)
  - `#cx-back-to-top-container` (Back to top button at bottom of outlines)
  - `#connectify-health-prompt` (Component restore banner)

---

*Back to [Overview](file:///Users/uwong/Downloads/2.1.14_0/overview.md)*
