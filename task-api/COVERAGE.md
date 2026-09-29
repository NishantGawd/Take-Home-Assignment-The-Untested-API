# Coverage Summary

Run with `npm run coverage` (Jest + Supertest)

PASS tests/integration/tasks.test.js
PASS tests/unit/taskService.test.js
-----------------|---------|----------|---------|---------|-------------------
File             | % Stmts | % Branch | % Funcs | % Lines | Uncovered Line #s 
-----------------|---------|----------|---------|---------|-------------------
All files        |    98.5 |    97.33 |   96.15 |   98.36 |                   
 src             |   84.61 |       75 |      50 |   84.61 |                   
  app.js         |   84.61 |       75 |      50 |   84.61 | 17-18             
 src/routes      |     100 |      100 |     100 |     100 |                   
  tasks.js       |     100 |      100 |     100 |     100 |                   
 src/services    |     100 |    94.11 |     100 |     100 |                   
  taskService.js |     100 |    94.11 |     100 |     100 | 22                
 src/utils       |     100 |      100 |     100 |     100 |                   
  validators.js  |     100 |      100 |     100 |     100 |                   
-----------------|---------|----------|---------|---------|-------------------

Test Suites: 2 passed, 2 total
Tests:       67 passed, 67 total
Snapshots:   0 total
Time:        1.128 s

Tests: 67 passed. Suites: 2 passed.

Notes:
- Remaining uncovered lines: app.js 17-18 (the `app.listen` branch, only runs when started directly) and one default-value branch in taskService.js.
- Tests marked `it.failing` document known unfixed bugs (see BUGS.md).