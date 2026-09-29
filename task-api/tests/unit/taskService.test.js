const taskService = require('../../src/services/taskService');
const { daysFromNow, makeTaskInput } = require('../helpers/factories');

// NOTE ON `it.failing`:
// Tests marked `it.failing` assert the CORRECT behaviour for a known bug (see BUGS.md).
// They pass while the bug exists (Jest expects them to fail). Once the bug is fixed,
// Jest will report them as failing -> just change `it.failing` to `it`.

beforeEach(() => {
  taskService._reset();
});

describe('taskService.create', () => {
  it('creates a task with defaults applied', () => {
    const task = taskService.create({ title: 'A' });

    expect(task).toMatchObject({
      title: 'A',
      description: '',
      status: 'todo',
      priority: 'medium',
      dueDate: null,
      completedAt: null,
    });
    expect(typeof task.id).toBe('string');
    expect(new Date(task.createdAt).toISOString()).toBe(task.createdAt);
  });

  it('respects explicitly provided fields', () => {
    const due = daysFromNow(3);
    const task = taskService.create(
      makeTaskInput({ description: 'd', status: 'in_progress', priority: 'high', dueDate: due })
    );

    expect(task).toMatchObject({ description: 'd', status: 'in_progress', priority: 'high', dueDate: due });
  });

  it('generates a unique id for every task', () => {
    const a = taskService.create(makeTaskInput());
    const b = taskService.create(makeTaskInput());
    expect(a.id).not.toBe(b.id);
  });
});

describe('taskService.getAll / findById', () => {
  it('returns an empty array when there are no tasks', () => {
    expect(taskService.getAll()).toEqual([]);
  });

  it('returns all created tasks', () => {
    taskService.create(makeTaskInput({ title: 'A' }));
    taskService.create(makeTaskInput({ title: 'B' }));
    expect(taskService.getAll().map((t) => t.title)).toEqual(['A', 'B']);
  });

  it('returns a copy of the list, so callers cannot empty the store', () => {
    taskService.create(makeTaskInput());
    taskService.getAll().length = 0;
    expect(taskService.getAll()).toHaveLength(1);
  });

  it('findById returns the task, or undefined when missing', () => {
    const t = taskService.create(makeTaskInput());
    expect(taskService.findById(t.id)).toEqual(t);
    expect(taskService.findById('nope')).toBeUndefined();
  });
});

describe('taskService.getByStatus', () => {
  beforeEach(() => {
    taskService.create(makeTaskInput({ title: 'T1', status: 'todo' }));
    taskService.create(makeTaskInput({ title: 'P1', status: 'in_progress' }));
    taskService.create(makeTaskInput({ title: 'D1', status: 'done' }));
  });

  it('returns only tasks with the exact status', () => {
    expect(taskService.getByStatus('todo').map((t) => t.title)).toEqual(['T1']);
    expect(taskService.getByStatus('done').map((t) => t.title)).toEqual(['D1']);
  });

  it('returns an empty array for a status nobody has', () => {
    expect(taskService.getByStatus('unknown')).toEqual([]);
  });

  // BUG-1: uses String.includes -> substring matching
  it.failing('does not match partial status strings (e.g. "do" must not match "todo"/"done")', () => {
    expect(taskService.getByStatus('do')).toEqual([]);
  });
});

describe('taskService.getPaginated', () => {
  beforeEach(() => {
    for (let i = 1; i <= 5; i++) taskService.create(makeTaskInput({ title: `T${i}` }));
  });

  // BUG-2 (FIXED in this submission): offset was page * limit instead of (page - 1) * limit
  it('page 1 returns the first `limit` tasks', () => {
    expect(taskService.getPaginated(1, 2).map((t) => t.title)).toEqual(['T1', 'T2']);
  });

  it('page 2 returns the next slice', () => {
    expect(taskService.getPaginated(2, 2).map((t) => t.title)).toEqual(['T3', 'T4']);
  });

  it('last page may be partial', () => {
    expect(taskService.getPaginated(3, 2).map((t) => t.title)).toEqual(['T5']);
  });

  it('returns an empty array for a page past the end', () => {
    expect(taskService.getPaginated(10, 2)).toEqual([]);
  });
});

