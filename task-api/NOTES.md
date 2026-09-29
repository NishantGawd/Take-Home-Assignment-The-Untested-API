# Working Notes

## Setup
- Ran npm install from task-api/ (root has no package.json).
- No tests existed at first. Created tests/unit, tests/integration, tests/helpers.

## Code walkthrough
- app.js: exports app, only listens if run directly, so Supertest works.
- routes/tasks.js: thin HTTP layer. /stats declared before / so no shadowing.
- taskService.js: in-memory array. Has _reset() which I use in beforeEach.
- validators.js: returns error string or null.

## Doc discrepancy
- ASSIGNMENT.md says todo | in_progress | done; README says pending | in-progress | completed.
- The code (validators.js) uses the ASSIGNMENT.md values, so I used those.

## Bugs found (expected vs actual)
1. getByStatus uses .includes -> ?status=do matches todo and done.
2. getPaginated offset = page * limit -> page 1 skips first page. FIXED.
3. completeTask hard-codes priority 'medium'.
4. page/limit not validated: page=0 and limit=-1 accepted.
5. update spreads the body -> id/createdAt can be overwritten.
6. completing twice overwrites completedAt (debatable).
7. Malformed JSON returns 500, expected 400 (error handler ignores err.status).
8. status filter and pagination cannot be combined.

## Decisions
- Used it.failing for unfixed bugs so the suite stays green but bugs stay visible.
- Used relative dates instead of fake timers (simpler, and no problems with Supertest).
- Chose to fix bug 2: unambiguous expected behaviour, one-line fix.

## Surprises
- README status values don't match the code.
- Bug 3 is easy to miss: completing a task silently changes priority.

## Questions for before production
- Is a persistent database planned? Data is lost on restart.
- Authentication, and who may assign or edit tasks?
- Max page size / limit?
- Should completing twice be an error, a no-op, or an update?
- Which status vocabulary is the real one?