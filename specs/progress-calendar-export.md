# Spec: Export Assessments to Google Calendar & Notion

Status: implemented (2026-10-23).

## 1. Summary
An **Export** view in the Progress panel that turns the student's upcoming (unmarked) assessments into two downloadable files:
- **Google Calendar (.ics)**: one iCalendar file, imported in Google Calendar (also works in Apple Calendar and Outlook).
- **Notion (CSV)**: one CSV, imported in Notion as a new database (Import → CSV).

Everything is generated locally from Connectify's cache. No sign-in, no API, no server, no new permissions, so it works the same in the GitHub, Firefox and Chrome Web Store builds.

Connect gives assessments a school week ("Term 2 Week 6/7"), never a date, so the feature also adds a **generated WA school-term calendar** (with an **Early Easter** option) and a **weekday per subject** to place each task on a real day.

## 2. Entry point & layout
- **Header button**: `Export` (`.cx-refresh-btn` styling, `#cx-export-toggle`, `aria-pressed`) beside **Refresh Assessments** in the Progress header. Pressing it hides the subject chips and chart area and shows the export view (`#cx-export-view`); the button then reads `← Back to Graph` and pressing it restores the graph exactly as it was (selected chip kept).
- Only on the Assessment Outlines page (the Progress launcher is already disabled elsewhere under `.cx-page-notice`).
- Closing the drawer or opening another tool returns Progress to the graph next time it opens.

```
┌ Progress ───────────────────────────── [← Back to Graph] [Refresh Assessments] ┐
│ Terms start Mon 2 Feb · Mon 20 Apr · Mon 20 Jul · Mon 12 Oct   [x] Early Easter │
│ [Expand Subject Outlines]          (only when a class has no cached tasks)      │
│ [x] Merge exams into one event per semester (.ics)                              │
│                                                                                 │
│ Chemistry ATAR          Day: [Mon ▾]                      [Select All / None]   │
│   [x] Test 3            Term 2 Week 6/7      [Subject day ▾]   Mon 25 May       │
│   [x] Exam              Term 2 Week 9        [Subject day ▾]   Mon 15 Jun  In Semester 1 Exam │
│ English ATAR            Day: [Thu ▾]                                            │
│   [ ] Essay 2           Term 3 Week 2        [Fri ▾]           Fri 31 Jul       │
│                                                                                 │
│ No week: Practical Report (Physics ATAR). Set one in the Progress table.        │
│                                                                                 │
│ [Google Calendar (.ics)]   [Notion (CSV)]                                       │
│ To update an earlier export, import into a new calendar.                        │
└─────────────────────────────────────────────────────────────────────────────────┘
```

### 2.1 Term line
- `Terms start <T1> · <T2> · <T3> · <T4>` for the current calendar year (`Mon 2 Feb` format, the actual start weekday, so a Wednesday start reads `Wed 2 Feb`), then an **Early Easter** checkbox. Toggling it updates the Term 2 date, every preview date and both files at once.
- The checkbox starts at the automatic value (§3.2); the student's choice is stored per year and overrides it. No other term editing.

### 2.2 Expand Subject Outlines
- The shared `ConnectifyTargetUiHelpers.expandOutlinesButton(ctx)` button, shown only when a class tile on the page has no cached tasks. It expands only on the student's click (Rule 7), then the list rebuilds.

