import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
const screenshotDir=process.env.FORM_SCREENSHOT_DIR;
if(screenshotDir)await mkdir(screenshotDir,{recursive:true});
import {fileURLToPath} from 'node:url';
import {createServer} from '../src/parent-web/node_modules/vite/dist/node/index.js';
import {chromium} from '../src/child-pwa/node_modules/playwright/index.mjs';
const servers=await Promise.all(['parent-web','child-pwa'].map((app,i)=>createServer({root:fileURLToPath(new URL(`../src/${app}/`,import.meta.url)),server:{host:'127.0.0.1',port:19141+i,strictPort:true}})));
let browser;
try{
 for(const s of servers)await s.listen();
 browser=await chromium.launch({...(process.env.PLAYWRIGHT_BROWSER==='chromium'?{}:{channel:'chrome'}),headless:true});
 const context=await browser.newContext({viewport:{width:768,height:950}});const parent=await context.newPage();parent.setDefaultTimeout(15000);
 const errors=[];parent.on('pageerror',e=>errors.push(e.message));
 await context.addInitScript(()=>{
  const original=window.fetch;window.fetch=(input,options)=>String(input).includes('/events')?Promise.resolve(new Response(new ReadableStream({start(c){c.enqueue(new TextEncoder().encode(': connected\n\n'));}}),{headers:{'Content-Type':'text/event-stream'}})):original(input,options);
  localStorage.setItem('parent_token','synthetic-token');localStorage.setItem('parent_active_tab','today');localStorage.setItem('device_token','synthetic-device');localStorage.setItem('child_profile',JSON.stringify({id:'kid',name:'测试孩子'}));
 });
 let tasks=[{id:'timed',title:'计时任务',status:'pending',approved:true,created_by:'parent',require_approval:false,reward_stars:2,expected_minutes:20,completion_version:0,plan_id:'plan'},
 {id:'plain',title:'普通任务',status:'pending',approved:true,created_by:'parent',require_approval:false,reward_stars:1,expected_minutes:10,completion_version:0,plan_id:'plan'}];
 let stars=6, created, childCreated, mutationBodies=[],failCompletion=false,redeemCount=0;
 const today=()=>({date:'2026-11-06',tasks,rewards:{stars_total:stars,current_streak_days:12}});
 const goods=[{id:'item',title:'折扣礼物',status:'active',star_cost:10,discounted_star_cost:8,stock:2}];
 await context.route('https://**/*',r=>r.abort());
 await context.route('**/api/v1/**',async route=>{
  const req=route.request(),url=new URL(req.url()),p=url.pathname;
  if(p==='/api/v1/children')return route.fulfill({json:[{id:'kid',name:'测试孩子',streak_threshold:80}]});
  if(p.endsWith('/dashboard'))return route.fulfill({json:{today:{submitted_tasks:0},rewards:today().rewards}});
  if(p==='/api/v1/plans')return route.fulfill({json:[{id:'plan',status:'active',tasks:[]}]});
  if(p.endsWith('/daily-tasks')){if(req.method()==='POST'){created=req.postDataJSON();return route.fulfill({status:201,json:created.tasks});}return route.fulfill({json:today()});}
  if(p==='/api/v1/child/today')return route.fulfill({json:today()});
  if(p==='/api/v1/child/tasks'&&req.method()==='POST'){childCreated=req.postDataJSON();return route.fulfill({status:201,json:{id:'proposal',...childCreated,approved:false,reward_stars:null}});}
  if(p.endsWith('/complete')){
   const body=req.postDataJSON();mutationBodies.push(body);
   if(failCompletion){failCompletion=false;return route.abort();}
   const id=p.split('/').at(-2),task=tasks.find(t=>t.id===id);task.status='completed';task.actual_seconds=body.actual_seconds??null;stars+=task.reward_stars;
   return route.fulfill({json:{status:'completed',stars_awarded:task.reward_stars}});
  }
  if(p.endsWith('/shop/items'))return route.fulfill({json:goods});
  if(p.endsWith('/shop/freeze'))return route.fulfill({json:{available_count:0,star_cost:5,max_limit:2,can_purchase:true}});
  if(p.endsWith('/redeem')){redeemCount++;stars-=8;return route.fulfill({json:{id:'redemption'}});}
  if(p==='/api/v1/ai/settings')return route.fulfill({json:{provider:'deepseek',enabled:false,model:'test',has_api_key:false}});
  throw new Error(`Unexpected feature API ${req.method()} ${p}`);
 });
 await parent.goto('http://127.0.0.1:19141');await parent.getByText('计时任务',{exact:true}).waitFor();
 await parent.getByRole('button',{name:'添加日常任务',exact:true}).click();
 assert.equal(await parent.getByLabel('开始分钟',{exact:true}).count(),0);
 assert.equal(await parent.getByLabel('计划结束').count(),0);
 assert.equal(await parent.getByText('结束时间（自动）',{exact:true}).count(),0);
 assert.ok((await parent.locator('label[for="parent-task-title"]').innerText()).includes('*'));
 assert.equal(await parent.getByPlaceholder('任务名称，如：练琴20分钟、口算一页...').getAttribute('required'),'');
 assert.ok((await parent.locator('.task-timing-fields').innerText()).includes('（选填）'));
 await parent.getByRole('button',{name:'🌟 1',exact:true}).waitFor();
 if(screenshotDir){for(const theme of ['light','dark']){await parent.emulateMedia({colorScheme:theme});await parent.screenshot({animations:'disabled',path:`${screenshotDir}/parent-${theme}.png`});}}
 await parent.setViewportSize({width:390,height:850});assert.ok(await parent.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
 if(screenshotDir)await parent.screenshot({animations:'disabled',path:`${screenshotDir}/parent-mobile.png`});
 await parent.setViewportSize({width:768,height:950});
 await parent.getByPlaceholder('任务名称，如：练琴20分钟、口算一页...').fill('自定义奖励');
 await parent.getByRole('button',{name:'自定义',exact:true}).click();await parent.getByLabel('自定义奖励星星').fill('8');
 await parent.getByLabel('开始小时',{exact:true}).selectOption('23');await parent.getByLabel('开始分钟',{exact:true}).selectOption('50');
 assert.equal(await parent.getByLabel('计划结束').innerText(),'次日 00:10');
 await parent.getByLabel('预计用时',{exact:true}).selectOption('25');assert.equal(await parent.getByLabel('计划结束').innerText(),'次日 00:15');
 assert.equal(await parent.getByLabel('开始分钟',{exact:true}).locator('option').count(),12);
 await parent.getByLabel('开始小时',{exact:true}).selectOption('');
 assert.equal(await parent.getByLabel('开始分钟',{exact:true}).count(),0);
 assert.equal(await parent.getByLabel('计划结束').count(),0);
 await parent.getByLabel('开始小时',{exact:true}).selectOption('00');
 assert.equal(await parent.getByLabel('计划结束').innerText(),'00:25');
 await parent.getByLabel('开始小时',{exact:true}).selectOption('23');await parent.getByLabel('开始分钟',{exact:true}).selectOption('50');
 await parent.getByRole('button',{name:'添加',exact:true}).click();
 await parent.getByText('自定义奖励',{exact:true}).waitFor({state:'detached'}).catch(()=>{});
 assert.equal(created.tasks[0].reward_stars,8);assert.equal(created.tasks[0].scheduled_end,'00:15');
 const kid=await context.newPage();kid.setDefaultTimeout(15000);kid.on('pageerror',e=>errors.push(e.message));
 await kid.clock.install({time:new Date('2026-11-06T12:00:00Z')});
 await kid.clock.pauseAt(new Date('2026-11-06T12:00:01Z'));
 await kid.goto('http://127.0.0.1:19142');await kid.getByText('计时任务',{exact:true}).waitFor();
 await kid.getByRole('button',{name:'+ 添加日常任务',exact:true}).click();
 assert.equal(await kid.getByRole('group',{name:'奖励星星'}).count(),0);
 assert.equal(await kid.getByLabel('开始分钟',{exact:true}).count(),0);assert.equal(await kid.getByLabel('计划结束').count(),0);
 assert.ok((await kid.locator('label[for="child-task-title"]').innerText()).includes('*'));
 if(screenshotDir){for(const theme of ['light','dark']){await kid.emulateMedia({colorScheme:theme});await kid.screenshot({animations:'disabled',path:`${screenshotDir}/child-${theme}.png`});}}
 await kid.setViewportSize({width:390,height:850});assert.ok(await kid.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
 if(screenshotDir)await kid.screenshot({animations:'disabled',path:`${screenshotDir}/child-mobile.png`});
 await kid.setViewportSize({width:768,height:950});
 await kid.getByLabel('开始小时',{exact:true}).selectOption('00');assert.equal(await kid.getByLabel('计划结束').innerText(),'00:20');
 await kid.getByLabel('开始小时',{exact:true}).selectOption('');assert.equal(await kid.getByLabel('开始分钟',{exact:true}).count(),0);assert.equal(await kid.getByLabel('计划结束').count(),0);
 await kid.getByPlaceholder('任务名称，如：练琴、口算一页...').fill('孩子的建议');
 await kid.getByRole('button',{name:'添加',exact:true}).click();
 assert.ok(!('reward_stars' in childCreated));assert.equal(childCreated.expected_minutes,20);assert.equal(childCreated.scheduled_start,null);assert.equal(childCreated.scheduled_end,null);
 await kid.getByRole('button',{name:'计时',exact:true}).first().click();
 await kid.clock.fastForward(65000);await kid.getByLabel('本机计时').filter({hasText:'1分5秒'}).waitFor();
 await kid.getByRole('button',{name:'暂停',exact:true}).click();await kid.clock.fastForward(60000);
 assert.ok((await kid.getByLabel('本机计时').innerText()).includes('1分5秒'));
 await kid.getByRole('button',{name:'继续',exact:true}).click();await kid.clock.fastForward(60000);
 assert.equal(mutationBodies.length,0,'timer actions must never upload a running timer');
 await kid.reload();await kid.getByLabel('本机计时').filter({hasText:'2分5秒'}).waitFor();
 assert.equal(await parent.getByText(/计时中|未记录/).count(),0);
 failCompletion=true;await kid.getByLabel('标记完成: 计时任务',{exact:true}).click();
 await kid.getByText('完成结果待同步，联网后会自动重试',{exact:true}).waitFor();
 await kid.getByText('完成结果待同步',{exact:true}).first().waitFor();
 assert.equal(mutationBodies[0].actual_seconds,125);const operation=mutationBodies[0].operation_id;
 assert.equal(tasks[0].actual_seconds,undefined,'failed request did not publish the result');
 await kid.evaluate(()=>window.dispatchEvent(new Event('online')));
 await kid.getByLabel('任务已完成').first().waitFor();assert.equal(mutationBodies[1].operation_id,operation);
 await parent.reload();await parent.getByText(/用时 2分5秒/).waitFor();
 await kid.getByLabel('标记完成: 普通任务',{exact:true}).click();await kid.getByLabel('任务已完成').nth(1).waitFor();
 assert.ok(!('actual_seconds' in mutationBodies.at(-1)));
 assert.equal(await kid.getByText('未记录',{exact:true}).count(),0);
 // Balance is now 9. A successful 8-star redemption must disable the remaining item.
 await kid.getByRole('button',{name:'商城',exact:true}).click();
 const redeem=kid.getByRole('button',{name:'兑换折扣礼物',exact:true});await redeem.waitFor();assert.ok(await redeem.isEnabled());
 await redeem.click();await kid.getByRole('button',{name:'立即兑换',exact:true}).click();
 const short=kid.getByRole('button',{name:'还差7星',exact:true});await short.waitFor();assert.ok(await short.isDisabled());assert.equal(redeemCount,1);
 await kid.setViewportSize({width:390,height:850});assert.ok(await kid.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
 assert.deepEqual(errors,[]);
 console.log('Feature browser passed: parent custom reward, linked 5-minute schedule, child reward removal, timer without uploads, pause/reload/offline retry, final-only duration and discounted affordability.');
}finally{await browser?.close();for(const s of servers)await s.close();}
