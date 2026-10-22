# Changelog

Every release since Connectify was forked from Connext 2.1.14, newest first. Notes for 2.0.0 to 2.1.14 are in [2.0.0_changelog.md](2.0.0_changelog.md).

---

## 3.2.4 (2026-10-20)

### Additions
- **Predictions on upcoming assessments**: each unmarked task shows a one-line Low • Mid • High panel beside its Type dropdown, in the Predictor's colours. If there isn't enough data yet, it says what the prediction still needs. The panel disappears once the task is marked.
- **Show this semester's classes only** (Settings, off by default): hides the other semester's outlines and lists only this semester's classes in every sidebar tool. Connectify switches to Semester 2 once a class shows a final Semester 1 grade, and your Semester 1 results are kept and still used.
- **Year in Progress data point modes**: a "Show:" dropdown switches each subject's graph between single tasks, a running weighted average and a weighted rolling average of the last three tasks. The cohort mean line is averaged the same way.
- A "Connectify updated" notice after each update, with a "What's new" button that opens this changelog.
- **Theme files**: themes export as `.ctme` files named after the theme (e.g. `test_theme.ctme`), holding the theme and its wallpaper. Older `.json` theme files still import.
- **Import Theme...** in the theme menu, below Customize Theme...: saves a theme file as a custom theme and applies it.
- The Theme Customizer offers the six preset wallpapers from Settings. A theme saves the preset it uses by name, not as an image.
- **Animated GIF wallpapers**: GIFs are saved as uploaded, so they keep animating. They can be up to 40 MB (4 MB in the Chrome Web Store version), and larger ones are refused with the reason shown.
- A ↺ button in the Theme Customizer's Full mode resets one colour.
- Settings says when the current theme is showing its own wallpaper instead of yours.

