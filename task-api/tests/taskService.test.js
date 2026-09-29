const taskService = require('../src/services/taskService');

describe('taskService', () => {
  beforeEach(() => {
    taskService._reset();
  });

  describe('_reset()', () => {
    it('clears all tasks from the store', () => {
      taskService.create({ title: 'Task 1' });
      taskService.create({ title: 'Task 2' });
      expect(taskService.getAll()).toHaveLength(2);

      taskService._reset();
      expect(taskService.getAll()).toHaveLength(0);
    });
  });

  describe('create()', () => {
    it('creates a task with default status and priority', () => {
      const task = taskService.create({ title: 'Test Task' });

      expect(task).toMatchObject({
        title: 'Test Task',
        description: '',
        status: 'todo',
        priority: 'medium',
        dueDate: null,
        completedAt: null,
      });
      expect(task.id).toBeDefined();
      expect(task.createdAt).toBeDefined();
    });

    it('generates a unique UUID for each task', () => {
      const task1 = taskService.create({ title: 'Task 1' });
      const task2 = taskService.create({ title: 'Task 2' });
      expect(task1.id).not.toBe(task2.id);
      expect(task1.id).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
      );
    });

    it('stores custom field values when provided', () => {
      const task = taskService.create({
        title: 'Custom Task',
        description: 'Some description',
        status: 'in_progress',
        priority: 'high',
        dueDate: '2025-12-31T00:00:00.000Z',
      });

      expect(task.title).toBe('Custom Task');
      expect(task.description).toBe('Some description');
      expect(task.status).toBe('in_progress');
      expect(task.priority).toBe('high');
      expect(task.dueDate).toBe('2025-12-31T00:00:00.000Z');
    });

    it('sets createdAt to a valid ISO timestamp', () => {
      const before = new Date().toISOString();
      const task = taskService.create({ title: 'Timestamp Test' });
      const after = new Date().toISOString();

      expect(new Date(task.createdAt).toISOString()).toBe(task.createdAt);
      expect(task.createdAt >= before).toBe(true);
      expect(task.createdAt <= after).toBe(true);
    });

    it('adds the created task to the store', () => {
      const task = taskService.create({ title: 'Stored Task' });
      const all = taskService.getAll();

      expect(all).toHaveLength(1);
      expect(all[0].id).toBe(task.id);
    });
  });

  describe('getAll()', () => {
    it('returns an empty array when no tasks exist', () => {
      expect(taskService.getAll()).toEqual([]);
    });

    it('returns all tasks in the store', () => {
      taskService.create({ title: 'Task 1' });
      taskService.create({ title: 'Task 2' });
      taskService.create({ title: 'Task 3' });

      const all = taskService.getAll();
      expect(all).toHaveLength(3);
    });

    it('returns a shallow copy to prevent internal array mutation', () => {
      taskService.create({ title: 'Task 1' });
      const result = taskService.getAll();
      result.push({ title: 'Injected' });

      expect(taskService.getAll()).toHaveLength(1);
    });
  });

  describe('findById()', () => {
    it('returns the matching task by ID', () => {
      const created = taskService.create({ title: 'Find Me' });
      const found = taskService.findById(created.id);

      expect(found).toBeDefined();
      expect(found.id).toBe(created.id);
      expect(found.title).toBe('Find Me');
    });

    it('returns undefined for a non-existent ID', () => {
      expect(taskService.findById('non-existent-id')).toBeUndefined();
    });
  });

  // Bug D1 regression: verifies exact equality comparison rather than substring match.
  describe('getByStatus()', () => {
    beforeEach(() => {
      taskService.create({ title: 'Todo Task', status: 'todo' });
      taskService.create({ title: 'In Progress Task', status: 'in_progress' });
      taskService.create({ title: 'Done Task', status: 'done' });
    });

    it('returns only tasks matching the exact status', () => {
      const todoTasks = taskService.getByStatus('todo');
      expect(todoTasks).toHaveLength(1);
      expect(todoTasks[0].title).toBe('Todo Task');
    });

    it('returns an empty array when no tasks match status', () => {
      const result = taskService.getByStatus('nonexistent');
      expect(result).toEqual([]);
    });

    it('does not match tasks where status is a substring match', () => {
      const result = taskService.getByStatus('do');
      expect(result).toEqual([]);
    });

    it('returns multiple tasks with the same status', () => {
      taskService.create({ title: 'Another Todo', status: 'todo' });
      const todoTasks = taskService.getByStatus('todo');
      expect(todoTasks).toHaveLength(2);
    });
  });

  // Bug D2 regression: verifies 1-based offset calculation ((page - 1) * limit).
  describe('getPaginated()', () => {
    beforeEach(() => {
      for (let i = 1; i <= 5; i++) {
        taskService.create({ title: `Task ${i}` });
      }
    });

    it('returns the first page using 1-based indexing', () => {
      const result = taskService.getPaginated(1, 2);
      expect(result).toHaveLength(2);
      expect(result[0].title).toBe('Task 1');
      expect(result[1].title).toBe('Task 2');
    });

    it('returns the second page of results', () => {
      const result = taskService.getPaginated(2, 2);
      expect(result).toHaveLength(2);
      expect(result[0].title).toBe('Task 3');
      expect(result[1].title).toBe('Task 4');
    });

    it('returns remaining items on a partial last page', () => {
      const result = taskService.getPaginated(3, 2);
      expect(result).toHaveLength(1);
      expect(result[0].title).toBe('Task 5');
    });

    it('returns an empty array for pages beyond available data', () => {
      const result = taskService.getPaginated(10, 2);
      expect(result).toEqual([]);
    });

    it('returns all items when limit exceeds total count', () => {
      const result = taskService.getPaginated(1, 100);
      expect(result).toHaveLength(5);
    });
  });

  describe('getStats()', () => {
    it('returns zero counts when no tasks exist', () => {
      const stats = taskService.getStats();
      expect(stats).toEqual({
        todo: 0,
        in_progress: 0,
        done: 0,
        overdue: 0,
      });
    });

    it('counts tasks by status', () => {
      taskService.create({ title: 'T1', status: 'todo' });
      taskService.create({ title: 'T2', status: 'todo' });
      taskService.create({ title: 'T3', status: 'in_progress' });
      taskService.create({ title: 'T4', status: 'done' });

      const stats = taskService.getStats();
      expect(stats.todo).toBe(2);
      expect(stats.in_progress).toBe(1);
      expect(stats.done).toBe(1);
    });

    it('counts overdue tasks when due date is past and status is not done', () => {
      taskService.create({
        title: 'Overdue Task',
        status: 'todo',
        dueDate: '2020-01-01T00:00:00.000Z',
      });

      const stats = taskService.getStats();
      expect(stats.overdue).toBe(1);
    });

    it('does not count done tasks as overdue even with past due date', () => {
      taskService.create({
        title: 'Done Overdue',
        status: 'done',
        dueDate: '2020-01-01T00:00:00.000Z',
      });

      const stats = taskService.getStats();
      expect(stats.overdue).toBe(0);
    });

    it('does not count tasks without a due date as overdue', () => {
      taskService.create({ title: 'No Due Date', status: 'todo' });

      const stats = taskService.getStats();
      expect(stats.overdue).toBe(0);
    });

    it('does not count tasks with future due dates as overdue', () => {
      taskService.create({
        title: 'Future Task',
        status: 'todo',
        dueDate: '2099-12-31T00:00:00.000Z',
      });

      const stats = taskService.getStats();
      expect(stats.overdue).toBe(0);
    });
  });

  describe('update()', () => {
    it('updates specified fields on an existing task', () => {
      const task = taskService.create({ title: 'Original' });
      const updated = taskService.update(task.id, { title: 'Updated' });

      expect(updated.title).toBe('Updated');
      expect(updated.id).toBe(task.id);
    });

    it('returns null when updating a non-existent task', () => {
      const result = taskService.update('non-existent', { title: 'Nope' });
      expect(result).toBeNull();
    });

    it('preserves unmodified fields during partial update', () => {
      const task = taskService.create({
        title: 'Original',
        description: 'Keep me',
        priority: 'high',
      });

      const updated = taskService.update(task.id, { title: 'Changed' });

      expect(updated.title).toBe('Changed');
      expect(updated.description).toBe('Keep me');
      expect(updated.priority).toBe('high');
      expect(updated.createdAt).toBe(task.createdAt);
    });

    it('persists updates in the store', () => {
      const task = taskService.create({ title: 'Original' });
      taskService.update(task.id, { title: 'Persisted' });

      const found = taskService.findById(task.id);
      expect(found.title).toBe('Persisted');
    });

    // Bug D4 documentation: update() allows overwriting system fields like id via object spread.
    it('allows overwriting fields via spread (known limitation D4)', () => {
      const task = taskService.create({ title: 'Original' });
      const originalId = task.id;
      const updated = taskService.update(originalId, { id: 'hijacked' });

      expect(updated.id).toBe('hijacked');
    });
  });

  describe('remove()', () => {
    it('removes an existing task and returns true', () => {
      const task = taskService.create({ title: 'Delete Me' });
      const result = taskService.remove(task.id);

      expect(result).toBe(true);
      expect(taskService.getAll()).toHaveLength(0);
    });

    it('returns false when removing a non-existent ID', () => {
      expect(taskService.remove('non-existent')).toBe(false);
    });

    it('ensures removed task can no longer be retrieved', () => {
      const task = taskService.create({ title: 'Soon Gone' });
      taskService.remove(task.id);

      expect(taskService.findById(task.id)).toBeUndefined();
    });
  });

  // Bug D3 regression: verifies original priority is preserved when completing a task.
  describe('completeTask()', () => {
    it('sets status to done', () => {
      const task = taskService.create({ title: 'Complete Me' });
      const completed = taskService.completeTask(task.id);

      expect(completed.status).toBe('done');
    });

    it('sets completedAt to an ISO timestamp', () => {
      const task = taskService.create({ title: 'Complete Me' });
      const before = new Date().toISOString();
      const completed = taskService.completeTask(task.id);
      const after = new Date().toISOString();

      expect(completed.completedAt).toBeDefined();
      expect(completed.completedAt).not.toBeNull();
      expect(completed.completedAt >= before).toBe(true);
      expect(completed.completedAt <= after).toBe(true);
    });

    it('preserves the original priority instead of resetting it', () => {
      const task = taskService.create({ title: 'High Priority', priority: 'high' });
      const completed = taskService.completeTask(task.id);

      expect(completed.priority).toBe('high');
    });

    it('returns null when completing a non-existent ID', () => {
      expect(taskService.completeTask('non-existent')).toBeNull();
    });

    it('persists completion status in the store', () => {
      const task = taskService.create({ title: 'Persist Completion' });
      taskService.completeTask(task.id);

      const found = taskService.findById(task.id);
      expect(found.status).toBe('done');
      expect(found.completedAt).not.toBeNull();
    });
  });

  describe('assignTask()', () => {
    it('assigns a name to an existing task', () => {
      const task = taskService.create({ title: 'Assign Me' });
      const assigned = taskService.assignTask(task.id, 'Alice');

      expect(assigned.assignee).toBe('Alice');
      expect(assigned.id).toBe(task.id);
      expect(assigned.title).toBe('Assign Me');
    });

    it('returns null when assigning a non-existent ID', () => {
      expect(taskService.assignTask('non-existent', 'Alice')).toBeNull();
    });

    it('replaces existing assignee on reassignment', () => {
      const task = taskService.create({ title: 'Reassign Me' });
      taskService.assignTask(task.id, 'Alice');
      const reassigned = taskService.assignTask(task.id, 'Bob');

      expect(reassigned.assignee).toBe('Bob');
    });

    it('persists assignment in the store', () => {
      const task = taskService.create({ title: 'Persist Assignment' });
      taskService.assignTask(task.id, 'Alice');

      const found = taskService.findById(task.id);
      expect(found.assignee).toBe('Alice');
    });

    it('preserves all other fields when assigning', () => {
      const task = taskService.create({
        title: 'Keep Fields',
        description: 'Important',
        priority: 'high',
      });
      const assigned = taskService.assignTask(task.id, 'Alice');

      expect(assigned.title).toBe('Keep Fields');
      expect(assigned.description).toBe('Important');
      expect(assigned.priority).toBe('high');
      expect(assigned.createdAt).toBe(task.createdAt);
    });
  });
});
