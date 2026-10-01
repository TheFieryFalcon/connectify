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
1. `assessment-data.js` (DOM scraping & task caching)
2. `cohort-math.js` (PCHIP interpolation & quantile stats)
3. `cohort-estimator.js` (baseline & empirical size estimation)
4. `task-types.js` (assessment categorizer & overrides)
5. `cohort-view.js` (panel DOM creation & mark rendering)
6. `cohort-stats.js` (cohort controller & mutation observer)
7. `scaling-data.js` (2025 TISC scaling curves)
8. `atar-math.js` (TEA/ATAR conversions & bonus rules)
9. `target-solver.js` (goal optimization solver)
10. `atar-scraper.js` (course & assessment scraper)
11. `atar-calculator.js` (course state & calculation engine)
12. `target-atar-ui.js` (Target ATAR modal view)
13. `target-grade-ui.js` (Target Grade modal view)
14. `target-planner-ui.js` (planner facade)
15. `atar-ui.js` (calculator modal controller)
16. `progress-math.js` (chronological ATAR trajectory)
17. `progress-chart.js` (SVG polyline line chart renderer)
18. `progress-graph.js` (progress graph modal controller)
19. `wace-countdown.js` (Year 12 exam countdown)
20. `compound-progress.js` (weighted completion progress bars)
21. `weakness-radar.js` (SVG radar/spider chart)
22. `scaling-calibration.js` (school scaling calibration editor)
23. `category-settings.js` (category keyword settings)
24. `predictor-math.js` (prediction math engine)
25. `predictor-ui.js` (Grade & ATAR predictor drawer tool)
26. `atar-features.js` (tools coordinator & expand buttons)
27. `sidebar.js` (slide-out tool drawer & launcher)
28. `notifications.js` (vertical stacked toast engine)
29. `new-grade.js` (grade change detector & jump-to-card dispatcher)
30. `dom-sweeper.js` (health check & component restoration)

### SPA Navigation & DOM Sweeping
Connect is built on Vaadin / Liferay SPA navigation where the DOM re-renders asynchronously on page transitions.
- Each module implements an active MutationObserver or debounced scheduler (`requestAnimationFrame`).
- `ConnectifyIsUserActive()` in `navigation.js` tracks user activity (`mousemove`, `keydown`, `scroll`, etc.) with a 90-second timeout to prevent background CPU waste during idle sessions.
- `dom-sweeper.js` monitors the DOM for missing injected components and prompts the user or auto-reinjects missing components upon dynamic view updates.

---

*Back to [Overview](file:///Users/uwong/Downloads/2.1.14_0/overview.md)*
