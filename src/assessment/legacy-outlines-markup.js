/**
 * Connectify Assessment: the old outline markup
 *
 * HTML for one Assessment Outlines tile as Connect's Vaadin page drew it before October 2026 (.eds-c-tile,
 * summary .cvr-c-task row, Show Details accordion, .cvr-c-tasks rows with Raw Score / Weighted Mark), built
 * from a ConnectifyOutlineApi record. Class lists are Vaadin's own, so Connect's stylesheets and every
 * Connectify theme style it as before; task texts are the ones assessment-api-parse.js reads, so a row's id
 * matches its cached task. Boxplots are drawn like Highcharts drew them (0–100 axis, 10px inset, grey
 * #A9A9A9 strokes, white box, black dot for the student's result), with the same fills the theme rules
 * recolour, and carry their quantiles in data-connectify-stats. Exposes window.ConnectifyLegacyMarkup.
 */
(() => {
  'use strict';

  if (window.ConnectifyLegacyMarkup) return;

  const esc = value => window.ConnectifyUtils.escapeHtml(String(value ?? ''));

  const label = (text, classes = '') =>
    `<div class="v-label v-widget eds-u-white-space--normal v-label-eds-u-white-space--normal ${classes} v-label-undef-w">${esc(text)}</div>`;
  const panel = inner => `<div class="v-csslayout v-layout v-widget cvr-c-ibhori-pnl v-csslayout-cvr-c-ibhori-pnl">${inner}</div>`;
  const FIRST_LAST = 'eds-s-is-first v-label-eds-s-is-first eds-s-is-last v-label-eds-s-is-last';

  const pct = v => `${Math.max(0, Math.min(100, Number(v)))}%`;
  const line = (x1, x2, y1, y2) =>
    `<line x1="${x1}" x2="${x2}" y1="${y1}" y2="${y2}" stroke="#A9A9A9" stroke-width="1" shape-rendering="crispEdges"></line>`;

  /** The boxplot chart cell (null without quantiles): whiskers, box, median and the student's result. */
  function chart(stats, percent) {
    if (!Array.isArray(stats) || stats.length !== 5) return '';
    const [min, q1, median, q3, max] = stats.map(pct);
    const dot = Number.isFinite(percent) ? `<circle cx="${pct(percent)}" cy="22.5" r="4" fill="#000000"></circle>` : '';
    const data = esc(JSON.stringify(stats));
    return `<div class="cvr-c-task__chart v-layout v-widget" data-connectify-stats="${data}">` +
      `<div class="v-widget v-has-width v-has-height cx-legacy-chart" data-connectify-stats="${data}">` +
      '<svg class="cx-legacy-boxplot" width="100%" height="50" aria-hidden="true" focusable="false"><g class="highcharts-series">' +
      line(min, q1, 22.5, 22.5) + line(q3, max, 22.5, 22.5) + line(min, min, 16.5, 28.5) + line(max, max, 16.5, 28.5) +
      `<rect x="${q1}" y="16.5" width="${Math.max(0, parseFloat(q3) - parseFloat(q1))}%" height="12" fill="#FFFFFF" stroke="#A9A9A9" stroke-width="1" shape-rendering="crispEdges"></rect>` +
      line(median, median, 16.5, 28.5) + `</g>${dot}</svg></div></div>`;
  }

  /** A task row's chart cell: marked tasks Connect charts only. */
  const taskChart = task => (task.mark && task.showChart ? chart(task.stats, task.percent) : '');
  /** The overall row's chart cell: the class boxplot, the dot at the overall mark when the chart gives none. */
  const summaryChart = record => (record.showChart
    ? chart(record.stats, Number.isFinite(record.percent) ? record.percent : window.ConnectifyApiParse?.overallMark?.(record)) : '');

  const markCell = inner => `<div class="cvr-c-task__mark v-layout v-widget"><div class="cvr-c-task__grade v-layout v-widget">${inner}</div></div>`;

  // A Raw Score / Weighted Mark cell: the value over "Out of N"
  function fractionCell(value, max) {
    const valueLabel = label(value || '-', `eds-c-heading v-label-eds-c-heading eds-c-heading--lg v-label-eds-c-heading--lg eds-u-flush v-label-eds-u-flush cvr-u-margin-bottom--xs v-label-cvr-u-margin-bottom--xs eds-s-is-first v-label-eds-s-is-first${max ? '' : ' eds-s-is-last v-label-eds-s-is-last'}`);
    const outOf = max ? label(`Out of ${max}`, 'eds-s-is-last v-label-eds-s-is-last') : '';
    return markCell(`<div class="v-csslayout v-layout v-widget eds-u-text-align--centre v-csslayout-eds-u-text-align--centre eds-c-caption v-csslayout-eds-c-caption eds-u-flush v-csslayout-eds-u-flush">${valueLabel}${outOf}</div>`);
  }

  const markHeader = text => `<div class="v-csslayout v-layout v-widget cvr-c-task-mark__header v-csslayout-cvr-c-task-mark__header eds-u-flush v-csslayout-eds-u-flush">${label(text, 'eds-c-caption v-label-eds-c-caption')}</div>`;

  /** One task row; unmarked tasks show "-" and no chart, as Connect's did. */
  function taskRow(task) {
    const [type, when, name] = [task.type, task.when, task.name];
    const details = panel(label(type, `eds-c-paragraph v-label-eds-c-paragraph eds-c-paragraph--bold v-label-eds-c-paragraph--bold ${FIRST_LAST}`)) +
      (when ? panel(label(when, `eds-c-caption v-label-eds-c-caption ${FIRST_LAST}`)) : '') +
      panel(label(name, FIRST_LAST));
    const weight = task.weightedMax || task.weighted ? fractionCell(task.weighted, task.weightedMax) : '';
    return '<div class="cvr-c-task v-layout v-widget">' +
      `<div class="cvr-c-task__details v-layout v-widget">${details}</div>` +
      `<div class="cvr-c-task-mark__headers v-layout v-widget">${markHeader('Raw Score')}${markHeader('Weighted Mark')}</div>` +
      '<div class="cvr-c-task__achievement v-layout v-widget">' +
      `<div class="cvr-c-task__marks v-layout v-widget">${fractionCell(task.mark, task.max)}${weight}</div>` +
      taskChart(task) +
      '</div></div>';
  }

  // "Chemistry ATAR Year 11 (AECHE)" for a course code, else the outline's own name
  const groupHeading = (record, code) => (/^[A-Z0-9]{3,8}$/.test(code) ? `${record.subject} (${code})` : code || record.subject);

  function taskGroup(record, outline) {
    const groupHeader = text => `<div class="cvr-c-task-group__header v-layout v-widget">${label(text, 'eds-c-caption v-label-eds-c-caption')}</div>`;
    return '<div class="cvr-c-task-group v-layout v-widget"><div class="cvr-c-task-group__heading v-layout v-widget">' +
      `<div class="v-csslayout v-layout v-widget">${label(groupHeading(record, outline.code), 'eds-c-heading v-label-eds-c-heading eds-c-heading--md v-label-eds-c-heading--md eds-u-flush v-label-eds-u-flush')}</div></div>` +
      `<div class="cvr-c-task-group__headers v-layout v-widget">${groupHeader('Raw Score')}${groupHeader('Weighted Mark')}</div></div>` +
      // The rows follow their group's heading bar (Connect lays the bar out as one flex row)
      (outline.tasks || []).map(taskRow).join('');
  }

  /** The accordion's panel: every outline's task group, added only while the tile is expanded. */
  function detailsPanel(record) {
    const groups = (record.outlines || []).filter(o => o.tasks?.length).map(o => taskGroup(record, o)).join('');
    const layout = 'v-csslayout v-layout v-widget eds-s-is-first v-csslayout-eds-s-is-first eds-s-is-last v-csslayout-eds-s-is-last';
    return '<div class="eds-c-accordion__panel v-layout v-widget eds-s-is-last eds-c-accordion__panel-eds-s-is-last">' +
      `<div class="${layout}"><div class="${layout}"><div class="cvr-c-tasks v-layout v-widget eds-s-is-first cvr-c-tasks-eds-s-is-first eds-s-is-last cvr-c-tasks-eds-s-is-last">${groups}</div></div></div></div>`;
  }

  /** The Show / Hide Details accordion (no panel; legacy-outlines.js adds it on expand). */
  function accordion(expanded) {
    const active = expanded ? ' eds-s-is-active v-csslayout-eds-s-is-active' : '';
    const buttonActive = expanded ? ' eds-s-is-active v-button-eds-s-is-active' : '';
    return '<div class="eds-c-accordion v-layout v-widget eds-c-accordion--light eds-c-accordion-eds-c-accordion--light eds-s-is-last eds-c-accordion-eds-s-is-last">' +
      `<div class="v-csslayout v-layout v-widget eds-c-accordion__section v-csslayout-eds-c-accordion__section eds-s-is-first v-csslayout-eds-s-is-first eds-s-is-last v-csslayout-eds-s-is-last${active}">` +
      '<div class="eds-c-accordion__section-heading v-layout v-widget eds-s-is-first eds-c-accordion__section-heading-eds-s-is-first">' +
      label(expanded ? 'Hide Details' : 'Show Details', 'eds-c-accordion__section-label v-label-eds-c-accordion__section-label eds-u-interactive v-label-eds-u-interactive') +
      `<div tabindex="0" role="button" aria-expanded="${expanded}" class="v-button v-widget eds-o-button v-button-eds-o-button eds-o-toggle-button v-button-eds-o-toggle-button eds-c-icon-button v-button-eds-c-icon-button eds-o-button--size-sm v-button-eds-o-button--size-sm eds-o-button--captionless v-button-eds-o-button--captionless eds-c-accordion__trigger v-button-eds-c-accordion__trigger${buttonActive}">` +
      `<span class="v-button-wrap"><span class="v-icon cvr-c-icon--${expanded ? 'collapse' : 'expand'}"> </span><span class="v-button-caption"></span></span></div></div></div></div>`;
  }

  // The overall row: mark and grade cells (an empty grade cell before the letter) over the class boxplot
  function summaryRow(record) {
    if (!record.mark) return '<div class="v-csslayout v-layout v-widget"></div>';
    const cells = markCell(label(record.mark)) + markCell(label(record.grade));
    return '<div class="v-csslayout v-layout v-widget"><div class="cvr-c-task v-layout v-widget eds-s-is-first cvr-c-task-eds-s-is-first eds-s-is-last cvr-c-task-eds-s-is-last">' +
      '<div class="cvr-c-task__details v-layout v-widget"></div><div class="cvr-c-task-mark__headers v-layout v-widget"></div>' +
      `<div class="cvr-c-task__achievement v-layout v-widget"><div class="cvr-c-task__marks v-layout v-widget">${cells}</div>${summaryChart(record)}</div></div></div>`;
  }

  // "Leon Harris from Willetton Senior High School"; names are links in Connect (legacy-outlines.js forwards clicks)
  function staffLine(record) {
    const link = (text, edge) => label(text, `eds-c-caption v-label-eds-c-caption eds-u-flush v-label-eds-u-flush eds-u-interactive v-label-eds-u-interactive cvr-c-data-nav-link v-label-cvr-c-data-nav-link eds-c-link--reversed v-label-eds-c-link--reversed ${edge}`);
    const parts = [];
    record.staff.forEach((name, i) => parts.push(link(name, `cv-sao-staff v-label-cv-sao-staff cvr-u-margin-right--xs v-label-cvr-u-margin-right--xs${i ? '' : ' eds-s-is-first v-label-eds-s-is-first'}`)));
    if (record.school) {
      if (parts.length) parts.push(label('from', 'eds-c-caption v-label-eds-c-caption eds-u-flush v-label-eds-u-flush cvr-u-margin-right--xs v-label-cvr-u-margin-right--xs'));
      parts.push(link(record.school, 'eds-s-is-last v-label-eds-s-is-last'));
    }
    return parts.length ? `<div class="v-csslayout v-layout v-widget cvr-c-ibhori-pnl v-csslayout-cvr-c-ibhori-pnl eds-s-is-first v-csslayout-eds-s-is-first">${parts.join('')}</div>` : '';
  }

  /** One outline tile (inside its cv-soa-course slot), collapsed or expanded. */
  function tile(record, expanded = false) {
    const hasTasks = (record.outlines || []).some(o => o.tasks?.length);
    const body = staffLine(record) + (record.statusLine ? label(record.statusLine, 'eds-c-text--bold v-label-eds-c-text--bold') : '') +
      summaryRow(record) + (hasTasks ? accordion(expanded) : '');
    return '<div class="eds-c-tile v-layout v-widget eds-o-feature eds-c-tile-eds-o-feature eds-s-is-first eds-c-tile-eds-s-is-first eds-s-is-last eds-c-tile-eds-s-is-last">' +
      `<div class="eds-c-tile__header v-layout v-widget">${label(record.title, `eds-c-tile__title v-label-eds-c-tile__title eds-u-float--left v-label-eds-u-float--left ${FIRST_LAST}`)}</div>` +
      // compound-progress.js fills it in place: inserting it later restyled the whole (expanded) tile
      '<div class="cx-compound-progress-container"></div>' +
      `<div class="eds-c-tile__body v-layout v-widget"><div class="v-csslayout v-layout v-widget eds-s-is-first v-csslayout-eds-s-is-first eds-s-is-last v-csslayout-eds-s-is-last">${body}</div></div></div>`;
  }

  window.ConnectifyLegacyMarkup = { tile, detailsPanel, accordion, taskRow, chart, taskChart, summaryChart, groupHeading };
})();
