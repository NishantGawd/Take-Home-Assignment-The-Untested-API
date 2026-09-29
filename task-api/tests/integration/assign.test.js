const request = require('supertest');
const app = require('../../src/app');
const taskService = require('../../src/services/taskService');
const { makeTaskInput } = require('../helpers/factories');

const createTask = async (overrides) => {
  const res = await request(app).post('/tasks').send(makeTaskInput(overrides));
  return res.body;
};

const assign = (id, body) => request(app).patch(`/tasks/${id}/assign`).send(body);

beforeEach(() => {
  taskService._reset();
});

describe('PATCH /tasks/:id/assign', () => {
  describe('happy path', () => {
    it('assigns the task and returns the updated task with 200', async () => {
      const t = await createTask();
      const res = await assign(t.id, { assignee: 'Alice' });

      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({ id: t.id, title: t.title, assignee: 'Alice' });
    });

    it('persists the assignee (visible in a later GET /tasks)', async () => {
      const t = await createTask();
      await assign(t.id, { assignee: 'Alice' });

      const list = await request(app).get('/tasks');
      expect(list.body.find((x) => x.id === t.id).assignee).toBe('Alice');
    });

    it('leaves all other fields unchanged', async () => {
      const t = await createTask({ priority: 'high', description: 'keep me' });
      const res = await assign(t.id, { assignee: 'Alice' });

      expect(res.body).toEqual({ ...t, assignee: 'Alice' });
    });

    it('new tasks are created with assignee: null', async () => {
      const t = await createTask();
      expect(t.assignee).toBeNull();
    });

    it('trims surrounding whitespace before storing', async () => {
      const t = await createTask();
      const res = await assign(t.id, { assignee: '  Alice  ' });
      expect(res.body.assignee).toBe('Alice');
    });

    it('accepts names with spaces and non-ASCII characters', async () => {
      const t = await createTask();
      const res = await assign(t.id, { assignee: 'José Álvarez' });
      expect(res.status).toBe(200);
      expect(res.body.assignee).toBe('José Álvarez');
    });

    it('accepts a name of exactly 100 characters', async () => {
      const t = await createTask();
      const res = await assign(t.id, { assignee: 'a'.repeat(100) });
      expect(res.status).toBe(200);
    });

    it('can assign a task that is already completed', async () => {
      const t = await createTask();
      await request(app).patch(`/tasks/${t.id}/complete`);
      const res = await assign(t.id, { assignee: 'Alice' });

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('done');
    });
  });

  describe('already-assigned tasks', () => {
    it('allows reassigning to a different person (replaces the old assignee)', async () => {
      const t = await createTask();
      await assign(t.id, { assignee: 'Alice' });
      const res = await assign(t.id, { assignee: 'Bob' });

      expect(res.status).toBe(200);
      expect(res.body.assignee).toBe('Bob');
    });

    it('is idempotent: assigning the same person twice gives the same result', async () => {
      const t = await createTask();
      const first = await assign(t.id, { assignee: 'Alice' });
      const second = await assign(t.id, { assignee: 'Alice' });

      expect(second.status).toBe(200);
      expect(second.body).toEqual(first.body);
    });
  });

  describe('not found', () => {
    it('returns 404 when the task does not exist', async () => {
      const res = await assign('nope', { assignee: 'Alice' });
      expect(res.status).toBe(404);
      expect(res.body.error).toEqual(expect.any(String));
    });

    it('does not create anything when the task does not exist', async () => {
      await assign('nope', { assignee: 'Alice' });
      expect((await request(app).get('/tasks')).body).toEqual([]);
    });
  });

  describe('validation (400)', () => {
    it.each([
      ['missing assignee field', {}],
      ['empty string', { assignee: '' }],
      ['whitespace-only string', { assignee: '   ' }],
      ['null', { assignee: null }],
      ['a number', { assignee: 123 }],
      ['a boolean', { assignee: true }],
      ['an array', { assignee: ['Alice'] }],
      ['an object', { assignee: { name: 'Alice' } }],
      ['a string longer than 100 characters', { assignee: 'a'.repeat(101) }],
    ])('rejects %s', async (_label, body) => {
      const t = await createTask();
      const res = await assign(t.id, body);

      expect(res.status).toBe(400);
      expect(res.body.error).toEqual(expect.any(String));
    });

    it('rejects a request with no body at all', async () => {
      const t = await createTask();
      const res = await request(app).patch(`/tasks/${t.id}/assign`);
      expect(res.status).toBe(400);
    });

    it('does not change an existing assignee when the new value is invalid', async () => {
      const t = await createTask();
      await assign(t.id, { assignee: 'Alice' });
      await assign(t.id, { assignee: '   ' });

      const list = await request(app).get('/tasks');
      expect(list.body[0].assignee).toBe('Alice');
    });

    it('checks the body before looking up the task (400 wins over 404, same as PUT)', async () => {
      const res = await assign('nope', { assignee: '' });
      expect(res.status).toBe(400);
    });
  });
});