### 2.3 Task list
- **Rows**: every unmarked task (`pending`) of every class from `ConnectifyData.collectClasses(true)` (so "Show this semester's classes only" applies, as in every sidebar tool), grouped under its subject.
- **Subject heading**: cleaned subject name (same cleaning as the Progress chips / Predictor tabs: `- Semester N` suffix removed), a **Day** select (`Mon`–`Fri`, default `Mon`, `.cx-settings-select`) and Select All / None.
- **Task row**: tick checkbox, task name, the raw week text (caption), a per-task day select (`Subject day` (default, follows the heading) or `Mon`–`Fri`), and the export date preview (`Mon 25 May`), updated live on every change. A task whose caption is a real date shows that date and no day select.
- **Exam tag**: while merging is on, each ticked Exam row shows `In Semester N Exam` (secondary ink). Rows stay individually tickable; unticking removes the exam from the merged span.
- **Ticks**: every task is ticked by default; unticked tasks stay unticked across visits (by task key); tasks first seen later arrive ticked.
- **Order**: subjects by their next due task (earliest export date among their upcoming tasks, ticked or not, so ticking never reorders); subjects with no dated task last, A–Z. Within a subject, tasks by export date, undated ones last.
- **No week**: tasks with no readable week are not rows; one line under the list names each (`No week: <task> (<subject>), …. Set one in the Progress table.`), the only note besides the import hint (UI copy rule: only what the screen cannot show). Tasks that would land after Term 4 are listed the same way (`After Term 4: …`).
- **Empty**: no upcoming tasks → the list is replaced by `No upcoming assessments.` and the buttons are disabled.

