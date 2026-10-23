# Connectify Analytics, Predictor & Testing Features Reference

This document details user-facing features 11 through 20, covering Goals and Estimates, ATAR progression graphs, Weakness Radar, Settings & Calibration, DOM sweeping, Grade notifications, store publishing, Predictions (Predict Grade / Predict ATAR), canonical sidebar sequence, and the master test suite.

---

## 7. Front-Facing Features Directory (Part 2: Features 11–20)

### 11. Goals & Estimates
- **Source Modules**: [`target-atar-ui.js`](file:///Users/uwong/Downloads/2.1.14_0/src/atar/target-atar-ui.js), [`target-grade-ui.js`](file:///Users/uwong/Downloads/2.1.14_0/src/atar/target-grade-ui.js), [`grade-estimate-ui.js`](file:///Users/uwong/Downloads/2.1.14_0/src/atar/grade-estimate-ui.js), [`atar-ui.js`](file:///Users/uwong/Downloads/2.1.14_0/src/atar/atar-ui.js)
- **DOM Insertion**: One calculator panel (`#connectea-atar`) in the sidebar workspace, opened by two launchers: **Goals** (Target ATAR, Target Grade) and **Estimates** (Estimate ATAR, Estimate Grade).
- **UI Appearance**: Launcher name as heading, then the Predictor-style mode tabs (`.cta-mode-tabs`), the semester buttons and the active mode's view; each launcher reopens on its last tab.
- **Functionality**:
  - **Estimate ATAR**: Aggregates scaled scores across enrolled ATAR courses using TISC Average Marks Scaling (each course's 2025 scaled mean + SD x z, z from the standardised mean 60 / SD 14); selects top 4 subjects for Tertiary Entrance Aggregate (TEA); applies 10% bonus for Methods, Specialist, and Languages (up to 2 bonus courses); calculates projected ATAR. Each course takes a school mark (Connect's by default) and shows its scaled score; a semester with final grades is Closed.
  - **Target ATAR Planner**: Input target ATAR; toggles top 4 course inclusion; difficulty-weighted optimization adjusts required marks based on historical strengths across subjects and categories (`Adjust marks by subject & task type performance`).
  - **Target Grade Planner**: Select course, enter target percentage, dynamic prior performance adjustment option (`Dynamically adjust required grade based on prior performance`), clean semester tabs eliminating ATAR text.
  - **Estimate Grade**: Select a class; each weighted unmarked task gets a mark input (`85`, `85%`, `17/20`, `17 Out of 20`). One headline (current average, else the estimate and its change) updates as you type, with no notes: Connect's average for the marked tasks as one block plus each typed mark at its weight (`ConnectifyGradeEstimate.estimate`); blank tasks are left out, so one typed mark is enough, and typing every one gives the final mark. Unweighted tasks get no input; unreadable marks are flagged (`aria-invalid`) and ignored. Typed marks persist per class (`gradeEstimates`) until Clear Marks.

### 12. ATAR Progression & Historical Graphs
- **Source Modules**: [`progress-chart.js`](file:///Users/uwong/Downloads/2.1.14_0/progress-chart.js), [`progress-graph.js`](file:///Users/uwong/Downloads/2.1.14_0/progress-graph.js)
- **DOM Insertion**: Full-screen modal overlay (`#connectify-progress`).
- **UI Appearance**: Responsive SVG line chart plotting student marks (blue polyline) vs cohort mean (red polyline) over school weeks with detailed task data table listing completed and pending tasks (grayed out with $\ge 5:1$ contrast).
- **Functionality**: "Show:" dropdown plots single tasks, a running weighted average or a weighted rolling average of the last three tasks (cohort mean alike); cohort means survive the semester filter (derived from cached boxplots); interactive hover tooltips; chronological week override inputs in table for all tasks (with `.cx-date-warning` on unparsable dates); running course average tracking.
- **Export**: the header's `Export` lists upcoming assessments by subject (soonest due first) with a weekday per subject or task and the generated WA term dates (Early Easter checkbox); `Google Calendar (.ics)` and `Notion (CSV)` download them, made locally (no sign-in, no new permissions). Spec: `specs/progress-calendar-export.md`.

### 13. Weaknesses Radar Chart
- **Source Module**: [`weakness-radar.js`](file:///Users/uwong/Downloads/2.1.14_0/weakness-radar.js)
- **DOM Insertion**: Standalone panel (`#connectify-weakness`).
- **UI Appearance**: Native SVG polygonal radar chart with 5 concentric percentage rings (20% to 100%), radial spoke axes, green performance polygon (`#2ecc71`), and perimeter labels.
- **Functionality**: Plots performance by assessment category; interactive subject checkboxes (`#cx-weakness-checkboxes`) with Select/Deselect All; persists filters in `connectify:weakness_disabled_subjects`.

### 14. Settings & Scaling Calibration Panel
- **Source Modules**: [`category-settings.js`](file:///Users/uwong/Downloads/2.1.14_0/category-settings.js), [`scaling-calibration.js`](file:///Users/uwong/Downloads/2.1.14_0/scaling-calibration.js)
- **DOM Insertion**: Standalone panel (`#connectify-categories`).
- **UI Appearance**: Three distinct sections: General Preferences (`connectify:auto_expand`, `connectify:general_cohort_size`, `connectify:atar_percentage`), Semester 1 Scaling Calibration grid table (`connectea:preferences`), and Assessment Categories editor (`+ Add Category`, custom colors, keyword editor).
- **Functionality**: Synchronizes custom categories across storage; triggers `rescanAllAutoAssessments()` upon saving.
- **Statistics Panels** (`connectify:panel_view`): Compact view (default), Expanded view on subject panels only, or Expanded view on all panels; takes effect after reload.
- **Show this semester's classes only** (`connectify:semester_filter`, off by default; always the detected semester: Semester 2 once a class shows a final Semester 1 grade): hides the other semester's outlines, refreshes the cache from this semester's cards only (the other semester's cached results stay frozen and are still used, e.g. final Semester 1 marks) and lists only this semester's classes in every sidebar tool. Filtering the outlines to a class keeps its outline for this semester visible; a class with none shows a message saying its other-semester outline is hidden, with "← Back to All".

### 15. DOM Sweeper & Health Monitor
- **Source Module**: [`dom-sweeper.js`](file:///Users/uwong/Downloads/2.1.14_0/dom-sweeper.js)
- **DOM Insertion**: Invisible background monitor with action banner rendered via `ConnectifyNotifications`.
- **UI Appearance**: Non-intrusive notification if key extension components require restoration.
- **Functionality**: Monitors DOM during Vaadin SPA navigations; detects missing extension containers; ignores incomplete tasks; restores components upon user confirmation.

### 16. Grade Update Notifications & Jump-to-Subject
- **Source Modules**: [`notifications.js`](file:///Users/uwong/Downloads/2.1.14_0/notifications.js), [`new-grade.js`](file:///Users/uwong/Downloads/2.1.14_0/new-grade.js)
- **DOM Insertion**: Fixed bottom-right toast stack (`#connectify-notifications-container`).
- **UI Appearance**: Purple-accented toast card (`.cx-notification--grade`) with trending icon (`📈`), updated average, delta percentage, and "Jump to Subject" action button.
- **Functionality**: Tracks running subject averages in `connectify:grade_cache:<student>`; detects grade updates once summary charts are stamped (own running mark moves $\ge 0.05\%$, or a quantile of a boxplot seen on both visits moves by more than 1 point; live charts only, so other classes, late charts and the other semester's cached boxplot stay quiet); marks the subject stale for re-scraping on its next expansion; "Jump to Subject" expands it, scrolls to the card and pulses an outline glow (`.cx-card-jump-highlight`).

### 17. Multi-Store Publishing & Automated CI/CD (AMO & Chrome Web Store)
- **Source Modules**: [`.github/workflows/publish.yml`](file:///Users/uwong/Downloads/2.1.14_0/.github/workflows/publish.yml), [`.github/scripts/publish-amo.js`](file:///Users/uwong/Downloads/2.1.14_0/.github/scripts/publish-amo.js), [`CHROMEWEBSTORE.md`](file:///Users/uwong/Downloads/2.1.14_0/CHROMEWEBSTORE.md), [`PRIVACY.md`](file:///Users/uwong/Downloads/2.1.14_0/PRIVACY.md)
- **Functionality**: Automated AMO v5 REST API upload via HS256 JWT authentication; Chrome Web Store clean packaging without prohibited keys or dev artifacts, uploaded through CWS API v2 (`mnao305/chrome-extension-upload@v7`, needs secrets `CWS_CLIENT_ID`/`CWS_CLIENT_SECRET`/`CWS_REFRESH_TOKEN` and `CWS_PUBLISHER_ID`; the CWS step condition reads the job-level `env`); standardized multi-dimension icons (16, 48, 128); minimal `storage` permission footprint (`unlimitedStorage`, which lets GitHub/Firefox builds keep GIF wallpapers up to 40 MB, is stripped from the CWS zip by both workflows, as are the update-reload background script and its Connect `host_permissions`, which refresh open Connect tabs after an update in GitHub/Firefox builds).

### 18. Predictions (Predict Grade, Predict ATAR) & Dynamic Breakout Performance Meter
- **Source Modules**: [`predictor-math.js`](file:///Users/uwong/Downloads/2.1.14_0/predictor-math.js), [`predictor-ui.js`](file:///Users/uwong/Downloads/2.1.14_0/predictor-ui.js), [`cohort-view.js`](file:///Users/uwong/Downloads/2.1.14_0/cohort-view.js), [`category-settings.js`](file:///Users/uwong/Downloads/2.1.14_0/category-settings.js)
- **DOM Insertion**: Launcher button `Predictions` (`#connectify-predictor-toggle`), workspace panel (`#connectify-predictor`), vertical outcome meter (`.connectea-outcome-bar`), and "Previous Year Baselines" card in Settings.
- **Functionality**:
  - **Cold-Start Baselines**: Previous-year category and subject averages kickstart predictions; dynamically injects baseline inputs for custom categories.
  - **Logarithmic Ceiling**: Tapers gains above 80% proportionally to headroom $\frac{100 - \text{Score}}{20}$.
  - **Predict Grade**: one scrollable sub-tab per subject (no cap, so a dropped course plus its replacement still shows every class) with Low, Mid, High task estimates. Secret purple breakout threshold is strictly hidden. Unparsable dates excluded unless custom override exists in Progress Graph.
  - **Predict ATAR**: Aggregates projected subject marks into Low, Mid, High ATAR and TEA without Year 11 scaling deductions.
  - **Dynamic Breakout Performance Meter**: 18px wide, 56px tall; 4 baseline segments: Red ($< \text{Low}$), Orange ($\text{Low} \le S < \text{Mid}$), Yellow ($\text{Mid} \le S < \text{High}$), Green ($S \ge \text{High}$). Suppressed on incomplete tasks and on first tasks lacking precedent/baseline. Secret double-height Purple breakout segment (height 20px) appears when $S > 1.10 \times \text{High}$. Critical shortfall ($S \le \text{Low} - 10\%$ additive) renders 0 segments with pulsing red alarm glow (`.connectea-outcome-critical`).

### 19. Sidebar Integration & Theme Navigation Stabilization
- **Canonical Sequence**: Goals, Predictions, Progress, Estimates, Weaknesses, Settings.
- **Button Styling**: Settings (`#connectify-categories-toggle`) and Weaknesses (`#connectify-weakness-toggle`) feature white buttons (`#ffffff`) in light mode with centered text.
- **Category Colors**: Category labels bind to `--cx-cat-color` via `.cx-cat-name-label` for vibrant visibility in dark mode.
- **Theme Button Mount**: `#connectea-theme-toggle` auto-discovers `.cvr-c-primary-navigation` and centers at `top: 50%; transform: translateY(-50%)`.

### 20. Master Unified Test Suite (`test_suite.js`)
- **Source Module**: [`test_suite.js`](file:///Users/uwong/Downloads/2.1.14_0/test_suite.js)
- **Role**: Single definitive master test suite across the extension. All new tests must be added to this file only. Run via `node test_suite.js`.
- **Test Sections**:
  - Section 1: Dark Mode Site-Wide Coverage & Contrast Hierarchy ($\ge 5:1$).
  - Section 2: Outcome Meter & Hover Tooltip Reliability (pointer-events, sizing, tiers).
  - Section 3: Chronological Historical Prediction Engine & Caching (headroom, variance, versioning).
  - Section 4: Sidebar Navigation & Workspace Layout (order, expansion, categories).
  - Section 5: Grade Update Notifications & System Integrity (delta formatting, jump-to-card, lifecycle).
  - Section 6: Regression Verification (centering, first-assessment outcome rules, card scraping, predictor interactivity).
  - Theme audit (`scripts/test-theme-styles.js`): applies themes through `connectify-request-theme` (the registry is isolated-world), clears focus before each capture, composites contrast over the theme's own `--cx-canvas-bg`, and counts unblurred one-axis inset shadows (accent bars) as separators.
  - Glass surface structure (Test 180): `NESTED_SURFACE_FILL` (a fill > 12% inside another surface), `NESTED_BACKDROP_BLUR`, `GLASS_WITHOUT_BLUR` (translucent outer surface) and `ROUNDED_FULL_WIDTH_BAR`, both glass presets; controls, chips, avatars, active states, overlays and Connectify UI exempt.
  - Contrast coverage and tool data (Test 185): SVG `<text>`/`<tspan>` (chart labels) are measured by fill against the CSS background behind the `<svg>` plus SVG shapes painted under them; Connectify UI on page views (cohort panels, type selects, outcome meters, theme menu) skips parity but is contrast-checked; `TOOL_SUBJECTS_MISSING` (once per drawer tool) flags Predictor tabs, Weakness checkboxes or Progress chips missing a subject with marked tasks, listed under "Tool Data Completeness" in the report.
  - Keyed ancestors (Test 219): no `src/` stylesheet tests a class substring (`[class*=...]`) on an ancestor or inside `:not(... *)`, so Connect's class changes restyle only what they can affect.
  - Spacing parity (Test 160): class/id containers with 0px padding/margin in `connect_css/` (the Default theme) must not get non-zero spacing from any theme or custom theme stylesheet.

---

*Back to [Overview](file:///Users/uwong/Downloads/2.1.14_0/overview.md)*