### Changes
- Every sidebar tool (Predictor, Weakness Analyzer, Year in Progress, ATAR Estimate, Target ATAR, Target Grade and Calibration) now reads your saved results instead of the outline tiles.
- New school year: last year's saved results are archived before they're cleared, because Connect no longer shows them.
- The new-year switch now starts as soon as every class is new.
- Uploaded wallpapers are cropped and scaled to your screen before they're saved, from both Settings and the Theme Customizer, so they take far less storage.
- Large wallpapers saved before this update, inside custom themes, or in imported theme files are shrunk the same way.
- Wallpapers are blurred slightly, then dimmed (themes with light text) or brightened (themes with dark text) just enough for text to stay readable.
- Bars, banners, headings, empty states, paginators and the Select All row no longer get panels or glass pills of their own. They sit straight on the page.
- Liquid Glass notices and discussions sit straight on your wallpaper instead of on a frosted reading panel.
- Notice and dialog text uses the theme's main text colour (cream in Quantum Dark) instead of its secondary colour.
- Full-mode colours you set in the Theme Customizer are kept when you switch back to Basic mode.
- Picking a preset in the Theme Customizer keeps all of its colours (e.g. Quantum Dark's green secondary text) instead of deriving them from its six Basic colours.
- Changing a Basic colour re-derives every Full colour based on it, including preset colours and ones you set yourself.
- Text colours you set in a custom theme are used exactly as set.
- Classes "View All" buttons use the theme's button colours.
- The coloured line under card headers uses the theme's border colour.
- Theme import errors say why the import failed.
- Changing an assessment's Type no longer lags: predictions are recalculated once, after the dropdown closes, instead of up to four times while it's still open.
- Year in Progress no longer repeats the subject name above the "Show:" dropdown, because the selected chip already names it.
- Year in Progress font weights are consistent: the heading is bold, subject chips semibold and the legend regular.
- The Target ATAR and Target Grade inputs are left-aligned.
- Shorter description for the semester filter in Settings.
- The baselines header in Settings is now "Previous Year Baselines".
- Saved predictions and results are rebuilt once after updating.

### Fixes
- Year in Progress lost its cohort mean line with "Show this semester's classes only" on, when a class was read before its charts had loaded. Means now come from the saved cohort statistics.
- The outcome meter appeared on every subject's first marked assessment.
- Semester 1 tasks listed on Semester 2 panels were treated as Semester 2 tasks.
- The first Semester 1 task listed on a Semester 2 panel got an outcome meter measured against itself.
- The Target ATAR and Target Grade planners started Semester 2 before Semester 1 grades were final.
- The user menu's Sign Out button had a border and rounded corners instead of Connect's shape.
- The user menu's header could be dark text on a dark background.
- Liquid Glass page controls ran off the page in the Library.
- Liquid Glass page controls overlapped "Page N of M".
- Liquid Glass Learners headings were bars of different widths.
- Liquid Glass home page: a square box showed behind Connect Help and other tiles.
- Liquid Glass home page: the notice of the month's text sat on a darker box.
- A theme with its own wallpaper replaced your Settings wallpaper, which stayed after you switched themes.
- Importing `.ctme` theme files failed in Firefox with "Invalid theme file".
- Secondary and muted text colours set in a custom theme were swapped to grey.
- Dragging in the Theme Customizer's colour picker selected text or scrolled the page.
- The Theme Customizer's hue slider stopped short of both ends of its track.
- In Light mode, the Theme Customizer's title and Live Preview heading took Connect's maroon heading colour.
- In Light mode, the Theme Customizer's labels took Connect's grey label colour.
- The Maintenance Notice lost its red header in dark themes.
- Liquid Glass drew an extra strip under the Maintenance Notice.
- Auto-login failed with saved passwords in Chrome, Dia and other Chromium browsers: it pressed Log in before the browser had handed over the password.
- With "Show this semester's classes only" on, filtering Assessment Outlines to a class showed a blank page: the filtered view made Connectify think it was the other semester and hid the class. A class with no outline this semester now shows a message saying why, with a Back to All button.

## 3.2.3 (2026-10-18)

### Additions
- Five new Chrome Web Store screenshots, one per theme.

### Changes
- The theme audit checks chart labels inside SVGs.
- The theme audit checks the contrast of Connectify's own panels.
- The theme audit checks that every drawer tool lists every subject.

### Fixes
- Predictor, Weakness Analyzer and Year in Progress listed only one subject when it had been opened by hand before Expand All, or after a reload. Existing partial caches are rebuilt.
- Weakness Analyzer radar labels, ring percentages and scores were unreadable in grey Liquid Glass.
- The Settings category delete button was unreadable in grey Liquid Glass.
- The Settings "Cache cleared!" note was unreadable in grey Liquid Glass.
- Chrome Web Store publishing never ran, and Google retired the API it used. It now uses the Chrome Web Store API v2.

## 3.2.2 (2026-10-18)

### Additions
- **Multi-theme system**: a theme menu beside the header toggle with 7 presets: Dark, Quantum Dark (Gruvbox green highlights), AMOLED Black, Midnight Navy, Emerald Forest, Liquid Glass (grey) and Liquid Tinted Glass (navy).
- The last theme used is restored on startup.
- **Liquid Glass**: frosted blur, translucent tiles, and rounded panels, cards, tiles and dialogs.
- Liquid Glass covers Class pages: banners, category bars, headings, Learners tables and Summary tiles.
- Liquid Glass notices and discussions sit on a strong-blur reading panel that keeps your wallpaper visible.
- **Theme Customizer** Basic mode: 6 colours, with everything else derived with readable contrast.
- Theme Customizer Full mode: 20 colours.
- A live preview in the Theme Customizer whose tooltip names the colour under the pointer.
- An HSV/HEX colour picker beside the colour being edited.
- Theme JSON import and export.
- Blur (0–40px) and Transparency (10–100%) sliders in the Theme Customizer.
- A custom theme with Liquid Glass on becomes a recoloured glass theme.
- Edit (✎) and Delete (✕) buttons for custom themes in the theme menu.
- Renaming a custom theme updates it instead of saving a copy.
- Custom wallpaper upload.
- Six preset gradient wallpapers in Settings.
- **New school year baselines**: when every class has a new, later-year name, last year's assessment type and subject averages become your Predictor baselines.
- Old baselines are backed up when a new school year replaces them.
- A notification explains the new school year baselines.
- The sidebar is disabled with a "Back to All" notice while the outlines are filtered.
- Paginators and the Select All row get their own surface.
- Empty pages are centred.
- Firefox and Chrome store badges in the README.
- An automated Chrome Web Store publishing workflow.
- Developer tooling: a Puppeteer theme auditor.
- Developer tooling: a Connect page crawler.

### Removals
- The six-subject cap on Grade Predictor tabs.

### Changes
- One shared page observer and one heartbeat replace eight observers and nine timers.
- Background work pauses while you're idle or the tab is hidden.
- Dark themes paint one surface per block, so no text sits on a box of a different shade.
- Dark themes keep Connect's native spacing around course tiles.
- Dark themes keep Connect's button and input shapes.
- Dark themes keep Connect's full-width bars.
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
- Saved category keywords now apply immediately.
- Reset restores the real default categories.
- Deleting a category rescans assessments.
- Category names with special characters work.
- Resetting settings left baselines behind.
- Saving only half the baselines reset the other half.
- Categories created from baselines were overwritten on reload.
- Saved custom themes were missing from the Settings theme list.
- Target Grade's difficulty-weighted mode ignored your assessment type overrides.
- Compound progress bars of similarly named subjects (e.g. Biology and Human Biology) redrew each other.
- Clicking the sidebar handle closed was undone by hover.
- The open tool lost its highlight every 1.5s.
- Deleted custom themes came back after reload.
- Large wallpapers were lost.
- Themes were applied two or three times.
- Older custom themes kept Dark leftovers.
- Subject, task, category and theme names were inserted into the page without escaping.
- Boxplot stats now appear as soon as charts load instead of on the next heartbeat.
- Chart resyncs after opening an accordion never ran.
- Expand All's safety timer could cut a later run short.
- Collapse All lagged.
- False "missing component" notices from the DOM sweeper.
- Boxplot backgrounds showed as slabs in dark themes.

## 3.2.1 (2026-10-04)

### Changes
- README highlights for 3.2.0 rewritten for students.

### Fixes
- Expand All and Collapse All are fast again: the prediction cache is no longer marked current while empty, and redundant and repeated DOM scrapes are gone.

## 3.2.0 (2026-10-04)

### Additions
- **Grade Predictor**: Low, Mid and High projections for upcoming assessments and subject grades.
- **ATAR Predictor**: Low, Mid and High ATAR projections.
- Predicted gains taper above 80%.
- Prediction spread scales with how volatile a subject is.
- Previous Year Baselines in Settings so predictions work from the first assessment, including custom categories.
- **Outcome meter**: a four-segment bar beside each marked assessment.
- A floating tooltip on the outcome meter.
- A pulsing alarm on the outcome meter for a critical shortfall.
- Site-wide dark mode across every Connect page.
- Dark mode turns off on the login page and is restored after you sign in.
- Redesigned tools drawer with a 30px handle anchored to Connect's sidebar.
- The tools drawer expands when you push the pointer to the left edge.
- A 900px workspace for tools in the drawer.
- A Back to Menu button in the drawer.
- Floating Expand All / Collapse All buttons.
- A progress pill while Expand All runs.
- A Back to top button.
- Year in Progress (formerly Progress Graph) lists upcoming tasks.
- Year in Progress lets you edit task dates.
- Cache clearing in Settings.
- A prompt when cached data is out of date.
- Statistics panels scale with the display width.
- Statistics panels stay on one line.
- A single master test suite (`test_suite.js`).
- Automated Firefox Add-ons (AMO) publishing.

### Removals
- Green improvement arrows on assessments.
- The sidebar Close button: click outside the drawer or press Escape instead.

### Changes
- Light and dark modes share the same bold text.
- Statistics are formatted more compactly.
- Semester 2 progress bars include Semester 1 tasks.
- Predictions refresh when categories, baselines or grades change.

### Fixes
- Expand All froze at 95%.
- Double-click lag on accordions.
- A memory spike on refresh.
- Scroll lag.
- Charts being destroyed.
- False cache invalidation.
- Duplicate dark mode buttons.
- ATAR calculation errors.
- Tasks counted twice across semesters.
- iPad accordion instability.

## 3.1.14 (2026-09-23)

### Additions
- Grade update notifications: stacked toasts with Jump to Subject and Dismiss.
- A General Cohort Size setting.
- An ATAR Percentage setting.
- An auto-expand toggle.

### Changes
- Codebase split into files of 400 lines or fewer.

### Fixes
- Edge cases in the scraper.
- Edge cases in the countdown.
- Edge cases in the calculator.
- The auto-expand and collapse lifecycle.
- Notification readability.

## 3.1.13 (2026-09-23)

### Additions
- Add Category button.

### Changes
- Statistics panels are hidden on incomplete assessments.

### Fixes
- Saving categories now rescans assessments.
- The overall panel layout is fixed.
- Data sync is fixed.
- Session expiry no longer blocks auto-login.
- Session expiry no longer blocks background timers.

## 3.1.12 (2026-09-23)

### Additions
- Assessment Type dropdown beside each statistics panel.
- Custom categories shared across a class's Semester 1 and 2.
- Semester 1 scaling calibration table.
- Top-four selection in Target ATAR.
- Difficulty weighting in Target ATAR.
- A DOM health check that offers to restore missing components.

### Changes
- Cohort sizes persist across collapses and update with new results.
- Target ATAR holds the TEA bonus at its current value.
- The Weakness Analyzer radar is drawn as native SVG.
- Chart data is read through a page-world bridge.

### Fixes
- Cohort size matching for subjects such as Chemistry.
- Progress bar margins.
- Progress bar cumulative weighting.
- Sidebar margins.
- The Weakness Analyzer button.
- The Settings button.

## 3.1.11 (2026-09-23)

### Fixes
- Sidebar visibility on Orion for iPadOS.
- A sidebar flashing loop.
- Duplicate buttons.

## 3.1.10 (2026-09-23)

### Additions
- Subject filter checkboxes in the Weakness Analyzer.
- The Weakness Analyzer needs at least 3 subjects.

### Fixes
- WebKit and Safari compatibility.

## 3.1.9 (2026-09-23)

### Changes
- Settings split into sections.
- Non-button text styled distinctly from buttons.

### Fixes
- Dark radar chart background.
- The Target ATAR Planner.
- Sidebar scrolling.

## 3.1.8 (2026-09-23)

### Additions
- TISC percentile scaling with Semester 1 calibration.
- Manual date entry for assessments with unreadable dates.

### Changes
- Assessment dates are shown as Term/Week.
- Scaling options moved into Settings.
- Headings and copy were reworded across all tools.

### Fixes
- Calculator menu links.
- A render bug.
- Progress graph timestamps.
- Progress graph calendar mapping.
- Settings reloading.
- History graph ATAR scaling.
- History graph Y axis.
- Storage key mismatches.
- Multi-semester courses in Settings.

## 3.1.7 (2026-09-22)

### Changes
- Version bump to test auto-updates. No user-facing changes.

## 3.1.6 (2026-09-22)

### Additions
- Auto-login opt-out toggle.
- Auto-login is skipped after a manual logout.

### Fixes
- Auto-login state now works across the Connect and login domains.
- Added the missing `storage` permission.
- Auto-login works with Firefox's storage API.

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
- Renamed from Connext to Connectify.
- The manifest for this release was mislabelled 2.1.3.

## 3.1.2 (2026-09-22)

### Additions
- Assessment category settings in their own tab.
- A state cache that survives Connect redrawing the page.

### Changes
- Sidebar buttons renamed.
- The expand buttons moved into the page.
- Progress graph uses a month axis with history averaged by month.
- Progress bars are filtered by semester.

### Fixes
- Weakness Analyzer positioning.
- Progress bars flipping.
- A race condition that stopped data loading.
- Hover wiping the page.
- Year 11 detection.
- The back button.

## 3.1.1 (2026-09-22)

### Changes
- The weighting tracker is merged into the progress bar using opacity.
- Dark mode is lighter.

### Fixes
- ATAR features not rendering after Connect redrew the page.
- The radar chart failing on slow loads.
- Year 11/12 AT/AE parsing.

## 3.1.0 (2026-09-22)

### Additions
- Compound Progress Bars with an assessment weighting tracker.
- The WACE Exam Countdown.
- The Weakness Analyzer radar chart.
- The original cohort estimate is shown beneath an overridden cohort size.

### Changes
- The ATAR predictor adjusts Year 11 unscaled marks.
- Smaller statistics panels.
- A muted dark mode.
- The theme toggle is anchored to the top of the page.
- The Assessment Outlines shortcut stays visible on that page.
- Releases ship signed Chrome CRX3 builds.

### Fixes
- Cohort size estimates differing between semesters.
- The estimate notice not updating.

## 3.0.1 (2026-09-21)

### Changes
- Cohort sizes are estimated for every course type and refined from boxplots when available.

### Fixes
- Cohort size and rank showing as unavailable when accordions were collapsed on load.

## 3.0.0 (2026-09-21)

### Additions
- Cohort size estimation for any school and course from boxplot summaries.
- A manual cohort size override that persists across semesters.
- Cohort place estimated with a monotone PCHIP spline across the five quantiles.
- Progress graph Y axis scales to your ATAR range.
- Automated Firefox and Chrome build workflows.

### Removals
- Hard-coded school cohort tables.
- School-specific assessment corrections.
- The Year 11 Economics average calculator.
- Legacy minified source files.

### Changes
- Source unminified into documented modules.
- Every course is evaluated the same way from live Connect data.

### Fixes
- Standings show decimals (`Top 0.4%` rather than `Top 0%`).
- A "Your scored" typo.
- The cohort input being hidden by presets.
- Graph points overflowing the canvas.
