import assert from 'node:assert/strict';
import {slideTaskCompletion} from './browser-slide-helpers.mjs';
import { fileURLToPath } from 'node:url';
import { mkdir, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createServer } from '../src/parent-web/node_modules/vite/dist/node/index.js';
import { chromium } from '../src/child-pwa/node_modules/playwright/index.mjs';
const root = fileURLToPath(new URL('../src/parent-web/', import.meta.url));
const server = await createServer({ root, server: { host: '127.0.0.1', port: 19139, strictPort: true } });
const childRoot = fileURLToPath(new URL('../src/child-pwa/', import.meta.url));
const childServer = await createServer({root:childRoot,server:{host:'127.0.0.1',port:19140,strictPort:true}});
const output=process.env.BROWSER_ARTIFACT_DIR || join(tmpdir(),'family-plan-share-date-regression');
let browser;
try {
  await mkdir(output,{recursive:true});
  await server.listen();
  await childServer.listen();
  browser = await chromium.launch({...(process.env.PLAYWRIGHT_BROWSER==='chromium'?{}:{channel:'chrome'}),headless:true});
  const page = await browser.newPage({viewport:{width:1100,height:900}});
  page.setDefaultTimeout(15000);
  const errors = [];
  page.on('pageerror', err => errors.push(err.message));
  await page.addInitScript(() => {
    localStorage.setItem('family_plan_theme','dark');
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
  const share=page.getByRole('button',{name:'分享自律成长成就海报',exact:true});
  await share.waitFor();
  await date.fill('2026-10-19');
  await page.waitForRequest(r=>r.url().includes('task_date=2026-10-19'));
  await date.fill('2026-10-20');
  await page.getByText('任务 2026-10-20',{exact:true}).waitFor();
  await page.waitForTimeout(650);
  assert.equal(await page.getByText('任务 2026-10-19',{exact:true}).count(),0,'stale date response must not replace selected day');
  const dateBar=page.getByRole('group',{name:'日期与分享'});
  assert.equal(await dateBar.locator('input[type=date]').count(),1);
  assert.ok(!/\d{4}[-/]\d{2}[-/]\d{2}/.test(await dateBar.innerText()),'date exists only in the native date control, not repeated as text');
  assert.equal(await page.getByRole('button',{name:'分享图片',exact:true}).count(),0);
  assert.equal(await dateBar.getByRole('button',{name:/分享/}).count(),1,'one share entry');
  for(const width of [390,768,1440]) {
    await page.setViewportSize({width,height:900});
    const bounds=await dateBar.boundingBox();
    assert.ok(bounds.x>=0 && bounds.x+bounds.width<=width);
    const inputBounds=await date.boundingBox(), shareBounds=await share.boundingBox();
    assert.ok(inputBounds.x+inputBounds.width<=shareBounds.x,'date input must not collide with share icon');
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth),'no horizontal overflow');
    await page.screenshot({animations:'disabled',path:join(output,`parent-dark-${width}.png`)});
  }
  await share.click();
  const shareDialog=page.getByRole('dialog',{name:'分享自律成长成就卡'});
  await shareDialog.getByRole('img',{name:'自律成长成就卡预览'}).waitFor();
  await shareDialog.getByRole('img',{name:'自律成长成就卡预览'}).evaluate(img=>img.decode());
  const download=page.waitForEvent('download');
  await shareDialog.getByRole('button',{name:'保存',exact:true}).click();
  const file=await download;
  assert.ok(file.suggestedFilename().includes('2026-10-20'));
  const pngPath=join(output,'parent-growth-poster.png');await file.saveAs(pngPath);
  assert.deepEqual([...(await readFile(pngPath)).subarray(0,8)],[137,80,78,71,13,10,26,10]);
  await shareDialog.getByRole('button',{name:'完成',exact:true}).click();
  await page.getByRole('button',{name:'前一天',exact:true}).click();
  assert.equal(await date.inputValue(),'2026-10-19');
  await page.getByText('任务 2026-10-19',{exact:true}).waitFor();
  await page.getByRole('button',{name:'后一天',exact:true}).click();
  await page.getByText('任务 2026-10-20',{exact:true}).waitFor();
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
  // Repeat the visible control checks in light mode after a real theme UI action.
  await dialog.getByRole('button',{name:'关闭',exact:true}).click();
  await page.getByRole('button',{name:'关闭',exact:true}).click();
  await page.getByRole('button',{name:'今天',exact:true}).click();
  await page.getByRole('button',{name:'切换明暗主题',exact:true}).click();
  assert.equal(await page.locator('html').getAttribute('data-theme'),'light');
  await page.setViewportSize({width:390,height:900});
  await page.screenshot({animations:'disabled',path:join(output,'parent-light-390.png')});

  const child=await browser.newPage({viewport:{width:768,height:900}});
  child.setDefaultTimeout(15000);
  child.on('pageerror',err=>errors.push(err.message));
  await child.addInitScript(()=>{
    localStorage.setItem('family_plan_theme','dark');
    localStorage.setItem('device_token','synthetic-device-token');
    localStorage.setItem('child_profile',JSON.stringify({id:'kid',name:'合并测试'}));
    const original=window.fetch;
    window.fetch=(input,options)=>String(input).includes('/events')?Promise.resolve(new Response(new ReadableStream({start(c){c.enqueue(new TextEncoder().encode(': connected\n\n'));}}),{headers:{'Content-Type':'text/event-stream'}})):original(input,options);
  });
  await child.route('https://**/*',r=>r.abort());
  let complete=false,writes=0;
  await child.route('**/api/v1/**',async r=>{
    const path=new URL(r.request().url()).pathname;
    if(path.endsWith('/complete')){writes++;await new Promise(resolve=>setTimeout(resolve,400));complete=true;return r.fulfill({json:{status:'completed',stars_awarded:2}});}
    if(path.endsWith('/today'))return r.fulfill({json:{date:'2026-10-20',tasks:[{id:'task',title:'测试阅读',status:complete?'completed':'pending',approved:true,reward_stars:2,expected_minutes:10}],rewards:{stars_total:complete?22:20,current_streak_days:12}}});
    if(path.includes('/shop/'))return r.fulfill({json:path.endsWith('/freeze')?{available_count:0,star_cost:5,max_limit:2}:[]});
    throw new Error(`Unexpected mocked child API ${path}`);
  });
  await child.goto('http://127.0.0.1:19140');
  const childShare=child.getByRole('button',{name:'分享今日自律成就卡',exact:true});
  await childShare.waitFor();
  assert.equal(await child.getByRole('button',{name:'分享图片',exact:true}).count(),0);
  assert.equal(await child.getByRole('button',{name:/^分享/}).count(),1);
  assert.equal(await child.getByRole('heading',{name:'你好，合并测试',exact:true}).count(),1);
  for(const width of [390,768]){
    await child.setViewportSize({width,height:900});
    assert.ok(await child.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth));
    await child.screenshot({animations:'disabled',path:join(output,`child-dark-${width}.png`)});
  }
  await childShare.click();
  const childDialog=child.getByRole('dialog',{name:'分享自律成长成就卡'});
  await childDialog.getByRole('img',{name:'自律成长成就卡预览'}).waitFor();
  await childDialog.getByRole('img',{name:'自律成长成就卡预览'}).evaluate(img=>img.decode());
  const childDownload=child.waitForEvent('download');await childDialog.getByRole('button',{name:'保存',exact:true}).click();
  const childFile=await childDownload;const childPng=join(output,'child-growth-poster.png');await childFile.saveAs(childPng);
  assert.deepEqual([...(await readFile(childPng)).subarray(0,8)],[137,80,78,71,13,10,26,10]);
  await childDialog.getByRole('button',{name:'完成',exact:true}).click();
  const mutation=child.waitForRequest(r=>r.url().endsWith('/complete'));
  await slideTaskCompletion(child,'测试阅读');await mutation;
  assert.equal(await childShare.isDisabled(),true);
  await child.getByLabel('任务已完成').waitFor();
  await childShare.waitFor({state:'visible'});
  await child.waitForFunction(()=>document.querySelector('[aria-label="分享今日自律成就卡"]')?.disabled===false);
  assert.equal(writes,1);
  assert.deepEqual(errors,[]);
  console.log('UI regression passed: one date, one growth-poster entry per app, responsive layouts, real PNG downloads, date race/navigation, child mutation guard, complete streak settings.');
} finally { await browser?.close(); await server.close(); await childServer.close(); }
