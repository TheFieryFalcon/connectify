# Connectify Context & Development Rules

All development in this repository must strictly adhere to `design_rules.md` and all architectural specifications in `docs/`. This rule is always active across all conversations.

---

## 1. Core Design Rules (`design_rules.md`)
- **Palette**: Canvas `#12171f` (Dark) / `#f7f9fc` (Light), Nav `#1a222d` / `#ffffff`, Tiles `#1e2632` (border `#2e3c4e`), Cohort Panel `#15263a` (border `#264669`, text `#d6e8f8`), Summary marks `#161e29`.
- **Contrast & Typography**: WCAG AA $\ge 5:1$ contrast ratio on all foreground/backgrounds. 1:1 bolding parity between light/dark modes (`700` on task titles, marks, stats headers; `400` on secondary labels). Dark mode disabled on login page (`/login`) and restored after login.
- **Sidebar & Handle**: 30px handle (`#connectify-sidebar-handle`), anchors directly to Connect native sidebar (`height >= 120`) scrolling synchronously; falls back to dynamic viewport vertical centering (`rect.top <= 25`). Drawer expands to 900px (`.cx-tool-active`) with `← Back to Menu`. Left-edge expand (`clientX <= 12`), outside click dismiss.
- **Outcome Meter**: Width 18px, height 56px. 4 baseline segments (Red, Orange, Yellow, Green). Secret Purple breakout segment (height 20px) when score $> 1.10 \times \text{High}$ (strictly secret threshold). Critical shortfall: 0 segments with red pulsing alarm glow (`.connectea-outcome-critical`). Suppressed on unmarked tasks and first task lacking baseline. Singleton floating tooltip (`#connectea-outcome-tooltip`), `pointer-events: none !important;` on segments.
- **Math Modeling**: Logarithmic headroom compression above 80% ($\frac{100 - \text{Score}}{20}$). Calibrated variance scaling preventing spread explosion on volatile subjects.
- **Runtime & Safety**: World isolation (MAIN `data.js` stamps dataset vs ISOLATED content scripts). Zero-flicker observers with activity tracking (`ConnectifyIsUserActive`).
- **Subsystem Invalidation**: Independent invalidation keys (`connectify:cache_version:<subsystem>`). Increment version on math changes. Isolated clearing.
- **Brevity & Size Standards**: Code/CSS files $\le 500$ lines (except `test_suite.js`). Markdown docs $\le 150$ lines each.

---

## 2. Architecture & 42-Script Dependency Pipeline (`docs/architecture.md`)
Main world `data.js` extracts Highcharts boxplot quantiles onto DOM `dataset.connectifyStats`.
Isolated world content scripts execute in exact dependency order:
1. `assessment-cache.js` 2. `assessment-parser.js` 3. `assessment-expand.js` 4. `assessment-data.js` 5. `cohort-math.js` 6. `cohort-estimator.js` 7. `task-types.js` 8. `cohort-outcome.js` 9. `cohort-panel.js` 10. `cohort-view.js` 11. `cohort-styles.js` 12. `cohort-stats.js` 13. `scaling-data.js` 14. `atar-math.js` 15. `target-solver.js` 16. `atar-scraper.js` 17. `atar-calculator.js` 18. `target-atar-ui.js` 19. `target-grade-ui.js` 20. `target-planner-ui.js` 21. `atar-ui.js` 22. `progress-math.js` 23. `progress-chart.js` 24. `progress-graph.js` 25. `wace-countdown.js` 26. `compound-progress.js` 27. `weakness-radar.js` 28. `scaling-calibration.js` 29. `category-baselines.js` 30. `category-settings.js` 31. `predictor-engine.js` 32. `predictor-dates.js` 33. `predictor-cache.js` 34. `predictor-math.js` 35. `predictor-grade-view.js` 36. `predictor-ui.js` 37. `atar-features.js` 38. `sidebar-handle.js` 39. `sidebar.js` 40. `notifications.js` 41. `new-grade.js` 42. `dom-sweeper.js`.

---

## 3. Core & UI Submodules Summary (`docs/modules_core.md`, `docs/modules_ui_analytics.md`)
- `assessment-data.js` & submodules (`assessment-cache.js`, `assessment-parser.js`, `assessment-expand.js`): In-memory subjects/task cache, card scraping, paced bulk expansion with non-blocking chunked finalization (90%->95%->98%->100%), 450ms animation guard.
- `cohort-view.js` & submodules (`cohort-outcome.js`, `cohort-panel.js`): Stats panel injection, row memoization (`ui._memo`), outcome meter rendering with secret purple breakout.
- `cohort-stats.js` & `cohort-styles.js`: Two-pass coordinator, `card._cxTaskRows` query caching, debounced scheduler.
- `category-settings.js` & `category-baselines.js`: Category keywords, custom categories, previous-year baselines with candidate key purging.
- `predictor-math.js` & submodules (`predictor-engine.js`, `predictor-dates.js`, `predictor-cache.js`): `predictionMemoryCache` Map for zero-disk lookups, task prediction, grade/ATAR projections.
- `predictor-ui.js` & `predictor-grade-view.js`: Predictor drawer panel, 6 subject tabs, upcoming task projections, ATAR hero cards.
- `sidebar.js` & `sidebar-handle.js`: Canonical launcher sequence (Target ATAR, Target Grade, Predictor, Progress, Estimate, Weakness, Settings).

---

## 4. System & Styling Summary (`docs/modules_system.md`, `docs/apis_and_storage.md`)
- `notifications.js`: Universal vertical stacked toast manager (`#connectify-notifications-container`).
- `new-grade.js`: Running average grade delta detection ($\ge 0.05\%$) with single-card expand and "Jump to Subject" glow.
- `dom-sweeper.js`: SPA DOM monitor and health restorer; panel mutation filter suppresses collapse loops.
- `theme.js` & modular CSS (`theme-*.css`): Site-wide dark theme, unstyled surface adaptation (`data-connectea-surface`).
- Modular styles: `sidebar-drawer.css`, `sidebar-notifications.css`, `sidebar-predictor.css`, `sidebar-settings.css`, `theme-core.css`, `theme-tiles.css`, `theme-cards.css`, `theme-controls.css`, `theme-material.css`, `theme-feed.css`, `theme-tables.css`, `theme-navigation.css`, `theme-surfaces.css`.
- Storage keys: `connectea:theme:v1`, `connectea:task_type_overrides`, `connectea:class_categories:`, `cx-categories`, `connectify:prediction:`, `connectify:stats_cache:`, `connectify:grade_cache:`, `connectify:cache_version:<subsystem>`.
