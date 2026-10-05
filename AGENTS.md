# Connectify System & Architecture Guidelines

All instructions, design constraints, and architectural standards in `design_rules.md` and all files under `docs/` (`apis_and_storage.md`, `architecture.md`, `features_analytics_publishing.md`, `features_navigation_ui.md`, `modules_core.md`, `modules_system.md`, `modules_ui_analytics.md`) are permanently active for this repository and must be adhered to at all times.

## Key Directives:
1. **Design Rules (`design_rules.md`)**:
   - WCAG AA $\ge 5:1$ contrast ratio across light and dark modes.
   - 1:1 bolding parity between light and dark modes.
   - Sleek 30px sidebar handle anchoring to Connect native sidebar; 900px expanded workspace drawer.
   - Outcome meter: 18px x 56px, 4-tier baseline track, secret purple breakout ($> 1.10 \times \text{High}$), 0-segment critical shortfall with pulsing red alarm. Suppressed on unmarked tasks and first task lacking baseline.
   - Logarithmic headroom compression above 80% ($\frac{100 - \text{Score}}{20}$). Calibrated variance scaling on volatile courses.
   - Subsystem cache versioning with independent keys (`connectify:cache_version:<subsystem>`).
   - All code and CSS files $\le 500$ lines (except `test_suite.js`).
   - All documentation markdown files $\le 150$ lines.

2. **Pipeline & Execution (`docs/architecture.md`)**:
   - MAIN world `data.js` stamps Highcharts boxplot quantiles onto DOM `dataset.connectifyStats`.
   - ISOLATED world executes 42 content scripts in exact sequence from `assessment-cache.js` to `dom-sweeper.js`.

3. **Subsystems & Modules (`docs/modules_*.md`)**:
   - Full modular architecture with self-contained submodules (`assessment-cache.js`, `assessment-parser.js`, `assessment-expand.js`, `cohort-outcome.js`, `cohort-panel.js`, `cohort-styles.js`, `predictor-engine.js`, `predictor-dates.js`, `predictor-cache.js`, `predictor-grade-view.js`, `sidebar-handle.js`, `category-baselines.js`).
   - Modular stylesheets (`theme-*.css`, `sidebar-*.css`).
