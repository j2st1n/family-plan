import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { createChildTaskShareSnapshot } from '../src/child-pwa/src/utils/taskShareSnapshot.js';
import { buildTaskShareModel } from '../src/shared-web/taskShareImage.js';

// Only use the credential-free fixture generated in the isolated synthetic DB.
const path = process.env.FAMILY_PLAN_SYNTHETIC_FIXTURE || '/private/tmp/family-plan-child-share-20261030/api-fixture.json';
const fixture = JSON.parse(await readFile(path, 'utf8'));
assert.equal(fixture.child.name, 'Synthetic Share');
const snapshot = createChildTaskShareSnapshot(fixture);
assert.equal(snapshot.date, fixture.date);
assert.ok(!/device_token|access_code|stars_total|current_streak_days/.test(JSON.stringify(snapshot)));
const model = buildTaskShareModel(snapshot);
assert.equal(model.total, 4); assert.equal(model.eligible, 3); assert.equal(model.completed, 2);
assert.equal(model.awaitingApproval, 1); assert.equal(model.rate, 66); assert.equal(model.earnedStars, 3);
assert.ok(!model.tasks.some(task => task.title === 'Remove me'));
assert.ok(model.tasks.some(task => task.details.includes('18:00–18:10')));
const result = { result: 'passed', isolatedRealApiToActualJsAdapter: true, apiDateCopiedExactly: true, total: model.total, eligible: model.eligible, completed: model.completed, pendingApproval: model.awaitingApproval, rate: model.rate, earnedStars: model.earnedStars, schedulePreserved: true, deletedExcluded: true, noPrivateFields: true };
await writeFile('/private/tmp/family-plan-child-share-20261030/api-adapter-verification.json', JSON.stringify(result, null, 2));
console.log(JSON.stringify(result));
