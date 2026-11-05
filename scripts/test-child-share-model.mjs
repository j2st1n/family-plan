import assert from 'node:assert/strict';
import { createChildTaskShareSnapshot } from '../src/child-pwa/src/utils/taskShareSnapshot.js';
import { buildTaskShareModel } from '../src/shared-web/taskShareImage.js';
const data = {
  date: '2026-10-20', child: { name: '小禾', access_code: 'PRIVATE_CODE', id: 'PRIVATE_ID' },
  token: 'PRIVATE_TOKEN', rewards: { stars_total: 999, current_streak_days: 77 },
  tasks: [{ id: 'PRIVATE_TASK_ID', title: '阅读', status: 'completed', approved: true, reward_stars: 2, expected_minutes: 20, private_note: 'PRIVATE_NOTE' },
    { title: '待确认', status: 'pending', approved: false, reward_stars: 5 },
    { title: '已删除', status: 'deleted', approved: true, reward_stars: 4 }],
};
const snapshot = createChildTaskShareSnapshot(data, '缓存旧名字');
assert.equal(snapshot.date, data.date);
assert.equal(snapshot.childName, '小禾');
assert.ok(!/PRIVATE|stars_total|current_streak_days/.test(JSON.stringify(snapshot)));
const model = buildTaskShareModel(snapshot);
assert.equal(model.total, 2); assert.equal(model.completed, 1); assert.equal(model.earnedStars, 2);
data.tasks[0].title = '后来变化'; assert.equal(snapshot.tasks[0].title, '阅读');
assert.equal(buildTaskShareModel(snapshot, false).title, '每日任务记录');
assert.equal(createChildTaskShareSnapshot({ date: '', tasks: [] }), null);
assert.equal(createChildTaskShareSnapshot({ date: '2026-02-30', tasks: [] }), null);
assert.equal(createChildTaskShareSnapshot({ date: '2026-10-20' }), null);
assert.equal(buildTaskShareModel(createChildTaskShareSnapshot({ date: '2026-10-20', tasks: [] })).total, 0);
console.log('Child snapshot: authoritative date/name, whitelist, fixed copy, invalid payload, approval and empty day passed.');
