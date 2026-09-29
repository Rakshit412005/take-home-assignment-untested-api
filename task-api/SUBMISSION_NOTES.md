# Submission Notes

## What I would test next

- **Concurrency and race conditions:** The in-memory array has no locking or atomic operations. Concurrent requests attempting to update, complete, or splice the same task simultaneously could cause lost updates or corrupt array indices.
- **Filter and pagination composition:** In `src/routes/tasks.js`, the status filter and pagination logic exist in separate `if` blocks. Querying `GET /tasks?status=todo&page=2&limit=5` currently returns all matching tasks without applying pagination. I would test and implement combined filtering and paging.
- **Payload size and length limits:** The Express server parses JSON without explicit size caps, and `validators.js` checks string types but not character length limits. Large strings in `title`, `description`, or `assignee` could cause memory pressure.
- **State consistency on PUT:** When a task is updated to `status: 'done'` via `PUT /tasks/:id`, `completedAt` remains `null`. Conversely, updating a completed task back to `'todo'` leaves a stale timestamp. I would add tests to verify and align lifecycle transitions across PUT and PATCH endpoints.
- **System field immutability:** `PUT /tasks/:id` currently spreads request body fields directly onto the stored task. I would add tests to confirm that client requests cannot overwrite `id` or `createdAt`.

## What surprised me

- **The priority reset in `completeTask()`:** The service explicitly reset `priority` to `'medium'` whenever a task was marked complete. Because the HTTP status and `completedAt` timestamp were valid, this data mutation could easily go unnoticed without an explicit assertion on the priority field.
- **Substring matching in `getByStatus()`:** Using `String.prototype.includes()` allowed queries like `?status=do` to match both `todo` and `done`. While standard queries like `?status=todo` passed normally, partial queries revealed that the implementation was not using strict equality.
- **Enum discrepancy in `README.md`:** The README schema listed statuses as `pending`, `in-progress`, and `completed`, while the code and `ASSIGNMENT.md` use `todo`, `in_progress`, and `done`. Testing the sample curl commands from the README resulted in validation errors.

## Questions I would ask before production

1. **Persistence:** The current in-memory store resets whenever the server process restarts. Which database (such as PostgreSQL or MongoDB) should be integrated, and what migration tooling is preferred?
2. **Authentication and authorization:** Requests currently operate without user identity or access controls. Should tasks be scoped to individual users or organizations, and who has permission to assign or delete tasks?
3. **Assignee model:** The endpoint accepts a free-form string for `assignee`. In a production system, should this reference an existing user entity or email address, and should unassigning a task be supported?
4. **Input sanitization and limits:** What maximum length limits should be applied to `title`, `description`, and `assignee`, and should inputs be sanitized against HTML injection?
5. **Allowed state transitions:** Can a task transition freely between any status (e.g., from `done` directly back to `todo`), or should valid lifecycle transitions be enforced?
6. **Observability:** Beyond standard console error logging, what structured logging, metrics, or error tracking services should be configured?

## Design decisions for `PATCH /tasks/:id/assign`

- **Validation:** Added `validateAssignTask` to `src/utils/validators.js`. It checks that `assignee` is present, is a string, and is non-empty after trimming whitespace, returning a 400 error if any condition fails.
- **Re-assignment semantics:** Overwriting an existing assignee with a new name is permitted. Since PATCH denotes a partial update, replacing the assignee directly is the standard behavior and avoids requiring an explicit un-assign step first.
- **Service layer:** Implemented `assignTask(id, assignee)` in `src/services/taskService.js` following the pattern of `completeTask()`. It locates the task by ID, creates an updated copy with the assignee property, replaces the object in the array, and returns the updated task.
- **Error ordering:** In `src/routes/tasks.js`, payload validation runs before the task lookup. This returns 400 for malformed requests and 404 for non-existent tasks, matching the pattern used by `PUT /tasks/:id`.
