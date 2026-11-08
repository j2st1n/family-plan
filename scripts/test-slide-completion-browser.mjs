import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import {createServer} from '../src/child-pwa/node_modules/vite/dist/node/index.js';
import {chromium} from '../src/child-pwa/node_modules/playwright/index.mjs';
import {slideTaskCompletion} from './browser-slide-helpers.mjs';
const server=await createServer({root:fileURLToPath(new URL('../src/child-pwa/',import.meta.url)),server:{host:'127.0.0.1',port:19195,strictPort:true}});
let browser;
try {
 await server.listen();browser=await chromium.launch({...(process.env.PLAYWRIGHT_BROWSER==='chromium'?{}:{channel:'chrome'}),headless:true});
 const context=await browser.newContext({viewport:{width:390,height:844}});
 let task={id:'gesture-task',title:'阅读二十分钟',expected_minutes:1,reward_stars:2,status:'pending',approved:true,created_by:'parent',completion_version:0,plan_id:'plan'};
 let calls=[],delayed=false,resolveComplete;const errors=[];
 await context.addInitScript(()=>{localStorage.setItem('device_token','synthetic');localStorage.setItem('child_profile',JSON.stringify({id:'kid',name:'合成孩子'}));});
 await context.route('https://**/*',r=>r.abort());
 await context.route('**/api/v1/**',async r=>{
  const path=new URL(r.request().url()).pathname;
  if(path.endsWith('/events'))return r.fulfill({body:': ready\n\n',contentType:'text/event-stream'});
  if(path.endsWith('/today'))return r.fulfill({json:{date:'2026-11-07',child:{id:'kid',name:'合成孩子'},tasks:[task],rewards:{stars_total:2,current_streak_days:1}}});
  if(path.endsWith('/items'))return r.fulfill({json:[]});
  if(path.endsWith('/freeze'))return r.fulfill({json:{available_count:0,star_cost:5,max_limit:2,can_purchase:false}});
  if(path.endsWith('/complete')){
   calls.push(r.request().postDataJSON());if(delayed)await new Promise(resolve=>resolveComplete=resolve);
   task={...task,status:'completed',actual_seconds:calls.at(-1).actual_seconds??null};
   return r.fulfill({json:{task_id:task.id,status:'completed',stars_awarded:2,current_streak_days:1}});
  }
  throw Error('Unexpected slide test API '+path);
 });
 const page=await context.newPage();page.setDefaultTimeout(10000);page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://127.0.0.1:19195');const name=task.title;
 const thumb=()=>page.getByRole('button',{name:`滑动完成: ${name}`,exact:true});
 async function geometry(){await thumb().scrollIntoViewIfNeeded();await page.waitForTimeout(220);return thumb().evaluate(e=>{const b=e.getBoundingClientRect(),r=e.parentElement.getBoundingClientRect();return {x:b.x+b.width/2,y:b.y+b.height/2,end:r.right-4-b.width/2};});}
 async function reset(){task={...task,status:'pending',actual_seconds:null,completion_version:task.completion_version+1};calls=[];await page.reload();await thumb().waitFor();}
 await thumb().waitFor();await thumb().click();await page.locator('.slide-complete').click();assert.equal(calls.length,0,'neither thumb nor track tap submits');
 let g=await geometry();
 await page.mouse.move(g.x,g.y);await page.mouse.down();await page.mouse.move((g.x+g.end)/2,g.y,{steps:5});await page.mouse.up();
 assert.equal(calls.length,0,'half drag snaps back');await page.waitForFunction(()=>document.querySelector('.slide-complete-thumb').style.transform==='translateX(0px)');
 g=await geometry();await page.mouse.move(g.x,g.y);await page.mouse.down();await page.mouse.move(g.end,g.y,{steps:8});await page.mouse.move(g.x+20,g.y,{steps:5});await page.mouse.up();assert.equal(calls.length,0,'reaching end then returning does not complete');
 g=await geometry();await page.mouse.move(g.x,g.y);await page.mouse.down();await page.mouse.move(g.end,g.y+70,{steps:8});await page.mouse.up();assert.equal(calls.length,0,'vertical cancellation does not submit');
 await thumb().press('Enter');await page.getByRole('alertdialog').waitFor();assert.equal(calls.length,0,'keyboard activation asks before completing');await page.getByRole('button',{name:'取消',exact:true}).click();assert.equal(calls.length,0);
 delayed=true;await slideTaskCompletion(page,name);await page.getByText('正在提交…',{exact:true}).waitFor();
 assert.equal(calls.length,1);assert.equal(await thumb().count(),0,'no repeat control during request');
 await page.getByText('正在提交…',{exact:true}).click();assert.equal(calls.length,1);resolveComplete();delayed=false;
 await page.getByLabel('任务已完成',{exact:true}).waitFor();assert.equal(await page.getByLabel('任务已完成').locator('svg').count(),1);
 await reset();await thumb().press('Enter');await page.getByRole('button',{name:'确认完成',exact:true}).click();await page.getByLabel('任务已完成').waitFor();assert.equal(calls.length,1,'accessible completion submits once after confirmation');
 await reset();await page.clock.install({time:new Date('2026-11-07T12:00:00Z')});
 await page.getByRole('button',{name:'计时',exact:true}).click();await page.clock.fastForward(65000);
 assert.equal(await thumb().count(),1,'one completion gesture while timing');await slideTaskCompletion(page,name,page.getByLabel('本机计时'));await page.getByLabel('任务已完成').waitFor();assert.equal(calls.length,1);assert.equal(calls[0].actual_seconds,65,'slide preserves final-only timing result');
 await reset();await page.getByRole('button',{name:'专注',exact:true}).click();const focus=page.getByRole('dialog',{name:'专注模式',exact:true});await focus.waitFor();await page.clock.fastForward(60000);
 await focus.getByRole('button',{name:`滑动完成: ${name}`,exact:true}).waitFor();await slideTaskCompletion(page,name,focus);await page.getByLabel('任务已完成').waitFor();assert.equal(calls.length,1,'focus reward completion uses the same gesture');
 await reset();
 // Chromium native touch events exercise real pointer capture rather than synthetic pointer handlers.
 const cdp=await context.newCDPSession(page);await cdp.send('Emulation.setTouchEmulationEnabled',{enabled:true});g=await geometry();
 await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:g.x,y:g.y,id:1}]});await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});assert.equal(calls.length,0,'touch tap does not complete');
 g=await geometry();await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:g.x,y:g.y,id:1}]});
 for(let step=1;step<=12;step++)await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:g.x+(g.end-g.x)*step/12,y:g.y,id:1}]});
 await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await page.getByLabel('任务已完成').waitFor();assert.equal(calls.length,1,'full native touch slide completes once');
 assert.deepEqual(errors,[]);console.log('Slide completion passed: thumb/track taps, partial/backtrack/vertical cancellation, request lock, keyboard cancel/confirm, mouse and native touch, one completion gesture in timer/focus and final-only duration.');
}finally{await browser?.close();await server.close();}
