# Spec: Goals

Status: spec (2026-10-26). Not implemented.

## 1. Summary
The Goal Setter's **Target Grade** and **Target ATAR** planners get a **Set as Goal** button that opens a modal dialog (preview, end point, Confirm) to save the plan as a **goal**. A **Goals** button opens a second modal listing saved goals. A saved goal:
- has a **difficulty tier** worked out from the chance of reaching it: **Trivial, Easy, Medium, Hard, Hell**, plus **Guaranteed** and **Impossible**, which end the goal as soon as they happen (early lock-in);
- carries **effort sliders** (5 notches) on each remaining task (Target Grade) or each top-four subject (Target ATAR) that shift the required marks between them without touching outline weights;
- adds two vertical bars to assessment rows on the outlines page: a **goal-performance bar** on completed tasks (four pastel segments plus a secret purple breakout) and a **goal-progress bar** (smooth, unsegmented fill coloured by the goal's tier) on completed tasks and the subject's overall row;
- is **saved**, **editable** and listed in the Goals modal, with finished goals kept under Past goals;
- for Target ATAR, creates **linked subject goals** for the top four, re-solved after every new mark.

Rule: **one active goal per subject**. A Target ATAR goal holds its four subjects.

## 2. Goal kinds and end points
| | Grade goal | ATAR goal |
|---|---|---|
| Target | final percent 0–100 | ATAR 30–99.95 |
| End | **Semester 1**, **Semester 2** or **Custom week** (school week 1–40) | **Semester 1** or **Semester 2** (the planner's semester buttons) |
| Sliders | one per remaining task in range | one per top-four subject; task sliders through each linked subject (§5.3) |
| Children | none | four linked grade goals (the top four ticked when saved, fixed until edited) |

### 2.1 What a goal measures
- **Semester ends**: the subject's semester mark, the way Connect works it out (Semester 2 is cumulative and includes Semester 1 tasks). The tasks in range are the outline's tasks for that semester (`taskSemester`, school week 17 split, the same as everywhere else).
- **Custom week** (grade goals only): the running weight-weighted mean of every task due up to the end of that school week (`ConnectifySchoolTerms.weekOrder`, Early Easter respected; Semester 2 weeks include Semester 1 tasks).
  - **A task's week is its Year Progression week**: the week set in the Progress table (`connectea:time_override:`, read through `ConnectifyUtils.customWeekOrder`), else its caption. This is the same `order` the graph and the export use.
  - Tasks after the end week are out of range: no slider, no bars.
  - Tasks with no readable week are also out of range. One line in the Set as Goal dialog names them (`No week: <task>. Set one in the Progress table.`); it is the only note besides errors.
- **Week snapshot**: goal ranges use the weeks as they were when the page loaded (`ConnectifyGoalPlan.weekSnapshot()`, taken once per load, beside `ConnectifyPanelView`'s read-once pattern). Changing a week in the Year Progression table, or toggling Early Easter, does **not** recompute goals, bars, tiers or verdicts until the page is reloaded.
  - The graph, the export and predictions still update at once, as today.
  - The goal subsystem ignores `connectify-terms-updated` and week-override saves. After either one, goals are **held** (`ConnectifyGoalPlan.isHeld()`): no tier, bar, verdict, lock-in or toast-line recompute for the rest of the page's life, even when the predictions refresh. Rows and dialogs keep showing the last values until reload.
  - The Set as Goal dialog also uses the snapshot, so a preview always matches what the saved goal will show.
- The week picker shows the term form beside the number (`Week 24 · Term 3 Week 4`), from this year's terms (snapshot).

### 2.2 Lifecycle
- **Active**: tier recomputed on every cohort pass and on `connectify-results-updated` / `connectify-predictions-updated`.
- **Early lock-in**:
  - **Guaranteed** (the target is met even with 0% on every remaining task in range) → **Achieved** at once.
  - **Impossible** (the target needs more than 100% on the remaining tasks) → **Missed** at once.
- **All tasks in range marked**, or the semester's final A–E letter shows → **Achieved** if the measured mark ≥ target, else **Missed**.
- A finished goal moves to **Past goals** and frees its subject. Its verdicts are frozen (§7.3).
- **ATAR goals**: only the ATAR goal locks in or finishes. The children re-solve (§5.2), so a child never finishes on its own. When the ATAR goal finishes, its children finish with it.

## 3. Difficulty tiers

### 3.1 Chance of success
Taken from Connectify's existing projections, so a goal never disagrees with the Predictor:
- **Grade goal**: target vs the subject's projected final mark (`projectSubjectGrades`: Low / Mid / High ≈ 20th / 50th / 80th percentile). For a custom week, the same projection limited to the tasks in range.
- **ATAR goal**: target vs Predict ATAR's Low / Mid / High (`projectATAR`).
- Model: a normal distribution centred on Mid. σ is the half-range on the target's side divided by 0.8416 (`(High − Mid)/0.8416` when target ≥ Mid, else `(Mid − Low)/0.8416`), so lopsided ATAR ranges stay honest. `chance = 1 − Φ((target − Mid)/σ)`. When the half-range is 0, chance is 1 or 0.
- **Effort sliders do not change the chance.** They change where the marks are needed, not how likely the total is.
- **Per-task tier** (planner only): the chance of scoring at least the task's required mark R against that task's own prediction (`predictTask` Low / Mid / High, same σ rule). Tasks without a prediction get no tier.

### 3.2 Tiers
| Tier | Rule | Progress colour (not pastel) |
|---|---|---|
| Guaranteed | met at 0% on everything left (→ Achieved) | `#15803d` |
| Trivial | chance ≥ 90% | `#22c55e` |
| Easy | 70% ≤ chance < 90% | `#84cc16` |
| Medium | 40% ≤ chance < 70% | `#eab308` |
| Hard | 15% ≤ chance < 40% | `#f97316` |
| Hell | chance < 15% (still possible) | `#ef4444` |
| Impossible | needs > 100% (→ Missed) | `#991b1b` |

Achieved bars and cards use the Guaranteed colour; Missed bars and cards use the Impossible colour. These are semantic colours and stay literal (Test 167 exemption, like the category and outcome colours). Light tone re-inks the tier **text** labels at OKLCH L 0.34 (hue and chroma kept); the bar fills keep their colours. Every label keeps ≥ 5:1 contrast.

## 4. Goal Setter UI

The planners stay planners. Goals are made in a **Set as Goal** dialog and managed in a **Goals** dialog. Both are modal dialogs over the page.

**Shared dialog behaviour** (`theme-wallpaper-crop.js` / customizer pattern):
- solid themed surface, never translucent in glass themes, 20px corners only in Liquid Glass;
- the page is dimmed behind (brightened in light tone);
- focus moves into the dialog and returns to the opening button;
- Escape, Cancel / ✕, or a click outside closes it without saving;
- clicks inside never reach the sidebar's outside-click handler, so the drawer stays open;
- labels use the theme ink.

### 4.1 Planner tabs (Target Grade, Target ATAR)
- **Target Grade**: the breakdown lists every remaining task with its required mark, a **per-task tier label** and an **effort slider** (§5).
- **Target ATAR**: each top-four subject row gets an effort slider and its own tier label (its required mark vs its projection, §3.1).
- Both banners show the goal tier label. No chance percentage and no explanatory notes (UI copy rule).
- The tabs have no End picker. They plan for the selected semester button, as today.
- **Set as Goal** (primary button tokens) sits under the result, in the Goal Setter only (never the Estimator), on the outlines page only. It is disabled while the planner shows an error.
- **Goals** (secondary button, `#cx-goals-open`, with the active count, e.g. `Goals (3)`) sits in the Goal Setter header beside the mode tabs. It is disabled when there are no goals at all.

### 4.2 Set as Goal dialog (`#cx-goal-dialog`)
```
┌ Set as Goal ─────────────────────────────────────────── ✕ ┐
│ Chemistry ATAR · 85%                              [Hard]    │
│ End: [Semester 2 ▾]   (Custom week… → Week [24] Term 3 Week 4) │
│                                                             │
│ Task                    Effort      Needs     Tier          │
│ Test 4                  More        88.0%     Hard          │
│ Investigation 2         Normal      81.5%     Medium        │
│ Semester 2 Exam         Less        79.0%     Medium        │
│                                                             │
│ ███████████░░░░░░░░░  41.2 of 80 weighted points            │
│ No week: Practical Report. Set one in the Progress table.   │
│                                         [Cancel] [Confirm]  │
└─────────────────────────────────────────────────────────────┘
```
- **Preview**: what the goal will be, from the planner's current subject (or top four), target, checkbox and sliders:
  - the heading: subject or `ATAR`, target and the goal's tier label;
  - read-only rows for the tasks (or subjects) in range, with their effort notch name, required mark and tier;
  - the horizontal progress bar with its points.
  - ATAR previews list the four subjects with their solved targets.
- **End**:
  - grade goals: `Semester 1` / `Semester 2` / `Custom week…`, which shows a week input (1–40) with the term hint. It defaults to the planner's selected semester.
  - ATAR goals: `Semester 1` / `Semester 2` only.
  - Changing the end recomputes the preview at once: tasks outside the range drop out, and their sliders are kept but ignored.
- **Confirm** saves the goal and closes the dialog. The Goal Setter shows a one-line `Goal set.` status for 3s, beside Set as Goal.
- Confirm is disabled, with one line saying why, when:
  - the preview is **Guaranteed** (`Already secured.`) or **Impossible** (`Highest possible: 78.4%.`);
  - the subject already has an active goal (`<subject> already has a goal.` plus an **Edit** link that opens it, §4.4);
  - the subject is held by the ATAR goal (`Set by your ATAR 95.00 goal.`, §5.3);
  - another ATAR goal is active (`You already have an ATAR goal.`).
- **ATAR conflict**: when a top-four subject already has a grade goal, Confirm turns into an in-dialog prompt: `Chemistry ATAR already has a goal (85% by Semester 2). Replace it?` **Replace** / **Back**. Replace deletes that grade goal (it does not go to Past goals), then saves.

### 4.3 Goals dialog (`#cx-goals-dialog`)
```
┌ Goals ───────────────────────────────────────────────── ✕ ┐
│ ┌ Chemistry ATAR · 85% by Semester 2 ──────── [Hard] ✎ ✕ ┐ │
│ │ ███████████░░░░░░░░░  41.2 of 80 weighted points       │ │
│ └────────────────────────────────────────────────────────┘ │
│ ┌ ATAR 95.00 by Semester 2 ─────────────────── [Medium] ✎ ✕ ┐│
│ │ ████████░░░░░░░░░░░░                                     ││
│ │ Methods ATAR 88.4% · English ATAR 81.0% · Chemistry … · … ││
│ └──────────────────────────────────────────────────────────┘│
│ ▸ Past goals (2)                                             │
└──────────────────────────────────────────────────────────────┘
```
- **Card**:
  - the subject (cleaned name) or `ATAR`, with its target and end (`85% by Semester 2`, `80% by Term 3 Week 4`, `ATAR 95.00 by Semester 1`);
  - a tier label in the tier colour (text);
  - a horizontal version of the progress bar (same fill and colour), with `<earned> of <required> weighted points` for grade goals;
  - **Edit ✎** and **Delete ✕**, the custom-theme menu's actions. Delete asks first, inline, never with `window.confirm`.
  - ATAR cards also list their four children with each one's current target.
- **Order**: the ATAR goal first, then grade goals by end, soonest first.
- **Past goals**: a collapsed `<details>` listing each finished goal's target, **Achieved** / **Missed**, the final mark or ATAR, and the date it finished. Read-only; Delete only.
- A just-completed goal's card glows (`.cx-goal-card--celebrate`, ~2s) the next time the Goals dialog opens after its celebration (§8.2).
- Also opens off the outlines page, read-only: no Edit, and progress and tiers from the cache.

### 4.4 Editing
- **Edit ✎** closes the Goals dialog and loads the goal into its planner tab: subject or top four, target, semester, checkbox and sliders.
- The tab heading reads `Editing <subject> goal` (or `Editing ATAR goal`), with a **Cancel Editing** link that restores the planner to how it was before.
- In edit mode, **Set as Goal** reads **Update Goal**. It opens the same dialog with the goal's end preselected, and **Confirm** reads **Save Changes**. The goal keeps its id (revision + 1), so it stays the same goal (§7.1).
- The conflict rules ignore the goal being edited.

## 5. Effort sliders

### 5.1 Control
- `<input type="range" min="-2" max="2" step="1">` (`.cx-goal-slider`), with the notch name beside it: **Much less / Less / Normal / More / Much more** (also its `aria-valuetext`). Keyboard-operable. Touch-target rules apply.
- No tooltip explaining the maths.
- Sliders exist only on unmarked, weighted tasks in range. When a task is marked, its slider goes away and the solver spreads its share over the rest.
- **The "Adjust marks by subject & task type performance" checkbox stays.** Toggling it either way resets every slider in the plan to Normal.

### 5.2 Maths: baseline offset
- Each notch shifts the baseline of its task (or every task of its subject, for ATAR) by **±5 points** (−10 / −5 / 0 / +5 / +10), applied after `clampBaseline` and clamped to [0, 100]. Then the existing bisection over the shared effort `t` (`ConnectifyTargetDifficulty.scoreAt` / `bisect`) solves the plan. "More" asks for roughly 5 points more on that task, and the other tasks drop to make up for it.
- **Checkbox on**: baselines come from past performance (as today).
- **Checkbox off**: every task gets the same flat baseline (the course average, else the required uniform average), then the offsets. With every slider at Normal this reproduces today's uniform required average exactly.
- **ATAR goal**: the subject notch and that subject's task notches (§5.3) add together on each task's baseline. The solver holds the TEA bonus fixed, as today.
- **Implementation**: `gradePlan` / `targetPlan` take a new `offsets` option (`{ [taskId]: points }`, `{ [course]: points }`). No offsets means today's behaviour. Bump `PREDICTOR_ALGO_VERSION` only if shared prediction maths changes (it should not).
- **ATAR re-solve**: the target, the top four and all sliders stay fixed, while the four child targets are re-solved after every new mark so the ATAR stays reachable.

### 5.3 Linked subjects (ATAR children)
- Picking an ATAR-held subject in the Target Grade tab shows its current target read-only (`Set by your ATAR 95.00 goal`), its tasks' required marks, tiers and **task sliders**. The sliders are editable.
- The target and checkbox are disabled there; they belong to the ATAR goal.
- **Update Goal** opens the Set as Goal dialog for the ATAR goal. Its preview shows this subject's tasks, and its end is locked. **Save Changes** stores the task sliders into the ATAR goal.

## 6. Bars on the outlines page

### 6.1 Placement
- Both bars are vertical, **18 × 56 px**, placed in the row wrapper **right of the outcome meter** (or where it would be when the meter is suppressed), so rows never grow. They appear in compact and expanded panels alike.
- **Completed task rows** judged by a goal (§7) get a performance bar and a progress bar.
- **The overall row** of a subject with a goal (active, or the latest past goal) gets a progress bar only.
- Unmarked rows get none.
- **Tooltips**: one singleton floating tooltip, `#cx-goal-tooltip` (as `#connectea-outcome-tooltip`: viewport-fixed, `pointer-events: none` on segments, never a `title` attribute), giving numbers only:
  - performance: `Needed 78.0% • Got 82.5%`;
  - progress: `Goal 80%: 41.2 of 80 weighted points • Hard` (ATAR children: `ATAR goal 95.00 • Chemistry needs 84.0%: 41.2 of 67.2 weighted points • Hard`).
  - Purple is never mentioned.

### 6.2 Goal-performance bar (completed tasks)
- **R** = the task's required mark from replaying the goal with only the results marked before this task, using the goal's current target and sliders (§7.1).
- **Tiers** (mark M):
  - Red: M < R − 5
  - Orange: R − 5 ≤ M < R
  - Yellow: R ≤ M < R + 5
  - Green: M ≥ R + 5
  - **Purple breakout**: M > 1.10 × R on top of Green. Secret, as with the outcome meter: never shown in tooltips, legends or docs aimed at users. (When R > 90.9, purple cannot happen, as with the outcome meter.)
- Geometry mirrors the outcome meter: 4 segments of 10 px, plus a purple 5th segment of 20 px; the active segment is fully opaque on the inactive track token.
- Pastel colours, so it never reads as the outcome meter: red `#f4a3a3`, orange `#f8c99b`, yellow `#f5e19a`, green `#a7e3b5`, purple `#cdb5f7`.

### 6.3 Goal-progress bar
- **Fill** = earned weighted points / required weighted points, capped at 1, where required = target × (total weight of the tasks in range) / 100. A smooth fill from the bottom up, **no segments**.
- **Task rows**: progress and tier **as of that task** (the cumulative points and the goal's tier right after it was marked), so the column reads as a history.
- **Overall row**: progress and tier now.
- **ATAR children**: points against the child's target at that time; colour by the child's own tier (its required mark vs its projection). The ATAR goal's own tier is on its card.
- **Colour**: tier table §3.2. Achieved and Missed use the Guaranteed and Impossible colours.

### 6.4 Rendering and memo
- `src/goals/goal-bars.js` renders inside the existing cohort pass (`cohort-view.js` calls it). It adds `goalSig` (goal id, revision, target, sliders, the task's verdict) to `ui._memo`, so rows without changes skip rebuilds.
- `dom-sweeper.js` ignores the bars (optional components).
- The observer already ignores Connectify's own nodes.

## 7. Which goal judges a task

### 7.1 Replay
- Each goal records `priorMarked`: the task ids already marked when it was created (from `cardTaskIds` / the subjects cache).
- Tasks in range that are not in `priorMarked` are judged by this goal, replayed live with its **current** settings. **Any edit keeps it the same goal** (target, sliders, end, checkbox), and its tasks are re-judged.
- Tasks in `priorMarked` show the **previous goal's verdict**: the most recent past goal that judged that task, frozen. If there is none, they get no bars.
- Delete-and-create starts a new goal, so the old goal's frozen verdicts (if it finished) stay and its live ones disappear.

### 7.2 Replay engine (`goal-plan.js`)
For each judged task in date order (school week, as the Predictor orders tasks), the engine runs the plan with only the results before it. It records R (§6.2), the tier just after it (§6.3) and the cumulative points. It is memoised per goal revision plus the results signature.

### 7.3 Frozen verdicts
- When a goal finishes, each judged task's `{ required, mark, perfTier, progress, goalTier }` is written to `connectify:goal_verdicts:<account>` under the goal id.
- Finished goals' bars keep showing them until a newer goal judges those tasks.
- **Clear Cache** removes `connectify:goal_verdicts:` (goals stay). Past goals are replayed again from their stored settings when their tasks are still cached; otherwise their bars go.

## 8. Notifications and celebration

### 8.1 Folded into "Class Updated"
The existing grade toast (`new-grade.js`) for a subject with an active goal (or an ATAR child) gets one extra line:
- unchanged: `Goal: Medium` (ATAR children: `ATAR goal: Medium`);
- tier changed: `Goal is now Hard (was Medium)`;
- finished, achieved: `Goal complete!` plus the celebration;
- finished, missed: `Goal missed!`.

There is no separate goal toast. The goal's `lastTier` is stored, so the "was" tier survives reloads.

### 8.2 Celebration (`goal-celebrate.js`, `goal-celebrate.css`)
- Plays **once per goal** (`celebrated: true` saved), never again on reload.
- About **4 s** of confetti bursting from the toast across the viewport, on a fixed full-screen canvas `#cx-goal-confetti` (`pointer-events: none`, top z-index, removed afterwards; no library, `requestAnimationFrame`, stopped when the tab is hidden).
- A stronger screen shake, about 600 ms. The shake applies `translate` to Connect's app layout (`#main-content`'s layout root), never `<html>`/`<body>`, so fixed elements and the drawer keep their positions.
- The goal card glows the next time the Goals dialog opens (§4.3).
- **`prefers-reduced-motion: reduce`**: no shake. The confetti becomes a static burst that fades in and out without moving. The toast text is unchanged.
- **ATAR goals**: one celebration (or one `Goal missed!`) for the ATAR goal; the children never celebrate.

## 9. Goals in other tools
- **Year Progression**: a dashed horizontal goal line (`.cx-goal-line`, labelled `Goal 85%`) on the subject's chart in every Show mode, running up to the goal's end week (to the right edge for semester ends). ATAR Progression shows the ATAR goal's line. It is drawn under the series, like the semester divider.
- **Estimate Grade**: when the selected class has a goal, one line under the headline: `Goal 85%: met` or `Goal 85%: 3.2 short`, using the typed estimate for the tasks in range.
- **Estimate ATAR**: when an ATAR goal exists for the shown semester: `Goal 95.00: met` or `Goal 95.00: 1.35 short`.

## 10. Storage
| Key | Store | Content |
|---|---|---|
| `connectify:goals:<account>` | `localStorage` | `{ version: 1, goals: [Goal] }` (account from `ConnectifyUtils.accountKey`) |
| `connectify:goal_verdicts:<account>` | `localStorage` | `{ <goalId>: { <taskId>: { required, mark, perfTier, progress, goalTier } } }` |

```
Goal = {
  id, revision,                       // revision++ on every edit (memo key)
  kind: 'grade' | 'atar',
  subject,                            // grade: cleaned subject key (year-independent match like year-rollover)
  parent,                             // ATAR child: the ATAR goal id; children are stored as grade goals
  target,                             // percent or ATAR; for children the last solved target (for toasts)
  end: { type: 'semester', semester: 1 | 2 } | { type: 'week', week: 1..40 },
  difficultyWeighted,                 // the checkbox
  sliders: { <taskId>: -2..2 },       // grade goals and children
  subjectSliders: { <course>: -2..2 },// ATAR
  topFour: [course],                  // ATAR, fixed until edited
  priorMarked: [taskId],
  status: 'active' | 'achieved' | 'missed',
  createdAt, finishedAt, finalValue,
  lastTier, celebrated
}
```
- Goals are student data: **Clear Cache keeps them** (verdicts excepted, §7.3), and `clearSettingsCache` removes them.
- **Conflicts** are checked by `ConnectifyGoalStore.conflicts(goal)`: one active goal per subject key (both semester outlines are one subject), and one active ATAR goal.
- **New school year** (`year-rollover.js`): active goals are judged on what is marked and finished; every goal and verdict goes into `connectify:year_archive:<account>` with last year's results; the Goals list starts empty.
- **Backward compatibility**: a missing or unknown `version` reads as no goals. Unknown fields are kept on save.

## 11. Files (new features in new files, each ≤ 250 lines)
Registered in `manifest.json` after the planner scripts (outlines group). The store, difficulty and Goals dialog modules also go in the sidebar-only group, so the Goals dialog opens read-only off the outlines page.

| File | Global | Role |
|---|---|---|
| `src/goals/goal-store.js` | `ConnectifyGoalStore` | load/save, conflicts, finish, archive, verdict cache |
| `src/goals/goal-difficulty.js` | `ConnectifyGoalDifficulty` | chance, tiers, colours, per-task tier |
| `src/goals/goal-plan.js` | `ConnectifyGoalPlan` | offsets → `gradePlan` / `targetPlan`, ATAR re-solve, replay (§7.2), progress points, `weekSnapshot()` (task weeks frozen at load, §2.1) |
| `src/goals/goal-sliders.js` | `ConnectifyGoalSliders` | slider markup, notch names, reset on checkbox |
| `src/goals/goal-modal.js` | `ConnectifyGoalModal` | shared modal shell: focus trap, Escape / outside click, dim, drawer-safe clicks |
| `src/goals/goal-dialog.js` | `ConnectifyGoalDialog` | Set as Goal dialog: preview, End picker, Confirm / Save Changes, conflict prompt |
| `src/goals/goal-list-ui.js` | `ConnectifyGoalListUI` | Goals dialog: cards, Past goals, Edit / Delete |
| `src/goals/goal-editor.js` | `ConnectifyGoalEditor` | Set as Goal / Update Goal / Goals buttons, edit mode and Cancel Editing in both tabs |
| `src/goals/goal-bars.js` | `ConnectifyGoalBars` | row bars, tooltip, memo signature |
| `src/goals/goal-events.js` | `ConnectifyGoalEvents` | lock-in / finish detection, toast line |
| `src/goals/goal-celebrate.js` | `ConnectifyGoalCelebrate` | confetti, shake, reduced motion |
| `src/progress/progress-goal-line.js` | `ConnectifyProgressGoalLine` | Year Progression goal line |
| `src/atar/grade-estimate-goal.js` | `ConnectifyGradeEstimateGoal` | Estimator goal lines |
| `src/goals/goal-bars.css`, `goal-dialog.css`, `goal-list.css`, `goal-celebrate.css` | | token-routed in dark themes, light-tone rules |

Changes to existing files stay small: `target-solver.js` gains the `offsets` option; the planners call the editor and sliders; `cohort-view.js` calls `goal-bars`; `new-grade.js` asks `goal-events` for the toast line; `year-rollover.js` archives goals; `cache-versions.js` clears verdicts on Clear Cache.

## 12. Tests (`test_suite.js`)
- **Tiers**: chance from Low / Mid / High with lopsided ranges; the 90 / 70 / 40 / 15 bands; Guaranteed (met at 0%) and Impossible (> 100%) edges.
- **Sliders**:
  - All Normal with the checkbox off equals today's uniform required average.
  - All Normal with the checkbox on equals today's difficulty-weighted plan.
  - +1 notch raises that task by about 5 and lowers the others while still reaching the target.
  - Toggling the checkbox resets the sliders.
- **ATAR**: subject offsets plus child task offsets; the top four stay fixed; children re-solve after a new mark; the TEA bonus is held.
- **Lifecycle**:
  - Early lock-in on Guaranteed / Impossible; finishing on the last mark and on the final letter; Past goals frees the subject.
  - Save is blocked for Guaranteed / Impossible / conflicts; the ATAR-over-grade prompt replaces the grade goal.
- **Replay**:
  - R uses only earlier results.
  - `priorMarked` tasks show the previous goal's frozen verdict or nothing.
  - An edit re-judges the goal's own tasks only.
  - Clear Cache drops verdicts and keeps goals.
- **Performance bar**: the ±5 bands; purple only above 1.10 × R and on Green; the tooltip never mentions purple.
- **Progress bar**: fill = earned / required, capped; task rows use the tier as of that task; no segments; tier colours.
- **Custom week**:
  - Tasks are in range by their Year Progression week: an override beats the caption.
  - Early Easter on and off.
  - Undated tasks are excluded and named.
  - Changing a week override or Early Easter after load leaves goal ranges, tiers and bars unchanged until reload; after a reload they follow the new weeks.
- **Dialogs**:
  - Set as Goal opens from the planner with its subject, target and sliders.
  - End changes recompute the preview.
  - Confirm is disabled for Guaranteed / Impossible / conflicts.
  - Escape, Cancel and outside click save nothing; the drawer stays open.
  - The Goals dialog lists cards and Past goals.
  - Edit loads the planner in edit mode, Update Goal saves the same id with revision + 1, and Cancel Editing restores the planner.
- **UI**:
  - Bars are 18 × 56 beside the outcome meter and rows keep their height.
  - No `title` attributes.
  - Labels ≥ 5:1 in every theme (theme audit covers the Goals list and bars).
  - Sliders are keyboard-operable with `aria-valuetext`.
- **Toast lines**: unchanged / changed / complete / missed wording.
- **Celebration**: plays once per goal; reduced motion means no shake and static confetti.
- **Storage**: account-scoped keys, version handling, archived on new year.

## 13. Docs to update when implemented
- `docs/modules_ui_analytics.md`: Goals section.
- `docs/apis_and_storage.md`: globals and the two keys.
- `docs/architecture.md`: script order.
- `docs/features_analytics_publishing.md`: Feature 11.
- `design_rules.md`: Section 4: goal bars (geometry, pastel performance tiers, secret purple, tier-coloured progress).

## 14. Defaults chosen without asking (revisit if wrong)
- The planner and dialogs show tier names only, with no chance percentage (UI copy rule).
- Effort sliders live in the planner tabs; the Set as Goal dialog shows their notches read-only.
- Edit ✎ reopens the goal in its planner tab (edit mode). The sliders need the planner, so the dialog alone cannot edit them.
- ATAR children's progress bars use the child's own tier; the ATAR goal's tier is on its card.
- Replacing a grade goal via the ATAR prompt deletes it rather than archiving it.
- Custom-week goals exclude tasks with no readable week.
