const request = require('supertest');
const app = require('../../src/app');
const taskService = require('../../src/services/taskService');
const { daysFromNow, makeTaskInput } = require('../helpers/factories');

// `it.failing` = documents a known bug (see BUGS.md). Flip to `it` once fixed.

const createTask = async (overrides) => {
  const res = await request(app).post('/tasks').send(makeTaskInput(overrides));
  return res.body;
};

beforeEach(() => {
  taskService._reset();
});

describe('POST /tasks', () => {
  it('creates a task and returns 201 with the full task shape', async () => {
    const res = await request(app).post('/tasks').send({ title: 'Write tests', priority: 'high' });

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({
      title: 'Write tests',
      description: '',
      status: 'todo',
      priority: 'high',
      dueDate: null,
      completedAt: null,
    });
    expect(res.body.id).toEqual(expect.any(String));
    expect(res.body.createdAt).toEqual(expect.any(String));
  });

  it('persists the task so it appears in GET /tasks', async () => {
    const created = await createTask({ title: 'Persist me' });
    const list = await request(app).get('/tasks');
    expect(list.body.map((t) => t.id)).toContain(created.id);
  });

  it.each([
    ['missing title', {}],
    ['empty title', { title: '' }],
    ['whitespace-only title', { title: '   ' }],
    ['non-string title', { title: 123 }],
    ['invalid status', { title: 'x', status: 'pending' }],
    ['invalid priority', { title: 'x', priority: 'urgent' }],
    ['invalid dueDate', { title: 'x', dueDate: 'not-a-date' }],
  ])('returns 400 for %s', async (_label, body) => {
    const res = await request(app).post('/tasks').send(body);
    expect(res.status).toBe(400);
    expect(res.body.error).toEqual(expect.any(String));
  });

  // BUG-7: body-parser errors fall into the catch-all handler and become 500
  it.failing('returns 400 (not 500) for malformed JSON', async () => {
    jest.spyOn(console, 'error').mockImplementation(() => {});
    const res = await request(app)
      .post('/tasks')
      .set('Content-Type', 'application/json')
      .send('{"title": ');
    console.error.mockRestore();

    expect(res.status).toBe(400);
  });
});

describe('GET /tasks', () => {
  it('returns an empty array when there are no tasks', async () => {
    const res = await request(app).get('/tasks');
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  it('returns all tasks', async () => {
    await createTask({ title: 'A' });
    await createTask({ title: 'B' });
    const res = await request(app).get('/tasks');
    expect(res.body).toHaveLength(2);
  });

  describe('?status filter', () => {
    beforeEach(async () => {
      await createTask({ title: 'T', status: 'todo' });
      await createTask({ title: 'P', status: 'in_progress' });
      await createTask({ title: 'D', status: 'done' });
    });

    it('returns only tasks with the requested status', async () => {
      const res = await request(app).get('/tasks?status=in_progress');
      expect(res.body.map((t) => t.title)).toEqual(['P']);
    });

    it('returns an empty array for a status with no tasks', async () => {
      const res = await request(app).get('/tasks?status=unknown');
      expect(res.status).toBe(200);
      expect(res.body).toEqual([]);
    });

    // BUG-1
    it.failing('does not match partial status values', async () => {
      const res = await request(app).get('/tasks?status=do');
      expect(res.body).toEqual([]);
    });
  });

  describe('pagination', () => {
    beforeEach(async () => {
      for (let i = 1; i <= 5; i++) await createTask({ title: `T${i}` });
    });

    // BUG-2 (FIXED)
    it('page=1&limit=2 returns the first two tasks', async () => {
      const res = await request(app).get('/tasks?page=1&limit=2');
      expect(res.body.map((t) => t.title)).toEqual(['T1', 'T2']);
    });

    it('page=2&limit=2 returns the next two tasks', async () => {
      const res = await request(app).get('/tasks?page=2&limit=2');
      expect(res.body.map((t) => t.title)).toEqual(['T3', 'T4']);
    });

    it('returns an empty array for a page beyond the last', async () => {
      const res = await request(app).get('/tasks?page=99&limit=2');
      expect(res.status).toBe(200);
      expect(res.body).toEqual([]);
    });

    it('uses defaults (page 1, limit 10) when only one param is given', async () => {
      const res = await request(app).get('/tasks?page=1');
      expect(res.body).toHaveLength(5);
    });

    // BUG-4: no validation of page/limit
    it.failing('rejects a negative limit with 400', async () => {
      const res = await request(app).get('/tasks?page=1&limit=-1');
      expect(res.status).toBe(400);
    });

    it.failing('rejects page=0 with 400', async () => {
      const res = await request(app).get('/tasks?page=0&limit=2');
      expect(res.status).toBe(400);
    });

    // BUG-8: `status` short-circuits, pagination silently ignored
    it.failing('applies pagination together with the status filter', async () => {
      const res = await request(app).get('/tasks?status=todo&page=1&limit=2');
      expect(res.body).toHaveLength(2);
    });
  });
});

describe('PUT /tasks/:id', () => {
  it('updates the given fields and returns the updated task', async () => {
    const t = await createTask({ title: 'Old', priority: 'low' });
    const res = await request(app).put(`/tasks/${t.id}`).send({ title: 'New', priority: 'high' });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ id: t.id, title: 'New', priority: 'high' });
  });

  it('persists the update', async () => {
    const t = await createTask({ title: 'Old' });
    await request(app).put(`/tasks/${t.id}`).send({ status: 'in_progress' });
    const list = await request(app).get('/tasks?status=in_progress');
    expect(list.body.map((x) => x.id)).toEqual([t.id]);
  });

  it('returns 404 for an unknown id', async () => {
    const res = await request(app).put('/tasks/nope').send({ title: 'x' });
    expect(res.status).toBe(404);
  });

  it.each([
    ['empty title', { title: '' }],
    ['invalid status', { status: 'pending' }],
    ['invalid priority', { priority: 'urgent' }],
    ['invalid dueDate', { dueDate: 'garbage' }],
  ])('returns 400 for %s', async (_label, body) => {
    const t = await createTask();
    const res = await request(app).put(`/tasks/${t.id}`).send(body);
    expect(res.status).toBe(400);
  });

  // BUG-5
  it.failing('ignores attempts to overwrite id / createdAt', async () => {
    const t = await createTask();
    const res = await request(app)
      .put(`/tasks/${t.id}`)
      .send({ id: 'hijacked', createdAt: '2000-01-01T00:00:00.000Z' });

    expect(res.body.id).toBe(t.id);
    expect(res.body.createdAt).toBe(t.createdAt);
  });
});

