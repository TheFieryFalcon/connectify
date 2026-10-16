# Connectify Architecture Reference

This document details the world isolation model, script execution lifecycle, and single-page application (SPA) DOM sweeping architecture for the Connectify browser extension.

---

## 1. Architectural Overview

### World Isolation Model (MAIN vs ISOLATED)
Connectify executes across both the webpage's `MAIN` execution world and the extension's default `ISOLATED` world:
- **`MAIN` World** (`src/system/data.js`): Connect renders boxplots using Highcharts attached to `window.Highcharts`. Due to Chrome/Firefox Manifest V3 isolation, `ISOLATED` content scripts cannot access `window.Highcharts` directly. `data.js` runs in `MAIN` at `document_idle`, intercepts Highcharts series and points data, and stamps JSON-encoded boxplot stats onto DOM element attributes (`data-connectify-stats` and `data-connectify-n`).
- **`ISOLATED` World** (All other content scripts): Content scripts read `dataset.connectifyStats` and `dataset.connectifyN` synchronously from DOM nodes without triggering CSP errors or context violations.

### Execution Lifecycle & Dependency Pipeline
All scripts for the assessment outlines page (`/group/students/ui/my-settings/assessment-outlines*`) load in strict dependency sequence under `src/`:
1. `src/system/utils.js` (shared helpers: `normalize`, storage key scans, baseline keys)
2. `src/assessment/cache-versions.js` (subsystem cache versions and isolated clearing, ConnectifyCache)
3. `src/assessment/assessment-cache.js` (in-memory subjects and persistent stats cache)
4. `src/assessment/assessment-parse-helpers.js` (order hints, cohort mean, weighted mean)
5. `src/assessment/assessment-parser.js` (task row & score parser)
6. `src/assessment/assessment-expand-progress.js` (Expand All progress pill and scroll freeze)
7. `src/assessment/assessment-accordion-watch.js` (single accordion animation guard and card refresh)
8. `src/assessment/assessment-expand.js` (paced Expand All / Collapse All)
9. `src/assessment/assessment-scrape.js` (per-card task scraping and chronological order)
10. `src/assessment/assessment-data.js` (scraper coordinator & cache manager)
11. `src/cohort/cohort-math.js` (PCHIP interpolation & quantile stats)
12. `src/cohort/cohort-size-baselines.js` (typical cohort sizes per subject and year level)
13. `src/cohort/cohort-estimator.js` (cohort size estimate refined by boxplot spreads)
14. `src/cohort/category-store.js` (default and saved assessment categories)
15. `src/cohort/task-types.js` (assessment categorizer & overrides)
16. `src/cohort/task-type-select.js` (row metadata, Type dropdown and Auto rescan)
17. `src/cohort/cohort-outcome.js` (outcome meter DOM & breakout evaluation)
18. `src/cohort/cohort-row-readers.js` (task row mark and boxplot readers, DOM helpers)
19. `src/cohort/cohort-panel.js` (statistics panel, Type dropdown and cohort size input)
20. `src/cohort/cohort-outcome-eval.js` (outcome meter evaluation and first-task suppression)
21. `src/cohort/cohort-view.js` (row rendering with memoised inputs)
22. `src/cohort/cohort-styles.js` (cohort styles & DOM utilities)
23. `src/cohort/cohort-stats.js` (two-pass cohort controller and pass scheduler)
24. `src/cohort/cohort-observer.js` (page observer, lifecycle and display scale)
25. `src/atar/scaling-data.js` (2025 TISC scaling curves)
26. `src/atar/atar-math.js` (TEA/ATAR conversions & bonus rules)
27. `src/atar/target-difficulty.js` (difficulty-weighted task model shared by both solvers)
28. `src/atar/target-solver.js` (goal optimization solver)
29. `src/atar/atar-scraper.js` (course & assessment scraper)
30. `src/atar/atar-calculator.js` (course state & calculation engine)
31. `src/atar/target-ui-helpers.js` (planner view helpers and Expand Subject Outlines button)
32. `src/atar/target-atar-breakdown.js` (Target ATAR plan banner and per-task breakdown)
33. `src/atar/target-atar-ui.js` (Target ATAR modal view)
34. `src/atar/target-grade-ui.js` (Target Grade modal view)
35. `src/atar/target-planner-ui.js` (planner facade)
36. `src/atar/atar-ui-markup.js` (calculator panel markup, semester labels and closing rules)
37. `src/atar/atar-ui.js` (calculator modal controller)
38. `src/progress/progress-math.js` (chronological ATAR trajectory)
39. `src/progress/progress-chart.js` (SVG polyline line chart renderer)
40. `src/progress/progress-graph.js` (progress graph modal controller)
41. `src/progress/wace-countdown.js` (Year 12 exam countdown)
42. `src/progress/compound-progress.js` (weighted completion progress bars)
43. `src/progress/weakness-radar.js` (SVG radar/spider chart)
44. `src/atar/scaling-calibration.js` (school scaling calibration editor)
45. `src/predictor/category-baselines.js` (baseline settings editor & storage)
46. `src/predictor/settings-markup.js` (settings panel markup)
47. `src/predictor/settings-preferences.js` (general preferences, theme list, wallpaper, cache clearing)
48. `src/predictor/category-settings.js` (category keyword settings coordinator)
49. `src/predictor/predictor-baselines.js` (previous-year baselines store)
50. `src/predictor/predictor-engine.js` (core prediction math & algorithms)
51. `src/predictor/predictor-history.js` (completed-result history, overall and prior to a task)
52. `src/predictor/predictor-dates.js` (task date resolution & overrides)
53. `src/predictor/predictor-store.js` (prediction persistence and version stamp)
54. `src/predictor/predictor-cache.js` (in-memory & storage prediction caching)
55. `src/predictor/predictor-grade-projection.js` (subject grade projection)
56. `src/predictor/predictor-atar-projection.js` (ATAR projection)
57. `src/predictor/predictor-math.js` (predictor coordinator & Grade/ATAR projections)
58. `src/predictor/year-rollover.js` (new school year: last year's averages become baselines)
59. `src/predictor/predictor-task-cards.js` (upcoming assessment cards with escaped names)
60. `src/predictor/predictor-grade-view.js` (subject grade predictor sub-tab renderer)
61. `src/predictor/predictor-atar-view.js` (predictor panel shell and ATAR view)
62. `src/predictor/predictor-ui.js` (predictor drawer controller)
63. `src/atar/outline-controls.js` (floating Expand/Collapse All and Back to top)
64. `src/atar/atar-features.js` (tools coordinator and startup auto-expand)
65. `src/sidebar/sidebar-handle-position.js` (handle anchoring and viewport centring maths)
66. `src/sidebar/sidebar-handle.js` (sidebar handle anchor & slide coordinator)
67. `src/sidebar/sidebar-hover.js` (left-edge expand and hover collapse)
68. `src/sidebar/sidebar-filter.js` (outline filter detection and Back to All notice)
69. `src/sidebar/sidebar-tools.js` (launcher buttons, tool panels and pressed state)
70. `src/sidebar/sidebar-shell.js` (drawer shell construction and attachment)
71. `src/sidebar/sidebar.js` (slide-out tool drawer & launcher)
72. `src/system/notifications.js` (vertical stacked toast engine)
73. `src/system/new-grade.js` (grade change detector & jump-to-card dispatcher)
74. `src/system/dom-sweeper.js` (health check & component restoration)

### SPA Navigation & DOM Sweeping
Connect is built on Vaadin / Liferay SPA navigation where the DOM re-renders asynchronously on page transitions.
- Each module implements an active MutationObserver or debounced scheduler (`requestAnimationFrame`).
- `ConnectifyIsUserActive()` in `navigation.js` tracks user activity (`mousemove`, `keydown`, `scroll`, etc.) with a 90-second timeout to prevent background CPU waste during idle sessions.
- `dom-sweeper.js` monitors the DOM for missing injected components and prompts the user or auto-reinjects missing components upon dynamic view updates.

### Global Theme & Customization Pipeline
Themes execute site-wide across all Connect pages (`https://connect.det.wa.edu.au/*`):
- **Scripts**: `theme-auth.js` $\to$ `theme-custom-tokens.js` $\to$ `theme-palettes.js` $\to$ `theme-registry.js` $\to$ `theme-custom-themes.js` $\to$ customizer (`theme-color-utils.js`, `theme-customizer-markup.js`, `theme-customizer-controls.js`, `theme-customizer.js`) $\to$ `theme-surface-adapter.js` $\to$ `theme-toggle.js` $\to$ `theme-menu.js` $\to$ `theme.js`.
- **Stylesheets**: `src/theme/styles/*.css` in manifest order, ending with `theme.css` (Liquid Glass geometry and opaque solid-theme panels).

---

*Back to [Overview](file:///Users/uwong/Downloads/2.1.14_0/overview.md)*
