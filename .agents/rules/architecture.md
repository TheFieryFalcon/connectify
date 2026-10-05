---
trigger: always_on
---

# Connectify Architecture Reference

This document details the world isolation model, script execution lifecycle, and single-page application (SPA) DOM sweeping architecture for the Connectify browser extension.

---

## 1. Architectural Overview

### World Isolation Model (MAIN vs ISOLATED)
Connectify executes across both the webpage's `MAIN` execution world and the extension's default `ISOLATED` world:
- **`MAIN` World** (`data.js`): Connect renders boxplots using Highcharts attached to `window.Highcharts`. Due to Chrome/Firefox Manifest V3 isolation, `ISOLATED` content scripts cannot access `window.Highcharts` directly. `data.js` runs in `MAIN` at `document_idle`, intercepts Highcharts series and points data, and stamps JSON-encoded boxplot stats onto DOM element attributes (`data-connectify-stats` and `data-connectify-n`).
- **`ISOLATED` World** (All other content scripts): Content scripts read `dataset.connectifyStats` and `dataset.connectifyN` synchronously from DOM nodes without triggering CSP errors or context violations.

### Execution Lifecycle & Dependency Pipeline
All scripts for the assessment outlines page (`/group/students/ui/my-settings/assessment-outlines*`) load in strict dependency sequence:
1. `assessment-cache.js` (DOM assessment cache)
2. `assessment-parser.js` (task row & score parser)
3. `assessment-expand.js` (bulk accordion expansion engine)
4. `assessment-data.js` (scraper coordinator & cache manager)
5. `cohort-math.js` (PCHIP interpolation & quantile stats)
6. `cohort-estimator.js` (baseline & empirical size estimation)
7. `task-types.js` (assessment categorizer & overrides)
8. `cohort-outcome.js` (outcome meter DOM & breakout evaluation)
9. `cohort-panel.js` (cohort panel DOM structure)
10. `cohort-view.js` (stats presentation coordinator)
11. `cohort-styles.js` (cohort styles & DOM utilities)
12. `cohort-stats.js` (cohort controller & mutation observer)
13. `scaling-data.js` (2025 TISC scaling curves)
14. `atar-math.js` (TEA/ATAR conversions & bonus rules)
15. `target-solver.js` (goal optimization solver)
16. `atar-scraper.js` (course & assessment scraper)
17. `atar-calculator.js` (course state & calculation engine)
18. `target-atar-ui.js` (Target ATAR modal view)
19. `target-grade-ui.js` (Target Grade modal view)
20. `target-planner-ui.js` (planner facade)
21. `atar-ui.js` (calculator modal controller)
22. `progress-math.js` (chronological ATAR trajectory)
23. `progress-chart.js` (SVG polyline line chart renderer)
24. `progress-graph.js` (progress graph modal controller)
25. `wace-countdown.js` (Year 12 exam countdown)
26. `compound-progress.js` (weighted completion progress bars)
27. `weakness-radar.js` (SVG radar/spider chart)
28. `scaling-calibration.js` (school scaling calibration editor)
29. `category-baselines.js` (baseline settings editor & storage)
30. `category-settings.js` (category keyword settings coordinator)
31. `predictor-engine.js` (core prediction math & algorithms)
32. `predictor-dates.js` (task date resolution & overrides)
33. `predictor-cache.js` (in-memory & storage prediction caching)
34. `predictor-math.js` (predictor coordinator & Grade/ATAR projections)
35. `predictor-grade-view.js` (subject grade predictor sub-tab renderer)
36. `predictor-ui.js` (predictor drawer controller)
37. `atar-features.js` (tools coordinator & expand buttons)
38. `sidebar-handle.js` (sidebar handle anchor & slide coordinator)
39. `sidebar.js` (slide-out tool drawer & launcher)
40. `notifications.js` (vertical stacked toast engine)
41. `new-grade.js` (grade change detector & jump-to-card dispatcher)
42. `dom-sweeper.js` (health check & component restoration)

### SPA Navigation & DOM Sweeping
Connect is built on Vaadin / Liferay SPA navigation where the DOM re-renders asynchronously on page transitions.
- Each module implements an active MutationObserver or debounced scheduler (`requestAnimationFrame`).
- `ConnectifyIsUserActive()` in `navigation.js` tracks user activity (`mousemove`, `keydown`, `scroll`, etc.) with a 90-second timeout to prevent background CPU waste during idle sessions.
- `dom-sweeper.js` monitors the DOM for missing injected components and prompts the user or auto-reinjects missing components upon dynamic view updates.

---

*Back to [Overview](file:///Users/uwong/Downloads/2.1.14_0/overview.md)*
