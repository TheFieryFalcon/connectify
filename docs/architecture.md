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
2. `src/assessment/assessment-cache.js` (DOM assessment cache)
3. `src/assessment/assessment-parser.js` (task row & score parser)
4. `src/assessment/assessment-expand.js` (bulk accordion expansion engine)
5. `src/assessment/assessment-data.js` (scraper coordinator & cache manager)
6. `src/cohort/cohort-math.js` (PCHIP interpolation & quantile stats)
7. `src/cohort/cohort-estimator.js` (baseline & empirical size estimation)
8. `src/cohort/task-types.js` (assessment categorizer & overrides)
9. `src/cohort/cohort-outcome.js` (outcome meter DOM & breakout evaluation)
10. `src/cohort/cohort-panel.js` (cohort panel DOM structure)
11. `src/cohort/cohort-view.js` (stats presentation coordinator)
12. `src/cohort/cohort-styles.js` (cohort styles & DOM utilities)
13. `src/cohort/cohort-stats.js` (cohort controller & mutation observer)
14. `src/atar/scaling-data.js` (2025 TISC scaling curves)
15. `src/atar/atar-math.js` (TEA/ATAR conversions & bonus rules)
16. `src/atar/target-solver.js` (goal optimization solver)
17. `src/atar/atar-scraper.js` (course & assessment scraper)
18. `src/atar/atar-calculator.js` (course state & calculation engine)
19. `src/atar/target-atar-ui.js` (Target ATAR modal view)
20. `src/atar/target-grade-ui.js` (Target Grade modal view)
21. `src/atar/target-planner-ui.js` (planner facade)
22. `src/atar/atar-ui.js` (calculator modal controller)
23. `src/progress/progress-math.js` (chronological ATAR trajectory)
24. `src/progress/progress-chart.js` (SVG polyline line chart renderer)
25. `src/progress/progress-graph.js` (progress graph modal controller)
26. `src/progress/wace-countdown.js` (Year 12 exam countdown)
27. `src/progress/compound-progress.js` (weighted completion progress bars)
28. `src/progress/weakness-radar.js` (SVG radar/spider chart)
29. `src/atar/scaling-calibration.js` (school scaling calibration editor)
30. `src/predictor/category-baselines.js` (baseline settings editor & storage)
31. `src/predictor/category-settings.js` (category keyword settings coordinator)
32. `src/predictor/predictor-engine.js` (core prediction math & algorithms)
33. `src/predictor/predictor-dates.js` (task date resolution & overrides)
34. `src/predictor/predictor-cache.js` (in-memory & storage prediction caching)
35. `src/predictor/predictor-math.js` (predictor coordinator & Grade/ATAR projections)
36. `src/predictor/predictor-grade-view.js` (subject grade predictor sub-tab renderer)
37. `src/predictor/predictor-ui.js` (predictor drawer controller)
38. `src/atar/atar-features.js` (tools coordinator & expand buttons)
39. `src/sidebar/sidebar-handle-position.js` (handle anchoring and viewport centring maths)
40. `src/sidebar/sidebar-handle.js` (sidebar handle anchor & slide coordinator)
41. `src/sidebar/sidebar-hover.js` (left-edge expand and hover collapse)
42. `src/sidebar/sidebar-filter.js` (outline filter detection and Back to All notice)
43. `src/sidebar/sidebar-tools.js` (launcher buttons, tool panels and pressed state)
44. `src/sidebar/sidebar-shell.js` (drawer shell construction and attachment)
45. `src/sidebar/sidebar.js` (slide-out tool drawer & launcher)
46. `src/system/notifications.js` (vertical stacked toast engine)
47. `src/system/new-grade.js` (grade change detector & jump-to-card dispatcher)
48. `src/system/dom-sweeper.js` (health check & component restoration)

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
