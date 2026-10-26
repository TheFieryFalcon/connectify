# Connectify Goals Reference

Saved Target Grade / Target ATAR goals: difficulty tiers, effort sliders, outline goal bars, lifecycle and celebration. Spec: `specs/goals.md`.

---

## 1. Model

### Goals and ranges (`src/goals/goal-plan.js`, `ConnectifyGoalPlan`)
- **Kinds**: a grade goal (subject percent; end `Semester 1`, `Semester 2` or a custom school week 1–40) or an ATAR goal (ATAR 30–99.95; end `Semester 1` / `Semester 2`; four linked child grade goals, the top four ticked when saved).
- **Range**: a semester end is the semester's outline tasks (`taskSemester`, Semester 2 cumulative). A custom week is every task whose Year Progression week (`customWeekOrder` override, else caption) is <= the week's end; undated tasks are out of range for custom weeks.
- **Week snapshot**: `weekSnapshot()` reads each task's week once per page load. A week override save (`connectify-week-override-saved`) or `connectify-terms-updated` sets `isHeld()`: goals stop recomputing (tiers, bars, verdicts, lock-in, toast lines) until reload.
- **Sliders**: 5 notches (-2..+2, Much less / Less / Normal / More / Much more), +-5 points per notch on a task's baseline (`offsets`), then `gradePlan` / `targetPlan` bisect the shared effort. Checkbox off: one flat baseline for every task, so all-Normal equals the uniform required average. Toggling the checkbox resets the sliders. ATAR: subject notch + that subject's task notches add up.
- **ATAR re-solve**: target, top four and sliders fixed; child targets re-solved after every new mark.
- **Replay**: `replay(goal)` walks the judged tasks in week order, planning each with only the results before it: `R` (required), the tier and cumulative points just after it. Memoised per goal revision and marks signature.

### Difficulty (`src/goals/goal-difficulty.js`, `ConnectifyGoalDifficulty`)
- **Chance**: target vs the projection (grade: `projectSubjectGrades` limited to the range; ATAR: `projectATAR`): normal on Mid, sigma = half-range on the target's side / 0.8416, `chance = 1 - Phi((target - Mid)/sigma)`. Sliders never change it.
- **Tiers**: Guaranteed (met at 0% on everything left), Trivial >= 90%, Easy >= 70%, Medium >= 40%, Hard >= 15%, Hell < 15%, Impossible (needs > 100%).
- **Per-task tier** (planner, dialog): the task's own `predictTask` range against its R, same sigma rule.
- **Colours**: Guaranteed `#15803d`, Trivial `#22c55e`, Easy `#84cc16`, Medium `#eab308`, Hard `#f97316`, Hell `#ef4444`, Impossible `#991b1b` (Achieved / Missed use the first / last). Semantic, literal.

### Store (`src/goals/goal-store.js`, `ConnectifyGoalStore`)
- `connectify:goals:<account>`: `{ version: 1, goals: [...] }` (id, revision, kind, subject, parent, target, end, difficultyWeighted, sliders, subjectSliders, topFour, priorMarked, status, createdAt, finishedAt, finalValue, lastTier, celebrated, celebratePending). Unknown versions read as none; unknown fields are kept.
- `connectify:goal_verdicts:<account>`: frozen verdicts of finished goals per task (`required, mark, perfTier, progress, goalTier`). Clear Cache and a `goals` cache-version bump clear it; goals stay. A settings reset removes both.
- **Conflicts**: one active goal per subject key (both semester outlines are one subject), one active ATAR goal; an ATAR goal over a grade goal offers Replace (deletes it).
- **Lifecycle**: Guaranteed -> Achieved and Impossible -> Missed at once (early lock-in); otherwise finished once every task in range is marked or the semester's final letter shows. Finished goals free their subject and keep their verdicts. A new school year finishes active goals and archives every goal and verdict into `connectify:year_archive:<account>` (`goals`).

