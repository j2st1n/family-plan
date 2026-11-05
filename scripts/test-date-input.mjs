import assert from 'node:assert/strict';
import { isValidTaskDate } from '../src/parent-web/src/utils/date.js';
import api from '../src/parent-web/src/api.js';

for (const value of ['', undefined, null, 'NaN-NaN-NaN', '2026-02-30', '2025-02-29', '0000-01-01', '10000-01-01']) {
  assert.equal(isValidTaskDate(value), false);
}
for (const value of ['0001-01-01', '2024-02-29', '2026-10-29', '9999-12-31']) {
  assert.equal(isValidTaskDate(value), true);
}
let requests = 0;
const originalFetch = globalThis.fetch;
globalThis.fetch = async () => {
  requests++;
  return { ok: false, status: 422, json: async () => ({ detail: [{ loc: ['query', 'task_date'], msg: 'invalid date' }] }) };
};
try {
  assert.throws(() => api.fetchDailyTasks('synthetic', 'synthetic-plan', ''), /有效的任务日期/);
  assert.equal(requests, 0);
  await assert.rejects(api.fetchDailyTasks('synthetic', 'synthetic-plan', '2026-10-29'), /日期无效，请重新选择日期/);
  assert.equal(requests, 1);
} finally {
  globalThis.fetch = originalFetch;
}
console.log('Date validation and API guards passed.');
