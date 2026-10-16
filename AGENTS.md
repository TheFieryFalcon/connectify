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
   - All `src/` code and CSS files $\le 250$ lines (`test_suite.js` and `scripts/` test tooling exempt). New features go in new files.
   - All documentation markdown files $\le 150$ lines.

2. **Pipeline & Execution (`docs/architecture.md`)**:
   - MAIN world `src/system/data.js` stamps Highcharts boxplot quantiles onto DOM `dataset.connectifyStats`.
   - ISOLATED world executes content scripts in the exact sequence listed in `manifest.json` / `docs/architecture.md`, starting with `src/system/utils.js` (`ConnectifyUtils`).

3. **Subsystems & Modules (`docs/modules_*.md`)**:
   - Full modular architecture under `src/` with self-contained submodules across `assessment/`, `cohort/`, `atar/`, `predictor/`, `progress/`, `sidebar/`, `theme/`, and `system/`.
   - Modular stylesheets (`src/theme/theme-*.css`, `src/sidebar/styles/*.css`, `src/atar/atar*.css`, `src/progress/progress.css`).

4. **Git & Remote Workflow**:
   - Always commit and push all verified changes to remote (`origin main`) after completing every task. Never leave working trees uncommitted or unpushed.

5. **Test Integrity & Direct Implementation**:
   - When requested to change functionality, typography, markup, styling, or behavior, directly update the implementation and any tests that explicitly assert against that specific item. Never use indirect workarounds just to appease an outdated test assertion; update the test directly to assert the newly specified behavior.
