import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { chromium, request } from '../src/child-pwa/node_modules/playwright/index.mjs';

const baseURL = process.env.FAMILY_PLAN_TEST_URL;
if (!baseURL || !['localhost', 'mom.localhost', '127.0.0.1'].includes(new URL(baseURL).hostname)) {
  throw new Error('Set FAMILY_PLAN_TEST_URL to an isolated local test environment');
}
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const api = await request.newContext({ baseURL });
const today = new Date().toLocaleDateString('en-CA');
const childName = `Browser test ${Date.now()}`;
let childId;
let headers;
let page;

async function send(method, path, data) {
  const response = await api.fetch(`/api/v1${path}`, { method, headers, data });
  assert.ok(response.ok(), `${method} ${path}: ${response.status()} ${await response.text()}`);
  return response.status() === 204 ? null : response.json();
}

try {
  const auth = await send('POST', '/auth/register', {
    username: `browser${Date.now()}`, password: 'isolated-test-pass12345',
  });
  headers = { Authorization: `Bearer ${auth.token}` };
  const child = await send('POST', '/children', { name: childName });
  childId = child.id;
  const oldPlan = await send('POST', '/plans', { child_id: childId, title: 'Old plan', start_date: today });
  const [task] = await send('POST', `/plans/${oldPlan.id}/daily-tasks`, {
    task_date: today, tasks: [{ title: 'Cross-plan task', expected_minutes: 10 }],
  });
  await send('POST', `/plans/${oldPlan.id}/task-templates`, {
    title: 'Routine instance', expected_minutes: 10, weekdays: [],
  });
  const newerPlan = await send('POST', '/plans', { child_id: childId, title: 'New plan', start_date: today });
  assert.notEqual(oldPlan.id, newerPlan.id);
  const context = await browser.newContext({ viewport: { width: 1024, height: 768 } });
  await context.addInitScript(token => localStorage.setItem('parent_token', token), auth.token);
  page = await context.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('dialog', dialog => dialog.accept());
  await page.goto(baseURL);
  await page.getByText(childName, { exact: true }).click();
  const dailyPanel = page.getByRole('heading', { name: '当日任务', exact: true }).locator('..').locator('..');
  const routinePanel = page.getByRole('heading', { name: '重复任务', exact: true }).locator('..');
  await page.getByText('Cross-plan task', { exact: true }).waitFor();
  let card = page.locator('div').filter({ has: page.getByText('Cross-plan task', { exact: true }) })
    .filter({ has: page.getByRole('button', { name: '✎', exact: true }) }).last();
  await card.getByRole('button', { name: '✎', exact: true }).click();
  await page.getByPlaceholder('任务名 *').fill('Updated cross-plan task');
  await dailyPanel.getByLabel('预计时长').fill('22');
  await dailyPanel.getByText('分钟', { exact: true }).waitFor();
  await dailyPanel.getByLabel('奖励星星').selectOption('5');
  const saved = page.waitForResponse(response => response.request().method() === 'PATCH' && response.url().includes(task.id));
  await page.getByRole('button', { name: '保存', exact: true }).click();
  const savedResponse = await saved;
  assert.equal(savedResponse.status(), 200);
  assert.equal(savedResponse.request().postDataJSON().expected_minutes, 22);
  assert.equal(savedResponse.request().postDataJSON().reward_stars, 5);
  assert.equal((await savedResponse.json()).reward_stars, 5);
  await page.getByText('Updated cross-plan task', { exact: true }).waitFor();
  await dailyPanel.getByText('⭐5', { exact: true }).waitFor();
  await dailyPanel.getByText('22分钟', { exact: true }).waitFor();
  let failDelete = true;
  await page.route(`**/api/v1/plans/${oldPlan.id}/daily-tasks/${task.id}`, route => {
    if (route.request().method() === 'DELETE' && failDelete) {
      failDelete = false;
      return route.fulfill({ status: 500, json: { detail: { message: 'Test retry message' } } });
    }
    return route.continue();
  });
  card = page.locator('div').filter({ has: page.getByText('Updated cross-plan task', { exact: true }) })
    .filter({ has: page.getByRole('button', { name: '✕', exact: true }) }).last();
  await card.getByRole('button', { name: '✕', exact: true }).click();
  await page.getByRole('alert').filter({ hasText: 'Test retry message' }).waitFor();
  const deleted = page.waitForResponse(response => response.request().method() === 'DELETE' && response.url().includes(task.id) && response.status() === 204);
  await card.getByRole('button', { name: '✕', exact: true }).click();
  await deleted;
  await page.getByText('Updated cross-plan task', { exact: true }).waitFor({ state: 'detached' });
  await routinePanel.getByText('Routine instance', { exact: true }).waitFor();
  const routineCard = dailyPanel.locator('div').filter({ has: page.getByText('Routine instance', { exact: true }) })
    .filter({ has: page.getByRole('button', { name: '✕', exact: true }) }).last();
  await routineCard.getByRole('button', { name: '✕', exact: true }).click();
  await dailyPanel.getByText('Routine instance', { exact: true }).waitFor({ state: 'detached' });
  await page.reload();
  await page.getByText(childName, { exact: true }).click();
  await page.getByText('当天暂无任务', { exact: true }).waitFor();
  const tasks = await send('GET', `/plans/${newerPlan.id}/daily-tasks?task_date=${today}`);
  assert.deepEqual(tasks.tasks, []);
  await routinePanel.getByRole('button', { name: '✎', exact: true }).click();
  await routinePanel.getByPlaceholder('任务名 *').fill('Updated routine');
  const routineSaved = page.waitForResponse(response => response.request().method() === 'PATCH' && response.url().includes('/task-templates/'));
  await routinePanel.getByRole('button', { name: '保存', exact: true }).click();
  assert.equal((await routineSaved).status(), 200);
  await routinePanel.getByText('Updated routine', { exact: true }).waitFor();
  const routineDeleted = page.waitForResponse(response => response.request().method() === 'DELETE' && response.url().includes('/task-templates/'));
  await routinePanel.getByRole('button', { name: '✕', exact: true }).click();
  assert.equal((await routineDeleted).status(), 204);
  await routinePanel.getByText('Updated routine', { exact: true }).waitFor({ state: 'detached' });
  assert.deepEqual(errors, []);
  if (process.env.FAMILY_PLAN_TEST_SCREENSHOT) {
    await mkdir(new URL('.', `file://${process.env.FAMILY_PLAN_TEST_SCREENSHOT}`).pathname, { recursive: true });
    await page.screenshot({ path: process.env.FAMILY_PLAN_TEST_SCREENSHOT, fullPage: true });
  }
  console.log('Browser regression passed: cross-plan daily and routine edit/delete, visible retry error, routine instance deletion persists after reload, no page errors.');
  await context.close();
} catch (error) {
  if (page && !page.isClosed()) {
    await page.screenshot({ path: '/private/tmp/family-plan-browser-failure.png', fullPage: true });
    console.error('Visible alerts:', await page.getByRole('alert').allTextContents());
  }
  throw error;
} finally {
  if (childId) await send('DELETE', `/children/${childId}`);
  await api.dispose();
  await browser.close();
}
