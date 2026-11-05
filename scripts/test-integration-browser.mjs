import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { createServer } from '../src/parent-web/node_modules/vite/dist/node/index.js';
import { chromium } from '../src/child-pwa/node_modules/playwright/index.mjs';
const root = fileURLToPath(new URL('../src/parent-web/', import.meta.url));
const server = await createServer({ root, server: { host: '127.0.0.1', port: 19139, strictPort: true } });
let browser;
try {
  await server.listen();
  browser = await chromium.launch({channel:'chrome',headless:true});
  const page = await browser.newPage({viewport:{width:1100,height:900}});
  const errors = [];
  page.on('pageerror', err => errors.push(err.message));
  await page.addInitScript(() => {
    localStorage.setItem('parent_token','synthetic-integration-token');
    localStorage.setItem('parent_active_tab','today');
    const fetchOriginal = window.fetch;
    window.fetch = (input, options) => String(input).includes('/events')
      ? Promise.resolve(new Response(new ReadableStream({start(c){c.enqueue(new TextEncoder().encode(': connected\n\n'));}}),{headers:{'Content-Type':'text/event-stream'}}))
      : fetchOriginal(input,options);
    Object.defineProperty(navigator,'canShare',{value:()=>false,configurable:true});
  });
  await page.route('https://**/*',route=>route.abort());
  let settings = {streak_threshold:70,streak_discount_enabled:false,streak_discount_tiers:[7,14,21,28,35].map((days,i)=>({days,discount_percent:95-i*5}))};
  let saved;
  await page.route('**/api/v1/**',async route=>{
    const request=route.request(), url=new URL(request.url()), path=url.pathname;
    if(path==='/api/v1/ai/settings') return route.fulfill({json:{provider:'deepseek',enabled:false,model:'test-model',base_url:'https://example.invalid/v1',has_api_key:false}});
    if(path==='/api/v1/children') return route.fulfill({json:[{id:'kid',name:'合并测试',grade_label:'三年级',streak_threshold:settings.streak_threshold}]});
    if(path.endsWith('/dashboard')) return route.fulfill({json:{today:{submitted_tasks:0},rewards:{stars_total:20,current_streak_days:12}}});
    if(path==='/api/v1/plans') return route.fulfill({json:[{id:'plan',status:'active',child_id:'kid',tasks:[]}]});
    if(path.endsWith('/daily-tasks')) {
      const date=url.searchParams.get('task_date');
      if(date==='2026-10-19') await new Promise(resolve=>setTimeout(resolve,500));
      return route.fulfill({json:{tasks:[{id:'task',title:`任务 ${date}`,status:'pending',approved:true,reward_stars:2,expected_minutes:10,plan_id:'plan'}],rewards:{stars_total:20,current_streak_days:12}}});
    }
    if(path.endsWith('/reward-settings')) {
      if(request.method()==='PATCH') { saved=request.postDataJSON(); settings={...saved}; }
      return route.fulfill({json:settings});
    }
    throw new Error(`Unexpected mocked API: ${request.method()} ${path}`);
  });
  await page.goto('http://127.0.0.1:19139');
  const date=page.getByLabel('任务日期');
  const share=page.getByRole('button',{name:'分享图片',exact:true});
  await share.waitFor();
  await date.fill('2026-10-19');
  await page.waitForRequest(r=>r.url().includes('task_date=2026-10-19'));
  await date.fill('2026-10-20');
  await page.getByText('任务 2026-10-20',{exact:true}).waitFor();
  await page.waitForTimeout(650);
  assert.equal(await page.getByText('任务 2026-10-19',{exact:true}).count(),0,'stale date response must not replace selected day');
  await share.click();
  const shareDialog=page.getByRole('dialog',{name:'分享任务图片'});
  await shareDialog.getByRole('img').evaluate(img=>img.decode());
  await shareDialog.getByRole('button',{name:'关闭分享预览'}).click();
  await page.getByRole('button',{name:'设置',exact:true}).click();
  await page.getByText('家庭与孩子档案',{exact:true}).click();
  await page.getByRole('button',{name:'连胜规则',exact:true}).click();
  const dialog=page.getByRole('dialog',{name:'连胜规则',exact:true});
  const threshold=dialog.getByLabel('连胜达标完成率');
  await threshold.waitFor();
  assert.equal(await threshold.inputValue(),'70');
  assert.equal(await dialog.getByRole('switch').getAttribute('aria-checked'),'false');
  for(const [i,days] of [7,14,21,28,35].entries()) assert.equal(await dialog.getByLabel(`连续${days}天支付比例`).inputValue(),String(95-i*5));
  await threshold.fill('85');
  await dialog.getByLabel('连续35天支付比例').fill('70');
  await dialog.getByRole('button',{name:'保存奖励设置'}).click();
  await dialog.getByText('奖励设置已保存',{exact:true}).waitFor();
  assert.deepEqual(saved,{streak_threshold:85,streak_discount_enabled:false,streak_discount_tiers:[7,14,21,28,35].map((days,i)=>({days,discount_percent:i===4?70:95-i*5}))});
  assert.deepEqual(errors,[]);
  console.log('Merged UI regression passed: stale dates, real PNG share, reachable complete streak settings, exact API roundtrip.');
} finally { await browser?.close(); await server.close(); }
