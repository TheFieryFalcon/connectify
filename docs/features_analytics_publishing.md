# Connectify Analytics, Predictor & Testing Features Reference

This document details user-facing features 11 through 20, covering Target ATAR and Grade planners, ATAR progression graphs, Weakness Radar, Settings & Calibration, DOM sweeping, Grade notifications, store publishing, Grade/ATAR Predictor, canonical sidebar sequence, and the master test suite.

---

## 7. Front-Facing Features Directory (Part 2: Features 11–20)

### 11. Target ATAR & Grade Planner Modal
- **Source Modules**: [`target-atar-ui.js`](file:///Users/uwong/Downloads/2.1.14_0/target-atar-ui.js), [`target-grade-ui.js`](file:///Users/uwong/Downloads/2.1.14_0/target-grade-ui.js), [`atar-ui.js`](file:///Users/uwong/Downloads/2.1.14_0/atar-ui.js)
- **DOM Insertion**: Full-screen modal overlay (`#connectea-atar`) opened via sidebar or floating button.
- **UI Appearance**: Clean tabbed interface with Course Marks Table, Target ATAR Planner, and Target Grade Planner.
- **Functionality**:
  - **ATAR Calculator**: Aggregates scaled scores across enrolled ATAR courses using 2025 TISC scaling tables; selects top 4 subjects for Tertiary Entrance Aggregate (TEA); applies 10% bonus for Methods, Specialist, and Languages (up to 2 bonus courses); calculates projected ATAR.
  - **Target ATAR Planner**: Input target ATAR; toggles top 4 course inclusion; difficulty-weighted optimization adjusts required marks based on historical strengths across subjects and categories (`Adjust marks by subject & task type performance`).
  - **Target Grade Planner**: Select course, enter target percentage, dynamic prior performance adjustment option (`Dynamically adjust required grade based on prior performance`), clean semester tabs eliminating ATAR text.

### 12. ATAR Progression & Historical Graphs
- **Source Modules**: [`progress-chart.js`](file:///Users/uwong/Downloads/2.1.14_0/progress-chart.js), [`progress-graph.js`](file:///Users/uwong/Downloads/2.1.14_0/progress-graph.js)
- **DOM Insertion**: Full-screen modal overlay (`#connectify-progress`).
- **UI Appearance**: Responsive SVG line chart plotting student marks (blue polyline) vs cohort mean (red polyline) over school weeks with detailed task data table listing completed and pending tasks (grayed out with $\ge 5:1$ contrast).
- **Functionality**: Interactive hover tooltips; chronological week override inputs in table for all tasks (with `.cx-date-warning` on unparsable dates); running course average tracking.

### 13. Weakness Analyzer Radar Chart
- **Source Module**: [`weakness-radar.js`](file:///Users/uwong/Downloads/2.1.14_0/weakness-radar.js)
- **DOM Insertion**: Standalone panel (`#connectify-weakness`).
- **UI Appearance**: Native SVG polygonal radar chart with 5 concentric percentage rings (20% to 100%), radial spoke axes, green performance polygon (`#2ecc71`), and perimeter labels.
- **Functionality**: Plots performance by assessment category; interactive subject checkboxes (`#cx-weakness-checkboxes`) with Select/Deselect All; persists filters in `connectify:weakness_disabled_subjects`.

### 14. Settings & Scaling Calibration Panel
- **Source Modules**: [`category-settings.js`](file:///Users/uwong/Downloads/2.1.14_0/category-settings.js), [`scaling-calibration.js`](file:///Users/uwong/Downloads/2.1.14_0/scaling-calibration.js)
- **DOM Insertion**: Standalone panel (`#connectify-categories`).
- **UI Appearance**: Three distinct sections: General Preferences (`connectify:auto_expand`, `connectify:general_cohort_size`, `connectify:atar_percentage`), Semester 1 Scaling Calibration grid table (`connectea:preferences`), and Assessment Categories editor (`+ Add Category`, custom colors, keyword editor).
- **Functionality**: Synchronizes custom categories across storage; triggers `rescanAllAutoAssessments()` upon saving.

### 15. DOM Sweeper & Health Monitor
- **Source Module**: [`dom-sweeper.js`](file:///Users/uwong/Downloads/2.1.14_0/dom-sweeper.js)
- **DOM Insertion**: Invisible background monitor with action banner rendered via `ConnectifyNotifications`.
- **UI Appearance**: Non-intrusive notification if key extension components require restoration.
- **Functionality**: Monitors DOM during Vaadin SPA navigations; detects missing extension containers; ignores incomplete tasks; restores components upon user confirmation.

### 16. Grade Update Notifications & Jump-to-Subject
- **Source Modules**: [`notifications.js`](file:///Users/uwong/Downloads/2.1.14_0/notifications.js), [`new-grade.js`](file:///Users/uwong/Downloads/2.1.14_0/new-grade.js)
- **DOM Insertion**: Fixed bottom-right toast stack (`#connectify-notifications-container`).
- **UI Appearance**: Purple-accented toast card (`.cx-notification--grade`) with trending icon (`📈`), updated average, delta percentage, and "Jump to Subject" action button.
- **Functionality**: Tracks running subject averages in `connectify:grade_cache:<student>`; detects grade updates ($\ge 0.05\%$); temporarily expands and scrapes updated subject; scrolls to course card with outline glow pulse (`.cx-card-jump-highlight`).

### 17. Multi-Store Publishing & Automated CI/CD (AMO & Chrome Web Store)
- **Source Modules**: [`.github/workflows/publish.yml`](file:///Users/uwong/Downloads/2.1.14_0/.github/workflows/publish.yml), [`.github/scripts/publish-amo.js`](file:///Users/uwong/Downloads/2.1.14_0/.github/scripts/publish-amo.js), [`CHROMEWEBSTORE.md`](file:///Users/uwong/Downloads/2.1.14_0/CHROMEWEBSTORE.md), [`PRIVACY.md`](file:///Users/uwong/Downloads/2.1.14_0/PRIVACY.md)
- **Functionality**: Automated AMO v5 REST API upload via HS256 JWT authentication; Chrome Web Store clean packaging without prohibited keys or dev artifacts; standardized multi-dimension icons (16, 48, 128); minimal `storage` permission footprint.

### 18. Grade Predictor, ATAR Predictor & Dynamic Breakout Performance Meter
- **Source Modules**: [`predictor-math.js`](file:///Users/uwong/Downloads/2.1.14_0/predictor-math.js), [`predictor-ui.js`](file:///Users/uwong/Downloads/2.1.14_0/predictor-ui.js), [`cohort-view.js`](file:///Users/uwong/Downloads/2.1.14_0/cohort-view.js), [`category-settings.js`](file:///Users/uwong/Downloads/2.1.14_0/category-settings.js)
- **DOM Insertion**: Launcher button `Predictor` (`#connectify-predictor-toggle`), workspace panel (`#connectify-predictor`), vertical outcome meter (`.connectea-outcome-bar`), and "Previous Year Baselines" card in Settings.
- **Functionality**:
  - **Cold-Start Baselines**: Previous-year category and subject averages kickstart predictions; dynamically injects baseline inputs for custom categories.
  - **Logarithmic Ceiling**: Tapers gains above 80% proportionally to headroom $\frac{100 - \text{Score}}{20}$.
  - **Grade Predictor**: Up to 6 subject sub-tabs with Low, Mid, High task estimates. Secret purple breakout threshold is strictly hidden. Unparsable dates excluded unless custom override exists in Progress Graph.
  - **ATAR Predictor**: Aggregates projected subject marks into Low, Mid, High ATAR and TEA without Year 11 scaling deductions.
  - **Dynamic Breakout Performance Meter**: 18px wide, 56px tall; 4 baseline segments: Red ($< \text{Low}$), Orange ($\text{Low} \le S < \text{Mid}$), Yellow ($\text{Mid} \le S < \text{High}$), Green ($S \ge \text{High}$). Suppressed on incomplete tasks and on first tasks lacking precedent/baseline. Secret double-height Purple breakout segment (height 20px) appears when $S > 1.10 \times \text{High}$. Critical shortfall ($S \le \text{Low} - 10\%$ additive) renders 0 segments with pulsing red alarm glow (`.connectea-outcome-critical`).

### 19. Sidebar Integration & Theme Navigation Stabilization
- **Canonical Sequence**: Target ATAR, Target Grade, Predictor, Progress Graph, ATAR Estimate, Weakness Analyzer, Settings.
- **Button Styling**: Settings (`#connectify-categories-toggle`) and Weakness Analyzer (`#connectify-weakness-toggle`) feature white buttons (`#ffffff`) in light mode with centered text.
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

---

*Back to [Overview](file:///Users/uwong/Downloads/2.1.14_0/overview.md)*
