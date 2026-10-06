/**
 * Connectify Target Planner UI Facade
 *
 * Facade coordinating Target ATAR Planner (ConnectifyTargetAtarUI)
 * and Target Grade Planner (ConnectifyTargetGradeUI).
 */
(() => {
  'use strict';

  window.ConnectifyTargetPlannerUI = {
    createPlannerView: (...args) => window.ConnectifyTargetAtarUI?.createPlannerView(...args),
    renderTargetOutput: (...args) => window.ConnectifyTargetAtarUI?.renderTargetOutput(...args),
    createGradeView: (...args) => window.ConnectifyTargetGradeUI?.createGradeView(...args),
    renderGradeOutput: (...args) => window.ConnectifyTargetGradeUI?.renderGradeOutput(...args)
  };
})();
