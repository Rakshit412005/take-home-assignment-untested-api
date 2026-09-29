const request = require('supertest');
const app = require('../src/app');
const taskService = require('../src/services/taskService');

describe('Task API', () => {
  beforeEach(() => {
    taskService._reset();
  });

  const createTask = (overrides = {}) =>
    request(app)
      .post('/tasks')
      .send({ title: 'Default Task', ...overrides })
      .expect(201);

  describe('POST /tasks', () => {
    it('creates a task and returns 201', async () => {
      const res = await createTask({ title: 'New Task' });

      expect(res.body).toMatchObject({
        title: 'New Task',
        description: '',
        status: 'todo',
        priority: 'medium',
        dueDate: null,
        completedAt: null,
      });
      expect(res.body.id).toBeDefined();
      expect(res.body.createdAt).toBeDefined();
    });

    it('accepts optional fields during creation', async () => {
      const res = await createTask({
        title: 'Full Task',
        description: 'A detailed description',
        status: 'in_progress',
        priority: 'high',
        dueDate: '2025-12-31T00:00:00.000Z',
      });

      expect(res.body.description).toBe('A detailed description');
      expect(res.body.status).toBe('in_progress');
      expect(res.body.priority).toBe('high');
      expect(res.body.dueDate).toBe('2025-12-31T00:00:00.000Z');
    });

    it('returns 400 when title is missing', async () => {
      const res = await request(app)
        .post('/tasks')
        .send({})
        .expect(400);

      expect(res.body.error).toBeDefined();
    });

    it('returns 400 when title is an empty string', async () => {
      const res = await request(app)
        .post('/tasks')
        .send({ title: '' })
        .expect(400);

      expect(res.body.error).toBeDefined();
    });

    it('returns 400 when title is whitespace only', async () => {
      const res = await request(app)
        .post('/tasks')
        .send({ title: '   ' })
        .expect(400);

      expect(res.body.error).toBeDefined();
    });

    it('returns 400 when title is not a string', async () => {
      const res = await request(app)
        .post('/tasks')
        .send({ title: 123 })
        .expect(400);

      expect(res.body.error).toBeDefined();
    });

    it('returns 400 for invalid status', async () => {
      const res = await request(app)
        .post('/tasks')
        .send({ title: 'Task', status: 'invalid' })
        .expect(400);

      expect(res.body.error).toContain('status');
    });

    it('returns 400 for invalid priority', async () => {
      const res = await request(app)
        .post('/tasks')
        .send({ title: 'Task', priority: 'urgent' })
        .expect(400);

      expect(res.body.error).toContain('priority');
    });

    it('returns 400 for invalid dueDate', async () => {
      const res = await request(app)
        .post('/tasks')
        .send({ title: 'Task', dueDate: 'not-a-date' })
        .expect(400);

      expect(res.body.error).toContain('dueDate');
    });
  });

  describe('GET /tasks', () => {
    it('returns an empty array when no tasks exist', async () => {
      const res = await request(app).get('/tasks').expect(200);
      expect(res.body).toEqual([]);
    });

    it('returns all created tasks', async () => {
      await createTask({ title: 'Task 1' });
      await createTask({ title: 'Task 2' });

      const res = await request(app).get('/tasks').expect(200);
      expect(res.body).toHaveLength(2);
    });
  });

  // Bug D1 regression: verifies filtering by exact status rather than substring match.
  describe('GET /tasks?status=', () => {
    beforeEach(async () => {
      await createTask({ title: 'Todo 1', status: 'todo' });
      await createTask({ title: 'Todo 2', status: 'todo' });
      await createTask({ title: 'In Progress', status: 'in_progress' });
      await createTask({ title: 'Done', status: 'done' });
    });

    it('filters tasks by exact status', async () => {
      const res = await request(app)
        .get('/tasks?status=todo')
        .expect(200);

      expect(res.body).toHaveLength(2);
      res.body.forEach((task) => {
        expect(task.status).toBe('todo');
      });
    });

    it('returns an empty array for non-matching status', async () => {
      const res = await request(app)
        .get('/tasks?status=nonexistent')
        .expect(200);

      expect(res.body).toEqual([]);
    });

    it('does not return substring status matches', async () => {
      const res = await request(app)
        .get('/tasks?status=do')
        .expect(200);

      expect(res.body).toEqual([]);
    });
  });

  // Bug D2 regression: verifies 1-based pagination offset calculation.
  describe('GET /tasks?page=&limit=', () => {
    beforeEach(async () => {
      for (let i = 1; i <= 5; i++) {
        await createTask({ title: `Task ${i}` });
      }
    });

    it('returns the first page of results', async () => {
      const res = await request(app)
        .get('/tasks?page=1&limit=2')
        .expect(200);

      expect(res.body).toHaveLength(2);
      expect(res.body[0].title).toBe('Task 1');
      expect(res.body[1].title).toBe('Task 2');
    });

    it('returns the second page of results', async () => {
      const res = await request(app)
        .get('/tasks?page=2&limit=2')
        .expect(200);

      expect(res.body).toHaveLength(2);
      expect(res.body[0].title).toBe('Task 3');
      expect(res.body[1].title).toBe('Task 4');
    });

    it('returns an empty array for pages beyond available data', async () => {
      const res = await request(app)
        .get('/tasks?page=100&limit=10')
        .expect(200);

      expect(res.body).toEqual([]);
    });

    it('defaults to page 1 and limit 10', async () => {
      const res = await request(app)
        .get('/tasks?page=1')
        .expect(200);

      expect(res.body).toHaveLength(5);
    });
  });

  describe('GET /tasks/stats', () => {
    it('returns zero counts when no tasks exist', async () => {
      const res = await request(app).get('/tasks/stats').expect(200);

      expect(res.body).toEqual({
        todo: 0,
        in_progress: 0,
        done: 0,
        overdue: 0,
      });
    });

    it('returns task counts by status', async () => {
      await createTask({ title: 'T1', status: 'todo' });
      await createTask({ title: 'T2', status: 'in_progress' });
      await createTask({ title: 'T3', status: 'done' });
      await createTask({ title: 'T4', status: 'todo' });

      const res = await request(app).get('/tasks/stats').expect(200);

      expect(res.body.todo).toBe(2);
      expect(res.body.in_progress).toBe(1);
      expect(res.body.done).toBe(1);
    });

    it('counts overdue tasks correctly', async () => {
      await createTask({
        title: 'Overdue',
        status: 'todo',
        dueDate: '2020-01-01T00:00:00.000Z',
      });
      await createTask({
        title: 'Not Overdue',
        status: 'done',
        dueDate: '2020-01-01T00:00:00.000Z',
      });

      const res = await request(app).get('/tasks/stats').expect(200);

      expect(res.body.overdue).toBe(1);
    });
  });

  describe('PUT /tasks/:id', () => {
    it('updates an existing task and returns 200', async () => {
      const created = await createTask({ title: 'Original' });
      const res = await request(app)
        .put(`/tasks/${created.body.id}`)
        .send({ title: 'Updated Title' })
        .expect(200);

      expect(res.body.title).toBe('Updated Title');
      expect(res.body.id).toBe(created.body.id);
    });

    it('returns 404 for a non-existent task', async () => {
      const res = await request(app)
        .put('/tasks/non-existent-id')
        .send({ title: 'Nope' })
        .expect(404);

      expect(res.body.error).toBe('Task not found');
    });

    it('returns 400 for an empty string title on update', async () => {
      const created = await createTask({ title: 'Original' });
      await request(app)
        .put(`/tasks/${created.body.id}`)
        .send({ title: '' })
        .expect(400);
    });

    it('returns 400 for invalid status on update', async () => {
      const created = await createTask({ title: 'Original' });
      await request(app)
        .put(`/tasks/${created.body.id}`)
        .send({ status: 'invalid_status' })
        .expect(400);
    });

    it('returns 400 for invalid priority on update', async () => {
      const created = await createTask({ title: 'Original' });
      await request(app)
        .put(`/tasks/${created.body.id}`)
        .send({ priority: 'critical' })
        .expect(400);
    });

    it('preserves unmodified fields on partial update', async () => {
      const created = await createTask({
        title: 'Original',
        description: 'Keep this',
        priority: 'high',
      });

      const res = await request(app)
        .put(`/tasks/${created.body.id}`)
        .send({ title: 'New Title' })
        .expect(200);

      expect(res.body.title).toBe('New Title');
      expect(res.body.description).toBe('Keep this');
      expect(res.body.priority).toBe('high');
    });
  });

  describe('DELETE /tasks/:id', () => {
    it('deletes an existing task and returns 204', async () => {
      const created = await createTask({ title: 'Delete Me' });
      await request(app)
        .delete(`/tasks/${created.body.id}`)
        .expect(204);
    });

    it('returns 404 when deleting a non-existent task', async () => {
      await request(app)
        .delete('/tasks/non-existent-id')
        .expect(404);
    });

    it('ensures task is no longer returned after deletion', async () => {
      const created = await createTask({ title: 'Gone Soon' });
      await request(app).delete(`/tasks/${created.body.id}`).expect(204);

      const res = await request(app).get('/tasks').expect(200);
      expect(res.body).toHaveLength(0);
    });
  });

  // Bug D3 regression: verifies priority is preserved when completing a task.
  describe('PATCH /tasks/:id/complete', () => {
    it('marks a task as done and returns 200', async () => {
      const created = await createTask({ title: 'Complete Me' });
      const res = await request(app)
        .patch(`/tasks/${created.body.id}/complete`)
        .expect(200);

      expect(res.body.status).toBe('done');
      expect(res.body.completedAt).toBeDefined();
      expect(res.body.completedAt).not.toBeNull();
    });

    it('returns 404 when completing a non-existent task', async () => {
      await request(app)
        .patch('/tasks/non-existent-id/complete')
        .expect(404);
    });

    it('sets completedAt to an ISO timestamp', async () => {
      const created = await createTask({ title: 'Timestamp Check' });
      const res = await request(app)
        .patch(`/tasks/${created.body.id}/complete`)
        .expect(200);

      const completedAt = new Date(res.body.completedAt);
      expect(completedAt.toISOString()).toBe(res.body.completedAt);
    });

    it('preserves original priority on completion', async () => {
      const created = await createTask({ title: 'High Priority', priority: 'high' });
      const res = await request(app)
        .patch(`/tasks/${created.body.id}/complete`)
        .expect(200);

      expect(res.body.priority).toBe('high');
    });
  });

  describe('PATCH /tasks/:id/assign', () => {
    it('assigns a task and returns 200 with assignee', async () => {
      const created = await createTask({ title: 'Assign Me' });
      const res = await request(app)
        .patch(`/tasks/${created.body.id}/assign`)
        .send({ assignee: 'Alice' })
        .expect(200);

      expect(res.body.assignee).toBe('Alice');
      expect(res.body.id).toBe(created.body.id);
      expect(res.body.title).toBe('Assign Me');
    });

    it('returns 404 when assigning a non-existent task', async () => {
      const res = await request(app)
        .patch('/tasks/non-existent-id/assign')
        .send({ assignee: 'Alice' })
        .expect(404);

      expect(res.body.error).toBe('Task not found');
    });

    it('returns 400 when assignee is missing', async () => {
      const created = await createTask({ title: 'No Assignee' });
      const res = await request(app)
        .patch(`/tasks/${created.body.id}/assign`)
        .send({})
        .expect(400);

      expect(res.body.error).toBeDefined();
    });

    it('returns 400 when assignee is an empty string', async () => {
      const created = await createTask({ title: 'Empty Assignee' });
      await request(app)
        .patch(`/tasks/${created.body.id}/assign`)
        .send({ assignee: '' })
        .expect(400);
    });

    it('returns 400 when assignee is whitespace only', async () => {
      const created = await createTask({ title: 'Whitespace Assignee' });
      await request(app)
        .patch(`/tasks/${created.body.id}/assign`)
        .send({ assignee: '   ' })
        .expect(400);
    });

    it('returns 400 when assignee is not a string', async () => {
      const created = await createTask({ title: 'Non-String Assignee' });
      await request(app)
        .patch(`/tasks/${created.body.id}/assign`)
        .send({ assignee: 123 })
        .expect(400);
    });

    it('overwrites previous assignee on reassignment', async () => {
      const created = await createTask({ title: 'Reassign Me' });
      await request(app)
        .patch(`/tasks/${created.body.id}/assign`)
        .send({ assignee: 'Alice' })
        .expect(200);

      const res = await request(app)
        .patch(`/tasks/${created.body.id}/assign`)
        .send({ assignee: 'Bob' })
        .expect(200);

      expect(res.body.assignee).toBe('Bob');
    });

    it('preserves all other fields when assigning', async () => {
      const created = await createTask({
        title: 'Keep Fields',
        description: 'Important',
        priority: 'high',
      });

      const res = await request(app)
        .patch(`/tasks/${created.body.id}/assign`)
        .send({ assignee: 'Alice' })
        .expect(200);

      expect(res.body.title).toBe('Keep Fields');
      expect(res.body.description).toBe('Important');
      expect(res.body.priority).toBe('high');
    });
  });
});
