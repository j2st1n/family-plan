import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { chromium } from '../src/child-pwa/node_modules/playwright/index.mjs';

const dist = fileURLToPath(new URL('../src/child-pwa/dist/', import.meta.url));
const output = '/private/tmp/family-plan-child-share-20261030';
let browser;
const server = createServer(async (request, response) => {
  try {
    const path = new URL(request.url, 'http://localhost').pathname;
    assert.ok(path === '/' || /^\/assets\/[a-zA-Z0-9_.-]+$/.test(path));
    const data = await readFile(dist + (path === '/' ? 'index.html' : path.slice(1)));
    response.setHeader('Content-Type', path.endsWith('.js') ? 'text/javascript' : path.endsWith('.css') ? 'text/css' : path.endsWith('.json') ? 'application/json' : 'text/html');
    response.end(data);
  } catch { response.statusCode = 404; response.end(); }
});
try {
  await new Promise(resolve => server.listen(19132, '127.0.0.1', resolve));
  browser = await chromium.launch({ channel: 'chrome', headless: true });
  const page = await browser.newPage({ acceptDownloads: true }); page.setDefaultTimeout(10000);
  const errors = []; page.on('pageerror', error => errors.push(error.message));
  let failWrite = true, completed = false, expired = false, writes = 0;
  await page.addInitScript(() => {
    localStorage.setItem('device_token', 'SYNTHETIC_TOKEN'); localStorage.setItem('child_profile', JSON.stringify({ id: 'child', name: '小禾' }));
    window.__created = []; window.__revoked = [];
    const createURL = URL.createObjectURL.bind(URL), revokeURL = URL.revokeObjectURL.bind(URL);
    URL.createObjectURL = blob => { const url = createURL(blob); window.__created.push(url); return url; };
    URL.revokeObjectURL = url => { window.__revoked.push(url); revokeURL(url); };
    Object.defineProperty(navigator, 'canShare', { configurable: true, value: () => false });
    const original = window.fetch;
    window.fetch = (input, options) => {
      if (String(input) !== '/api/v1/child/events') return original(input, options);
      return Promise.resolve(new Response(new ReadableStream({ start(controller) { options.signal.addEventListener('abort', () => { try { controller.close(); } catch {} }); } }), { headers: { 'Content-Type': 'text/event-stream' } }));
    };
  });
  await page.route('https://**/*', route => route.abort());
  await page.route('**/api/v1/**', async route => {
    const request = route.request(), path = new URL(request.url()).pathname;
    if (path === '/api/v1/child/today') return expired ? route.fulfill({ status: 401, json: {} }) : route.fulfill({ json: {
      date: '2026-10-20', child: { name: '小禾' }, tasks: [{ id: 'task', title: '正式构建合成任务', status: completed ? 'completed' : 'pending', created_by: 'parent', approved: true, expected_minutes: 10, reward_stars: 2 }], rewards: { stars_total: completed ? 2 : 0 },
    } });
    if (path === '/api/v1/child/shop/items') return route.fulfill({ json: [] });
    assert.equal(path, '/api/v1/child/tasks/task/complete'); assert.equal(request.method(), 'PATCH'); assert.deepEqual(request.postDataJSON(), { feedback: 'easy' }); writes++;
    await new Promise(resolve => setTimeout(resolve, 300));
    if (failWrite) return route.fulfill({ status: 500, json: {} });
    completed = true; return route.fulfill({ json: { stars_awarded: 2 } });
  });
  const share = page.getByRole('button', { name: '分享图片', exact: true }), dialog = page.getByRole('dialog', { name: '分享任务图片' });
  const ready = async () => { await share.waitFor(); await page.waitForFunction(() => [...document.querySelectorAll('button')].some(b => b.textContent.trim() === '分享图片' && !b.disabled)); };
  await page.goto('http://127.0.0.1:19132/'); await ready(); await page.waitForTimeout(1000); await ready();
  await page.getByRole('button', { name: '完成', exact: true }).click(); assert.equal(await share.isDisabled(), true);
  await page.getByText('操作失败，请重试', { exact: true }).waitFor(); assert.equal(await share.count(), 0); assert.equal(writes, 1);
  await page.getByRole('button', { name: '重试', exact: true }).click(); await ready(); failWrite = false;
  await page.getByRole('button', { name: '完成', exact: true }).click(); await ready(); assert.equal(writes, 2); assert.equal(completed, true);
  await share.click(); await dialog.getByRole('img').waitFor(); await dialog.getByRole('img').evaluate(img => img.decode());
  assert.equal(await dialog.getByRole('button', { name: '系统分享', exact: true }).count(), 0);
  const event = page.waitForEvent('download'); await dialog.getByRole('button', { name: '保存图片', exact: true }).click(); const download = await event;
  assert.equal(download.suggestedFilename(), 'family-plan-2026-10-20.png'); const path = await download.path(); const png = await readFile(path);
  assert.deepEqual([...png.subarray(0, 8)], [137,80,78,71,13,10,26,10]); assert.equal(png.readUInt32BE(16), 1080);
  expired = true; await page.evaluate(() => window.dispatchEvent(new Event('focus')));
  await page.getByRole('button', { name: '绑定', exact: true }).waitFor(); assert.equal(await dialog.count(), 0);
  const cleanup = await page.evaluate(() => ({ token: localStorage.getItem('device_token'), profile: localStorage.getItem('child_profile'), overflow: document.body.style.overflow, urlsRevoked: window.__created.every(url => window.__revoked.includes(url)) }));
  assert.deepEqual(cleanup, { token: null, profile: null, overflow: '', urlsRevoked: true }); assert.deepEqual(errors, []);
  const result = { result: 'passed', compiledProductionAppAndStrictMode: true, actualPngDownload: true, pngWidth: png.readUInt32BE(16), failurePreventedShare: true, completionRetryPassed: true, mutationPayloadUnchanged: true, expirationRemovedPreviewAndCredentials: true, allUrlsRevoked: true, noPageErrors: true, nativeDeliveryNotInvoked: true };
  await writeFile(output + '/production-verification.json', JSON.stringify(result, null, 2)); console.log(JSON.stringify(result));
} finally { await browser?.close(); await new Promise(resolve => server.close(resolve)); }
