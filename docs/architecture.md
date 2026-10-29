# Connectify Architecture Reference

This document details the world isolation model, script execution lifecycle, and single-page application (SPA) DOM sweeping architecture for the Connectify browser extension.

---

## 1. Architectural Overview

### World Isolation Model (MAIN vs ISOLATED)
Connectify executes across both the webpage's `MAIN` execution world and the extension's default `ISOLATED` world:
- **Connect's API** (since October 2026 the outlines page is Angular with canvas boxplots): `outline-api.js` reads the outlines and every boxplot from `/connectapi/rest/api/v1/app/student/` (`default_student`, `assessmentOutlines`, `assessmentOutlines/chart`; `X-XSRF-TOKEN` from the `CONNECT_XSRF` cookie). Caches fill from these records, never the page; `legacy-outlines.js` draws Connect's cards again in the old Vaadin markup from them, before Connect renders (Connect fetches each boxplot in turn and shows nothing for ~13s; Connectify draws at ~2.7s, boxplots filling in by ~7s).
- **`MAIN` World** (`src/system/data.js`): Connect rendered boxplots using Highcharts attached to `window.Highcharts`. Due to Chrome/Firefox Manifest V3 isolation, `ISOLATED` content scripts cannot access `window.Highcharts` directly. `data.js` runs in `MAIN` at `document_idle`, intercepts Highcharts series and points data, and stamps JSON-encoded boxplot stats onto DOM element attributes (`data-connectify-stats` and `data-connectify-n`).
- **`ISOLATED` World** (All other content scripts): Content scripts read `dataset.connectifyStats` and `dataset.connectifyN` synchronously from DOM nodes without triggering CSP errors or context violations. Globals never cross worlds (e.g. `ConnectifyIsAccordionAnimating` is invisible to `data.js`); requests go through DOM events.

