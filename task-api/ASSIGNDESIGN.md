# `PATCH /tasks/:id/assign` — Design Notes

## What it does

`PATCH /tasks/:id/assign` with `{ "assignee": "Alice" }` stores the name on the task and returns the updated task.

I wrote the tests first and watched them fail, then wrote the code. Changes are in three places, matching how the rest of the codebase is split:

- `validators.js`: new `validateAssignTask` (checks the input)
- `taskService.js`: new `assign` function (changes the data) and a default `assignee: null` on new tasks
- `routes/tasks.js`: the new route (HTTP status codes)

## Decisions and why

| Question | What I chose | Why |
|---|---|---|
| Task doesn't exist | `404` | Required by the brief. Same shape as the other routes. |
| `assignee` missing, or not a string (number, null, array, object) | `400` | A name has to be text. Guessing what the client meant would hide their mistake. |
| Empty string or only spaces | `400` | A blank name isn't a person. I check after trimming, so `"   "` is rejected too. |
| Whitespace around the name | Trimmed before saving | Otherwise `"Alice"` and `"Alice "` would count as two different people. |
| Very long names | `400` above 100 characters | Stops junk or abuse data. 100 is a guess; the real limit depends on the user system. |
| Task is already assigned | Allowed, replaces the old assignee, returns `200` | Handing a task to someone else is a normal thing to do. Assigning the same person again is harmless (idempotent). |
| Which check runs first, 400 or 404? | Validation first, then lookup | This is what `PUT` already does, so the API stays consistent. |
| Completed tasks | Can still be assigned | Nothing in the brief forbids it, and it's sometimes useful for record keeping. |
| Shape of old and new tasks | New tasks get `assignee: null` | Every task has the same fields, whether assigned or not. |

## Things I considered but didn't do

- **`409 Conflict` when already assigned.** Stricter, and it would protect against two people grabbing the same task. But it makes reassigning awkward, since you'd need a separate "unassign" step first. I'd ask the team which behaviour they want before choosing this.
- **Unassigning** (setting `assignee` back to `null`). Not in the brief, so I left it out. Right now an empty string is an error, so there's no way to unassign.
- **Checking the name against a real user list.** There are no users in this API, so `assignee` is just free text.

## Known limitation

`PUT /tasks/:id` can also change `assignee`, because it copies anything in the request body onto the task (this is BUG-5 in `BUGS.md`). That means the checks above can be bypassed through `PUT`. Fixing BUG-5 with an allow-list fixes this too.