import assert from 'node:assert/strict';

const baseURL = process.env.FAMILY_PLAN_TEST_URL;
if (!baseURL || !['localhost', 'mom.localhost', '127.0.0.1'].includes(new URL(baseURL).hostname)) {
  throw new Error('Set FAMILY_PLAN_TEST_URL to an isolated local test environment');
}
let headers;
let childId;
const controller = new AbortController();
const timer = setTimeout(() => controller.abort(), 75000);

async function send(method, path, data) {
  const response = await fetch(`${baseURL}/api/v1${path}`, {
    method, headers: { 'Content-Type': 'application/json', ...headers },
    body: data === undefined ? undefined : JSON.stringify(data),
  });
  assert.ok(response.ok, `${method} ${path}: ${response.status}`);
  return response.status === 204 ? null : response.json();
}

try {
  const auth = await send('POST', '/auth/register', {
    username: `stream${Date.now()}`, password: 'isolated-test-pass12345',
  });
  headers = { Authorization: `Bearer ${auth.token}` };
  const child = await send('POST', '/children', { name: 'SSE test child' });
  childId = child.id;
  const plan = await send('POST', '/plans', { child_id: childId, title: 'SSE test plan', start_date: new Date().toLocaleDateString('en-CA') });
  const response = await fetch(`${baseURL}/api/v1/events/parent`, { headers, signal: controller.signal });
  assert.equal(response.status, 200);
  const decoder = new TextDecoder();
  let buffer = '';
  let heartbeats = 0;
  let received = false;
  const started = Date.now();
  for await (const chunk of response.body) {
    buffer += decoder.decode(chunk, { stream: true });
    const frames = buffer.split('\n\n');
    buffer = frames.pop();
    for (const frame of frames) {
      if (frame === ': keepalive') {
        heartbeats += 1;
        if (heartbeats === 2) {
          await send('POST', `/plans/${plan.id}/daily-tasks`, {
            task_date: new Date().toLocaleDateString('en-CA'),
            tasks: [{ title: 'event after idle', expected_minutes: 10 }],
          });
        }
      }
      const payload = frame.split('\n').find(line => line.startsWith('data: '));
      if (payload) {
        const event = JSON.parse(payload.slice(6));
        if (event.reason === 'task_created' && event.child_id === childId) {
          assert.ok(heartbeats >= 2);
          received = true;
        }
      }
    }
    if (received) break;
  }
  assert.ok(received, 'No task event received after idle heartbeats');
  console.log(`SSE runtime regression passed: ${heartbeats} real 25-second heartbeats, task event after idle, elapsed ${Math.round((Date.now() - started) / 1000)}s.`);
} finally {
  clearTimeout(timer);
  controller.abort();
  if (childId) await send('DELETE', `/children/${childId}`);
}