describe('taskService.getStats', () => {
  it('returns zeros when empty', () => {
    expect(taskService.getStats()).toEqual({ todo: 0, in_progress: 0, done: 0, overdue: 0 });
  });

  it('counts tasks by status', () => {
    taskService.create(makeTaskInput({ status: 'todo' }));
    taskService.create(makeTaskInput({ status: 'todo' }));
    taskService.create(makeTaskInput({ status: 'in_progress' }));
    taskService.create(makeTaskInput({ status: 'done' }));

    expect(taskService.getStats()).toMatchObject({ todo: 2, in_progress: 1, done: 1 });
  });

  it('counts unfinished tasks with a past due date as overdue', () => {
    taskService.create(makeTaskInput({ status: 'todo', dueDate: daysFromNow(-1) }));
    taskService.create(makeTaskInput({ status: 'in_progress', dueDate: daysFromNow(-5) }));

    expect(taskService.getStats().overdue).toBe(2);
  });

  it('does not count done tasks, future tasks, or tasks without a due date as overdue', () => {
    taskService.create(makeTaskInput({ status: 'done', dueDate: daysFromNow(-1) }));
    taskService.create(makeTaskInput({ status: 'todo', dueDate: daysFromNow(2) }));
    taskService.create(makeTaskInput({ status: 'todo', dueDate: null }));

    expect(taskService.getStats().overdue).toBe(0);
  });
});

describe('taskService.update', () => {
  it('merges the given fields into the task and persists them', () => {
    const t = taskService.create(makeTaskInput({ priority: 'low' }));
    const updated = taskService.update(t.id, { title: 'New', priority: 'high' });

    expect(updated).toMatchObject({ id: t.id, title: 'New', priority: 'high' });
    expect(taskService.findById(t.id)).toEqual(updated);
  });

  it('leaves untouched fields alone', () => {
    const t = taskService.create(makeTaskInput({ description: 'keep me' }));
    expect(taskService.update(t.id, { title: 'New' }).description).toBe('keep me');
  });

  it('returns null for an unknown id', () => {
    expect(taskService.update('nope', { title: 'x' })).toBeNull();
  });

  // BUG-5: fields are spread blindly, so system-managed fields can be overwritten
  it.failing('does not allow overwriting id or createdAt', () => {
    const t = taskService.create(makeTaskInput());
    const updated = taskService.update(t.id, { id: 'hijacked', createdAt: '2000-01-01T00:00:00.000Z' });

    expect(updated.id).toBe(t.id);
    expect(updated.createdAt).toBe(t.createdAt);
  });
});

describe('taskService.remove', () => {
  it('removes an existing task and returns true', () => {
    const t = taskService.create(makeTaskInput());
    expect(taskService.remove(t.id)).toBe(true);
    expect(taskService.getAll()).toEqual([]);
  });

  it('returns false for an unknown id', () => {
    expect(taskService.remove('nope')).toBe(false);
  });
});

describe('taskService.completeTask', () => {
  it('marks the task done and sets completedAt', () => {
    const t = taskService.create(makeTaskInput());
    const before = Date.now();
    const done = taskService.completeTask(t.id);

    expect(done.status).toBe('done');
    expect(new Date(done.completedAt).getTime()).toBeGreaterThanOrEqual(before);
    expect(taskService.findById(t.id).status).toBe('done');
  });

  it('returns null for an unknown id', () => {
    expect(taskService.completeTask('nope')).toBeNull();
  });

  // BUG-3: priority is hard-coded to 'medium' on completion
  it.failing('preserves the existing priority', () => {
    const t = taskService.create(makeTaskInput({ priority: 'high' }));
    expect(taskService.completeTask(t.id).priority).toBe('high');
  });

  // BUG-6: completing twice overwrites the original completion time
  it.failing('does not overwrite completedAt when the task is already done', async () => {
    const t = taskService.create(makeTaskInput());
    const first = taskService.completeTask(t.id);
    await new Promise((r) => setTimeout(r, 5));
    const second = taskService.completeTask(t.id);

    expect(second.completedAt).toBe(first.completedAt);
  });
});