describe('DELETE /tasks/:id', () => {
  it('deletes the task and returns 204 with no body', async () => {
    const t = await createTask();
    const res = await request(app).delete(`/tasks/${t.id}`);

    expect(res.status).toBe(204);
    expect(res.body).toEqual({});
    expect((await request(app).get('/tasks')).body).toEqual([]);
  });

  it('returns 404 for an unknown id', async () => {
    const res = await request(app).delete('/tasks/nope');
    expect(res.status).toBe(404);
  });

  it('returns 404 when deleting the same task twice', async () => {
    const t = await createTask();
    await request(app).delete(`/tasks/${t.id}`);
    const res = await request(app).delete(`/tasks/${t.id}`);
    expect(res.status).toBe(404);
  });
});

describe('PATCH /tasks/:id/complete', () => {
  it('marks the task done and sets completedAt', async () => {
    const t = await createTask();
    const res = await request(app).patch(`/tasks/${t.id}/complete`);

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('done');
    expect(res.body.completedAt).toEqual(expect.any(String));
  });

  it('returns 404 for an unknown id', async () => {
    const res = await request(app).patch('/tasks/nope/complete');
    expect(res.status).toBe(404);
  });

  // BUG-3
  it.failing('keeps the original priority', async () => {
    const t = await createTask({ priority: 'high' });
    const res = await request(app).patch(`/tasks/${t.id}/complete`);
    expect(res.body.priority).toBe('high');
  });

  // BUG-6
  it.failing('keeps the original completedAt when completed twice', async () => {
    const t = await createTask();
    const first = await request(app).patch(`/tasks/${t.id}/complete`);
    await new Promise((r) => setTimeout(r, 5));
    const second = await request(app).patch(`/tasks/${t.id}/complete`);
    expect(second.body.completedAt).toBe(first.body.completedAt);
  });
});

describe('GET /tasks/stats', () => {
  it('is not shadowed by the /:id routes and returns zeros when empty', async () => {
    const res = await request(app).get('/tasks/stats');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ todo: 0, in_progress: 0, done: 0, overdue: 0 });
  });

  it('returns counts by status and the overdue count', async () => {
    await createTask({ status: 'todo', dueDate: daysFromNow(-2) });
    await createTask({ status: 'in_progress' });
    await createTask({ status: 'done', dueDate: daysFromNow(-2) });

    const res = await request(app).get('/tasks/stats');
    expect(res.body).toEqual({ todo: 1, in_progress: 1, done: 1, overdue: 1 });
  });
});