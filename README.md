# Connext 2.0.0

Connext adds local assessment statistics, progress graphs, grade planning and a dark theme to Connect.

## Install or update

Extract the complete package into your extension folder, reload the extension in your browser's extension manager, and refresh all open Connect pages. Keep the existing extension identity to preserve saved settings. The new logo is the supplied artwork. Core scripts include assessment-data.js, cohort-stats.js, atar-calculator.js, progress-graph.js, sidebar.js, theme.js and navigation.js; the manifest has been updated accordingly.

## Progress Graph

On Assessment Outlines, select Progress Graph, then a subject. Opening it expands available assessment details. The line shows completed raw assessment percentages from semester 1 through the cumulative semester 2 outline. Pending results are omitted; zero is a completed score. Matching tasks repeated across the two outlines are shown once, with the newer result used. Published week/term/date labels determine order where readable; otherwise the outline order is retained. Hover or focus points for details; the table below lists every plotted mark. Use Scan all assessments if details have not loaded. Show all subjects in Connect to include them all.

## Cohorts and ranks

Built-in cohort counts apply only when Year 11 is detected and the subject card identifies Willetton Senior High School. Explicit other-year cards are excluded. Other schools and subjects use manual entry, shared between semesters. Added Modern History ATAR (15), Mathematics Applications ATAR (189) and Accounting/Accounting and Finance ATAR (36).

An estimated rank of 1 reads “You're the top of the cohort for this subject” or “You're the top of the cohort for this test”. Other ranks read “Your estimated subject/assessment rank is … out of …”. These remain estimates from the published boxplot summary, not official ranks.

## Calculators

ATAR estimate and Target ATAR are available only when assessment cards contain Year 11 or Year 12. Otherwise only Target grade remains, and the launcher is named Grade calculator. Target headings use “whether”. The requested explanatory grade-planner note is removed.

Target ATAR opens semester 1 before overall A–E grades appear, opens semester 2 after semester 1 grades are published, and closes each semester once its own grades appear. Both close when both have grades. Semester 1 uses its actual outline total; semester 2 uses the full annual weighting including completed semester 1 tasks. Target grade retains its semester-selection behaviour. See ATAR-REFERENCE.md for calculation assumptions.

## Navigation and appearance

Assessment Outlines appears beside My Connect across Connect, except within Assessment Outlines itself. It opens the signed-in user's outline without a hard-coded student ID. The shortcut also appears in the small-screen menu. Dark mode uses a saved site-wide preference and restores its toggle if Connect rebuilds the page. Native menus, selected items, hover states, avatar button backgrounds and buttons use soft dark surfaces; profile images are preserved.

## Verification

Calculation checks cover cohort/school/year restrictions, new defaults, and existing ATAR/grade scenarios. Browser fixtures checked graph order, repeated-task removal, pending-task exclusion, the grade-only interface, the shortcut and selected dark menu surfaces. The actual Connect DOM was inspected for school labels, task weeks and native menu classes. The package was not installed into the user's browser during this task.

## Version 2.0.1

Fixed Willetton detection when Connect joins adjacent labels without spaces (for example, TeacherfromWilletton). School matching now also reads the individual Vaadin labels. Verified the corrected match on all 12 current subject cards and regression-tested cohort defaults, other schools and Year 12 exclusions. Removed the requested Target ATAR explanatory paragraph.

## Version 2.0.2

Progress Graph corrects the supplied Year 11 Physics task labels: Portfolio assessment 1C is Term 3 week 4, and Test 3: Waves is Term 3 week 6. The correction affects graph labels and ordering only, leaving school records unchanged.

The calculator now uses compact segmented tabs, tighter score rows, a slightly wider panel and clearer result highlighting. Detailed target calculations and imported assessment tables are expandable, keeping the main result visible without long default scrolling. Verified a six-subject calculator layout and the collapsed target breakdown in a browser fixture; existing calculation tests and the Physics correction checks pass.

## Version 2.0.3

Both assessment breakdowns are permanently visible sections with no collapse option. Both target calculation buttons read Calculate. Added spacing between target inputs and buttons, and placed the subject selector on its own row above the overall target field. Calculation checks pass; the revised grade layout was checked in a browser preview.

## Version 2.1.0 — Shared sidebar and progress comparison

Open Connext with the obvious arrow on the right edge. The sidebar contains the calculator, Progress Graph, Expand all and Unexpand all. Tools fill the sidebar workspace, and opening one immediately closes the other. Subject checkboxes have more separation from their labels and rows. On smaller screens the workspace fits within the viewport.

Progress Graph overlays a red estimated cohort-mean line on the blue student-score line, with the requested colour legend. Cohort means use the same five-number-summary estimate as the statistics cards. Missing boxplots create gaps, never invented means. ATAR Progression appears after the subject buttons for Years 11/12. It reconstructs weighted running school percentages at each available school week, applying the same 2025 ATAR rounding and bonuses. It starts once at least four subjects have results. It uses school marks, not manual current-score overrides, and does not use future scores at earlier dates. Missing dates or weights prevent an unreliable history from being plotted; below-table ATAR values remain <30 instead of becoming zero.

