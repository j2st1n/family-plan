import assert from 'node:assert/strict';
import { mkdir, writeFile, unlink, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { createServer } from '../src/parent-web/node_modules/vite/dist/node/index.js';
import { chromium } from '../src/child-pwa/node_modules/playwright/index.mjs';

const root = fileURLToPath(new URL('../src/parent-web/', import.meta.url));
const harness = new URL('../src/parent-web/.task-share-regression.html', import.meta.url);
const output = process.env.FAMILY_PLAN_SHARE_OUTPUT || '/private/tmp/family-plan-share-20261030';
const fixtures = [
  { id: 'read', title: '阅读《夏洛的网》', status: 'completed', approved: true, expected_minutes: 25, reward_stars: 2 },
  { id: 'math', title: '数学口算练习', status: 'pending', approved: true, expected_minutes: 15, reward_stars: 1, scheduled_start: '19:00', scheduled_end: '19:15' },
  { id: 'tidy', title: '整理书桌与书包', status: 'completed', approved: true, expected_minutes: 10, reward_stars: 1 },
  { id: 'music', title: '练习喜欢的曲子', status: 'pending', approved: false, expected_minutes: 20, reward_stars: 2 },
];
let server;
let browser;
try {
  await mkdir(output, { recursive: true });
  await writeFile(harness, `<div id="root"></div><script type="module">
    import React from 'react';import {createRoot} from 'react-dom/client';
    import TaskManage from '/src/pages/TaskManage.jsx';import '/src/index.css';
    createRoot(document.getElementById('root')).render(React.createElement(TaskManage, {
      token:'PRIVATE_TOKEN', child:{id:'test-child',name:'小禾',access_code:'DO_NOT_SHARE'},
      isActive:false,onExpired:()=>{},onBack:()=>{}
    }));</script>`);
  server = await createServer({ root, server: { host: '127.0.0.1', port: 19128, strictPort: true } });
  await server.listen();
  browser = await chromium.launch({ channel: 'chrome', headless: true });
  const page = await browser.newPage({ viewport: { width: 1024, height: 850 }, acceptDownloads: true });
  const errors = [];
  const requests = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.addInitScript(() => {
    window.__paintedText = [];
    window.__createdPngUrls = [];
    window.__revokedUrls = [];
    window.__shares = [];
    window.__nativeSupported = true;
    window.__shareMode = 'success';
    window.__failNextBlob = false;
    const fillText = CanvasRenderingContext2D.prototype.fillText;
    CanvasRenderingContext2D.prototype.fillText = function (value, ...args) {
      window.__paintedText.push(String(value)); return fillText.call(this, value, ...args);
    };
    const toBlob = HTMLCanvasElement.prototype.toBlob;
    HTMLCanvasElement.prototype.toBlob = function (callback, ...args) {
      if (window.__failNextBlob) { window.__failNextBlob = false; queueMicrotask(() => callback(null)); return; }
      return toBlob.call(this, callback, ...args);
    };
    const createUrl = URL.createObjectURL.bind(URL);
    URL.createObjectURL = value => { const url = createUrl(value); if (value.type === 'image/png') window.__createdPngUrls.push(url); return url; };
    const revokeUrl = URL.revokeObjectURL.bind(URL);
    URL.revokeObjectURL = url => { window.__revokedUrls.push(url); revokeUrl(url); };
    Object.defineProperty(navigator, 'canShare', { configurable: true, value: ({ files }) => window.__nativeSupported && files.length > 0 });
    Object.defineProperty(navigator, 'share', { configurable: true, value: async ({ files, title }) => {
      const items = [];
      for (const file of files) {
        const data = await file.arrayBuffer(); const view = new DataView(data);
        items.push({ name: file.name, type: file.type, size: file.size, width: view.getUint32(16), height: view.getUint32(20) });
      }
      window.__shares.push({ title, files: items });
      if (window.__shareMode === 'abort') throw new DOMException('cancelled', 'AbortError');
      if (window.__shareMode === 'error') throw new DOMException('unavailable', 'DataError');
    } });
  });
  await page.route('https://**/*', route => route.abort());
  await page.route('**/api/v1/**', async route => {
    const req = route.request(); const url = new URL(req.url());
    assert.equal(req.method(), 'GET', 'image sharing must not write business data');
    requests.push(url.pathname + url.search);
    if (url.pathname === '/api/v1/plans') return route.fulfill({ json: [{ id: 'test-plan', status: 'active', tasks: [] }] });
    if (url.pathname === '/api/v1/plans/test-plan/daily-tasks') {
      const date = url.searchParams.get('task_date');
      await new Promise(resolve => setTimeout(resolve, 180));
      if (date === '2026-10-19') return route.fulfill({ status: 500, json: { detail: { message: 'Synthetic date load failure' } } });
      const tasks = date === '2026-10-22' ? [] : date === '2026-10-21' ? Array.from({ length: 30 }, (_, i) => ({
        id: `long-${i}`, title: `${i === 29 ? '最后一项不丢失' : `第${i + 1}项`}${'长标题任务内容与中文阅读练习'.repeat(12)}`.slice(0, 160),
        status: i % 3 === 0 ? 'completed' : 'pending', approved: true, reward_stars: 1, expected_minutes: 10,
      })) : fixtures;
      return route.fulfill({ json: { tasks: tasks.map(task => ({ ...task, plan_id: 'test-plan' })), rewards: { stars_total: 999, current_streak_days: 41 } } });
    }
    throw new Error(`Unexpected synthetic request: ${url.pathname}`);
  });
  await page.goto('http://127.0.0.1:19128/.task-share-regression.html');
  const shareButton = page.getByRole('button', { name: '分享图片', exact: true });
  const dateInput = page.getByLabel('任务日期');
  const ready = () => page.waitForFunction(() => [...document.querySelectorAll('button')].some(button => button.textContent.trim() === '分享图片' && !button.disabled));
  await ready();
  await dateInput.fill('2026-10-19');
  assert.equal(await shareButton.isDisabled(), true);
  await page.getByRole('alert').filter({ hasText: 'Synthetic date load failure' }).waitFor();
  assert.equal(await shareButton.isDisabled(), true, 'failed selected day must not share the previous day');
  await dateInput.fill('2026-10-20'); await ready();
  const selectedShareDate = await dateInput.inputValue();
  const requestsBeforeShare = requests.length;
  await shareButton.click();
  const dialog = page.getByRole('dialog', { name: '分享任务图片' });
  const preview = dialog.getByRole('img');
  await preview.waitFor(); await preview.evaluate(img => img.decode());
  assert.equal(requests.length, requestsBeforeShare, 'generating an image adds no API requests');
  const painted = await page.evaluate(() => window.__paintedText);
  assert.ok(painted.includes('小禾的任务记录'));
  assert.ok(painted.includes('阅读《夏洛的网》'), 'collapsed completed tasks are included');
  assert.ok(painted.includes('整理书桌与书包'));
  assert.ok(painted.includes('2/3'));
  assert.ok(painted.includes('66%'));
  assert.ok(painted.includes('3'));
  assert.ok(painted.some(text => text.includes('2026 年 10 月 20 日')));
  assert.ok(!painted.some(text => /PRIVATE_TOKEN|DO_NOT_SHARE|^999$/.test(text)));
  const download = page.waitForEvent('download');
  await dialog.getByRole('button', { name: '保存图片', exact: true }).click();
  const file = await download;
  assert.equal(file.suggestedFilename(), 'family-plan-2026-10-20.png');
  await file.saveAs(`${output}/share-example.png`);
  const png = await readFile(`${output}/share-example.png`);
  assert.deepEqual([...png.subarray(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10]);
  assert.equal(png.readUInt32BE(16), 1080);
  assert.ok(png.readUInt32BE(20) <= 3600);
  await page.screenshot({ path: `${output}/preview-desktop.png` });
  await dialog.getByRole('button', { name: '系统分享', exact: true }).click();
  await page.waitForFunction(() => window.__shares.length === 1);
  assert.equal((await page.evaluate(() => window.__shares[0].files))[0].name, 'family-plan-2026-10-20.png');
  await page.evaluate(() => { window.__shareMode = 'abort'; });
  await dialog.getByRole('button', { name: '系统分享', exact: true }).click();
  await page.waitForFunction(() => window.__shares.length === 2);
  assert.equal(await dialog.getByRole('alert').count(), 0);
  await page.evaluate(() => { window.__shareMode = 'error'; });
  await dialog.getByRole('button', { name: '系统分享', exact: true }).click();
  await dialog.getByRole('alert').filter({ hasText: '保存图片后发送' }).waitFor();
  assert.equal(await dialog.getByRole('button', { name: '保存图片', exact: true }).isEnabled(), true);
  await page.setViewportSize({ width: 390, height: 844 });
  const saveBounds = await dialog.getByRole('button', { name: '保存图片', exact: true }).boundingBox();
  const dialogBounds = await dialog.boundingBox();
  assert.ok(dialogBounds.x >= 0 && dialogBounds.x + dialogBounds.width <= 390);
  assert.ok(saveBounds.y >= 0 && saveBounds.y + saveBounds.height <= 844, 'mobile actions remain in view');
  await page.screenshot({ path: `${output}/preview-mobile.png` });
  const oldUrl = await preview.getAttribute('src');
  await page.evaluate(() => { window.__paintedText = []; });
  await dialog.getByLabel('标题显示孩子姓名').uncheck();
  await page.waitForFunction(url => { const img = document.querySelector('.task-share-preview'); return img && img.src !== url; }, oldUrl);
  const anonymousText = await page.evaluate(() => window.__paintedText);
  assert.ok(anonymousText.includes('每日任务记录'));
  assert.ok(!anonymousText.some(text => text.includes('小禾')));
  await dialog.getByRole('button', { name: '关闭分享预览' }).click();
  await page.waitForFunction(url => window.__revokedUrls.includes(url), oldUrl);
  assert.equal(await page.evaluate(() => document.body.style.overflow), '');
  await page.evaluate(() => { window.__nativeSupported = false; });
  await dateInput.fill('2026-10-22'); await ready(); await shareButton.click(); await preview.waitFor();
  assert.equal(await dialog.getByRole('button', { name: '系统分享', exact: true }).count(), 0);
  assert.equal(await dialog.getByRole('button', { name: '保存图片', exact: true }).isEnabled(), true);
  assert.ok((await page.evaluate(() => window.__paintedText)).includes('这一天没有安排任务'));
  await page.keyboard.press('Escape'); await dialog.waitFor({ state: 'detached' });
  await page.evaluate(() => { window.__failNextBlob = true; });
  await shareButton.click();
  await dialog.getByRole('alert').filter({ hasText: '图片生成失败，请重试' }).waitFor();
  assert.equal(await dialog.getByRole('img').count(), 0);
  assert.equal(await dialog.getByRole('button', { name: '保存图片', exact: true }).isDisabled(), true);
  await dialog.getByRole('button', { name: '重新生成', exact: true }).click();
  await preview.waitFor();
  assert.equal(await dialog.getByRole('button', { name: '保存图片', exact: true }).isEnabled(), true);
  await page.keyboard.press('Escape'); await dialog.waitFor({ state: 'detached' });
  await page.evaluate(() => { window.__nativeSupported = true; window.__shareMode = 'success'; window.__paintedText = []; });
  await dateInput.fill('2026-10-21'); await ready(); await shareButton.click(); await preview.waitFor();
  assert.ok((await page.evaluate(() => window.__paintedText)).some(text => text.includes('最后一项不丢失')));
  await dialog.getByRole('button', { name: '分享全部图片', exact: true }).click();
  await page.waitForFunction(() => window.__shares.at(-1).files.length > 1);
  const pages = await page.evaluate(() => window.__shares.at(-1).files);
  assert.ok(pages.every(file => file.type === 'image/png' && file.width === 1080 && file.height <= 3600));
  await dialog.getByRole('button', { name: '下一张分享图片' }).click();
  assert.match(await preview.getAttribute('alt'), /第2张/);
  const nextDownload = page.waitForEvent('download');
  await dialog.getByRole('button', { name: '保存当前图片', exact: true }).click();
  assert.equal((await nextDownload).suggestedFilename(), 'family-plan-2026-10-21-2.png');
  await dialog.getByRole('button', { name: '关闭分享预览' }).click();
  await page.waitForFunction(() => window.__createdPngUrls.every(url => window.__revokedUrls.includes(url)));
  assert.deepEqual(errors, []);
  const verification = {
    result: 'passed',
    tested: ['selected date/failure guard', 'full task statuses and rewards', 'actual PNG download', 'native share success/cancel/failure via mocks', 'unsupported fallback', 'hide name', 'mobile layout', 'empty day', 'generation failure/retry', 'long-list pagination', 'URL cleanup'],
    selectedDateCheck: { selected: selectedShareDate, paintedDateLabel: painted.find(text => /^\d+ 年 \d+ 月 \d+ 日/.test(text)), downloadedFilename: file.suggestedFilename(), pngWidth: png.readUInt32BE(16), pngHeight: png.readUInt32BE(20), validPngSignature: true },
    nativeSharingMocked: true, longListPages: pages.length, example: `${output}/share-example.png`,
  };
  await writeFile(`${output}/verification.json`, JSON.stringify(verification, null, 2));
  console.log(JSON.stringify(verification));
} finally {
  await browser?.close(); await server?.close(); await unlink(harness).catch(() => {});
}
