# Coverage Summary

Run with `npm run coverage` (Jest + Supertest)

PASS tests/unit/taskService.assign.test.js
PASS tests/unit/taskService.test.js
PASS tests/integration/assign.test.js
PASS tests/integration/tasks.test.js
-----------------|---------|----------|---------|---------|-------------------
File             | % Stmts | % Branch | % Funcs | % Lines | Uncovered Line #s 
-----------------|---------|----------|---------|---------|-------------------
All files        |   98.73 |    97.75 |   96.66 |   98.61 |                   
 src             |   84.61 |       75 |      50 |   84.61 |                   
  app.js         |   84.61 |       75 |      50 |   84.61 | 17-18             
 src/routes      |     100 |      100 |     100 |     100 |                   
  tasks.js       |     100 |      100 |     100 |     100 |                   
 src/services    |     100 |    94.73 |     100 |     100 |                   
  taskService.js |     100 |    94.73 |     100 |     100 | 22                
 src/utils       |     100 |      100 |     100 |     100 |                   
  validators.js  |     100 |      100 |     100 |     100 |                   
-----------------|---------|----------|---------|---------|-------------------

Test Suites: 4 passed, 4 total
Tests:       98 passed, 98 total
Snapshots:   0 total
Time:        2.226 s

Tests: 98 passed. Suites: 4 passed.

Notes:
- Remaining uncovered lines: app.js 17-18 (the `app.listen` branch, only runs when started directly) and one default-value branch in taskService.js.
- Tests marked `it.failing` document known unfixed bugs (see BUGS.md).