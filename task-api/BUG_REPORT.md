# Bug Report — Task Manager API

---

## Bug D1: `getByStatus()` uses substring matching instead of exact equality

- **File:** `src/services/taskService.js`, line 9
- **Severity:** High
- **Expected behavior:** Filtering tasks by status should return only tasks whose status matches the requested string exactly.
- **Actual behavior:** `getByStatus()` used `String.prototype.includes()`, which matches substrings. Querying `status=do` returned both `done` and `todo` tasks because both contain `"do"`.
- **How discovered:** Discovered by writing an integration test querying `GET /tasks?status=do`, which unexpectedly returned tasks rather than an empty list.
- **Root cause:** Line 9 used `t.status.includes(status)` instead of strict equality `t.status === status`.
- **Fix:** Replace `.includes()` with `===`:
```diff
-const getByStatus = (status) => tasks.filter((t) => t.status.includes(status));
+const getByStatus = (status) => tasks.filter((t) => t.status === status);
```
- **Current status:** Fixed

---

## Bug D2: `getPaginated()` calculates offset incorrectly for 1-based indexing

- **File:** `src/services/taskService.js`, line 12
- **Severity:** High
- **Expected behavior:** Requesting page 1 should return items starting from the beginning of the collection (offset 0).
- **Actual behavior:** The offset was calculated as `page * limit`. For `page=1` and `limit=10`, the offset was 10, skipping the first 10 items entirely. Requesting page 1 with fewer than 10 items returned an empty array.
- **How discovered:** Discovered by creating 5 tasks and calling `GET /tasks?page=1&limit=10`. The response was empty instead of returning all 5 tasks.
- **Root cause:** 1-based page mathematics requires subtracting 1 before multiplying by the page size: `(page - 1) * limit`.
- **Fix:** Correct the offset formula:
```diff
-const offset = page * limit;
+const offset = (page - 1) * limit;
```
- **Current status:** Fixed

---

## Bug D3: `completeTask()` resets task priority to `'medium'`

- **File:** `src/services/taskService.js`, line 69
- **Severity:** Medium
- **Expected behavior:** Marking a task as complete should only update `status` to `'done'` and set `completedAt`. The task's existing priority should remain unchanged.
- **Actual behavior:** `completeTask()` explicitly included `priority: 'medium'` in the updated object spread, overwriting `high` or `low` priority tasks upon completion.
- **How discovered:** Discovered by creating a task with `priority: 'high'`, completing it via `PATCH /tasks/:id/complete`, and checking the returned priority, which reverted to `'medium'`.
- **Root cause:** The object spread in `completeTask()` included an unnecessary `priority: 'medium'` property.
- **Fix:** Remove the property from the update object:
```diff
 const updated = {
   ...task,
-  priority: 'medium',
   status: 'done',
   completedAt: new Date().toISOString(),
 };
```
- **Current status:** Fixed

---

## Bug D4: `update()` allows overwriting internal system fields

- **File:** `src/services/taskService.js`, line 50
- **Severity:** Medium
- **Expected behavior:** `PUT /tasks/:id` should only update client-mutable fields (`title`, `description`, `status`, `priority`, `dueDate`). Internal system fields (`id`, `createdAt`, `completedAt`) should be protected from client modification.
- **Actual behavior:** `update()` uses `{ ...tasks[index], ...fields }` without filtering incoming keys. A client can overwrite `id` by sending `{ "id": "custom-id" }`, changing the lookup key in memory and breaking subsequent operations.
- **How discovered:** Discovered by writing a unit test attempting to update a task with `{ id: 'hijacked' }`.
- **Root cause:** Missing field whitelist or destructuring in `update()` before merging attributes.
- **Proposed fix:** Filter incoming fields before merging:
```javascript
const { id, createdAt, completedAt, ...allowedFields } = fields;
const updated = { ...tasks[index], ...allowedFields };
```
- **Current status:** Documented (unfixed)

---

## Bug D5: `update()` does not synchronize `completedAt` on status change

- **File:** `src/services/taskService.js`, lines 46–53
- **Severity:** Low
- **Expected behavior:** When a task's status is changed to `'done'` via `PUT /tasks/:id`, `completedAt` should be recorded. If changed away from `'done'`, `completedAt` should be reset to `null`.
- **Actual behavior:** `update()` performs a direct field merge without lifecycle hooks. Setting `status: 'done'` via PUT leaves `completedAt: null`. Changing a completed task back to `'todo'` retains the stale completion timestamp.
- **How discovered:** Discovered by analyzing the lifecycle differences between `completeTask()` and `update()`.
- **Root cause:** `update()` does not contain conditional checks for status transitions.
- **Proposed fix:** Add transition checks for `completedAt`:
```javascript
if (fields.status === 'done' && !tasks[index].completedAt) {
  fields.completedAt = new Date().toISOString();
} else if (fields.status && fields.status !== 'done') {
  fields.completedAt = null;
}
```
- **Current status:** Documented (unfixed)

---

## Bug D6: README documentation lists unsupported status values

- **File:** `README.md`, line 77
- **Severity:** Low (documentation)
- **Expected behavior:** Documentation should list the enum values accepted by the API.
- **Actual behavior:** `README.md` documents status values as `"pending | in-progress | completed"`. The application code (`validators.js`, `taskService.js`) and `ASSIGNMENT.md` accept `"todo | in_progress | done"`. Requests following the README examples fail validation with HTTP 400.
- **How discovered:** Discovered during initial code review when comparing `README.md` curl examples and schema definitions against `VALID_STATUSES` in `src/utils/validators.js`.
- **Root cause:** Documentation was not updated when status strings were refactored in code.
- **Proposed fix:** Update line 77 of `README.md` to specify `"todo | in_progress | done"`.
- **Current status:** Documented (unfixed)
