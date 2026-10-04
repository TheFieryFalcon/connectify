# Connectify Roadmap

### 3.2.0 - Grade Predictor Update
- Adds the predictor, a tab in the sidebar that shows your predicted scores for all your next assignments based on their type and subject and prior data 
- Adds a four-segment bar that indicates how well you did based on your predictions (something might happen if you do really well... or poorly)
- Totally overhauled the dark mode to fit in with Connect more and to be more pleasing to the eye
- Progress bar
- Back to top button
- Many, MANY bugfixes, too many to count
- Cache everything with robust invalidators to catch edge cases and ensure backwards compatibility
- Centralize all data processing, e.g. task order, task dates, etc.

### Modes Update
- Adds a new "Really Dark" (name wip) mode that fulfills all degenerates' needs
- "Show only Semester 2" setting
- Add a new Progress Graph setting to graph averages instead of individual task performance (although must be designed to take into account decreasing contribution of each task... maybe rolling window of 3?)

### Stats Panel Update
- Adds a new "Expanded View" option to the stats panel that makes everything bigger and more compartmentalized
- Two options, either have it toggled on for all stats panels or just for the subject summary ones
- (MAYBE): Add icons to the sidebar? (everyone reading this, please let me know your thoughts on that through email)
- Add "Max Possible Average" somewhere in the subject accordion
- Add predictors to uncompleted tasks

### Goals Update (Phase 1)
- Centralize the Target ATAR and Target Grade menus to a Goal Manager menu
- Use predictions to display how difficult the target is to reach with words depending on variance (e.g. medium difficulty high variance "Goal is Possible", medium difficulty low variance "Goal is Doable")
- Add "Save as Goal" button
- Add third window to view goal progress

### 3.3.0 - Goals Update (Phase 2)
- Add desaturated three-segment bar next to the four-segment bar displaying how close you are to your goal
- Empty: Goal is impossible
- Red: Far from goal (needs to get above High prediction for all following tasks to reach goal)
- Yellow: Medium distance to goal (need to get a fair amount above Medium prediction for all following tasks to reach goal)
- Green: Close to goal (need to get above Medium prediction for all following tasks to reach goal)
- Full golden bar: Reached goal (amount exceeding is how "golden" the color is)