### Execution Lifecycle & Dependency Pipeline
All scripts for the assessment outlines page (`/group/students/ui/my-settings/assessment-outlines*`) load in strict dependency sequence under `src/`:
1. `src/system/scheduler.js` (shared page observer and heartbeat; first in every isolated group)
2. `src/system/utils.js` (shared helpers: `normalize`, the signed-in user's account and `userKey`, storage key scans, baseline keys), then `src/system/user-settings-migrate.js` (once: shared student settings move to the signed-in student's keys)
3. `src/assessment/cache-versions.js` (subsystem cache versions and isolated clearing, ConnectifyCache)
4. `src/assessment/assessment-cache.js` (in-memory subjects and persistent stats cache)
4b. `src/assessment/school-terms.js` (generated WA term dates, Early Easter choice, a date's term and week)
5. `src/assessment/assessment-parse-helpers.js` (order hints, cohort mean, weighted mean)
6. `src/assessment/assessment-parser.js` (task row & score parser; `taskRecord` shared with API records)
6a. `src/assessment/outline-api.js` (Connect's outlines and boxplots from its API, one record per card)
6b. `src/assessment/assessment-api-parse.js` (API records as the parser's tasks, with the old rows' ids)
7. `src/assessment/class-semesters.js` (class registry by semester, current-semester detection, new-year trigger)
7a. `src/system/overhaul-notice.js` (once, upgrading to 3.3.0: semester filter off and a popup on Connect's overhaul; before the filter reads it)
7b. `src/assessment/semester-filter-notice.js` (message in place of outlines the semester filter hides entirely)
8. `src/assessment/semester-filter.js` ("Show this semester's classes only": hidden tiles, refreshed cards, filtered tool data)
9. `src/assessment/assessment-expand-progress.js` (Expand All progress pill and scroll freeze)
10. `src/assessment/assessment-accordion-watch.js` (single accordion animation guard and card refresh)
11. `src/assessment/assessment-expand.js` (paced Expand All / Collapse All)
12. `src/assessment/assessment-scrape.js` (per-card task scraping and chronological order)
13. `src/assessment/assessment-data.js` (scraper coordinator & cache manager)
13a. `src/assessment/legacy-outlines-markup.js` / `legacy-outlines.js` (Connect's cards drawn again in the old Vaadin markup; styles `legacy-outlines.css`)
14. `src/cohort/cohort-math.js` (PCHIP interpolation & quantile stats)
15. `src/cohort/cohort-size-baselines.js` (typical cohort sizes per subject and year level)
16. `src/cohort/cohort-estimator.js` (cohort size estimate refined by boxplot spreads)
17. `src/cohort/category-store.js` (default and saved assessment categories)
18. `src/cohort/task-types.js` (assessment categorizer & overrides)
19. `src/cohort/task-type-select.js` (row metadata, Type dropdown and Auto rescan)
20. `src/cohort/cohort-outcome.js` (outcome meter DOM & breakout evaluation)
21. `src/cohort/cohort-row-readers.js` (task row mark and boxplot readers, DOM helpers)
21a. `src/cohort/cohort-panel-view.js` (Statistics Panels setting, read once per page load)
21b. `src/cohort/cohort-expanded.js` (expanded statistics and prediction cards, Score colour step)
22. `src/cohort/cohort-panel.js` (statistics panel, Type dropdown and cohort size input)
23. `src/cohort/cohort-outcome-eval.js` (outcome meter evaluation and first-task suppression)
24. `src/cohort/cohort-forecast.js` (Low / Mid / High prediction panel on unmarked rows)
24b. `src/cohort/cohort-upcoming.js` (class prediction panel on the overall row of a class without a letter)
24c. `src/cohort/cohort-subject-average.js` (restores Connect's missing overall row in Connect's own container)
24d. `src/cohort/cohort-grade-range.js` (lowest and highest final mark still possible on a class's overall row)
25. `src/cohort/cohort-view.js` (row rendering with memoised inputs)
26. `src/cohort/cohort-styles.js` (cohort styles & DOM utilities)
27. `src/cohort/cohort-stats.js` (two-pass cohort controller and pass scheduler)
28. `src/cohort/cohort-observer.js` (page observer, lifecycle and display scale)
29. `src/atar/scaling-data.js` (TISC scaled-score statistics per course)
30. `src/atar/atar-math.js` (TEA/ATAR conversions & bonus rules)
31. `src/atar/target-difficulty.js` (difficulty-weighted task model shared by both solvers)
32. `src/atar/target-solver.js` (goal optimization solver)
33. `src/atar/atar-scraper.js` (ATAR courses per semester from the centralized cache)
34. `src/atar/atar-calculator.js` (course state & calculation engine)
35. `src/atar/target-ui-helpers.js` (planner view helpers and Expand Subject Outlines button)
36. `src/atar/target-atar-breakdown.js` (Target ATAR plan banner and per-task breakdown)
37. `src/atar/target-atar-ui.js` (Target ATAR modal view)
38. `src/atar/target-grade-ui.js` (Target Grade modal view)
39. `src/atar/target-planner-ui.js` (planner facade)
39a. `src/atar/grade-estimate.js` (Estimate Grade math: average with typed marks on unmarked tasks)
39b. `src/atar/grade-estimate-ui.js` (Estimate Grade view)
39c. `src/goals/` goal-difficulty, goal-store, goal-plan, goal-replay, goal-modal, goal-sliders, goal-dialog, goal-list-ui, goal-editor, goal-celebrate, goal-events, goal-bars, goal-forecast, then `src/atar/grade-estimate-goal.js` (Goals: `modules_goals.md`)
40. `src/atar/atar-ui-markup.js` (calculator panel markup, Goals / Estimates groups and mode tabs, semester labels and closing rules)
41. `src/atar/atar-ui.js` (calculator controller: Goals and Estimates modes)
42. `src/progress/progress-math.js` (chronological ATAR trajectory)
42b. `src/progress/progress-semester-divider.js` (dashed Semester 1 | Semester 2 line on every progress chart) / `progress-goal-line.js` (each task's goal target as a dashed line from the last score; ATAR goal line)
43. `src/progress/progress-chart.js` (SVG polyline line chart renderer)
44. `src/progress/progress-week-editor.js` (school week override cells in the Progress Graph table)
44b. `src/progress/progress-modes.js` (Progress data point modes: single tasks, weighted or rolling average) / `progress-early-easter.js` (the Early Easter checkbox shared by the graph and the export)
45. `src/progress/progress-panel.js` (Progress launcher and panel markup)
46. `src/progress/progress-graph.js` (progress graph modal controller)
46b. `src/progress/export-tasks.js` (upcoming tasks placed on days for the export)
46c. `src/progress/export-ics.js` / `export-csv.js` (Google Calendar .ics and Notion CSV builders) / `export-rows.js` (one subject's export rows)
46d. `src/progress/export-view.js` (Progress Export view: task ticks, weekdays, downloads)
47. `src/progress/wace-countdown.js` (Year 12 exam countdown)
48. `src/progress/compound-progress.js` (weighted completion progress bars)
49. `src/progress/weakness-radar-view.js` (radar SVG, status messages and panel markup)
50. `src/progress/weakness-radar.js` (SVG radar/spider chart)
51. `src/atar/scaling-calibration.js` (school scaling calibration editor)
52. `src/predictor/category-baselines.js` (baseline settings editor & storage)
53. `src/predictor/settings-markup.js` (settings panel markup)
54. `src/predictor/settings-semester-filter.js` ("Show this semester's classes only" checkbox)
54b. `src/predictor/settings-panel-view.js` (Statistics Panels dropdown)
55. `src/predictor/settings-preferences.js` (general preferences, theme list, wallpaper, cache clearing)
56. `src/predictor/category-settings.js` (category keyword settings coordinator)
57. `src/predictor/predictor-baselines.js` (previous-year baselines store)
58. `src/predictor/predictor-engine.js` (core prediction math & algorithms)
59. `src/predictor/predictor-history.js` (completed-result history, overall and prior to a task)
60. `src/predictor/predictor-dates.js` (task date resolution & overrides)
61. `src/predictor/predictor-store.js` (prediction persistence and version stamp)
62. `src/predictor/predictor-cache.js` (in-memory & storage prediction caching)
63. `src/predictor/predictor-grade-projection.js` (subject grade projection)
64. `src/predictor/predictor-atar-projection.js` (ATAR projection)
65. `src/predictor/predictor-math.js` (predictor coordinator & Grade/ATAR projections)
66. `src/predictor/year-rollover.js` (new school year: last year's averages become baselines, last year archived)
67. `src/predictor/predictor-task-cards.js` (upcoming assessment cards with escaped names)
67b. `src/predictor/predictor-tab-scroll.js` (plain scrollbar under the subject tabs, no hover change)
68. `src/predictor/predictor-grade-view.js` (subject grade predictor sub-tab renderer)
69. `src/predictor/predictor-atar-view.js` (predictor panel shell and ATAR view)
70. `src/predictor/predictor-ui.js` (predictor drawer controller)
70b. `src/atar/outline-jump.js` (Jump To subject dropdown above Expand/Collapse All)
71. `src/atar/outline-controls.js` (floating Expand/Collapse All and Back to top)
72. `src/atar/atar-features.js` (tools coordinator and startup auto-expand)
73. `src/sidebar/sidebar-handle-position.js` (handle anchoring and viewport centring maths)
74. `src/sidebar/sidebar-handle.js` (sidebar handle anchor & slide coordinator)
75. `src/sidebar/sidebar-hover.js` (left-edge expand and hover collapse)
76. `src/sidebar/sidebar-filter.js` (outline filter detection for the new-year rollover; presses the top-level "All" with a full mouse press)
76b. `src/sidebar/sidebar-page-notice.js` (off-outlines notice; Settings is the only tool that works on every page)
77. `src/sidebar/sidebar-tools.js` (launcher buttons, tool panels and pressed state)
78. `src/sidebar/sidebar-shell.js` (drawer shell construction and attachment)
79. `src/sidebar/sidebar.js` (slide-out tool drawer & launcher)
80. `src/system/notifications.js` (vertical stacked toast engine)
81. `src/system/update-notice.js` ("Connectify updated" toast linking to the changelog)
82. `src/system/grade-snapshot.js` (subject running marks compared with the grade cache)
82b. `src/system/grade-tasks.js` (newly marked tasks on outlines whose task rows are on screen)
83. `src/system/new-grade.js` (grade change detector & jump-to-card dispatcher)
84. `src/system/dom-sweeper.js` (health check & component restoration)

**Document start** (every Connect page, before Connect renders): `src/system/pointer-kind.js` (`<html data-cx-mouse>` after a mouse input, so touch targets stay normal size) and `src/theme/theme-boot.js` (the last theme's snapshot stamped on `<html>`, so a reload never flashes white; Chrome-safe wallpaper URLs).

**Background** (`src/system/update-reload.js`, GitHub and Firefox builds only; the Chrome Web Store zip drops it with `host_permissions`): browsers never load a new version into open tabs (Firefox leaves the old drawer with dead buttons), so after an install or update every open Connect tab is reloaded (`tabs.query` needs the Connect host permission in Chrome).

**Other Connect pages** load a sidebar-only group (`exclude_matches` the outlines page and login URLs; login and logged-out pages never build the drawer, `ConnectifyThemeAuth.isAuthDisabled()`): scheduler, utils, the assessment cache and data modules, categories, the predictor model, Settings (calibration, baselines, preferences) and the sidebar, in the order above. `ConnectifyUtils.isOutlinesPage()` keeps `collect()`, semester detection and the semester filter off other pages' tiles there, so tools read only the cache.

### SPA Navigation & DOM Sweeping
Connect is built on Vaadin / Liferay SPA navigation where the DOM re-renders asynchronously on page transitions.
- `scheduler.js` (`ConnectifyScheduler`) owns the one page-wide MutationObserver (child lists, text, and `class`/chart attributes) and the one 500ms heartbeat. Modules subscribe with `onMutations(callback, { filter, mute })` (records batched per frame; `mute` skips accordion animations and Expand All) and `every(ms, fn, { whenActive, whenVisible, mute, when })` (idle users, hidden tabs and closed panels are skipped). Only the sidebar's workspace observer and short startup polls stay local.
- The `MAIN`-world bridge has no timer of its own: isolated scripts dispatch `connectify-sync-charts` (`ConnectifyDataSyncCharts()`) after accordions open and on the heartbeat.
- `ConnectifyIsUserActive()` in `navigation.js` tracks user activity (`mousemove`, `keydown`, `scroll`, etc.) with a 90-second timeout to prevent background CPU waste during idle sessions.
- `dom-sweeper.js` monitors the DOM for missing injected components and prompts the user or auto-reinjects missing components upon dynamic view updates.

### Global Theme & Customization Pipeline
Themes execute site-wide across all Connect pages (`https://connect.det.wa.edu.au/*`):
- **Scripts**: `theme-auth.js` $\to$ `theme-custom-tokens.js` $\to$ `theme-wallpaper-dim.js` $\to$ `theme-palettes.js` $\to$ `theme-wallpaper-presets.js` (before the registry, which resolves a theme's preset wallpaper at startup) $\to$ `theme-registry.js` $\to$ `theme-custom-themes.js` $\to$ customizer (`theme-color-utils.js`, `theme-oklch.js`, `theme-token-derive.js`, `theme-glass-tokens.js`, `theme-wallpaper-fit.js`, `theme-wallpaper-crop.js`, `theme-wallpaper-migrate.js`, `theme-customizer-tokens.js`, `theme-ctme.js`, `theme-import.js`, `theme-customizer-markup.js`, `theme-customizer-popover.js`, `theme-customizer-controls.js`, `theme-customizer.js`) $\to$ `theme-surface-adapter.js` $\to$ `theme-toggle.js` $\to$ `theme-menu.js` $\to$ `theme.js` $\to$ `theme-request.js` (page-world theme requests, used by the audit).
- **Stylesheets**: `src/theme/styles/*.css` in manifest order, ending with `theme.css` (Liquid Glass geometry and opaque solid-theme panels), then `src/system/touch-targets.css` (44px touch targets on touchscreens until a mouse is used) and `src/system/webkit-buttons.css` (iPadOS / iOS only: Connectify buttons without native appearance, so WebKit never rounds them).

---

*Back to [Overview](file:///Users/uwong/Downloads/2.1.14_0/overview.md)*
