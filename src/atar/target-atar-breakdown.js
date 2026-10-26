/**
 * Connectify Target ATAR: plan breakdown
 *
 * Renders a solved Target ATAR plan: the required-score banner (or the maximum when the goal is out of
 * reach), the assumptions note, and each subject's remaining tasks with the score each one needs.
 * Exposes window.ConnectifyTargetAtarBreakdown.
 */
(() => {
  'use strict';

  const { createEl, round } = window.ConnectifyTargetUiHelpers;

  /** `onChange`: re-render after a subject's effort slider moves. */
  function renderPlan(targetOutputContainer, plan, rows, difficultyWeighted, onChange) {
    const targets = window.ConnectifyGoalReplay?.childTargets(plan, rows) || {};
    const wholeScore = window.ConnectifyMath?.wholeScore || (v => (Number.isFinite(Number(v)) ? Math.round(Number(v)) : undefined));
    if (plan.impossible) {
      targetOutputContainer.append(
        createEl(
          'strong',
          '',
          `Goal unattainable with remaining tasks. Maximum achievable ATAR: ${plan.maximum?.atar ?? '—'} (assuming 100% on all remaining assessments).`
        )
      );
    } else {
      const bannerText =
        plan.required === 0
          ? 'Target secured under current assumptions.'
          : difficultyWeighted
          ? `Requires performance-adjusted scores (averaging ${round(plan.required)}%) on remaining assessments for an estimated ATAR of ${
              plan.result?.atar ?? '—'
            }.`
          : `Requires ${round(plan.required)}% on remaining assessments for an estimated ATAR of ${
              plan.result?.atar ?? '—'
            }.`;

      targetOutputContainer.append(createEl('strong', '', bannerText));
    }

    const bonusNote = plan.bonus > 0 ? ` (assumes current TEA bonus of ${round(plan.bonus)} points)` : '';
    targetOutputContainer.append(
      createEl(
        'p',
        'cta-note',
        difficultyWeighted
          ? `Maximum achievable ATAR: ${plan.maximum?.atar ?? '—'}${bonusNote}. Marks are scaled proportionally based on demonstrated subject and assessment type performance.`
          : `Maximum achievable ATAR: ${plan.maximum?.atar ?? '—'}${bonusNote}. Assumes uniform performance across remaining tasks.`
      )
    );

    const taskDetails = createEl('section', 'cta-assessment-details');
    taskDetails.append(
      createEl('strong', 'cta-breakdown-title', `Subject and assessment breakdown (${rows.length} subjects)`)
    );
    targetOutputContainer.append(taskDetails);

    rows.forEach((course, idx) => {
      const block = createEl('div', 'cta-course');
      const projectedScore = plan.rows?.[idx]?.score ?? course.score ?? 0;

      if (!course.include) {
        block.style.opacity = '0.65';
        block.append(
          createEl('strong', '', `${course.name} (Excluded from top four target)`),
          createEl(
            'small',
            '',
            `Current score: ${
              course.score !== undefined
                ? wholeScore(course.score)
                : course.mark !== undefined
                ? wholeScore(course.mark)
                : '—'
            }`
          )
        );
        taskDetails.append(block);
        return;
      }

      block.append(
        createEl('strong', '', course.name),
        createEl(
          'small',
          '',
          `Outline weight ${round(course.progress?.total ?? 0)}% · ${round(
            course.progress?.earned ?? 0
          )} normalized points earned · ${round(course.progress?.remaining ?? 0)}% of semester remaining · projected rounded score ${wholeScore(
            projectedScore
          )}`
        )
      );

      if (onChange) window.ConnectifyGoalSliders?.renderSubject(block, { course, target: targets[course.id], onChange });

      for (const task of course.progress?.tasks || []) {
        let reqText = '';
        if (plan.impossible) {
          reqText = 'max 100%';
        } else if (plan.effort) {
          const meta = plan.taskRequirements?.[`${course.name}::${task.id || task.name}`];
          const reqVal = meta ? meta.required : plan.required;
          const baseVal = meta ? meta.baseline : null;
          reqText = `required ${round(reqVal)}%${baseVal !== null ? ` (baseline: ${round(baseVal)}%)` : ''}`;
        } else {
          reqText = `required ${round(plan.required)}%`;
        }

        block.append(
          createEl(
            'small',
            '',
            `${task.name}: weight ${round(task.weight)}% · ${reqText}`
          )
        );
      }

      if (!course.progress?.remaining) {
        block.append(createEl('small', '', 'All weighted tasks completed.'));
      }
      taskDetails.append(block);
    });
  }

  window.ConnectifyTargetAtarBreakdown = { renderPlan };
})();
