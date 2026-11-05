import assert from 'node:assert/strict';
import { writeFile, unlink, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { createServer } from '../src/parent-web/node_modules/vite/dist/node/index.js';
import { chromium } from '../src/child-pwa/node_modules/playwright/index.mjs';
const root = fileURLToPath(new URL('../src/parent-web/', import.meta.url));
const harness = new URL('../src/parent-web/.refresh-regression.html', import.meta.url);
const output = '/private/tmp/family-plan-refresh-20261030';
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
let server, browser;
try {
  await mkdir(output, { recursive: true });
  await writeFile(harness, `<div id="root"></div><script type="module">
    import React from 'react';import{createRoot}from'react-dom/client';
    import Home from '/src/pages/Home.jsx';import Shop from '/src/pages/Shop.jsx';import '/src/index.css';
    function Test(){const[active,setActive]=React.useState(true);window.setActive=setActive;
      return React.createElement(new URL(location).searchParams.has('shop')?Shop:Home,{token:'synthetic',isActive:active,onExpired:()=>{},onLogout:()=>{}});}
    createRoot(document.getElementById('root')).render(React.createElement(Test));</script>`);
  server = await createServer({ root, server: { host: '127.0.0.1', port: 19129, strictPort: true } }); await server.listen();
  browser = await chromium.launch({ channel: 'chrome', headless: true });
  const page = await browser.newPage({ viewport: { width: 900, height: 500 } });
  page.setDefaultTimeout(10000);
  let navigations = 0, activeReads = 0, maxReads = 0, failNext = false, taskDelay = 220, title = '稳定任务卡片';
  const requests = [], errors = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('framenavigated', frame => { if (frame === page.mainFrame()) navigations++; });
  await page.addInitScript(() => {
    window.__loadingEpisodes = 0; let wasLoading = false;
    new MutationObserver(() => { const loading = [...document.querySelectorAll('p')].some(p => p.textContent === '加载中…'); if (loading && !wasLoading) window.__loadingEpisodes++; wasLoading = loading; }).observe(document, { childList: true, subtree: true });
    const nativeFetch = window.fetch; window.__sseOpens = 0;
    window.fetch = (input, opts) => {
      if (String(input) !== '/api/v1/events/parent') return nativeFetch(input, opts);
      window.__sseOpens++;
      const response = new Response(new ReadableStream({ start(controller) {
        window.__sseController = controller;
        opts.signal.addEventListener('abort', () => { try { controller.close(); } catch {} });
        controller.enqueue(new TextEncoder().encode(': connected\n\n'));
      } }), { headers: { 'Content-Type': 'text/event-stream' } });
      return new URL(location).searchParams.has('late') ? new Promise((resolve, reject) => setTimeout(() => {
        if (opts.signal.aborted) reject(new DOMException('aborted', 'AbortError')); else resolve(response);
      }, 1000)) : Promise.resolve(response);
    };
    window.__return = (elapsed = 6000) => {
      const clock = Date.now; let offset = 0; Date.now = () => clock() + offset;
      window.__visibility = 'hidden'; Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => window.__visibility });
      window.dispatchEvent(new Event('blur')); document.dispatchEvent(new Event('visibilitychange')); offset = elapsed;
      window.__visibility = 'visible'; document.dispatchEvent(new Event('visibilitychange')); window.dispatchEvent(new Event('focus')); Date.now = clock;
    };
    window.__send = (topic = 'tasks', child_id = 'synthetic-child') => window.__sseController.enqueue(new TextEncoder().encode('data: ' + JSON.stringify({ topic, child_id }) + '\n\n'));
  });
  await page.route('https://**/*', route => route.abort());
  await page.route('**/api/v1/**', async route => {
    const path = new URL(route.request().url()).pathname; requests.push(path);
    assert.equal(route.request().method(), 'GET');
    if (path === '/api/v1/children') return route.fulfill({ json: [{ id: 'synthetic-child', name: '刷新测试' }] });
    if (path.endsWith('/dashboard')) return route.fulfill({ json: {} });
    if (path === '/api/v1/plans') return route.fulfill({ json: [{ id: 'synthetic-plan', status: 'active', tasks: [] }] });
    if (path.endsWith('/daily-tasks')) {
      activeReads++; maxReads = Math.max(activeReads, maxReads); const capturedTitle = title, failure = failNext; failNext = false;
      await wait(taskDelay); activeReads--;
      if (failure) return route.fulfill({ status: 500, json: { detail: { message: 'Synthetic sync failure' } } });
      return route.fulfill({ json: { tasks: Array.from({ length: 12 }, (_, i) => ({ id: `task-${i}`, plan_id: 'synthetic-plan', title: i ? `任务${i}` : capturedTitle, status: 'pending', approved: true, created_by: 'parent', expected_minutes: 10, reward_stars: 1 })), rewards: {} } });
    }
    if (path === '/api/v1/shop/items') return route.fulfill({ json: [{ id: 'item', title: '合成商品', status: 'active', star_cost: 1 }] });
    if (path.includes('redemptions')) return route.fulfill({ json: [] });
    throw Error(`Unexpected synthetic request ${path}`);
  });
  const count = suffix => requests.filter(path => path.endsWith(suffix)).length;
  const ready = () => page.waitForFunction(() => [...document.querySelectorAll('button')].some(b => b.textContent === '分享图片' && !b.disabled));
  await page.goto('http://127.0.0.1:19129/.refresh-regression.html'); await page.getByText('刷新测试', { exact: true }).click();
  await ready(); await wait(1000);
  assert.equal(count('/daily-tasks'), 1);
  const initial = count('/daily-tasks'), homeBefore = count('/children');
  const loadingBefore = await page.evaluate(() => window.__loadingEpisodes);
  await page.evaluate(() => { window.__sseController.enqueue(new TextEncoder().encode(': keepalive\n\n'.repeat(3))); window.dispatchEvent(new Event('focus')); window.__return(100); }); await wait(850);
  assert.equal(count('/daily-tasks'), initial);
  await page.evaluate(() => window.__return()); await wait(1000);
  assert.equal(count('/daily-tasks'), initial + 1);
  assert.equal(count('/children'), homeBefore, 'home must not refresh while task view is active');
  const beforeReconnect = count('/daily-tasks'); await page.evaluate(() => window.__sseController.close()); await wait(2100);
  assert.equal(count('/daily-tasks'), beforeReconnect + 1);
  await page.getByRole('button', { name: '✎', exact: true }).first().click();
  const input = page.getByPlaceholder('任务名 *', { exact: true });
  await input.fill('尚未保存的编辑');
  await input.evaluate(el => { window.__editingInput = el; el.focus(); el.setSelectionRange(2, 4); window.scrollTo(0, 50); window.__scroll = scrollY; });
  const beforeEvent = count('/daily-tasks');
  await page.evaluate(() => { window.__send(); window.__send(); window.__send(); });
  await page.waitForFunction(() => document.querySelector('[aria-busy="true"]'));
  const pendingObserved = await page.evaluate(() => ({
    taskPanelBusy: Boolean(document.querySelector('[aria-busy="true"]')),
    loadingParagraphCount: [...document.querySelectorAll('p')].filter(p => p.textContent === '加载中…').length,
    editorConnected: window.__editingInput.isConnected,
  }));
  assert.deepEqual(pendingObserved, { taskPanelBusy: true, loadingParagraphCount: 0, editorConnected: true });
  await wait(400);
  assert.equal(count('/daily-tasks'), beforeEvent + 1);
  const editorObserved = await input.evaluate(el => ({ same: el === window.__editingInput, focused: document.activeElement === el, text: el.value, start: el.selectionStart, end: el.selectionEnd, scroll: scrollY === window.__scroll }));
  assert.deepEqual(editorObserved, { same: true, focused: true, text: '尚未保存的编辑', start: 2, end: 4, scroll: true });
  const loadingAfter = await page.evaluate(() => window.__loadingEpisodes);
  assert.equal(loadingAfter, loadingBefore);
  const filtered = count('/daily-tasks'); await page.evaluate(() => { window.__send('shop'); window.__send('tasks', 'other-child'); }); await wait(850); assert.equal(count('/daily-tasks'), filtered);
  failNext = true; await page.evaluate(() => window.__send()); await page.getByRole('alert').filter({ hasText: 'Synthetic sync failure' }).waitFor();
  assert.equal(await input.inputValue(), '尚未保存的编辑');
  await page.evaluate(() => window.__send()); await wait(1000); assert.equal(await page.getByRole('alert').count(), 0);
  taskDelay = 1100;
  await page.evaluate(() => window.__send()); await wait(720); title = '更新后的真实状态';
  await page.evaluate(() => window.__send()); await wait(2600); await ready();
  assert.equal(maxReads, 1, 'same-day reads must never run in parallel');
  await page.getByRole('button', { name: '取消', exact: true }).click(); await page.getByText(title, { exact: true }).waitFor(); taskDelay = 220;
  const beforeInactive = count('/daily-tasks'); await page.evaluate(() => window.setActive(false)); await wait(100); await page.evaluate(() => window.__return()); await wait(850); assert.equal(count('/daily-tasks'), beforeInactive);
  await page.evaluate(() => window.setActive(true)); await ready(); await wait(1000); assert.equal(count('/daily-tasks'), beforeInactive + 1);
  await page.getByRole('button', { name: '← 首页', exact: true }).click(); await wait(1000); assert.equal(count('/children'), homeBefore + 1);
  const result = { initialTaskLoads: initial, loadsFromKeepaliveAndShortFocus: 0, loadsFromVisibilityAndFocus: 1, loadsFromStreamReconnect: 1, backgroundLoadingEpisodes: 0, editDomFocusCaretScrollPreserved: true, failedSyncRetryPassed: true, eventDuringOlderReadCaughtUp: true, maxConcurrentSameDayReads: maxReads, homeInactiveIsolationPassed: true, taskReactivationPassed: true, documentNavigations: navigations };
  result.editorObserved = editorObserved;
  result.loadingObserved = { beforeBackground: loadingBefore, afterBackground: loadingAfter, pendingObserved };
  const beforeLate = count('/daily-tasks');
  await page.goto('http://127.0.0.1:19129/.refresh-regression.html?late'); await page.getByText('刷新测试', { exact: true }).click();
  await ready(); const lateInitialLoading = await page.evaluate(() => window.__loadingEpisodes);
  await wait(2000); assert.equal(count('/daily-tasks'), beforeLate + 2, 'late subscription must catch up changes missed before it connected');
  assert.equal(await page.evaluate(() => window.__loadingEpisodes), lateInitialLoading); result.lateSubscriptionCatchupPassed = true;
  await page.goto('http://127.0.0.1:19129/.refresh-regression.html?shop'); await page.getByText('合成商品', { exact: true }).waitFor();
  await page.getByRole('button', { name: '✎', exact: true }).click(); await page.getByPlaceholder('名称', { exact: true }).fill('商城编辑保留');
  await page.getByPlaceholder('名称', { exact: true }).evaluate(el => { window.__shopInput = el; el.focus(); });
  await page.evaluate(() => window.__send('shop')); await wait(1000);
  assert.deepEqual(await page.getByPlaceholder('名称', { exact: true }).evaluate(el => [el === window.__shopInput, document.activeElement === el, el.value]), [true, true, '商城编辑保留']);
  assert.deepEqual(errors, []); result.shopEditorPreserved = true;
  await writeFile(output + '/verification.json', JSON.stringify(result, null, 2)); console.log(JSON.stringify(result));
} finally { await browser?.close(); await server?.close(); await unlink(harness).catch(() => {}); }
