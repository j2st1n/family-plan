import assert from 'node:assert/strict';
import { mkdir, writeFile, unlink, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { createServer } from '../src/child-pwa/node_modules/vite/dist/node/index.js';
import { chromium } from '../src/child-pwa/node_modules/playwright/index.mjs';

const root = fileURLToPath(new URL('../src/child-pwa/', import.meta.url));
const harness = new URL('../src/child-pwa/.child-share-regression.html', import.meta.url);
const output = '/private/tmp/family-plan-child-share-20261030';
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
let server, browser;
try {
  await mkdir(output, { recursive: true });
  await writeFile(harness, `<div id="root"></div><script type="module">
    import React from 'react';import {createRoot} from 'react-dom/client';import Today from '/src/pages/Today.jsx';import '/src/index.css';
    const expired=()=>{window.__expired=true};
    createRoot(document.getElementById('root')).render(React.createElement(Today,{child:{id:'child',name:'缓存旧名字',access_code:'PRIVATE_CODE'},active:true,onExpired:expired}));</script>`);
  server = await createServer({ root, server: { host: '127.0.0.1', port: 19131, strictPort: true } }); await server.listen();
  browser = await chromium.launch({ channel: 'chrome', headless: true });
  const page = await browser.newPage({ viewport: { width: 1024, height: 850 }, acceptDownloads: true }); page.setDefaultTimeout(10000);
  const errors = [], requests = [];
  let tasks = [
    { id: 'read', title: '阅读小故事', status: 'completed', approved: true, created_by: 'parent', expected_minutes: 20, reward_stars: 2 },
    { id: 'math', title: '口算练习', status: 'pending', approved: true, created_by: 'parent', expected_minutes: 10, reward_stars: 2 },
    { id: 'tidy', title: '整理书包', status: 'completed', approved: true, created_by: 'parent', expected_minutes: 5, reward_stars: 1 },
    { id: 'wish', title: '自选练习', status: 'pending', approved: false, created_by: 'child', expected_minutes: 10, reward_stars: 5 },
  ];
  let date = '2026-10-20', failNext = false, delayNext = 0, captureNextRead, slowFinished = false;
  page.on('pageerror', error => errors.push(error.message)); page.on('dialog', dialog => dialog.accept());
  await page.addInitScript(() => {
    localStorage.setItem('device_token', 'PRIVATE_DEVICE_TOKEN');
    window.__painted = []; window.__urls = []; window.__revoked = []; window.__shares = []; window.__nativeSupported = true; window.__shareMode = 'success';
    const fillText = CanvasRenderingContext2D.prototype.fillText;
    CanvasRenderingContext2D.prototype.fillText = function(value, ...args) { window.__painted.push(String(value)); return fillText.call(this, value, ...args); };
    const createURL = URL.createObjectURL.bind(URL), revokeURL = URL.revokeObjectURL.bind(URL);
    URL.createObjectURL = blob => { const url = createURL(blob); if (blob.type === 'image/png') window.__urls.push(url); return url; };
    URL.revokeObjectURL = url => { window.__revoked.push(url); revokeURL(url); };
    Object.defineProperty(navigator, 'canShare', { configurable: true, value: ({files}) => window.__nativeSupported && files.length > 0 });
    Object.defineProperty(navigator, 'share', { configurable: true, value: async ({files}) => {
      window.__shares.push(files.map(file => ({ name: file.name, size: file.size, type: file.type })));
      if (window.__shareMode === 'abort') throw new DOMException('cancelled', 'AbortError');
      if (window.__shareMode === 'error') throw new DOMException('failed', 'DataError');
    } });
    const nativeFetch = window.fetch;
    window.fetch = (input, options) => {
      if (String(input) !== '/api/v1/child/events') return nativeFetch(input, options);
      return Promise.resolve(new Response(new ReadableStream({ start(controller) {
        window.__stream = controller; options.signal.addEventListener('abort', () => { try { controller.close(); } catch {} });
      } }), { headers: { 'Content-Type': 'text/event-stream' } }));
    };
    window.__refresh = () => window.__stream.enqueue(new TextEncoder().encode('data: {"topic":"tasks"}\n\n'));
  });
  await page.route('https://**/*', route => route.abort());
  await page.route('**/api/v1/**', async route => {
    const request = route.request(), path = new URL(request.url()).pathname, method = request.method();
    requests.push({ path, method });
    if (path === '/api/v1/child/today') {
      assert.equal(method, 'GET');
      const body = { date, child: { name: '小禾', access_code: 'PRIVATE_CODE' }, tasks: structuredClone(tasks), rewards: { stars_total: 999, current_streak_days: 77 } };
      const failure = failNext, delay = delayNext || 160; failNext = false; delayNext = 0;
      if (captureNextRead) { captureNextRead(); captureNextRead = null; }
      await wait(delay);
      if (delay === 900) slowFinished = true;
      return failure ? route.fulfill({ status: 500, json: {} }) : route.fulfill({ json: body });
    }
    await wait(350);
    const payload = method === 'DELETE' ? null : request.postDataJSON();
    if (path === '/api/v1/child/tasks' && method === 'POST') {
      tasks.push({ ...payload, id: 'created', created_by: 'child', status: 'pending', approved: false }); return route.fulfill({ json: {} });
    }
    const match = path.match(/^\/api\/v1\/child\/tasks\/([^/]+)(?:\/(complete|schedule))?$/); assert.ok(match, `Unexpected synthetic endpoint ${path}`);
    const task = tasks.find(item => item.id === match[1]); assert.ok(task);
    if (method === 'DELETE') tasks = tasks.filter(item => item.id !== task.id);
    else if (match[2] === 'complete') task.status = 'completed';
    else Object.assign(task, payload);
    return route.fulfill({ json: { stars_awarded: task.reward_stars } });
  });
  const share = page.getByRole('button', { name: '分享图片', exact: true });
  const ready = () => share.waitFor({ state: 'visible' }).then(() => page.waitForFunction(() => [...document.querySelectorAll('button')].some(b => b.textContent.trim() === '分享图片' && !b.disabled)));
  const dialog = page.getByRole('dialog', { name: '分享任务图片' }), preview = dialog.getByRole('img');
  const open = async () => { await ready(); await page.evaluate(() => { window.__painted = []; }); await share.click(); await preview.waitFor(); await preview.evaluate(img => img.decode()); };
  const close = () => dialog.getByRole('button', { name: '关闭分享预览' }).click();
  const refresh = async () => { await page.evaluate(() => window.__refresh()); await wait(1000); if (!await dialog.count()) await ready(); };
  const card = title => page.locator('p').filter({ hasText: title }).first().locator('..').locator('..');
  await page.goto('http://127.0.0.1:19131/.child-share-regression.html'); await ready(); await wait(1000); await ready();
  assert.equal(await page.getByText('阅读小故事', { exact: true }).count(), 0, 'completed list starts collapsed');
  await page.getByText('10月20日 星期二', { exact: true }).waitFor();
  const beforeShare = requests.length; await open(); assert.equal(requests.length, beforeShare);
  let painted = await page.evaluate(() => window.__painted);
  for (const value of ['小禾的任务记录', '阅读小故事', '整理书包', '口算练习', '自选练习', '2/3', '66%', '3', '待认可']) assert.ok(painted.includes(value), value);
  const canvasDateLabel = painted.find(value => /^2026 年 10 月 20 日/.test(value)); assert.ok(canvasDateLabel);
  assert.ok(!painted.some(value => /PRIVATE|缓存旧名字|^999$|^77$/.test(value)));
  const downloadEvent = page.waitForEvent('download'); await dialog.getByRole('button', { name: '保存图片', exact: true }).click();
  const download = await downloadEvent; assert.equal(download.suggestedFilename(), 'family-plan-2026-10-20.png'); await download.saveAs(output + '/child-share-example.png');
  const png = await readFile(output + '/child-share-example.png'); assert.deepEqual([...png.subarray(0, 8)], [137,80,78,71,13,10,26,10]); assert.equal(png.readUInt32BE(16), 1080);
  const beforeMutationWrites = requests.filter(item => item.method !== 'GET').length;
  await dialog.getByRole('button', { name: '系统分享', exact: true }).click(); await page.waitForFunction(() => window.__shares.length === 1);
  assert.equal(await page.evaluate(() => window.__shares[0][0].name), download.suggestedFilename());
  await page.evaluate(() => { window.__shareMode = 'abort'; }); await dialog.getByRole('button', { name: '系统分享', exact: true }).click(); assert.equal(await dialog.getByRole('alert').count(), 0);
  await page.evaluate(() => { window.__shareMode = 'error'; }); await dialog.getByRole('button', { name: '系统分享', exact: true }).click(); await dialog.getByRole('alert').waitFor();
  assert.equal(requests.filter(item => item.method !== 'GET').length, beforeMutationWrites);
  await page.setViewportSize({ width: 390, height: 844 });
  const bounds = await dialog.getByRole('button', { name: '保存图片', exact: true }).boundingBox(); assert.ok(bounds.y >= 0 && bounds.y + bounds.height <= 844);
  await page.screenshot({ path: output + '/child-preview-mobile.png' });
  const snapshotURL = await preview.getAttribute('src');
  await preview.evaluate(el => { window.__preview = el; });
  tasks[1].title = '后台更新后的口算'; await refresh();
  assert.equal(await preview.getAttribute('src'), snapshotURL); assert.equal(await preview.evaluate(el => el === window.__preview), true);
  failNext = true; await page.evaluate(() => window.__refresh()); await wait(1000);
  assert.equal(await preview.getAttribute('src'), snapshotURL, 'valid open snapshot survives background failure');
  await page.evaluate(() => { window.__painted = []; }); await dialog.getByLabel('标题显示我的姓名').uncheck();
  await page.waitForFunction(url => document.querySelector('.task-share-preview')?.src !== url, snapshotURL);
  painted = await page.evaluate(() => window.__painted); assert.ok(painted.includes('每日任务记录')); assert.ok(!painted.some(value => value.includes('小禾')));
  await close(); await page.getByText('加载失败，请重试', { exact: true }).waitFor(); assert.equal(await share.count(), 0);
  await page.getByRole('button', { name: '重试', exact: true }).click(); await ready();
  await page.setViewportSize({ width: 1024, height: 850 });
  await page.getByRole('button', { name: '完成', exact: true }).click(); assert.equal(await share.isDisabled(), true); await ready();
  await open(); painted = await page.evaluate(() => window.__painted); assert.ok(painted.includes('3/3')); assert.ok(painted.includes('100%')); assert.ok(painted.includes('5')); await close();
  await page.getByRole('button', { name: '+ 添加任务', exact: true }).click(); await page.getByPlaceholder('任务名 *', { exact: true }).fill('分享回归新任务'); await page.getByPlaceholder('分钟 *', { exact: true }).fill('12');
  await page.getByRole('button', { name: '添加', exact: true }).click(); assert.equal(await share.isDisabled(), true); await ready();
  await card('分享回归新任务').getByRole('button', { name: '修改', exact: true }).click(); await page.getByPlaceholder('任务名 *', { exact: true }).fill('分享回归修改任务');
  await page.getByRole('button', { name: '保存', exact: true }).click(); assert.equal(await share.isDisabled(), true); await ready();
  await card('分享回归修改任务').getByRole('button', { name: '删除', exact: true }).click(); assert.equal(await share.isDisabled(), true); await ready(); assert.equal(tasks.some(task => task.id === 'created'), false);
  tasks.push({ id: 'schedule', title: '安排时间回归', status: 'pending', approved: true, created_by: 'parent', reward_stars: 1 }); await refresh();
  await card('安排时间回归').getByRole('button', { name: '安排时间', exact: true }).click(); await page.locator('input[type="time"]').nth(0).fill('18:00'); await page.locator('input[type="time"]').nth(1).fill('18:10');
  await page.getByRole('button', { name: '保存', exact: true }).click(); assert.equal(await share.isDisabled(), true); await ready(); assert.equal(tasks.at(-1).scheduled_start, '18:00');
  delayNext = 900; tasks = [{ id: 'old', title: '迟到旧任务', status: 'pending', approved: true, created_by: 'parent' }];
  const slowCaptured = new Promise(resolve => { captureNextRead = resolve; });
  await page.evaluate(() => window.dispatchEvent(new Event('focus'))); await slowCaptured;
  // Start a second read before the deliberately slow response finishes.
  tasks = [{ id: 'new', title: '最新任务状态', status: 'pending', approved: true, created_by: 'parent' }]; await page.evaluate(() => window.dispatchEvent(new Event('focus'))); await ready(); assert.equal(slowFinished, false); await wait(1000); assert.equal(slowFinished, true);
  await page.getByText('最新任务状态', { exact: true }).waitFor(); assert.equal(await page.getByText('迟到旧任务', { exact: true }).count(), 0);
  date = ''; await page.evaluate(() => window.__refresh()); await wait(1000); assert.equal(await share.isDisabled(), true);
  date = '2026-10-20'; tasks = []; await refresh(); await page.evaluate(() => { window.__nativeSupported = false; }); await open();
  assert.equal(await dialog.getByRole('button', { name: '系统分享', exact: true }).count(), 0); assert.ok((await page.evaluate(() => window.__painted)).includes('这一天没有安排任务')); await close();
  tasks = Array.from({ length: 30 }, (_, i) => ({ id: `long-${i}`, title: `${i === 29 ? '最后一项不丢失' : `第${i + 1}项`}${'长标题内容与阅读练习'.repeat(15)}`.slice(0,160), status: i % 2 ? 'pending' : 'completed', approved: true, created_by: 'parent', reward_stars: 1 }));
  await refresh(); await page.evaluate(() => { window.__nativeSupported = true; window.__shareMode = 'success'; }); await open(); assert.ok((await page.evaluate(() => window.__painted)).some(value => value.includes('最后一项不丢失')));
  await dialog.getByRole('button', { name: '分享全部图片', exact: true }).click(); const pages = await page.evaluate(() => window.__shares.at(-1)); assert.ok(pages.length > 1); await close();
  await page.waitForFunction(() => window.__urls.every(url => window.__revoked.includes(url))); assert.deepEqual(errors, []);
  const verification = { result: 'passed', authoritativeDate: date, filename: download.suggestedFilename(), png: { signatureValid: true, width: png.readUInt32BE(16), height: png.readUInt32BE(20) }, completedFoldIncluded: true, approvedProgressAndCompletedRewardPassed: true, noPrivateFields: true, noImageGenerationRequests: true, nativeShareMocked: true, mobileActionsInView: true, snapshotSurvivedRefreshAndFailure: true, failureAndInvalidDateBlockedNewShare: true, emptyDayPassed: true, longListPages: pages.length, allUrlsRevoked: true, mutationGates: requests.filter(item => item.method !== 'GET'), staleReadIgnored: true };
  verification.dateObserved = { apiDate: date, canvasDateLabel, downloadedFilename: download.suggestedFilename() };
  await writeFile(output + '/verification.json', JSON.stringify(verification, null, 2)); console.log(JSON.stringify(verification));
} finally { await browser?.close(); await server?.close(); await unlink(harness).catch(() => {}); }
