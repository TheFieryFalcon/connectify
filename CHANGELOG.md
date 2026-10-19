# Changelog

Every release since Connectify was forked from Connext 2.1.14, newest first. Notes for 2.0.0 to 2.1.14 are in [2.0.0_changelog.md](2.0.0_changelog.md).

---

## 3.2.4 (2026-10-19)

### Additions
- **Predictions on upcoming assessments**: each unmarked task shows a one-line Low • Mid • High panel beside its Type dropdown, in the Predictor's colours. If there isn't enough data yet, it says what the prediction still needs. The panel disappears once the task is marked.
- **Show this semester's classes only** (Settings, off by default): hides the other semester's outlines and lists only this semester's classes in every sidebar tool. Connectify switches to Semester 2 once a class shows a final Semester 1 grade, and your Semester 1 results are kept and still used.
- **Year in Progress data point modes**: a "Show:" dropdown switches each subject's graph between single tasks, a running weighted average and a weighted rolling average of the last three tasks. The cohort mean line is averaged the same way.
- A "Connectify updated" notice after each update, with a "What's new" button that opens this changelog.

### Changes
- Every sidebar tool (Predictor, Weakness Analyzer, Year in Progress, ATAR Estimate, Target ATAR, Target Grade and Calibration) now reads your saved results instead of the outline tiles.
- New school year: last year's saved results are archived before they're cleared, because Connect no longer shows them. The new-year switch now starts as soon as every class is new.
- Uploaded wallpapers are cropped and scaled to your screen before they're saved, from both Settings and the Theme Customizer, so they take far less storage. Large wallpapers saved before this update, inside custom themes, or in imported theme files are shrunk the same way.
- Changing an assessment's Type no longer lags: predictions are recalculated once, after the dropdown closes, instead of up to four times while it's still open.
- Liquid Glass Library and Learners bars use the same glass as their tables, "Page N of M" and its page controls form one pill, and Learners headings fit their titles.
- Shorter description for the semester filter in Settings, and the baselines header is now "Previous Year Baselines".
- Saved predictions and results are rebuilt once after updating.

### Fixes
- Year in Progress lost its cohort mean line with "Show this semester's classes only" on, when a class was read before its charts had loaded. Means now come from the saved cohort statistics.
- The outcome meter appeared on every subject's first marked assessment.
- Semester 1 tasks listed on Semester 2 panels were treated as Semester 2 tasks, and the first of them got an outcome meter measured against itself.
- The Target ATAR and Target Grade planners started Semester 2 before Semester 1 grades were final.
- The user menu's Sign Out button had a border and rounded corners, and its header could be dark text on a dark background. Both now follow the theme and keep Connect's shape.
- Liquid Glass page controls ran off the page in the Library and overlapped "Page N of M", and Learners headings were bars of different widths.
- Liquid Glass home page: a square box showed behind Connect Help and other tiles, and the notice of the month's text sat on a darker box.

## 3.2.3 (2026-10-18)

### Additions
- Five new Chrome Web Store screenshots, one per theme.

### Changes
- The theme audit now checks chart labels inside SVGs, the contrast of Connectify's own panels, and that every drawer tool lists every subject.

### Fixes
- Predictor, Weakness Analyzer and Year in Progress listed only one subject when it had been opened by hand before Expand All, or after a reload. Existing partial caches are rebuilt.
- Weakness Analyzer radar labels, ring percentages and scores were unreadable in grey Liquid Glass. The Settings category delete button and "Cache cleared!" note were also fixed.
- Chrome Web Store publishing never ran, and Google retired the API it used. It now uses the Chrome Web Store API v2.

## 3.2.2 (2026-10-18)

### Additions
- **Multi-theme system**: a theme menu beside the header toggle with 7 presets: Dark, Quantum Dark (Gruvbox green highlights), AMOLED Black, Midnight Navy, Emerald Forest, Liquid Glass (grey) and Liquid Tinted Glass (navy). The last theme used is restored on startup.
- **Liquid Glass**: frosted blur, translucent tiles, and rounded panels, cards, tiles and dialogs. It covers Class pages (banners, category bars, headings, Learners tables, Summary tiles), and notices and discussions sit on a strong-blur reading panel that keeps your wallpaper visible.
- **Theme Customizer**: Basic mode (6 colours, everything else derived with readable contrast) and Full mode (20 colours), a live preview whose tooltip names the colour under the pointer, an HSV/HEX colour picker beside the colour being edited, JSON import/export, and Blur (0–40px) and Transparency (10–100%) sliders. A custom theme with Liquid Glass on becomes a recoloured glass theme.
- Edit (✎) and Delete (✕) buttons for custom themes in the theme menu. Renaming a theme updates it instead of saving a copy.
- Custom wallpaper upload, plus six preset gradient wallpapers in Settings.
- **New school year baselines**: when every class has a new, later-year name, last year's assessment type and subject averages become your Predictor baselines. Old baselines are backed up and a notification explains the change.
- The sidebar is disabled with a "Back to All" notice while the outlines are filtered.
- Paginators and the Select All row get their own surface, and empty pages are centred.
- Firefox and Chrome store badges in the README, and an automated Chrome Web Store publishing workflow.
- Developer tooling: a Puppeteer theme auditor and a Connect page crawler.

