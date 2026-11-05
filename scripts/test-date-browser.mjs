import assert from 'node:assert/strict';
import { writeFile, unlink } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { createServer } from '../src/parent-web/node_modules/vite/dist/node/index.js';
import { chromium } from '../src/child-pwa/node_modules/playwright/index.mjs';

const repo = fileURLToPath(new URL('../', import.meta.url));
const root = fileURLToPath(new URL('../src/parent-web/', import.meta.url));
const harness = new URL('../src/parent-web/.date-regression.html', import.meta.url);
const baseline = process.env.FAMILY_PLAN_BASELINE === '1';
const originalModules = new Map();
if (baseline) {
  for (const relative of ['src/pages/TaskManage.jsx', 'src/api.js']) {
    originalModules.set(root + relative, execFileSync('git', ['show', `HEAD:src/parent-web/${relative}`], { cwd: repo, encoding: 'utf8' }));
  }
}
let server;
let browser;
try {
  await writeFile(harness, `<div id="root"></div><script type="module">
    import React from 'react';
    import {createRoot} from 'react-dom/client';
    import TaskManage from '/src/pages/TaskManage.jsx';
    createRoot(document.getElementById('root')).render(React.createElement(TaskManage, {
      token: 'synthetic', child: {id: 'test-child', name: '日期测试'}, isActive: false,
      onExpired: () => {}, onBack: () => {}
    }));
  </script>`);
  server = await createServer({ root, plugins: [{
    name: 'baseline-date-regression', enforce: 'pre',
    transform(code, id) { return originalModules.get(id.split('?')[0]) ?? null; },
  }], server: { host: '127.0.0.1', port: 19127, strictPort: true } });
  await server.listen();
  browser = await chromium.launch({ channel: 'chrome', headless: true });
  const page = await browser.newPage();
  const dates = [];
  const pageErrors = [];
  page.on('pageerror', error => pageErrors.push(error.message));
  let failNext = false;
  let slowRoute;
  let slowArrived;
  const slowRequest = new Promise(resolve => { slowArrived = resolve; });
  await page.route('**/api/v1/**', async route => {
    const url = new URL(route.request().url());
    if (url.pathname === '/api/v1/plans') {
      return route.fulfill({ json: [{ id: 'test-plan', status: 'active', tasks: [] }] });
    }
    if (url.pathname === '/api/v1/plans/test-plan/daily-tasks') {
      const date = url.searchParams.get('task_date');
      dates.push(date);
      if (date === '2026-07-20') { slowRoute = route; slowArrived(); return; }
      if (!date || failNext) {
        failNext = false;
        return route.fulfill({ status: 422, json: { detail: [{ loc: ['query', 'task_date'], msg: 'invalid date' }] } });
      }
      return route.fulfill({ json: {
        tasks: [{ id: 'task', plan_id: 'test-plan', title: `任务 ${date}`, status: 'pending', expected_minutes: 10, reward_stars: 1 }],
        rewards: { stars_total: 1, current_streak_days: 1 },
      } });
    }
    throw new Error(`Unexpected synthetic request: ${url.pathname}`);
  });
  await page.goto('http://127.0.0.1:19127/.date-regression.html');
  await page.getByText(/^任务 \d{4}-/).waitFor();
  const input = page.locator('input[type="date"]');
  const original = await input.inputValue();
  await input.fill('');
  assert.equal(await input.inputValue(), original, 'clearing the date must retain the previous valid selection');
  assert.ok(dates.every(date => /^\d{4}-\d{2}-\d{2}$/.test(date)), 'no blank or malformed date requests');
  failNext = true;
  await input.fill('2026-07-18');
  await page.getByRole('alert').filter({ hasText: '日期无效，请重新选择日期' }).waitFor();
  await input.fill('2026-07-19');
  await page.getByText('任务 2026-07-19', { exact: true }).waitFor();
  assert.equal(await page.getByRole('alert').count(), 0, 'successful reload clears the old error');
  await input.fill('2026-07-20');
  await slowRequest;
  await input.fill('2026-07-21');
  await page.getByText('任务 2026-07-21', { exact: true }).waitFor();
  const oldResponse = page.waitForResponse(response => response.url().includes('task_date=2026-07-20'));
  await slowRoute.fulfill({ status: 422, json: { detail: [{ loc: ['query', 'task_date'], msg: 'invalid date' }] } });
  await oldResponse;
  await page.evaluate(() => new Promise(requestAnimationFrame));
  assert.equal(await input.inputValue(), '2026-07-21');
  assert.equal(await page.getByRole('alert').count(), 0, 'stale failed response cannot replace the latest success');
  assert.equal(await page.getByText('任务 2026-07-21', { exact: true }).count(), 1);
  assert.deepEqual(pageErrors, []);
  console.log('Browser date regression passed: blank input blocked, error recovery and stale response handling.');
} finally {
  await browser?.close();
  await server?.close();
  await unlink(harness).catch(() => {});
}
