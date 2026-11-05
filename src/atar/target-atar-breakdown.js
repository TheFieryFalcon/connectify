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
          `Goal unattainable. Highest possible ATAR: ${plan.maximum?.atar ?? '—'}, with 100% on every remaining assessment.`
        )
      );
    } else {
      const bannerText =
        plan.required === 0
          ? 'Target secured under current assumptions.'
          : difficultyWeighted
          ? `Requires marks averaging ${round(plan.required)}% on remaining assessments for an estimated ATAR of ${
              plan.result?.atar ?? '—'
            }.`
          : `Requires ${round(plan.required)}% on remaining assessments for an estimated ATAR of ${
              plan.result?.atar ?? '—'
            }.`;

      targetOutputContainer.append(createEl('strong', '', bannerText));
    }

    const bonusNote = plan.bonus > 0 ? `, with your current TEA bonus of ${round(plan.bonus)}` : '';
    targetOutputContainer.append(
      createEl(
        'p',
        'cta-note',
        difficultyWeighted
          ? `Highest possible ATAR: ${plan.maximum?.atar ?? '—'}${bonusNote}. Each task's mark follows how you do in that subject and task type.`
          : `Highest possible ATAR: ${plan.maximum?.atar ?? '—'}${bonusNote}. The same mark on every remaining task.`
      )
    );

    const taskDetails = createEl('section', 'cta-assessment-details');
    taskDetails.append(
      createEl('strong', 'cta-breakdown-title', `Subjects (${rows.length})`)
    );
    targetOutputContainer.append(taskDetails);

    rows.forEach((course, idx) => {
      const block = createEl('div', 'cta-course');
      const projectedScore = plan.rows?.[idx]?.score ?? course.score ?? 0;

      if (!course.include) {
        block.style.opacity = '0.65';
        block.append(
          createEl('strong', '', `${course.name} (Not counted)`),
          createEl(
            'small',
            '',
            `Current scaled mark: ${
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
          `${round(course.progress?.earned ?? 0)} of ${round(course.progress?.total ?? 0)} marks earned, ${round(course.progress?.remaining ?? 0)}% still to come, scaled mark ${wholeScore(projectedScore)} at this target`
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
          reqText = `needs ${round(reqVal)}%${baseVal !== null ? ` (usually ${round(baseVal)}%)` : ''}`;
        } else {
          reqText = `needs ${round(plan.required)}%`;
        }

        block.append(
          createEl(
            'small',
            '',
            `${task.name}: weight ${round(task.weight)}%, ${reqText}`
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
