import assert from 'node:assert/strict';
import { buildTaskShareModel } from '../src/parent-web/src/utils/taskShareImage.js';

const snapshot = {
  date: '2026-10-20', childName: '小禾', generatedAt: '2026-10-30T12:00:00Z',
  token: 'PRIVATE_TOKEN', stars_total: 999,
  tasks: [
    { title: '阅读', status: 'completed', approved: true, reward_stars: 2, expected_minutes: 25 },
    { title: '口算', status: 'pending', approved: true, reward_stars: 1, scheduled_start: '10:00', scheduled_end: '10:15' },
    { title: '整理', status: 'completed', approved: true, reward_stars: 1 },
    { title: '自建', status: 'pending', approved: false, reward_stars: 5 },
    { title: '已删除不显示', status: 'deleted', approved: true, reward_stars: 4 },
  ],
};
const model = buildTaskShareModel(snapshot);
assert.equal(model.title, '小禾的任务记录');
assert.equal(model.date, '2026-10-20');
assert.equal(model.total, 4);
assert.equal(model.eligible, 3);
assert.equal(model.completed, 2);
assert.equal(model.rate, 66);
assert.equal(model.earnedStars, 3);
assert.equal(model.awaitingApproval, 1);
assert.match(model.tasks[0].details, /预计 25 分钟/);
assert.match(model.tasks[1].details, /10:00–10:15/);
assert.equal(model.tasks[3].status, '待认可');
assert.ok(!JSON.stringify(model).includes('PRIVATE_TOKEN'));
assert.ok(!JSON.stringify(model).includes('999'));
assert.ok(!JSON.stringify(model).includes('已删除不显示'));
assert.equal(buildTaskShareModel(snapshot, false).title, '每日任务记录');
const empty = buildTaskShareModel({ date: '2026-10-20', tasks: [] });
assert.equal(empty.rate, null);
assert.equal(empty.earnedStars, 0);
assert.throws(() => buildTaskShareModel({ date: '' }), /有效的任务日期/);
assert.throws(() => buildTaskShareModel({ date: '2026-02-30' }), /有效的任务日期/);
assert.equal(snapshot.tasks.length, 5);
console.log('Task share model passed: selected date, approved progress, completed rewards, hidden/deleted fields and empty day.');
