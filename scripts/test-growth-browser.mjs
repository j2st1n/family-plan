import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { mkdir, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createServer } from '../src/child-pwa/node_modules/vite/dist/node/index.js';
import { chromium } from '../src/child-pwa/node_modules/playwright/index.mjs';
const output = process.env.BROWSER_ARTIFACT_DIR || join(tmpdir(), 'family-plan-growth-qa');
const servers = await Promise.all(['parent-web', 'child-pwa'].map((app, i) => createServer({ root: fileURLToPath(new URL(`../src/${app}/`, import.meta.url)), server: { host: '127.0.0.1', port: 19183 + i, strictPort: true } })));
const categories = ['学习思考', '体育运动', '生活自理', '家务协助'];
function fixture(days, kid = 'kid', empty = false) {
  const end = new Date('2026-11-07T12:00:00Z');
  const heatmap = Array.from({ length: days }, (_, i) => {
    const date = new Date(end); date.setUTCDate(date.getUTCDate() - days + i + 1);
    const status = empty ? 'rest' : ['perfect', 'qualified', 'missed', 'rest', 'vacation', 'frozen'][i % 6];
    return { date: date.toISOString().slice(0, 10), status, total_tasks: status === 'rest' ? 0 : 4, completed_tasks: status === 'perfect' ? 4 : status === 'qualified' ? 3 : 0, completion_rate: status === 'perfect' ? 100 : status === 'qualified' ? 75 : 0 };
  });
  return { child_id: kid, child_name: kid === 'kid' ? '小禾' : '小叶', days, start_date: heatmap[0].date, end_date: heatmap.at(-1).date, heatmap, categories: categories.map(category => ({ category, total_tasks: empty ? 0 : 10, completed_tasks: empty ? 0 : 8, completion_rate: empty ? 0 : 80 })), summary: { total_tasks: empty ? 0 : 100, completed_tasks: empty ? 0 : days, qualified_days: empty ? 0 : 3, recorded_tasks: empty ? 0 : 2, actual_seconds: empty ? 0 : 3675 }, streak: { current_streak_days: 58, longest_streak_days: 60 }, stars_earned: '1.25', insights: { best_habit: { title: 'PRIVATE TASK TITLE', total_count: 10, completed_count: 8, completion_rate: 80 }, attention_needed: null, streak: { current_streak_days: 58, longest_streak_days: 60, freeze_usages_count: 1, vacation_days_count: 1 }, stars: { stars_earned: '1.25', stars_spent: '2.50', current_stars: '999.25' } } };
}
let browser;
try {
  await mkdir(output, { recursive: true }); for (const server of servers) await server.listen();
  browser = await chromium.launch({ ...(process.env.PLAYWRIGHT_BROWSER === 'chromium' ? {} : { channel: 'chrome' }), headless: true });
  const errors = [], writes = []; let releaseSeven, delaySeven = false, empty = false, fail = false, expired = false;
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, acceptDownloads: true });
  await context.addInitScript(() => {
    localStorage.setItem('parent_token', 'synthetic-parent'); localStorage.setItem('parent_active_tab', 'analytics');
    localStorage.setItem('device_token', 'synthetic-device'); localStorage.setItem('child_profile', JSON.stringify({ id: 'kid', name: '小禾' }));
    const originalFetch = window.fetch;
    window.fetch = (input, options) => String(input).includes('/events') ? Promise.resolve(new Response(new ReadableStream({ start(c) { c.enqueue(new TextEncoder().encode(': connected\n\n')); } }), { headers: { 'Content-Type': 'text/event-stream' } })) : originalFetch(input, options);
    window.__reportTexts = []; const fill = CanvasRenderingContext2D.prototype.fillText;
    CanvasRenderingContext2D.prototype.fillText = function(text, ...args) { window.__reportTexts.push(String(text)); return fill.call(this, text, ...args); };
    window.__shares = []; window.__cancelShare = false; window.__canShare = true;
    Object.defineProperty(navigator, 'canShare', { value: () => window.__canShare, configurable: true });
    Object.defineProperty(navigator, 'share', { value: async data => { if (window.__cancelShare) throw new DOMException('Cancelled', 'AbortError'); window.__shares.push({ title: data.title, text: data.text, names: data.files.map(f => f.name), types: data.files.map(f => f.type) }); }, configurable: true });
  });
  await context.route('https://**/*', route => route.abort());
  await context.route('**/api/v1/**', async route => {
    const request = route.request(), url = new URL(request.url()), path = url.pathname;
    if (request.method() !== 'GET') writes.push(path);
    if (path.endsWith('/analytics')) {
      if (expired && path.includes('/child/')) return route.fulfill({ status: 401, json: {} });
      if (fail) return route.fulfill({ status: 503, json: {} });
      const days = Number(url.searchParams.get('days'));
      if (delaySeven && days === 7) await new Promise(resolve => { releaseSeven = resolve; });
      return route.fulfill({ json: fixture(days, path.includes('/kid2/') ? 'kid2' : 'kid', empty) });
    }
    if (path === '/api/v1/children') return route.fulfill({ json: [{ id: 'kid', name: '小禾' }, { id: 'kid2', name: '小叶' }] });
    if (path.endsWith('/dashboard')) return route.fulfill({ json: { today: { submitted_tasks: 0 }, rewards: { stars_total: 0, current_streak_days: 58 } } });
    if (path.endsWith('/daily-tasks')) return route.fulfill({ json: { date: '2026-11-07', tasks: [], rewards: { stars_total: 0, current_streak_days: 58 } } });
    if (path === '/api/v1/plans') return route.fulfill({ json: [] });
    if (path === '/api/v1/child/today') return route.fulfill({ json: { date: '2026-11-07', child: { id: 'kid', name: '小禾' }, tasks: [], rewards: { stars_total: 0, current_streak_days: 58 } } });
    if (path.endsWith('/items')) return route.fulfill({ json: [] });
    if (path.includes('/freeze')) return route.fulfill({ json: { available_count: 0, max_limit: 2, star_cost: 5, can_purchase: false } });
    throw new Error(`Unexpected growth fixture ${request.method()} ${path}`);
  });
  for (const [i, app] of ['parent', 'child'].entries()) {
    const page = await context.newPage(); page.on('pageerror', err => errors.push(err.message)); page.setDefaultTimeout(12000);
    await page.goto(`http://127.0.0.1:${19183 + i}`);
    if (app === 'child') await page.getByRole('navigation').getByRole('button', { name: '成长', exact: true }).click();
    await page.getByRole('region', { name: '成长概览' }).waitFor();
    const share = page.getByRole('button', { name: '分享成长报告', exact: true });
    await page.getByRole('region', { name: '实际用时' }).waitFor();
    for (const scheme of ['light', 'dark']) {
      await page.emulateMedia({ colorScheme: scheme });
      for (const width of [320, 390, 834, 1280]) {
        await page.setViewportSize({ width, height: 900 });
        assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${app} overflow ${scheme} ${width}`);
        assert.equal(await page.locator('.growth-day').count(), 30);
        if (width === 390 || width === 834) await page.screenshot({ path: join(output, `${app}-${scheme}-${width}.png`), fullPage: true });
      }
    }
    await share.click(); const dialog = page.getByRole('dialog', { name: '成长报告 · 近 30 天', exact: true });
    await dialog.getByRole('img', { name: '成长报告预览' }).evaluate(img => img.decode());
    const initialTexts = await page.evaluate(() => window.__reportTexts);
    assert.ok(initialTexts.includes('小禾的成长')); assert.ok(!initialTexts.includes('PRIVATE TASK TITLE'));
    assert.ok(!initialTexts.includes('999.25'));
    await page.evaluate(() => { window.__reportTexts = []; });
    await dialog.getByLabel('显示昵称', { exact: true }).uncheck();
    await dialog.getByRole('img').evaluate(img => img.decode());
    const privateTexts = await page.evaluate(() => window.__reportTexts);
    assert.ok(privateTexts.includes('我的成长')); assert.ok(!privateTexts.some(t => t.includes('小禾')));
    const save = page.waitForEvent('download'); await dialog.getByRole('button', { name: '保存图片', exact: true }).click();
    const file = await save; assert.ok(!file.suggestedFilename().includes('小禾'));
    const dest = join(output, `${app}-growth-report-private.png`); await file.saveAs(dest);
    const bytes = await readFile(dest); assert.deepEqual([...bytes.subarray(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10]);
    await dialog.getByRole('button', { name: '分享', exact: true }).click();
    const shares = await page.evaluate(() => window.__shares); assert.equal(shares.length, 1); assert.deepEqual(shares[0].types, ['image/png']); assert.ok(!JSON.stringify(shares[0]).includes('小禾'));
    await page.evaluate(() => { window.__cancelShare = true; }); await dialog.getByRole('button', { name: '分享', exact: true }).click();
    assert.equal(await dialog.getByText('暂时无法调起系统分享，请点击保存图片。').count(), 0);
    await page.evaluate(() => { window.__canShare = false; });
    const fallback = page.waitForEvent('download'); await dialog.getByRole('button', { name: '分享', exact: true }).click(); await fallback;
    await page.keyboard.press('Escape'); await dialog.waitFor({ state: 'detached' });
    assert.equal(await share.evaluate(e => document.activeElement === e), true);
    // Seven-day response arrives after ninety-day response and must not replace it.
    delaySeven = true; await page.getByRole('group', { name: '成长统计时段' }).getByRole('button', { name: '7 天', exact: true }).click();
    while (!releaseSeven) await new Promise(r => setTimeout(r, 10));
    assert.ok(await share.isDisabled());
    await page.getByRole('group', { name: '成长统计时段' }).getByRole('button', { name: '90 天', exact: true }).click();
    await page.waitForFunction(() => document.querySelectorAll('.growth-day').length === 90);
    releaseSeven(); releaseSeven = null; delaySeven = false;
    await page.waitForTimeout(150); assert.equal(await page.locator('.growth-day').count(), 90);
    await share.click(); await page.getByRole('dialog', { name: '成长报告 · 近 90 天', exact: true }).waitFor(); await page.keyboard.press('Escape');
    if (app === 'parent') {
      await page.getByRole('button', { name: '小叶', exact: true }).click();
      await page.waitForFunction(() => !document.querySelector('.growth-share').disabled);
      await share.click(); await page.getByRole('dialog').getByRole('img').evaluate(img => img.decode());
      assert.ok(await page.evaluate(() => window.__reportTexts.includes('小叶的成长'))); await page.keyboard.press('Escape');
    } else {
      empty = true; await page.getByRole('group', { name: '成长统计时段' }).getByRole('button', { name: '7 天', exact: true }).click();
      await page.getByText('从今天的一件小事开始，慢慢留下成长的脚印。', { exact: true }).waitFor();
      assert.equal(await page.getByRole('region', { name: '实际用时' }).count(), 0);
      assert.equal(await page.getByText('未记录', { exact: true }).count(), 0);
      fail = true; await page.getByRole('group', { name: '成长统计时段' }).getByRole('button', { name: '30 天', exact: true }).click();
      await page.getByRole('alert').waitFor(); assert.ok(await share.isDisabled());
      fail = false; await page.getByRole('button', { name: '重试', exact: true }).click(); await page.getByRole('alert').waitFor({ state: 'detached' });
      expired = true; await page.getByRole('group', { name: '成长统计时段' }).getByRole('button', { name: '90 天', exact: true }).click();
      await page.getByLabel('设备访问码', { exact: true }).waitFor();
    }
    await page.close();
  }
  assert.deepEqual(writes, [], 'analytics and share preview never write business data'); assert.deepEqual(errors, []);
  console.log('Growth browser passed: both boards, 7/30/90 and late-response guards, parent child switch, decimal earned stars, recorded-only timing, 320/390/834/1280 light/dark, aggregate-only private PNG, nickname toggle, native-share mock/cancel and download fallback, empty/error/retry/expired session; no business writes or page errors.');
} finally { await browser?.close(); for (const server of servers) await server.close(); }
