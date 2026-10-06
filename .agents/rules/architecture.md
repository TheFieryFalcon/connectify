---
trigger: always_on
---

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
1. `src/assessment/assessment-cache.js` (DOM assessment cache)
2. `src/assessment/assessment-parser.js` (task row & score parser)
3. `src/assessment/assessment-expand.js` (bulk accordion expansion engine)
4. `src/assessment/assessment-data.js` (scraper coordinator & cache manager)
5. `src/cohort/cohort-math.js` (PCHIP interpolation & quantile stats)
6. `src/cohort/cohort-estimator.js` (baseline & empirical size estimation)
7. `src/cohort/task-types.js` (assessment categorizer & overrides)
8. `src/cohort/cohort-outcome.js` (outcome meter DOM & breakout evaluation)
9. `src/cohort/cohort-panel.js` (cohort panel DOM structure)
10. `src/cohort/cohort-view.js` (stats presentation coordinator)
11. `src/cohort/cohort-styles.js` (cohort styles & DOM utilities)
12. `src/cohort/cohort-stats.js` (cohort controller & mutation observer)
13. `src/atar/scaling-data.js` (2025 TISC scaling curves)
14. `src/atar/atar-math.js` (TEA/ATAR conversions & bonus rules)
15. `src/atar/target-solver.js` (goal optimization solver)
16. `src/atar/atar-scraper.js` (course & assessment scraper)
17. `src/atar/atar-calculator.js` (course state & calculation engine)
18. `src/atar/target-atar-ui.js` (Target ATAR modal view)
19. `src/atar/target-grade-ui.js` (Target Grade modal view)
20. `src/atar/target-planner-ui.js` (planner facade)
21. `src/atar/atar-ui.js` (calculator modal controller)
22. `src/progress/progress-math.js` (chronological ATAR trajectory)
23. `src/progress/progress-chart.js` (SVG polyline line chart renderer)
24. `src/progress/progress-graph.js` (progress graph modal controller)
25. `src/progress/wace-countdown.js` (Year 12 exam countdown)
26. `src/progress/compound-progress.js` (weighted completion progress bars)
27. `src/progress/weakness-radar.js` (SVG radar/spider chart)
28. `src/atar/scaling-calibration.js` (school scaling calibration editor)
29. `src/predictor/category-baselines.js` (baseline settings editor & storage)
30. `src/predictor/category-settings.js` (category keyword settings coordinator)
31. `src/predictor/predictor-engine.js` (core prediction math & algorithms)
32. `src/predictor/predictor-dates.js` (task date resolution & overrides)
33. `src/predictor/predictor-cache.js` (in-memory & storage prediction caching)
34. `src/predictor/predictor-math.js` (predictor coordinator & Grade/ATAR projections)
35. `src/predictor/predictor-grade-view.js` (subject grade predictor sub-tab renderer)
36. `src/predictor/predictor-ui.js` (predictor drawer controller)
37. `src/atar/atar-features.js` (tools coordinator & expand buttons)
38. `src/sidebar/sidebar-handle.js` (sidebar handle anchor & slide coordinator)
39. `src/sidebar/sidebar.js` (slide-out tool drawer & launcher)
40. `src/system/notifications.js` (vertical stacked toast engine)
41. `src/system/new-grade.js` (grade change detector & jump-to-card dispatcher)
42. `src/system/dom-sweeper.js` (health check & component restoration)

### SPA Navigation & DOM Sweeping
Connect is built on Vaadin / Liferay SPA navigation where the DOM re-renders asynchronously on page transitions.
- Each module implements an active MutationObserver or debounced scheduler (`requestAnimationFrame`).
- `ConnectifyIsUserActive()` in `navigation.js` tracks user activity (`mousemove`, `keydown`, `scroll`, etc.) with a 90-second timeout to prevent background CPU waste during idle sessions.
- `dom-sweeper.js` monitors the DOM for missing injected components and prompts the user or auto-reinjects missing components upon dynamic view updates.

---

*Back to [Overview](file:///Users/uwong/Downloads/2.1.14_0/overview.md)*
