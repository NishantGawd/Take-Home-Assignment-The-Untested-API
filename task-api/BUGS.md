# Bug Report

I found these bugs by writing tests first and reading the code second. Where a test failed on the original code, I treated it as a bug lead and then went to the source to work out why it happens.

Line numbers are approximate, because I was counting them by hand from the original files. The function names are exact.

Each bug below has a matching test in the test files, marked with a BUG-n comment. For bugs I haven't fixed, the test uses it.failing, which means "this test is expected to fail because the bug still exists." Once the bug is fixed, I'd change it.failing to it.

## Summary

| # | Severity | Short description | Status |
|---|----------|-------------------|--------|
| 2 | High | Pagination skips the first page | **Fixed** |
| 3 | High | Completing a task resets its priority to "medium" | Not fixed |
| 1 | Medium | Status filter matches partial strings | Not fixed |
| 4 | Medium | `page` and `limit` are not validated | Not fixed |
| 5 | Medium | PUT lets clients overwrite `id` and `createdAt` | Not fixed |
| 7 | Medium | Malformed JSON returns 500 instead of 400 | Not fixed |
| 6 | Low | Completing twice overwrites `completedAt` | Not fixed |
| 8 | Low | Status filter and pagination can't be combined | Not fixed |

---

## BUG-2: Pagination skips the first page (High) — FIXED

**Where:** `src/services/taskService.js`, `getPaginated`, line 12

**Expected:** `GET /tasks?page=1&limit=2` returns the first two tasks.

**Actual:** It returns tasks 3 and 4. Page 1 is skipped completely, and the last page always comes back empty or short.

**How I found it:** The first pagination tests I wrote failed right away. I created 5 tasks and asked for page 1, but the first task wasn't in the response. I also checked it by hand with curl.