A green up arrow appears at the latest completed task when its percentage exceeds the current overall subject average. Pending tasks are excluded. Task order uses published weeks/dates, including the previously requested Physics correction.

For Willetton Year 11 Economics ATAR, Calculate Economics average displays the weighted completed-assessment average for semester 1 and the cumulative average across both semesters. Repeated tasks are included once. These calculated percentages become the default school marks for the ATAR calculator and the basis of target grade calculations. Existing manual scenario overrides remain editable; Reset restores the calculated marks. The special button disappears when overall letter grades appear in both semesters. Expand all details to supply task scores and weights. This uses published weights and does not assume a 50/50 semester split or a separate Economics scaling formula.

The theme switch now sits immediately before the notification bell when it is available. In light mode its button is dark; in dark mode its button is white. If the header has not loaded yet, it uses a temporary top-right position.

Update every file, including the new data.js, sidebar.js and sidebar.css, reload the extension, and refresh Connect. Verified the live bell selector; browser fixtures checked panel switching, cohort lines, ATAR progression, Economics averages and gates, green arrows, and expand/collapse controls. Math checks cover missing data and no use of later results in earlier ATAR points. The authenticated browser extension was not installed or replaced by this task.

## 2.1.1
- Theme switch is aligned beside the notification bell without changing navigation height.
- Larger, labelled Connext tools opener makes calculators and progress graphs easier to find.
- Latest-assessment improvement arrow sits to the right of its statistics panel.


## 2.1.2
- ATAR progression recognises reversed term/week captions such as Weeks 7 & 8 Term 2.
- Undated zero-weight exam components no longer block the timeline or double-count the full exam.
- Unreadable dates or weights on contributing assessments identify the affected task.
- Verified progression rendering with mixed date formats and zero-weight exam components; calculation regression checks passed.


## 2.1.3
- ATAR estimate, Target ATAR and Target grade open directly from the main Connext tools menu.
- Removed the combined calculator launcher and internal calculator tabs.
- Preserved year-group eligibility and exclusive tool switching; verified all three destinations and junior grade-only access.


## 2.1.4
- Tool buttons and expand/collapse controls appear only in the main Tools menu, not above individual tools.
- The theme button keeps a fixed top position and width; scrolling and theme changes no longer reposition it. Header spacing recalculates only on window resize.
- Verified Tools restores the menu and the theme button coordinates remain unchanged after scrolling and toggling.


## 2.1.5
- The sidebar header shows a left-arrow Back to Main Menu button only inside a tool; it is hidden on the main menu.



### 2.1.6 — Chapter-labelled assessments

ATAR Progression now falls back to assessment rounds when a completed weighted assessment has no readable date, including Human Biology chapter labels. Each round adds the next completed weighted task in each subject’s outline order; subjects with fewer tasks retain their latest average. All subjects remain included, and the graph explains that rounds are not calendar dates. Dated outlines continue to use school weeks. Missing weights still require refreshing expanded outlines.


### 2.1.7 — Music cohort and tools button

Music ATAR uses a cohort of 10, including titles written as Music: ATAR. The closed Connext tools button now sits at the lower-left edge.


### 2.1.8 — Left-side tools panel

The tools panel now opens from the left, with its handle on the panel’s right edge and a left-pointing close arrow. This applies to both the main menu and expanded tools.


### 2.1.9 — Visible assessment detail controls

Assessment expand/collapse icons are white in dark mode, with clearer button borders, hover and keyboard focus states.


### 2.1.10 — Correct dark-mode detail arrows

Removed icon filters that produced a white square. Dark mode now shows a white down/up arrow on a dark blue background for Show/Hide Details. The visual overlay leaves native clicks unchanged.


### 2.1.11 — Remove duplicate tool navigation

Removed the inner Close/Back buttons from the calculators and progress graph. Use Back to Main Menu in the shared header. The outer panel Close button remains.

## 2.1.12 - Home announcement dark theme
Fixed the homepage white promotion card override, heading, body text and Learn more button. Artwork is preserved. Verified against Connect's native white-theme rules in both dark and light mode. Based on the supplied Connext-Final.zip (2.1.11).


## 2.1.13 - Readable dark-mode text
Cohort entry labels are white in dark mode. Dark neutral text, including inline-styled text, dynamically inserted content and SVG text labels, is converted to white. Original inline text styles are restored in light mode. Coloured text and artwork are preserved. Verified dark/light restoration and late-loaded text in the browser.


## 2.1.14 - Attendance, category menus and placeholders
Fixed semi-transparent black text that the old opacity filter skipped. Added explicit white attendance headers/footer labels, dark native category menus on Attendance and Reports, and opaque white input placeholders. Inspected both native menus and verified original colours return in light mode.

