# Submission Note

**Branch:** submission/nishant-jain
**Files to look at:** BUGS.md (bug report), ASSIGNDESIGN.md (assign endpoint decisions), COVERAGE.md (coverage output)

## What I did
I wrote 98 tests (unit and integration) with about 98% coverage. They found 8 bugs, which are documented in BUGS.md with the file, the root cause and a suggested fix for each. I fixed the pagination bug (BUG-2), because the correct behaviour was clear and the fix was one line. I also added `PATCH /tasks/:id/assign`, writing the tests first.

## What I'd test next
- Fix the other seven bugs and turn their `it.failing` tests into normal tests.
- Combine status filtering with pagination once BUG-8 is fixed, including edge cases such as a page past the end of a filtered list.
- Requests happening at the same time, such as two people assigning the same task, since the store is a shared array.
- Big data sets (thousands of tasks) to check pagination and stats performance.
- Property-based tests for pagination: for any page and limit, pages never overlap and together cover every task.

## What surprised me
- The README and ASSIGNMENT.md disagree on status names. The code follows ASSIGNMENT.md (`todo`, `in_progress`, `done`), so the README examples like `?status=pending` return nothing.
- Completing a task silently resets its priority to "medium". Nothing errors, so it's easy to miss.
- A small typo in my own curl command triggered BUG-7 by accident. Broken JSON returns a 500 with a stack trace, instead of a 400.
- The status filter used `.includes()`, so `?status=do` matches both "todo" and "done".

## Questions I'd ask before shipping
- Is a real database planned? Everything is lost on restart.
- Who is allowed to create, edit, delete and assign tasks? There is no authentication.
- Which status names are the real ones, and should the README be fixed?
- What should happen when a completed task is completed again, and when a task that is already assigned is assigned again? I allowed reassignment, but a team might prefer a 409.
- Should `assignee` be checked against a real user list, and should there be a way to unassign?
- What is the maximum page size? I suggested capping `limit` at 100.
- Should PUT be limited to an allow-list of fields? Right now it can change `id`, `createdAt` and `assignee`.