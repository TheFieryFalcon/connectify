# Connectify Goals Reference

Saved Target Grade / Target ATAR goals: difficulty tiers, effort sliders, outline goal bars, lifecycle and celebration. Spec: `specs/goals.md`. All goal scripts are in the outlines group (manifest order: goal-difficulty, goal-store, goal-plan, goal-replay, goal-modal, goal-sliders, goal-dialog, goal-list-ui, goal-editor, goal-celebrate, goal-events, goal-bars).

---

## 1. Model

### Plans (`goal-plan.js`, `ConnectifyGoalPlan`)
- **Kinds**: a grade goal (subject percent; end `Semester 1`, `Semester 2` or a custom school week 1–40) or an ATAR goal (ATAR 30–99.95; end Semester 1 / 2; four linked child grade goals: the plan's top four when saved, fixed until edited; `included` keeps the ticked subjects the solver uses).
- **Subject key**: the planners' course id (`ConnectifyGoalStore.subjectKey`: semester, `ATAR` and `Year N` removed, lower case), so both semester outlines are one subject.
- **Range** (`rangeTasks`): a semester end is that semester's outline tasks (Semester 2 cumulative); a custom week is every task whose Year Progression week (week override, else caption, as `atar-scraper.js` resolves `order`) is <= the end week; undated tasks are left out and named.
- **Week snapshot** (`weekOf`): each task's school week and semester as first read this page load. `connectify-week-override-saved` (the Progress week editor) or `connectify-terms-updated` (Early Easter) sets `isHeld()`: goals stop recomputing until reload.
- **Sliders**: 5 notches (-2..+2, `NOTCHES`), +-5 points each on a task's baseline (`offsets`), then the solver bisects one shared effort. `gradePlan` / `targetPlan` take `offsets` (`{ taskKey }`; ATAR `{ course, course::taskKey }`); no offsets reproduces the old plans. Checkbox off: every task starts at the uniform score. `taskRequirements` are keyed by task id (name without one).
- **ATAR rows** (`atarRows`, shared with the Target ATAR planner): scaled school marks, progress, calibration offsets and the held TEA bonus. `atarOffsets` adds subject notches and each child's task notches.

### Evaluation (`goal-replay.js`, `ConnectifyGoalReplay`)
- `evaluate(goal, ctx)` -> `{ tier, chance, range, plan, progress, verdicts, children (ATAR), finished, finalValue, undated }`; `ctx.noReplay` skips the per-task replay (planner tiers).
- **Replay**: judged tasks (marked, weighted, not in `priorMarked`) in date order; each is planned with only the results before it (`required` R), then added (tier and points as of it). Verdict keys `<subject>::<task id>`.
- **ATAR**: child targets re-solved from the plan's projected rows (`childTargets`, raw percent); the ATAR range comes from each included course's projected Low / Mid / High through `ConnectifyMath.calculate`.

### Difficulty (`goal-difficulty.js`, `ConnectifyGoalDifficulty`)
- **Chance**: target vs a Low / Mid / High projection (`projectTasks`: marked tasks as they are, the rest from `getOrComputeTaskPrediction`, the Predictor's minimum spread): normal on Mid on the logit scale (marks bounded by 0 and 100), sigma = the wider logit half-range / 0.8416 (High's logarithmic headroom squeezes the upside near 100, which made a point over Mid Hell). Sliders never change it.
- **Tiers**: Guaranteed (met at 0% on everything left), Trivial >= 90%, Easy >= 70%, Medium >= 40%, Hard >= 15%, Hell < 15%, Impossible (needs > 100%). `taskTier`: a remaining task's own prediction vs its R.
- **Performance bands** (`perfTier`): red < R-5, orange < R, yellow < R+5, green; purple (secret) above 1.10 x R on green.
- **Colours**: Guaranteed `#15803d`, Trivial `#22c55e`, Easy `#84cc16`, Medium `#eab308`, Hard `#f97316`, Hell `#ef4444`, Impossible `#991b1b`; Achieved / Missed take the first / last.

### Store (`goal-store.js`, `ConnectifyGoalStore`)
- `connectify:goals:<account>`: `{ version: 1, goals }` (id, revision, kind, subject, name, parent, target, end, difficultyWeighted, sliders, subjectSliders, included, topFour, priorMarked, status, createdAt, finishedAt, finalValue, finalProgress, lastTier, seenMarked, announcePending, celebratePending, celebrated, glowPending). Unknown versions read as none; unknown fields are kept.
- `connectify:goal_verdicts:<account>`: frozen verdicts of finished goals. Clear Cache and the `goals` cache version (`clearGoalsCache`) clear only these; a settings reset removes goals too.
- **Conflicts** (`conflicts`): one active goal per subject, one active ATAR goal; the goal being edited never counts. `save` keeps the id and counts a revision; an ATAR save rewrites its children (`childSliders`).
- `finish`, `remove`, `takeAll` (new-year archive). Events: `connectify-goals-changed` on every write.

## 2. Interface

### Planners and dialogs
- `goal-sliders.js` (`ConnectifyGoalSliders`): Target Grade's task table (Effort / Needs / Difficulty), Target ATAR's subject slider, needed mark and tier; drafts per subject; `reset` on the checkbox; keyboard focus kept across re-renders. A drag moves only the notch name (`input`); the planner re-renders on `change` (release, each key press), since replacing the slider mid-drag dropped the drag and selected text.
- `goal-editor.js` (`ConnectifyGoalEditor`): the goal tier beside each planner headline, Set as Goal / Update Goal and Cancel Editing, `Goals (n)` in the panel heading (`paintGoalsButton`, from `paintModeTabs`), `edit(goal)` (loads its planner tab; semester by its button), `heldTarget` (an ATAR-held subject plans for its child target, read-only, `Set by your ATAR <n> goal`).
- `goal-modal.js` (`ConnectifyGoalModal`): the shared dialog (solid surface, dimmed page, focus in and back, Escape / ✕ / outside click, clicks never reach the drawer's outside-click), `tierLabel`, `progressBar`.
- `goal-dialog.js` (`#cx-goal-dialog`): preview, End (week input with term hint), Confirm / Save Changes; blocked with `Already secured.`, `Highest possible: X%.`, `<subject> already has a goal.` (+ Edit), `Set by your ATAR <n> goal.`, `You already have an ATAR goal.`; an ATAR goal over subject goals asks to Replace them. New goals record `priorMarked`.
- `goal-list-ui.js` (`#cx-goals-dialog`): cards (title, tier, progress, ATAR children's targets, Edit ✎ / Delete ✕ with inline confirm) and Past goals (Achieved / Missed, final mark, date).

### Outline bars (`goal-bars.js`, `ConnectifyGoalBars`)
- `.cx-goal-bars` after the outcome meter (task rows) or in the panel's top right (overall row of the goal's semester card). Performance (`.cx-goal-perf`, segments lit up to the band, purple 20px) and progress (`.cx-goal-progress`, smooth fill, `data-tier`). The outcome meter's singleton tooltip shows numbers only; `signature` (what the bars show, no evaluation counter) joins the row memo (`goalSig`), so a re-evaluation redraws only rows whose bars changed. Goals, verdicts and each card's `cardTaskIds` are read once per pass (dropped after the task or on `connectify-goals-changed`).
- Live verdicts for the goal's own tasks; earlier tasks show the latest finished goal's frozen verdict.

### Events and celebration
- `goal-events.js` (`ConnectifyGoalEvents`): `stateOf` (cached per revision; kept while held), `refresh` after results / predictions / goals / types change (400ms; results and goals events whose inputs (goal ids, revisions, statuses; each course's tasks, mark and letter) are unchanged skip the replay and cohort pass; settles finished goals: Guaranteed -> Achieved, Impossible -> Missed, all marked or final letter -> by the measured mark), then `connectify-goals-evaluated` and a cohort pass. A newly read marked task in range (not in the goal's `seenMarked`, else `priorMarked`) or a goal ending brings a `Goal Updated` toast of its own (`announce`, id `connectify-goal-<id>`, Jump to Subject; never folded into Class Updated, whose collapsed-card marks come before the task is read): `lineFor` gives `Goal: Medium`, `Goal is now Hard (was Medium)` (`lastTier`), `Goal complete!` + celebration or `Goal missed!` (`ATAR goal ...`). `celebratePending` (Goals dialog), `endYear` (`year-rollover.js` archive).
- `goal-celebrate.js` (`ConnectifyGoalCelebrate.play`): ~4s confetti on `#cx-goal-confetti` from the toast corner, ~600ms shake of `.cvr-c-app-layout` / `#main-content`; reduced motion: still fading confetti, no shake. Once per goal; the finished goal glows in the Goals dialog.

### Other tools
- `progress-goal-line.js` (`ConnectifyProgressGoalLine`): the subject's Year Progression chart plots each task's target mark as a dashed line with markers (`.cx-goal-target-point`; legend `Dashed: Target mark (Goal 85%)`): a judged task's verdict R, a remaining in-range task's `requiredOf` in the current plan (an ATAR goal's child: `<course>::<task>`); none for tasks marked before the goal or outside its range. Remaining targets run on from the last plotted score (the plan starts where the results end); judged requirements are their own line. Average modes average the targets like the scores (a task without one counts its own mark, `ownScore`). ATAR Progression keeps one dashed line at the ATAR goal.
- `grade-estimate-goal.js` (`ConnectifyGradeEstimateGoal`): `Goal 85%: met` / `3.2 short` under Estimate Grade (range tasks only for custom weeks); `Goal 95.00: 1.35 short` under Estimate ATAR (that semester's goal).

## 3. Styles
`goal-dialog.css` (dialogs, tier labels: tier 40% into the theme ink on a 14% tint, >= 5:1 in every preset), `goal-planner.css` (planner controls, sliders), `goal-list.css`, `goal-bars.css` (bars, goal targets and line), `goal-celebrate.css`: theme tokens only.

---

*Back to [Overview](file:///Users/uwong/Downloads/2.1.14_0/overview.md)*