### Removals
- The six-subject cap on Grade Predictor tabs.

### Changes
- One shared page observer and one heartbeat replace eight observers and nine timers. Background work pauses while you're idle or the tab is hidden.
- Dark themes paint one surface per block, so no text sits on a box of a different shade. Connect's native spacing around course tiles, its button and input shapes, and its full-width bars are kept.
- Themes with dark text re-ink category labels, chart keys and status pills for light surfaces.
- The Theme Customizer dialog is always solid, even in glass themes.
- Every theme turns off on the login and logout pages and comes back after you sign in.
- Auto-login only fires for saved passwords or browser autofill, never while you're typing.
- Grade update notifications need a boxplot to move by more than 1 point, so other classes uploading results stay quiet.
- The outcome bar is hidden on a class's first marked assessment unless there is an earlier marked result or a subject baseline.
- Source reorganised into `src/` subsystems with every file at 250 lines or fewer.

### Fixes
- False "Class Updated" notifications caused by Semester 1 and 2 summary stats sharing cache keys.
- Jump to Subject now scrolls and highlights instantly.
- Progress Graph week overrides were read differently by the Predictor, placing tasks up to six weeks early.
- Saved category keywords now apply immediately, Reset restores the real defaults, deleting a category rescans assessments, and names with special characters work.
- Resetting settings left baselines behind, saving only half the baselines reset the other half, and categories created from baselines were overwritten on reload.
- Saved custom themes were missing from the Settings theme list.
- Target Grade's difficulty-weighted mode ignored your assessment type overrides.
- Compound progress bars of similarly named subjects (e.g. Biology and Human Biology) redrew each other.
- Clicking the sidebar handle closed was undone by hover, and the open tool lost its highlight every 1.5s.
- Deleted custom themes came back after reload, large wallpapers were lost, themes were applied two or three times, and older custom themes kept Dark leftovers.
- Subject, task, category and theme names were inserted into the page without escaping.
- Boxplot stats now appear as soon as charts load instead of on the next heartbeat. Chart resyncs after opening an accordion never ran.
- Expand All's safety timer could cut a later run short, and Collapse All lagged.
- False "missing component" notices from the DOM sweeper.
- Boxplot backgrounds showed as slabs in dark themes.

## 3.2.1 (2026-10-04)

### Changes
- README highlights for 3.2.0 rewritten for students.

### Fixes
- Expand All and Collapse All are fast again: the prediction cache is no longer marked current while empty, and redundant and repeated DOM scrapes are gone.

## 3.2.0 (2026-10-04)

### Additions
- **Grade Predictor and ATAR Predictor**: Low, Mid and High projections for upcoming assessments, subject grades and ATAR, with gains tapered above 80% and spread scaled to subject volatility.
- Previous Year Baselines in Settings so predictions work from the first assessment, including custom categories.
- **Outcome meter**: a four-segment bar beside each marked assessment with a floating tooltip and a pulsing alarm on a critical shortfall.
- Site-wide dark mode across every Connect page, turned off on the login page and restored after you sign in.
- Redesigned tools drawer: a 30px handle anchored to Connect's sidebar, expand by pushing the pointer to the left edge, a 900px workspace for tools, and Back to Menu.
- Floating Expand All / Collapse All with a progress pill, and a Back to top button.
- Year in Progress (formerly Progress Graph) lists upcoming tasks and lets you edit their dates.
- Cache clearing in Settings and a prompt when cached data is out of date.
- Statistics panels scale with the display width and stay on one line.
- A single master test suite (`test_suite.js`) and automated Firefox Add-ons (AMO) publishing.

### Removals
- Green improvement arrows on assessments.
- The sidebar Close button: click outside the drawer or press Escape instead.

### Changes
- Light and dark modes share the same bold text.
- Statistics are formatted more compactly.
- Semester 2 progress bars include Semester 1 tasks.
- Predictions refresh when categories, baselines or grades change.

### Fixes
- Expand All freezing at 95%, double-click lag on accordions, a memory spike on refresh, scroll lag, and charts being destroyed.
- False cache invalidation, duplicate dark mode buttons, ATAR calculation errors, tasks counted twice across semesters, and iPad accordion instability.

## 3.1.14 (2026-09-23)

### Additions
- Grade update notifications: stacked toasts with Jump to Subject and Dismiss.
- General Cohort Size and ATAR Percentage settings, and an auto-expand toggle.

### Changes
- Codebase split into files of 400 lines or fewer.

### Fixes
- Edge cases in the scraper, countdown and calculator, the auto-expand and collapse lifecycle, and notification readability.

## 3.1.13 (2026-09-23)

### Additions
- Add Category button.

### Changes
- Statistics panels are hidden on incomplete assessments.

