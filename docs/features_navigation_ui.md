# Connectify Navigation & Interface Features Reference

This document details user-facing visual features 1 through 10, covering direct shortcuts, dark mode, auto-login, sidebar drawers, accordion controls, exam countdowns, compound progress bars, cohort panels, and assessment type overrides.

---

## 7. Front-Facing Features Directory (Part 1: Features 1–10)

### 1. Direct Navigation Shortcut
- **Source Module**: [`navigation.js`](file:///Users/uwong/Downloads/2.1.14_0/navigation.js)
- **DOM Insertion**: Desktop: Appended after "My Connect" link in `.cvr-c-primary-navigation__links` (`.cvr-js-greedy__item`). Mobile/Drawer: Appended after "My Connect" item in `.cvr-c-primary-menu__list`.
- **UI Appearance**: Matches native Connect navigation link styling seamlessly (`[Assessment Outlines]`).
- **Functionality**: One-click direct link to `/group/students/ui/my-settings/assessment-outlines`, bypassing nested user menus. Automatically reinjects across client-side SPA route transitions.

### 2. Site-Wide Dark Theme
- **Source Modules**: [`theme.js`](file:///Users/uwong/Downloads/2.1.14_0/theme.js), [`theme.css`](file:///Users/uwong/Downloads/2.1.14_0/theme.css)
- **DOM Insertion**: Injected into the top navigation/header bar across all Connect pages (`https://connect.det.wa.edu.au/*`).
- **UI Appearance**: High-contrast toggle button (`☀ Light mode` / `☾ Dark mode`).
- **Functionality**:
  - Instant, zero-flicker toggle applying `.connectea-dark` to `document.documentElement` without DOM traversal or style recalculation loops.
  - High-fidelity dark palette strictly preserving visual hierarchy:
    - Main canvas: `#12171f`, Top nav & menus: `#1a222d`
    - Course Card (`.eds-c-tile`): `#1e2632` with border `#2e3c4e`
    - Cohort Statistics Panel (`.connectea-panel`): Deep navy `#15263a` with border `#264669` and soft blue text `#d6e8f8`
    - Summary total mark & grade cell (`.cvr-c-task__marks`): Box `#161e29` with divider `#2d3b4d`
    - Subheader bar: `#18202b`, Accordion section heading: `#222b39` with border `#2e3c4e`
    - Compound progress bars: Preserves distinct category colors (teal, blue, purple, red)
    - Assessment type dropdowns: `#182330` with border `#2c425c`
    - Highcharts boxplots: `#161e29` box fill, `#647b95` whiskers, transparent canvas.
    - Card/tile headers & bodies: Unified `#2e3c4e` border, suppressing native colored accent stripes; dark "View All" tile actions (`#24303f`); Connect Help, nav lists (`.eds-c-nav-list`, `.eds-c-nav-list__item`), and resource cards (`.cvr-c-resource`) styled with `#1e2632` surfaces, `#2e3c4e` borders, `#263344` hover, and `#e2e8f0` text; high-contrast role switch and webfont icons (`[class*="cvr-c-icon"]:before`, `.cvr-c-icon--switch:before`, `#cbd5e1`, hover `#ffffff`).
    - Red outline normalization: Neutralizes `.eds-t-red` card borders to `#3d5066`, headings to `#f8fafc`, and renders attendance/locked alerts as soft dark-theme badges (`#2b171a`, border `#7f2329`, text `#fca5a5`).
    - Material & utility components: Scopes `button.mat-focus-indicator`, `.mat-button`, `.mat-stroked-button` (`#202c3b` surface, `#455a73` border) and `div.w-100` flex wrappers.
    - Base Connect margin alignment: Aligns with native Connect CSS by removing `.mat-expansion-panel` bottom margin override and excluding icon buttons from button padding.
    - Form controls: Custom dark checkboxes (`appearance: none`, SVG checkmark), custom `<select>` dropdowns (SVG chevron, dark `<option>`), and polished button hierarchy ($\ge 5:1$ contrast).
    - Tables & grids: Full coverage for `.table`, `.table-striped`, `.table-hover`, `.v-table`, `.v-grid`, `.cvr-c-table`, and `.cvr-c-submission-students-table` with `#1e2632` surfaces and `#36485e` borders.
    - Modals & dialogs: Dark styling for `.v-window`, `.ui-dialog`, `.modal-content`, `.cvr-c-popup`, and dark backdrop curtains (`.v-window-modalitycurtain`, `.modal-backdrop`, `rgba(0,0,0,0.75)`).
    - Menus & dropdowns: Dark auto-suggest popups (`.v-filterselect-suggestpopup`), `.dropdown-menu`, `.v-menubar-popup`, and `.ui-menu`.
    - Calendars & dates: Full support for `.v-calendar`, `.ui-datepicker`, and `.v-datefield-popup` with highlighted today and selected dates.
    - Tabs, breadcrumbs & feeds: `.v-tabsheet`, `.eds-c-tabs`, `.breadcrumb`, `.cvr-c-location-bar`, `.cvr-c-speech-box`, `.v-Notification`, `.alert`, and badges.
  - Persists theme state in `localStorage` (`connectea:theme:v1`).

### 3. DET SSO Auto-Login Assistant
- **Source Module**: [`auto-login.js`](file:///Users/uwong/Downloads/2.1.14_0/auto-login.js)
- **DOM Insertion**: DET Single Sign-On page (`https://login.det.wa.edu.au/*`), adjacent to `#login`.
- **UI Appearance**: Checkbox toggle labelled `[x] Auto-login` with red status badges (`(Paused: session expired)` or `(Paused: logged out)`) when safety guards are active.
- **Functionality**: Automatically checks the mandatory terms box, submits saved credentials, pauses upon manual logout or session timeout, and enforces 30-second rapid-loop protection.

### 4. Floating Tools Drawer & Sidebar
- **Source Modules**: [`sidebar.js`](file:///Users/uwong/Downloads/2.1.14_0/sidebar.js), [`sidebar.css`](file:///Users/uwong/Downloads/2.1.14_0/sidebar.css)
- **DOM Insertion**: Fixed to the right edge of viewport (`#connectify-sidebar-handle` and `#connectify-sidebar`).
- **UI Appearance**: Floating handle expanding into a slide-out drawer containing canonical launcher buttons:
  - **Target ATAR** (`#connectify-target-toggle`)
  - **Target Grade** (`#connectify-grade-toggle`)
  - **Predictor** (`#connectify-predictor-toggle`)
  - **Progress Graph** (`#connectify-progress-toggle`)
  - **ATAR Estimate** (`#connectify-estimate-toggle`)
  - **Weakness Analyzer** (`#connectify-weakness-toggle`): Clean white button (`#ffffff`) in light mode with centered text.
  - **Settings & Calibration** (`#connectify-categories-toggle`): Clean white button (`#ffffff`) in light mode with centered text.
- **Functionality**: Smoothly expands drawer from 310px to 900px (`.cx-tool-active`) with prominent `← Back to Menu` navigation header, single-active-tool view policy, Escape dismissal, and event propagation isolation (`e.stopPropagation()`) preventing double-toggle desynchronization.

### 5. Outline Accordion Expand / Collapse Controls
- **Source Modules**: [`atar-features.js`](file:///Users/uwong/Downloads/2.1.14_0/atar-features.js), [`assessment-data.js`](file:///Users/uwong/Downloads/2.1.14_0/assessment-data.js)
- **DOM Insertion**: Floating pill button container (`#cx-expand-btn`) anchored to bottom-right; animated loading pill (`#cx-expand-progress`) on first expand.
- **UI Appearance**: Compact buttons: `Expand All` and `Collapse All`. Progress pill shows animated spinner, percentage, and blue fill bar.
- **Functionality**: Clicks accordion headings staggered across animation frames; mounts `#cx-expand-progress` on bulk expand and pre-caches predictions; silences background MutationObservers during animation (`window.ConnectifyIsAccordionAnimating`) and skips re-scrapes on collapse; respects `connectify:auto_expand` setting on load.
- **Back to Top Button**: Injects a centered button (`#cx-back-to-top-btn` in `#cx-back-to-top-container`) at the bottom of the outlines list for smooth scrolling back to top.

### 6. Year 12 WACE Exam Countdown Banner
- **Source Module**: [`wace-countdown.js`](file:///Users/uwong/Downloads/2.1.14_0/wace-countdown.js)
- **DOM Insertion**: Pre-pended to `#main-content` (`#connectify-wace-countdown`).
- **UI Appearance**: Centered dark gold card with gold border and countdown typography (`⏳ 142 days until WACE Exams`).
- **Functionality**: Detects Year 12 ATAR enrolment, computes days until WACE examinations (late October), and dynamically indicates exam progress during active examination weeks.

### 7. Compound Subject Progress Bars
- **Source Module**: [`compound-progress.js`](file:///Users/uwong/Downloads/2.1.14_0/compound-progress.js)
- **DOM Insertion**: Embedded in subject card headers (`.eds-c-tile__header`), below title (`.cx-compound-progress-container`).
- **UI Appearance**: Multi-segmented horizontal bar (`height: 6px; border-radius: 3px;`) color-coded by category with completion status text.
- **Functionality**: Proportional task weights; completed assessments opaque, pending translucent; hover tooltips; Semester 1 cards display Semester 1 tasks, while Semester 2 cards encapsulate tasks from both semesters for cumulative annual progress tracking; reactive to category changes.

### 8. Assessment Cohort Statistics & Rank Panels
- **Source Modules**: [`cohort-view.js`](file:///Users/uwong/Downloads/2.1.14_0/cohort-view.js), [`cohort-stats.js`](file:///Users/uwong/Downloads/2.1.14_0/cohort-stats.js)
- **DOM Insertion**: Inside assessment rows (`.cvr-c-task__details`) alongside task labels.
- **UI Appearance**: Light blue card (`.connectea-panel`) showing distribution quantiles and student percentile rank metrics.
- **Functionality**: Extracts Highcharts quantiles, computes weighted mean, standard deviation, PCHIP cohort percentile, $z$-score, and school rank. Automatically hides on incomplete/unmarked tasks.

### 9. Assessment Type Dropdowns & Custom Categories
- **Source Modules**: [`cohort-view.js`](file:///Users/uwong/Downloads/2.1.14_0/cohort-view.js), [`task-types.js`](file:///Users/uwong/Downloads/2.1.14_0/task-types.js)
- **DOM Insertion**: Inline in `.connectea-row-wrapper` adjacent to statistics panel.
- **UI Appearance**: Compact dropdown selector (`Type: [ Auto (Exam) v ]`) with highlighted styling when overridden.
- **Functionality**: Automated keyword categorizing; manual overrides (`Exam`, `Test`, `Application`, `Essay`, `Take-Home`); supports `+ Custom...` category creation shared across Semester 1 and 2 in that class.

### 10. Overall Subject Cohort Controls
- **Source Modules**: [`cohort-view.js`](file:///Users/uwong/Downloads/2.1.14_0/cohort-view.js), [`cohort-estimator.js`](file:///Users/uwong/Downloads/2.1.14_0/cohort-estimator.js)
- **DOM Insertion**: Overall subject summary row (top row of each `.eds-c-tile` card).
- **UI Appearance**: Full-width statistics card with cohort size override input (`Cohort Size: [ ~170 ]`).
- **Functionality**: Student override for course cohort baseline; persists to `localStorage` (`connectea:cohort:v3:<student>:<year>:<subject>`); immediately recalculates rank and standing across assessments.

---

*Back to [Overview](file:///Users/uwong/Downloads/2.1.14_0/overview.md)*
