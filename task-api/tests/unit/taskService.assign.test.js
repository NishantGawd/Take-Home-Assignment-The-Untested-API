const taskService = require('../../src/services/taskService');
const { makeTaskInput } = require('../helpers/factories');

beforeEach(() => {
  taskService._reset();
});

describe('taskService.create (assignee field)', () => {
  it('new tasks start unassigned (assignee: null) so the task shape is consistent', () => {
    const task = taskService.create(makeTaskInput());
    expect(task.assignee).toBeNull();
  });
});

describe('taskService.assign', () => {
  it('stores the assignee on the task and returns the updated task', () => {
    const t = taskService.create(makeTaskInput());
    const updated = taskService.assign(t.id, 'Alice');

    expect(updated.assignee).toBe('Alice');
    expect(updated.id).toBe(t.id);
  });

  it('persists the assignee in the store', () => {
    const t = taskService.create(makeTaskInput());
    taskService.assign(t.id, 'Alice');
    expect(taskService.findById(t.id).assignee).toBe('Alice');
  });

  it('returns null when the task does not exist', () => {
    expect(taskService.assign('nope', 'Alice')).toBeNull();
  });

  it('only changes the assignee and leaves every other field alone', () => {
    const t = taskService.create(makeTaskInput({ priority: 'high', description: 'keep' }));
    const updated = taskService.assign(t.id, 'Alice');

    expect(updated).toEqual({ ...t, assignee: 'Alice' });
  });

  it('does not touch other tasks', () => {
    const a = taskService.create(makeTaskInput({ title: 'A' }));
    const b = taskService.create(makeTaskInput({ title: 'B' }));
    taskService.assign(a.id, 'Alice');

    expect(taskService.findById(b.id).assignee).toBeNull();
  });

  it('allows reassigning to a different person', () => {
    const t = taskService.create(makeTaskInput());
    taskService.assign(t.id, 'Alice');
    expect(taskService.assign(t.id, 'Bob').assignee).toBe('Bob');
  });
});