# 2025 ATAR estimate

The bottom-right **ATAR estimate** button opens a panel with separate Semester 1 and Semester 2 scenarios. The panel imports overall percentages for ATAR subjects currently present in Assessment Outlines. Show all classes if a semester is missing. Semester 2 uses Connect's displayed cumulative percentage.

**School percentages are not scaled scores.** Imported marks are starting assumptions only. Edit the score fields to your estimated scaled scores, or uncheck a subject to exclude it. Overrides are saved separately for each semester. Reset restores current school percentages.

The reference calculator explicitly requests scaled scores:

- [ATAR Notes WACE calculator](https://wace.atarcalc.com/)
- [TISC's 2025 table and aggregation rules](https://www.tisc.edu.au/static/guide/atar-about.tisc)

Connect Tea implements the aggregation locally, using the highest four included scores and applicable maths/language bonuses. Conversion interpolates TISC's published 2025 summary table and rounds to ATAR increments of 0.05. The summary table is less detailed than ATAR Notes' backend, so some results may differ slightly. No student marks are sent to either service.

A fictional reference check with Chemistry, English, Physics and Biology at 70 each returned TEA 280 and ATAR 92.30 from ATAR Notes for 2025; Connect Tea gives the same result. Other tests covered bonuses outside the best four, only the best language bonus, fewer than four subjects, invalid inputs, and conversion endpoints.

This is a scenario tool, not an official ATAR or scaling prediction. It does not determine WACE eligibility, English competency, or prohibited subject combinations. Exclude incompatible courses yourself. General courses, including Mathematics Essentials, are not imported. Year 11 marks cannot establish a final Year 12 ATAR.

Version 1.3.1 applies user-requested whole-score rounding (nearest integer, .5 down) before aggregation and bonuses. This intentionally differs from the reference website’s truncation of decimal inputs. For the six supplied semester 2 scores, the resulting TEA is 279.30.

## Target planning (version 1.5.0)

Let T be total outline weight, E the sum of completed score percentages multiplied by their weights divided by 100, and R the pending weight. The final subject percentage at a future average x is 100*E/T + x*R/T. Semester 1 accepts its actual published T; semester 2 requires the cumulative annual T of 100. The target grade planner solves this weighted-average equation directly; target ATAR applies the existing scenario-score adjustment and ATAR conversion to the projected subject percentages.

For example, a semester outline totaling 42 with 29.4 weight completed at 70% and 12.6 pending requires a remaining average of 86.666...% to finish at 75%. The recommendation displays 86.7%. Its maximum is 79%, so 80% is unattainable from those remaining tasks.

Grade-planning reference: https://www.calculator.net/grade-calculator.html. All calculations remain local; no marks are transmitted to the reference site.
