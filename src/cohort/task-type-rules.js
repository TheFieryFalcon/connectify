/**
 * Connectify: assessment type detection by specificity
 *
 * Every keyword that names a category is found in a task's name and its labels (Connect's task type, caption and
 * name), each with a specificity tier, and the most specific match wins, whatever the category order:
 *   4  phrases that settle a known clash (validation test, oral communication)
 *   3  conditions: exam, test, quiz, in class, take home, assignment (an "Extended response" labelled
 *      Examination is part of the exam, one called a take-home extended response is take-home)
 *   2  formats: essay, investigation, practical, presentation
 *   1  vague words: response, analysis, semester, research (they decide only when nothing else is named)
 * Ties go to the task's name over its labels, then the longer keyword, then the Settings order.
 * Settings' keywords take their tier from TIERS (a word it does not know is 2, a custom category's keyword 3);
 * VOCABULARY adds words teachers use that Settings does not list, skipped when Settings lists the same words, and
 * SUBJECT_RULES read a word as its subject means it (a Maths "Response" is a test, a language's oral is speaking).
 * Keywords match whole words (plurals and "examination" too), never inside one: "oral" is not "Choral".
 * Exposes window.ConnectifyTaskTypeRules.
 */
(() => {
  'use strict';

  if (window.ConnectifyTaskTypeRules) return;

  // Lower case, words split by single spaces, letters and digits apart ("Test1" -> "test 1", "in-class" -> "in class")
  const words = text => String(text || '').toLowerCase()
    .replace(/([a-z])(\d)/g, '$1 $2').replace(/(\d)([a-z])/g, '$1 $2')
    .replace(/[^a-z0-9]+/g, ' ').trim();

  const TIERS = {
    exam: 3, test: 3, quiz: 3, 'in class': 3, 'take home': 3, takehome: 3, assignment: 3, homework: 3, timed: 3,
    semester: 1, response: 1, analysis: 1, research: 1, 'extended response': 1
  };

  // [keyword, category, tier]: words teachers name tasks with beyond Settings' defaults (WA SCSA assessment types)
  const VOCABULARY = [
    ['mock exam', 'Exam', 3], ['wace', 'Exam', 2],
    ['checkpoint', 'Test', 2], ['timed', 'Test', 3], ['supervised', 'Test', 3],
    ['inquiry', 'Application', 2], ['enquiry', 'Application', 2], ['experiment', 'Application', 2],
    ['fieldwork', 'Application', 2], ['field work', 'Application', 2], ['lab', 'Application', 2], ['laboratory', 'Application', 2],
    ['case study', 'Application', 2], ['simulation', 'Application', 2], ['data interpretation', 'Application', 2],
    ['data analysis', 'Application', 2], ['comprehension', 'Application', 2], ['viewing and reading', 'Application', 2],
    ['reading and viewing', 'Application', 2], ['aural', 'Application', 2], ['performance', 'Application', 2],
    ['recital', 'Application', 2], ['ensemble', 'Application', 2], ['mock trial', 'Application', 2], ['moot', 'Application', 2],
    ['folio', 'Application', 2], ['translation', 'Application', 2],
    ['explanation', 'Essay', 2], ['source analysis', 'Essay', 2], ['written response', 'Essay', 2], ['responding', 'Essay', 2],
    ['commentary', 'Essay', 2], ['critique', 'Essay', 2], ['critical review', 'Essay', 2], ['persuasive', 'Essay', 2],
    ['paragraph', 'Essay', 2], ['written communication', 'Essay', 2], ['extended answer', 'Essay', 2],
    ['take home', 'Take-Home', 3], ['takehome', 'Take-Home', 3], ['homework', 'Take-Home', 3], ['research', 'Take-Home', 1],
    ['creating', 'Take-Home', 2], ['production', 'Take-Home', 2], ['composition', 'Take-Home', 2], ['arrangement', 'Take-Home', 2],
    ['podcast', 'Take-Home', 2], ['poster', 'Take-Home', 2], ['video', 'Take-Home', 2], ['documentary', 'Take-Home', 2],
    ['short film', 'Take-Home', 2], ['website', 'Take-Home', 2], ['infographic', 'Take-Home', 2], ['speech', 'Take-Home', 2],
    ['debate', 'Take-Home', 2], ['seminar', 'Take-Home', 2], ['short story', 'Take-Home', 2], ['narrative', 'Take-Home', 2],
    // Phrases that settle a clash between two keywords
    ['validation test', 'Application', 4], ['in class validation', 'Application', 4], ['oral communication', 'Application', 4]
  ];

  const SUBJECTS = {
    maths: /\b(?:maths?|mathematics|methods|specialist|numeracy)\b/i,
    languages: /\b(?:japanese|french|chinese|mandarin|indonesian|italian|german|spanish|korean|greek|arabic|vietnamese|hindi|latin|auslan|languages?|eal|eald|esl|dialect)\b/i
  };

  // [subject, keyword, category, tier]: a word read as its subject means it, whatever Settings says
  const SUBJECT_RULES = [
    ['maths', 'response', 'Test', 3],
    ['languages', 'oral', 'Application', 3], ['languages', 'interview', 'Application', 3],
    ['languages', 'conversation', 'Application', 3], ['languages', 'role play', 'Application', 3],
    ['languages', 'presentation', 'Application', 3], ['languages', 'writing', 'Essay', 3]
  ];

  const SUFFIX = '(?:s|es|d|ed|ing|er|ers|zes|ination|inations)?';
  const escape = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const matcher = phrase => new RegExp(`(?:^| )${escape(phrase)}${SUFFIX}(?= |$)`);

  let compiled = null;
  const results = new Map();

  /** The rules for a category set, rebuilt only when its keywords change. */
  function rulesFor(categories, defaults) {
    const sig = JSON.stringify(Object.entries(categories).map(([name, c]) => [name, c?.keywords || []]));
    if (compiled?.sig === sig) return compiled;
    const names = Object.keys(categories);
    const rules = [];
    const listed = new Set();
    const add = (phrase, category, tier, subject = null) => {
      if (!phrase || !names.includes(category)) return;
      rules.push({ phrase, category, tier, subject, order: names.indexOf(category), re: matcher(phrase) });
    };
    for (const [category, data] of Object.entries(categories)) {
      for (const raw of data?.keywords || []) {
        const phrase = words(raw);
        if (!phrase) continue;
        listed.add(phrase);
        add(phrase, category, TIERS[phrase] ?? (defaults[category] ? 2 : 3));
      }
    }
    for (const [phrase, category, tier] of VOCABULARY) if (!listed.has(phrase)) add(phrase, category, tier);
    for (const [subject, phrase, category, tier] of SUBJECT_RULES) add(phrase, category, tier, subject);
    results.clear();
    compiled = { sig, rules };
    return compiled;
  }

  const subjectGroups = subject => Object.keys(SUBJECTS).filter(k => SUBJECTS[k].test(subject || ''));

  /** Every match as { category, tier, phrase, field (0 name, 1 labels) }, most specific first. */
  function matches(taskName, labels, subject, categories, defaults) {
    const { rules } = rulesFor(categories, defaults);
    const groups = subjectGroups(subject);
    const fields = [words(taskName), words((labels || []).join(' '))];
    const found = [];
    for (const rule of rules) {
      if (rule.subject && !groups.includes(rule.subject)) continue;
      fields.forEach((text, field) => { if (text && rule.re.test(text)) found.push({ ...rule, field }); });
    }
    return found.sort((a, b) => b.tier - a.tier || a.field - b.field || b.phrase.length - a.phrase.length || a.order - b.order);
  }

  /** The most specific category for a task, or null when nothing names one. */
  function classify(taskName, labels, subject, categories, defaults = {}) {
    const key = `${subjectGroups(subject).join(',')}|${taskName || ''}|${(labels || []).join('::')}`;
    rulesFor(categories, defaults);
    if (results.has(key)) return results.get(key);
    const category = matches(taskName, labels, subject, categories, defaults)[0]?.category || null;
    if (results.size > 5000) results.clear();
    results.set(key, category);
    return category;
  }

  window.ConnectifyTaskTypeRules = { TIERS, VOCABULARY, SUBJECT_RULES, SUBJECTS, words, matches, classify };
})();