### Fixes
- Saving categories now rescans assessments, the overall panel layout and data sync are fixed, and session expiry no longer blocks auto-login or background timers.

## 3.1.12 (2026-09-23)

### Additions
- Assessment Type dropdown beside each statistics panel, with custom categories shared across a class's Semester 1 and 2.
- Semester 1 scaling calibration table, and top-four selection and difficulty weighting in Target ATAR.
- A DOM health check that offers to restore missing components.

### Changes
- Cohort sizes persist across collapses and update with new results.
- Target ATAR holds the TEA bonus at its current value.
- The Weakness Analyzer radar is drawn as native SVG.
- Chart data is read through a page-world bridge.

### Fixes
- Cohort size matching for subjects such as Chemistry, progress bar margins and cumulative weighting, sidebar margins, and the Weakness Analyzer and Settings buttons.

## 3.1.11 (2026-09-23)

### Fixes
- Sidebar visibility on Orion for iPadOS, a sidebar flashing loop, and duplicate buttons.

## 3.1.10 (2026-09-23)

### Additions
- Subject filter checkboxes in the Weakness Analyzer, which needs at least 3 subjects.

### Fixes
- WebKit and Safari compatibility.

## 3.1.9 (2026-09-23)

### Changes
- Settings split into sections, and non-button text styled distinctly from buttons.

### Fixes
- Dark radar chart background, the Target ATAR Planner, and sidebar scrolling.

## 3.1.8 (2026-09-23)

### Additions
- TISC percentile scaling with Semester 1 calibration.
- Manual date entry for assessments with unreadable dates.

### Changes
- Assessment dates are shown as Term/Week, scaling options moved into Settings, and headings and copy were reworded across all tools.

### Fixes
- Calculator menu links, a render bug, progress graph timestamps and calendar mapping, Settings reloading, history graph ATAR scaling and Y axis, storage key mismatches, and multi-semester courses in Settings.

## 3.1.7 (2026-09-22)

### Changes
- Version bump to test auto-updates. No user-facing changes.

## 3.1.6 (2026-09-22)

### Additions
- Auto-login opt-out toggle, and auto-login is skipped after a manual logout.

### Fixes
- Auto-login state now works across the Connect and login domains, adds the missing `storage` permission, and works with Firefox's storage API.

## 3.1.5 (2026-09-22)

### Additions
- SSO auto-login on the Department of Education sign-in page.

## 3.1.4 (2026-09-22)

### Additions
- Automatic updates through self-hosted update manifests.

### Changes
- New logo.

### Fixes
- Icon format and manifest reference.

## 3.1.3 (2026-09-22)

### Changes
- Renamed from Connext to Connectify. The manifest for this release was mislabelled 2.1.3.

## 3.1.2 (2026-09-22)

### Additions
- Assessment category settings in their own tab, and a state cache that survives Connect redrawing the page.

### Changes
- Sidebar buttons renamed, and the expand buttons moved into the page.
- Progress graph uses a month axis with history averaged by month, and progress bars are filtered by semester.

### Fixes
- Weakness Analyzer positioning, progress bars flipping, a race condition that stopped data loading, hover wiping the page, Year 11 detection, and the back button.

## 3.1.1 (2026-09-22)

### Changes
- The weighting tracker is merged into the progress bar using opacity, and dark mode is lighter.

### Fixes
- ATAR features not rendering after Connect redrew the page, the radar chart failing on slow loads, and Year 11/12 AT/AE parsing.

## 3.1.0 (2026-09-22)

### Additions
- Compound Progress Bars with an assessment weighting tracker, the WACE Exam Countdown and the Weakness Analyzer radar chart.
- The original cohort estimate is shown beneath an overridden cohort size.

### Changes
- The ATAR predictor adjusts Year 11 unscaled marks.
- Smaller statistics panels and a muted dark mode.
- The theme toggle is anchored to the top of the page, and the Assessment Outlines shortcut stays visible on that page.
- Releases ship signed Chrome CRX3 builds.

### Fixes
- Cohort size estimates differing between semesters, and the estimate notice not updating.

## 3.0.1 (2026-09-21)

### Changes
- Cohort sizes are estimated for every course type and refined from boxplots when available.

### Fixes
- Cohort size and rank showing as unavailable when accordions were collapsed on load.

## 3.0.0 (2026-09-21)

### Additions
- Cohort size estimation for any school and course from boxplot summaries, with a manual override that persists across semesters.
- Cohort place estimated with a monotone PCHIP spline across the five quantiles.
- Progress graph Y axis scales to your ATAR range.
- Automated Firefox and Chrome build workflows.

### Removals
- Hard-coded school cohort tables, school-specific assessment corrections, and the Year 11 Economics average calculator.
- Legacy minified source files.

### Changes
- Source unminified into documented modules, and every course is evaluated the same way from live Connect data.

### Fixes
- Standings show decimals (`Top 0.4%` rather than `Top 0%`), a "Your scored" typo, the cohort input being hidden by presets, and graph points overflowing the canvas.