### 2.4 Buttons
- `Google Calendar (.ics)` and `Notion (CSV)` (primary button tokens); disabled while nothing is ticked.
- One hint line under them: `To update an earlier export, import into a new calendar.` (Google's import skips events whose UID already exists, so moved tasks would not update in place.)
- Files: `connectify_assessments_<year>.ics` / `connectify_assessments_<year>.csv`, downloaded with a Blob and `<a download>` (the pattern in `theme-customizer-controls.js`), revoking the object URL afterwards.

## 3. School-term calendar (`school-terms.js`)
### 3.1 Term 1 start
- The **Monday falling 1–4 Feb**; in years with none, the **Wednesday falling 31 Jan–3 Feb**.
- **Week 1** is the week containing the start day; a Wednesday start makes Week 1 Wed–Fri. "Week n" anchors on the Monday of week 1 (`w1Mon`, the Monday before a Wednesday start).

### 3.2 Terms 2–4 and Early Easter
- Each term is 10 weeks, with 2-week holidays between terms; Terms 2–4 start on Mondays.
- Normal: T2 = `w1Mon + 12 weeks`, T3 = `+24 weeks`, T4 = `+36 weeks`.
- **Early Easter**: Term 1 is 9 weeks, the April holidays start a week earlier and Term 2 starts at `w1Mon + 11 weeks` with **11 weeks**. Terms 3 and 4 are unchanged.
- **Automatic value**: on when Easter Monday (Gregorian computus) falls in Term 1 Week 10 (the holidays would otherwise start the week after Easter); off otherwise. The student's checkbox overrides it for that year.
- Fixtures (tests):

| Year | Term 1 | Easter Monday | Early Easter (auto) | Term 2 | Term 3 | Term 4 |
|---|---|---|---|---|---|---|
| 2026 | Mon 2 Feb | 6 Apr | on | Mon 20 Apr | Mon 20 Jul | Mon 12 Oct |
| 2027 | Mon 1 Feb | 29 Mar | off | Mon 26 Apr | Mon 19 Jul | Mon 11 Oct |
| 2028 | Wed 2 Feb | 17 Apr | off | Mon 24 Apr | Mon 17 Jul | Mon 9 Oct |
| 2029 | Wed 31 Jan | 2 Apr | on | Mon 16 Apr | Mon 16 Jul | Mon 8 Oct |
| 2030 | Mon 4 Feb | 22 Apr | off | Mon 29 Apr | Mon 22 Jul | Mon 14 Oct |
| 2031 | Mon 3 Feb | 14 Apr | off | Mon 28 Apr | Mon 21 Jul | Mon 13 Oct |
| 2032 | Mon 2 Feb | 29 Mar | off | Mon 26 Apr | Mon 19 Jul | Mon 11 Oct |

- **Year**: the current calendar year. Public holidays and pupil-free days are not modelled.

### 3.3 API
`ConnectifySchoolTerms`: `term1Start(year)`, `easterMonday(year)`, `autoEarlyEaster(year)`, `terms(year, early)` → `[{ start, weeks }] x4`, `dateFor(year, term, week, weekday, early)` → `Date | null` (§4.2).

## 4. Task date resolution (`export-tasks.js`)
### 4.1 Which week
In priority order:
1. **Progress week override** (`ConnectifyUtils.readTimeOverride([subject, title], [id, name])`), read at export time so overrides typed after the last scrape count; decoded with `customWeekOrder` (12-slot order: `term = floor((o - 1) / 12) + 1`, `week = o - 12 (term - 1)`).
2. **Caption term and week**: `Term T Week W` / `Week W, Term T`; a range (`Week 6/7`, `6-7`, `6 & 7`) uses its **first** week.
3. **Caption real date** (`Fri 14 Mar`, `14th March`): that date in the current year; the weekday selects do not apply.
4. Otherwise **no week** (§2.3). A bare `Week 4` with no term counts as no week.

### 4.2 Which day
- The task's own day if set, else its subject's day (default Monday): that weekday of school week `W` of term `T`.
- **Spill-over**: a week past its term's length moves into the next term (`Term 1 Week 10` under Early Easter → Term 2 Week 1; `Term 2 Week 11` without it → Term 3 Week 1). Past Term 4 → left out (`After Term 4`).
- **Clamp**: a day before Term 1's start (Mon/Tue of a Wednesday-start Week 1) moves to the start day.

### 4.3 Task fields
`{ key: '<subject>::<task.id>', subject (cleaned), name, caption, weight, type, semester, date | null, reason }`; `type` = `ConnectifyTaskTypes.getEffectiveType(subject, task, task.labelsKey)` (overrides count); `semester` = the task's own `semester` (`taskSemester`: Semester 1 is before Term 2 Week 7).

## 5. Exam merge (.ics only)
- Checkbox `Merge exams into one event per semester (.ics)`, **default on**, stored.
- Tasks whose effective type is **Exam** (a Test set to Exam merges, an Exam set to Test does not), ticked and dated, grouped by semester **across all subjects**.
- A semester with **2 or more** such exams gets one all-day event `Semester N Exam` from the first exam date through the last (inclusive); its description lists each exam (`Mon 8 Jun: Exam (Chemistry ATAR)`), and the individual exam events are omitted. A semester with one exam keeps it as a normal event.
- The CSV always keeps one row per exam.

## 6. .ics format (`export-ics.js`)
- RFC 5545, CRLF line endings, lines folded at 75 octets, UTF-8. Text escaped (`\\`, `\;`, `\,`, newline → `\n`).
- Calendar: `VERSION:2.0`, `PRODID:-//Connectify//Assessments//EN`, `CALSCALE:GREGORIAN`, `METHOD:PUBLISH`, `X-WR-CALNAME:Connectify Assessments`.
- Event: `UID:<hash(account|year|key)>@connectify` (stable across exports; merged exams `<hash(account|year|sN-exam)>@connectify`), `DTSTAMP` (UTC now), `DTSTART;VALUE=DATE:<yyyymmdd>`, `DTEND;VALUE=DATE:<day after>` (exclusive end; the last exam's day after for a merged span), `SUMMARY:<task> (<subject>)`, `DESCRIPTION:Type: <type>\nWeight: <w>%\n<caption>` (Weight line omitted when unknown), `TRANSP:TRANSPARENT` (never shows the student as busy). No alarms.

## 7. CSV format (`export-csv.js`)
- RFC 4180 (comma, `"` quoting and doubling, CRLF), UTF-8 with BOM.
- Columns: `Name` (`<task> (<subject>)`, Notion's title), `Date` (`May 25, 2026`, a form Notion's importer reads as a date; verify on import), `Subject`, `Type`, `Weight (%)` (number, blank when unknown), `Term / Week` (the caption).
- Ticked, dated tasks only, in list order.

## 8. Storage
`connectify:calendar_export:<account>` (`localStorage`, account from `ConnectifyUtils.accountKey()`):
```
{ unticked: [key], subjectDays: { <subject>: 1-5 }, taskDays: { <key>: 1-5 },
  earlyEaster: { <year>: true | false }, mergeExams: true }
```
- A preference: Clear Cache keeps it; `clearSettingsCache` removes it. No algorithm version changes (no existing maths changes). Docs: add the key to `docs/apis_and_storage.md`.

## 9. Modules (new files, each <= 250 lines)
| File | Export | Role |
|---|---|---|
| `src/progress/school-terms.js` | `ConnectifySchoolTerms` | §3 term calendar, Easter, `dateFor` |
| `src/progress/export-tasks.js` | `ConnectifyExportTasks` | §4 upcoming tasks, weeks, dates, order, exam groups |
| `src/progress/export-ics.js` | `ConnectifyExportIcs` | §5–6 `build(items, opts)` |
| `src/progress/export-csv.js` | `ConnectifyExportCsv` | §7 `build(items)` |
| `src/progress/export-view.js` | `ConnectifyExportView` | §2 markup, events, storage, downloads; mounts its button in `#connectify-progress header` |
| `src/progress/export-view.css` | | view styles |

- Manifest: after `progress-graph.js` (outlines group only), in the order above; CSS with the other progress stylesheets. `progress-graph.js` is at 250 lines and is not touched: `export-view.js` adopts the existing panel and only toggles the chips/chart containers' `hidden`.
- `docs/architecture.md`, `docs/modules_ui_analytics.md` and `docs/features_analytics_publishing.md` (Feature 12) get one line each.

## 10. Styling
- Token-routed colours (`var(--cx-<token>, <Dark literal>)`), scoped to `#cx-export-view`; one surface per block (rows and headings clear inside the Progress panel, hairline dividers between subjects); Liquid Glass changes no button or input geometry; selects use `.cx-settings-select`; secondary text (captions, tags, notes) in the secondary ink at >= 5:1 in every theme, Light and light tone included; labels 400, subject names and dates 700. No `[class*=...]` ancestors.

## 11. Tests (`test_suite.js`)
1. Term starts, auto Early Easter and Term 2–4 starts match the §3.2 table for 2026–2032.
2. Wednesday start: Week 1 Mon/Tue clamp to Wed; Week 2 Monday = start + 5 days.
3. Early Easter toggled: Term 2 moves one week, Terms 3/4 do not; `Term 1 Week 10` spills to Term 2 Week 1; `Term 4 Week 11` is left out.
4. Week precedence: override > caption > real date; `Week 6/7` uses Week 6; bare `Week 4` is no week.
5. Subject day, task day override, and real-date captions ignoring both.
6. Order: subjects by next due, tasks by date, undated last; ticking does not reorder.
7. Ticks: unticks persist by key, new tasks ticked, stored shape as §8.
8. Exam merge: >= 2 exams per semester across subjects → one span with exclusive DTEND; one exam stays alone; Type overrides decide; unticked exams excluded; CSV unaffected.
9. .ics: CRLF, folding at 75 octets, escaping, `VALUE=DATE`, stable UIDs across two builds, no Weight line when unknown.
10. CSV: BOM, header, quoting of commas/quotes/newlines, date format, blank weight.
11. Line limits and manifest order for the new files; no new permissions.

## 12. Out of scope
Live sync (Google Calendar API, Notion API, subscription URLs), reminders/alarms, per-subject calendar files, public holidays and pupil-free days, editable term dates, timetable-based weekdays, marked tasks.

## 13. Risks to verify
- Blob downloads from a content script in Firefox MV3 (the theme `.ctme` export already uses this path; confirm in Firefox Developer Edition).
- Notion's CSV importer detecting the `Date` column as a date and `Subject` / `Type` as selects (else the student changes the property type once).
- Schools whose terms differ from the generated WA pattern (private/Catholic) get off-by-a-week dates; only Early Easter is adjustable.
