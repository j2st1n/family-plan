import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import {mkdir,writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {createServer} from '../src/child-pwa/node_modules/vite/dist/node/index.js';
import {chromium,webkit,devices} from '../src/child-pwa/node_modules/playwright/index.mjs';
const engine=process.env.TIMER_MENU_ENGINE||'webkit';assert.ok(['webkit','chromium'].includes(engine));
const cases=process.env.TIMER_MENU_CASE?[process.env.TIMER_MENU_CASE]:['desktop','ipad','standalone'];
const output=process.env.TIMER_MENU_ARTIFACT_DIR||join(tmpdir(),'family-plan-timer-menu-qa');await mkdir(output,{recursive:true});
const server=await createServer({root:fileURLToPath(new URL('../src/child-pwa/',import.meta.url)),server:{host:'127.0.0.1',port:19211,strictPort:true}});
let browser;
try{
 await server.listen();browser=await(engine==='webkit'?webkit:chromium).launch({...(engine==='chromium'&&process.env.PLAYWRIGHT_BROWSER!=='chromium'?{channel:'chrome'}:{}),headless:true});
 for(const mode of cases){
  assert.ok(['desktop','ipad','standalone'].includes(mode));
  const context=await browser.newContext(mode==='desktop'?{viewport:{width:1024,height:900}}:{...devices['iPad Pro 11']});
  await context.addInitScript(({standalone})=>{
   localStorage.setItem('device_token','synthetic-device');localStorage.setItem('child_profile',JSON.stringify({id:'kid',name:'合成孩子'}));
   Object.defineProperty(navigator,'standalone',{configurable:true,get:()=>standalone});
   window.__menuEvents=[];
   for(const type of ['pointerdown','pointerup','mousedown','mouseup','focusin','focusout','click'])document.addEventListener(type,e=>{
    const role=x=>x?.getAttribute?.('role')||x?.tagName||null;
    window.__menuEvents.push({type,target:role(e.target),related:role(e.relatedTarget),active:role(document.activeElement),menu:!!document.querySelector('[role="menu"]')});
   },true);
  },{standalone:mode==='standalone'});
  let mutations=0;const errors=[];
  await context.route('https://**/*',r=>r.abort());
  await context.route('**/api/v1/**',r=>{
   const p=new URL(r.request().url()).pathname;
   if(r.request().method()!=='GET'){mutations++;return r.fulfill({status:500,json:{error:{message:'Cancellation must stay local'}}});}
   if(p.endsWith('/events'))return r.fulfill({body:': ready\n\n',contentType:'text/event-stream'});
   if(p.endsWith('/today'))return r.fulfill({json:{date:'2026-11-08',child:{id:'kid',name:'合成孩子'},tasks:[{id:'task',title:'演示计时任务',status:'pending',approved:true,created_by:'parent',expected_minutes:20,reward_stars:1,completion_version:0,plan_id:'plan'}],rewards:{stars_total:3,current_streak_days:1}}});
   if(p.endsWith('/items'))return r.fulfill({json:[]});
   if(p.endsWith('/freeze'))return r.fulfill({json:{available_count:0,max_limit:2,star_cost:5,can_purchase:false}});
   throw Error('Unexpected timer-menu API '+p);
  });
  const page=await context.newPage();page.setDefaultTimeout(8000);page.on('pageerror',e=>errors.push(e.message));
  const activate=locator=>mode==='desktop'?locator.click():locator.tap();
  const menuItem=()=>page.getByRole('menuitem',{name:'取消计时',exact:true});
  const timer=()=>page.getByLabel('本机计时',{exact:true});
  async function openMenu(){await activate(page.getByRole('button',{name:'计时选项',exact:true}));await menuItem().waitFor();}
  async function openConfirmation(){await openMenu();await activate(menuItem());await page.getByRole('alertdialog',{name:'取消计时',exact:true}).waitFor();}
  try{
   await page.goto('http://127.0.0.1:19211');assert.equal(await page.evaluate(()=>navigator.standalone),mode==='standalone');
   await activate(page.getByRole('button',{name:'计时',exact:true}));await timer().waitFor();
   const original=await page.evaluate(()=>localStorage.getItem('family_plan_timer_v1:kid'));assert.ok(original);
   await openConfirmation();await page.screenshot({path:join(output,`${engine}-${mode}-confirm.png`)});
   await activate(page.getByRole('alertdialog').getByRole('button',{name:'保留',exact:true}));await page.getByRole('alertdialog').waitFor({state:'detached'});assert.equal(await page.evaluate(()=>localStorage.getItem('family_plan_timer_v1:kid')),original);
   // Replay Safari's observed null-focus transition explicitly, so CI ports with different focus defaults still guard the bug.
   await openMenu();const bounds=await menuItem().boundingBox();assert.ok(bounds);
   await page.mouse.move(bounds.x+bounds.width/2,bounds.y+bounds.height/2);await page.mouse.down();
   assert.equal(await page.getByRole('alertdialog').count(),0,'pointer down alone must not activate cancellation');
   await menuItem().evaluate(e=>e.blur());await page.mouse.up();await page.getByRole('alertdialog').waitFor();
   await activate(page.getByRole('alertdialog').getByRole('button',{name:'保留',exact:true}));await page.getByRole('alertdialog').waitFor({state:'detached'});
   await openMenu();await activate(page.getByRole('heading',{name:'你好，合成孩子',exact:true}));await page.getByRole('menu').waitFor({state:'detached'});assert.equal(await page.getByRole('alertdialog').count(),0,'outside tap dismisses without cancellation');
   await openMenu();await menuItem().press('Escape');await page.getByRole('menu').waitFor({state:'detached'});assert.ok(await page.getByRole('button',{name:'计时选项'}).evaluate(e=>e===document.activeElement),'Escape returns focus');
   await page.getByRole('button',{name:'计时选项'}).press('ArrowDown');await menuItem().waitFor();await menuItem().press('Tab');await page.getByRole('menu').waitFor({state:'detached'});
   await openMenu();await menuItem().press('Enter');await page.getByRole('alertdialog').waitFor();await page.getByRole('button',{name:'保留',exact:true}).press('Enter');await page.getByRole('alertdialog').waitFor({state:'detached'});
   for(const paused of [false,true]){
    if(paused){await activate(page.getByRole('button',{name:'计时',exact:true}));await activate(page.getByRole('button',{name:'暂停',exact:true}));}
    await openConfirmation();await activate(page.getByRole('alertdialog').getByRole('button',{name:'取消计时',exact:true}));await timer().waitFor({state:'detached'});
    assert.equal(await page.evaluate(()=>localStorage.getItem('family_plan_timer_v1:kid')),null);assert.equal(mutations,0,'timer cancellation never completes or modifies a task');
    await page.reload();await page.getByRole('button',{name:'计时',exact:true}).waitFor();assert.equal(await timer().count(),0,'cancelled timer does not return after reload');assert.equal(await page.getByLabel('任务已完成').count(),0);
   }
   assert.deepEqual(errors,[]);console.log(`Timer menu passed: ${engine}/${mode}, native ${mode==='desktop'?'mouse':'touch'} and null-focus replay open confirmation; keep/outside/Escape/Tab/Enter; running/paused cancel persists after reload; zero task mutations.`);
  }catch(error){await writeFile(join(output,`${engine}-${mode}-events.json`),JSON.stringify(await page.evaluate(()=>window.__menuEvents.slice(-30)),null,2));await page.screenshot({path:join(output,`${engine}-${mode}-failure.png`)});throw error;}
  finally{await context.close();}
 }
}finally{await browser?.close();await server.close();}