## 2. Interface

### Planner and dialogs
- `goal-sliders.js` (`ConnectifyGoalSliders`): the Target Grade task rows (required mark, tier, slider) and Target ATAR subject sliders; ATAR-held subjects show `Set by your ATAR <n> goal` with editable task sliders.
- `goal-modal.js` (`ConnectifyGoalModal`): shared modal shell (solid surface, page dimmed, focus moved in and returned, Escape / Cancel / outside click close, clicks never reach the drawer's outside-click).
- `goal-dialog.js` (`ConnectifyGoalDialog`, `#cx-goal-dialog`): **Set as Goal** preview (heading with tier, read-only task/subject rows, horizontal progress), End picker (week input with term hint), Confirm / Save Changes, disabled reasons (`Already secured.`, `Highest possible: X%.`, `<subject> already has a goal.`, `Set by your ATAR <n> goal.`, `You already have an ATAR goal.`), Replace prompt.
- `goal-list-ui.js` (`ConnectifyGoalListUI`, `#cx-goals-dialog`): goal cards (target and end, tier label, horizontal progress, Edit / Delete with inline confirm), ATAR children, Past goals `<details>`; read-only off the outlines page.
- `goal-editor.js` (`ConnectifyGoalEditor`): Set as Goal / Update Goal under each planner, the `Goals (n)` header button (`#cx-goals-open`), edit mode (`Editing <subject> goal`, Cancel Editing restores the planner).

### Outline bars (`src/goals/goal-bars.js`, `ConnectifyGoalBars`)
- `.cx-goal-bars` right of the outcome meter (compact and expanded panels), each bar 18 x 56.
- **Performance** (`.cx-goal-perf`, completed tasks judged by a goal): pastel Red < R-5, Orange < R, Yellow < R+5, Green >= R+5; secret purple breakout (20px) above 1.10 x R on Green.
- **Progress** (`.cx-goal-progress`, completed tasks and the overall row): smooth fill = earned / required weighted points, tier colour as of that task (overall row: now).
- Singleton `#cx-goal-tooltip` (numbers only, no `title`, purple never named); `goalSig` joins the row memo.
- **Which goal judges a task**: tasks not in a goal's `priorMarked` are replayed live; earlier tasks show the most recent finished goal's frozen verdict, else nothing.

### Events and celebration
- `goal-events.js` (`ConnectifyGoalEvents`): evaluates active goals after each results update (unless held), locks in / finishes them, keeps `lastTier`; `toastLine(subject)` for the Class Updated toast: `Goal: Medium` / `Goal is now Hard (was Medium)` / `Goal complete!` / `Goal missed!` (`ATAR goal: ...` for children).
- `goal-celebrate.js` (`ConnectifyGoalCelebrate`): once per goal, ~4s confetti on `#cx-goal-confetti` (no library) and a ~600ms shake of Connect's app layout (never html/body); `prefers-reduced-motion`: no shake, static fading confetti. A goal that finishes without a toast (first visit on a fresh cache) celebrates the next time the Goals dialog opens; its card glows (`.cx-goal-card--celebrate`).

### Other tools
- `progress-goal-line.js` (`ConnectifyProgressGoalLine`): dashed `Goal 85%` line on the subject's Year Progression chart (ATAR goal on ATAR Progression) up to the end week.
- `grade-estimate-goal.js` (`ConnectifyGradeEstimateGoal`): `Goal 85%: met` / `Goal 85%: 3.2 short` under Estimate Grade; `Goal 95.00: met` / `1.35 short` under Estimate ATAR.

## 3. Styles
`goal-bars.css`, `goal-dialog.css`, `goal-list.css`, `goal-celebrate.css`: token-routed in dark themes, tier labels re-inked at OKLCH 0.34 in light tone, >= 5:1.

---

*Back to [Overview](file:///Users/uwong/Downloads/2.1.14_0/overview.md)*