**Root cause:** The offset is calculated as `page * limit`. That would be right if pages started at 0, but the API (and the route's own default of `page = 1`) treats pages as 1-based. So page 1 gets an offset of `limit` instead of 0.

**Fix:** Subtract one from the page number:

```js
const offset = (page - 1) * limit;
```

**Status:** Fixed in this submission. I picked this bug to fix because the correct behaviour is obvious, the fix is a single line, and the regression tests are easy to read. The pagination tests in both test files are now normal `it` tests.

---

## BUG-3: Completing a task resets its priority to "medium" (High)

**Where:** `src/services/taskService.js`, `completeTask`, around line 69

**Expected:** `PATCH /tasks/:id/complete` changes the status to `done` and sets `completedAt`. Everything else stays the same.

**Actual:** The priority is also overwritten with `'medium'`. A high-priority task becomes medium once it is completed.

**How I found it:** I wrote a test that created a `high` priority task, completed it, and checked the priority. It came back as `medium`.

**Root cause:** The object built in `completeTask` contains a hard-coded `priority: 'medium'` line. It looks like a leftover from copy-paste or a debugging session. Nothing in the endpoint's job requires changing priority.

**Why it matters:** It is silent data loss. Nothing errors, and anyone who later reports on "how many high priority tasks did we finish" gets wrong numbers.

**Suggested fix:** Delete that line. The spread of `...task` already keeps the existing priority.

**Status:** Not fixed. Test: `keeps the original priority`.

---

## BUG-1: Status filter matches partial strings (Medium)

**Where:** `src/services/taskService.js`, `getByStatus`, line 9

**Expected:** `GET /tasks?status=todo` returns only tasks whose status is exactly `todo`. An unknown value returns an empty list.

**Actual:** The filter is a substring match. `?status=do` returns every task with `todo` or `done`, and `?status=o` returns all of them.

**How I found it:** I was writing "unknown status returns empty list" tests and wondered what a partial value would do. I tried `do`, and it returned tasks.

**Root cause:** The code uses `t.status.includes(status)`. `String.prototype.includes` checks for a substring, not for equality.

**Suggested fix:**

```js
const getByStatus = (status) => tasks.filter((t) => t.status === status);
```

**Status:** Not fixed. Tests: `does not match partial status strings` (unit) and `does not match partial status values` (integration).

---

## BUG-4: `page` and `limit` are not validated (Medium)

**Where:** `src/routes/tasks.js`, `GET /`, around lines 20-21

**Expected:** Invalid values such as `page=0`, `page=-3`, `limit=-1` or `limit=abc` get a 400 with a clear message. There should also be a sensible maximum for `limit`.

**Actual:**
- `page=0` is quietly turned into page 1 and `limit=0` into 10.
- `limit=-1` is passed to `slice()` as-is, so it returns "everything except the last item", which makes no sense.
- `limit=abc` silently becomes 10.
- There is no upper limit, so `limit=1000000` is accepted.

**How I found it:** Manual testing with odd values, then two `it.failing` tests for `limit=-1` and `page=0`.

**Root cause:** The route uses `parseInt(page) || 1` and `parseInt(limit) || 10`. The `||` treats any falsy result (0 and NaN) as "not given", so bad input gets swallowed. Negative numbers are truthy, so they pass straight through. Nothing checks the range.

**Suggested fix:** Parse with `Number`, then reject anything that is not a positive integer. Cap `limit` at something like 100.

```js
const pageNum = page === undefined ? 1 : Number(page);
const limitNum = limit === undefined ? 10 : Number(limit);
if (!Number.isInteger(pageNum) || pageNum < 1 || !Number.isInteger(limitNum) || limitNum < 1 || limitNum > 100) {
  return res.status(400).json({ error: 'page and limit must be positive integers (limit max 100)' });
}
```

The exact rules are a product decision (400 vs falling back to defaults), so I would check with the team before shipping. I chose 400 because silently guessing what the client meant hides mistakes.

**Status:** Not fixed. Tests: `rejects a negative limit with 400` and `rejects page=0 with 400`.

---

## BUG-5: PUT lets clients overwrite `id` and `createdAt` (Medium)

**Where:** `src/services/taskService.js`, `update`, around line 50

**Expected:** Clients can change fields like title, description, status, priority and dueDate. Fields the system manages (`id`, `createdAt`, `completedAt`) can't be changed.

**Actual:** `PUT /tasks/:id` with `{"id": "hijacked"}` changes the task's id. The same goes for `createdAt`, and for any extra field the client invents, which then gets stored on the task.

**How I found it:** Reading `update`. It is one line that merges the request body into the task. I wrote a test to confirm the id really changes, and it does.

**Root cause:** `update` does `{ ...tasks[index], ...fields }`, and the route passes `req.body` straight into it. The validator only checks the fields it knows about and ignores everything else, so unknown and protected fields pass through untouched. This is sometimes called mass assignment.

**Why it matters:** After an id change, the old id returns 404 and the task is effectively lost to any client that saved the old id. Changing `createdAt` corrupts history.

**Suggested fix:** Only copy fields from an allowed list:

```js
const ALLOWED = ['title', 'description', 'status', 'priority', 'dueDate'];
const changes = Object.fromEntries(Object.entries(fields).filter(([k]) => ALLOWED.includes(k)));
const updated = { ...tasks[index], ...changes };
```

**Status:** Not fixed. Tests: `does not allow overwriting id or createdAt` (unit) and `ignores attempts to overwrite id / createdAt` (integration).

A related thing I noticed: `PUT` with `status: "done"` does not set `completedAt`, so the task can be "done" with no completion time. I left this out of the bug count because the spec doesn't say what should happen, but it is worth asking about.

---

## BUG-7: Malformed JSON returns 500 instead of 400 (Medium)

**Where:** `src/app.js`, the error-handling middleware, around lines 9-12

**Expected:** If a client sends a broken JSON body, the API answers `400 Bad Request`, because it is the client's mistake.

**Actual:** The API answers `500 Internal server error` and prints a stack trace to the server console.

**How I found it:** I sent `{"title": ` (cut off) to `POST /tasks` while testing bad input.

**Root cause:** `express.json()` throws an error with `status: 400` when the body can't be parsed. That error lands in the catch-all handler at the bottom of `app.js`, which ignores `err.status` and always sends 500.

**Why it matters:** 500s usually trigger alerts and get counted as server failures. A client typo shouldn't page anyone, and the client is told the problem is on our side when it isn't.

**Suggested fix:** Respect the status the error carries:

```js
app.use((err, req, res, next) => {
  const status = err.status || 500;
  if (status >= 500) console.error(err.stack);
  res.status(status).json({ error: status >= 500 ? 'Internal server error' : 'Invalid request body' });
});
```

**Status:** Not fixed. Test: `returns 400 (not 500) for malformed JSON`.

---

## BUG-6: Completing a task twice overwrites `completedAt` (Low)

**Where:** `src/services/taskService.js`, `completeTask`, around line 71

**Expected:** If a task is already done, calling complete again should not move the completion time. It could return the task unchanged (my preference) or return a 409.

**Actual:** Every call to `/complete` writes a fresh `completedAt`, so the original completion time is lost.

**How I found it:** A test that completes the same task twice, with a short wait in between, and compares the timestamps.

**Root cause:** `completeTask` never checks whether the task is already `done`. It always builds a new object with `completedAt: new Date().toISOString()`.

**Suggested fix:** Add an early return:

```js
if (task.status === 'done') return task;
```

I marked this Low because the spec doesn't say what should happen, so it is partly a design choice. What's clearly wrong is losing the original timestamp.

**Status:** Not fixed. Tests: `does not overwrite completedAt when the task is already done` (unit) and `keeps the original completedAt when completed twice` (integration).

---

## BUG-8: Status filter and pagination can't be combined (Low)

**Where:** `src/routes/tasks.js`, `GET /`, lines 14-24

**Expected:** `GET /tasks?status=todo&page=1&limit=2` returns the first two todo tasks. The README's own example request combines the two.

**Actual:** The `status` branch returns early with every matching task, and `page` and `limit` are ignored.

**How I found it:** I tried the README sample request and got all the matching tasks back instead of one page.

**Root cause:** The route is written as `if (status) return ...`, then `if (page || limit) return ...`. The two options are mutually exclusive by construction.

**Suggested fix:** Filter first, then paginate the filtered list. That means `getPaginated` needs to accept a list (or a status) instead of always slicing the whole store.

**Status:** Not fixed. Test: `applies pagination together with the status filter`.

---

## Things I noticed but did not count as bugs

- **README and ASSIGNMENT.md disagree on status names.** ASSIGNMENT.md says `todo | in_progress | done` and the README says `pending | in-progress | completed`. The code uses the ASSIGNMENT.md values, so the README is the one that's wrong. Anyone following the README examples (`?status=pending`) would get empty results.
- **Returned objects are shared with the store.** `create` returns the same object it saved, and `getAll` only copies the array, not the tasks inside it. Any code that changes a returned task changes the stored one. It isn't causing problems today, but it is a trap for later.
- **Loose date checking.** `Date.parse` accepts strings like `"2024"` or `"Jan 5 2024"`, so "valid ISO date" is not really enforced. Due dates are also stored exactly as sent, not normalised.
- **Titles aren't trimmed.** `"  hello "` is stored as-is.
- **The paginated response has no metadata.** It's a bare array with no total count, so a client can't tell how many pages exist.
- **Everything is in memory**, so data disappears on restart. The brief says this is expected, but it matters before production.