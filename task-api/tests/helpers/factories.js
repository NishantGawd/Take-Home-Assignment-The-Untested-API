// Shared helpers so tests stay short and readable.

const DAY_MS = 24 * 60 * 60 * 1000;

/** ISO string N days from now (negative = in the past). No fake timers needed. */
const daysFromNow = (days) => new Date(Date.now() + days * DAY_MS).toISOString();

/** Valid create-payload with sensible defaults; override any field. */
const makeTaskInput = (overrides = {}) => ({
  title: 'Write tests',
  ...overrides,
});

module.exports = { daysFromNow, makeTaskInput };