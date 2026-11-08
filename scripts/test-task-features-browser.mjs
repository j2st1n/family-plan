import assert from 'node:assert/strict';
import {slideTaskCompletion} from './browser-slide-helpers.mjs';
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
 let stars=6, created, childCreated, mutationBodies=[],failCompletion=false,redeemCount=0,parentPosts=0;
 let failCopilotPublish=false,publishWait=null,parseWait=null;const publishBodies=[];
 const today=()=>({date:'2026-11-06',tasks,rewards:{stars_total:stars,current_streak_days:12}});
 const goods=[{id:'item',title:'折扣礼物',status:'active',star_cost:10,discounted_star_cost:8,stock:2}];
 await context.route('https://**/*',r=>r.abort());
 await context.route('**/api/v1/**',async route=>{
  const req=route.request(),url=new URL(req.url()),p=url.pathname;
  if(p==='/api/v1/children')return route.fulfill({json:[{id:'kid',name:'测试孩子',streak_threshold:80}]});
  if(p.endsWith('/dashboard'))return route.fulfill({json:{today:{submitted_tasks:0},rewards:today().rewards}});
  if(p==='/api/v1/plans')return route.fulfill({json:[{id:'plan',status:'active',tasks:[]}]});
  if(p.endsWith('/daily-tasks')){if(req.method()==='POST'){parentPosts++;created=req.postDataJSON();publishBodies.push(created);if(publishWait)await publishWait;if(failCopilotPublish){failCopilotPublish=false;return route.fulfill({status:500,json:{error:{message:'合成发布失败'}}});}return route.fulfill({status:201,json:created.tasks});}return route.fulfill({json:today()});}
  if(p==='/api/v1/ai/copilot/parse-tasks'){if(parseWait)await parseWait;return route.fulfill({json:{raw_summary:'分类校验草稿',resolved_date:'2026-11-06',tasks:[{title:'AI分类任务',expected_minutes:20,reward_stars:1,category:'未知分类'}]}});}
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
 await parent.getByRole('group',{name:'习惯分类（必填）',exact:true}).getByRole('button',{name:'🏃 体育运动',exact:true}).click();
 assert.equal(await parent.getByRole('button',{name:'🏃 体育运动',exact:true}).getAttribute('aria-pressed'),'true');
 await parent.getByRole('button',{name:'添加',exact:true}).click();
 await parent.getByText('自定义奖励',{exact:true}).waitFor({state:'detached'}).catch(()=>{});
 assert.equal(created.tasks[0].reward_stars,8);assert.equal(created.tasks[0].scheduled_end,'00:15');assert.equal(created.tasks[0].description,'[体育运动]');
 await parent.getByRole('button',{name:'AI 建议建任务',exact:true}).click();
 await parent.getByPlaceholder(/^如：每天晚上7点/).fill('新增一个分类任务');await parent.getByRole('button',{name:'开始智能解析',exact:true}).click();
 await parent.getByRole('button',{name:'发布',exact:true}).click();await parent.getByText('请为每个任务选择习惯分类',{exact:true}).waitFor();assert.equal(parentPosts,1);
 await parent.getByRole('button',{name:'🧹 家务协助',exact:true}).click();await parent.getByRole('button',{name:'发布',exact:true}).click();
 await parent.getByText('AI 智能建任务',{exact:true}).waitFor({state:'detached'});assert.equal(parentPosts,2);assert.equal(created.tasks[0].description,'[家务协助]');
 // The closed Copilot stays mounted: successful publication must consume its local draft.
 const aiPrompt=parent.getByPlaceholder(/^如：每天晚上7点/);
 async function openCopilot(){await parent.getByRole('button',{name:'AI 建议建任务',exact:true}).click();await aiPrompt.waitFor();}
 async function assertFreshCopilot(){assert.equal(await aiPrompt.inputValue(),'');assert.equal(await parent.locator('#draft-task-title-0').count(),0);assert.equal(await parent.getByRole('button',{name:'发布',exact:true}).count(),0);assert.equal(await parent.getByRole('button',{name:/^确认发布/}).count(),0);assert.equal(await parent.getByText(/发布任务失败/).count(),0);}
 await openCopilot();await assertFreshCopilot();assert.equal(parentPosts,2,'reopening a consumed draft sends no write');
 await aiPrompt.fill('保留失败后的编辑');await parent.getByRole('button',{name:'开始智能解析',exact:true}).click();
 const draftTitle=parent.locator('#draft-task-title-0');await draftTitle.waitFor();
 await parent.getByRole('button',{name:'🧹 家务协助',exact:true}).click();await draftTitle.fill('重试保留草稿');
 await parent.getByRole('button',{name:'自定义',exact:true}).click();await parent.getByLabel('自定义奖励星星').fill('8');
 const draftDate=await parent.locator('.ios-sheet-content input[type="date"]').inputValue();
 await parent.getByRole('button',{name:'取消',exact:true}).click();await openCopilot();
 assert.equal(await aiPrompt.inputValue(),'保留失败后的编辑');assert.equal(await draftTitle.inputValue(),'重试保留草稿');assert.equal(parentPosts,2,'cancel retains the unsent draft');
 failCopilotPublish=true;let releasePublish;publishWait=new Promise(resolve=>releasePublish=resolve);
 await parent.getByRole('button',{name:'发布',exact:true}).click();await parent.getByRole('button',{name:'正在发布中…',exact:true}).waitFor();
 assert.ok(await parent.getByRole('button',{name:'发布中…',exact:true}).isDisabled());assert.ok(await parent.getByRole('button',{name:'正在发布中…',exact:true}).isDisabled());assert.ok(await parent.getByRole('button',{name:'开始智能解析',exact:true}).isDisabled(),'no new parse can refill a consumed draft during publication');
 releasePublish();publishWait=null;await parent.getByText('发布任务失败：合成发布失败',{exact:true}).waitFor();
 assert.equal(parentPosts,3);assert.equal(await aiPrompt.inputValue(),'保留失败后的编辑');assert.equal(await draftTitle.inputValue(),'重试保留草稿');assert.equal(await parent.getByLabel('自定义奖励星星').inputValue(),'8');assert.equal(await parent.locator('.ios-sheet-content input[type="date"]').inputValue(),draftDate);
 const failedBody=publishBodies.at(-1);await parent.getByRole('button',{name:/^确认发布/}).click();
 await parent.getByText('AI 智能建任务',{exact:true}).waitFor({state:'detached'});assert.equal(parentPosts,4);assert.deepEqual(publishBodies.at(-1),failedBody,'retry preserves title, category, reward and date');
 await openCopilot();await assertFreshCopilot();assert.equal(parentPosts,4,'footer success clears draft and error without reposting');
 await aiPrompt.fill('全新的任务');await parent.getByRole('button',{name:'开始智能解析',exact:true}).click();await draftTitle.waitFor();
 let releaseParse;parseWait=new Promise(resolve=>releaseParse=resolve);await parent.getByRole('button',{name:'开始智能解析',exact:true}).click();await parent.getByRole('button',{name:'正在智能解析中…',exact:true}).waitFor();
 assert.ok(await parent.getByRole('button',{name:'发布',exact:true}).isDisabled());assert.ok(await parent.getByRole('button',{name:/^确认发布/}).isDisabled(),'no publication overlaps an in-flight parse');
 releaseParse();parseWait=null;await parent.getByRole('button',{name:'开始智能解析',exact:true}).waitFor();assert.equal(parentPosts,4);await parent.getByRole('button',{name:'取消',exact:true}).click();

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
 const actions=kid.getByRole('group',{name:'任务操作：计时任务',exact:true});
 const complete=kid.getByRole('button',{name:'滑动完成: 计时任务',exact:true});
 assert.equal(await complete.locator('svg').count(),1,'pending thumb has a direction icon, not a completion check');
 assert.equal(await actions.getByRole('button').allTextContents().then(a=>a.map(s=>s.trim()).join('|')),'计时|专注|安排时间');
 assert.equal(await kid.getByLabel('任务选项：计时任务',{exact:true}).count(),0,'common actions are not hidden in a menu');
 for(const theme of ['light','dark']){
  await kid.emulateMedia({colorScheme:theme});
  for(const width of [320,390,834,1280]){
   await kid.setViewportSize({width,height:950});await kid.clock.runFor(32);
   assert.ok(await kid.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'task actions fit '+width);
   const bounds=await actions.getByRole('button').evaluateAll(nodes=>nodes.map(e=>{const r=e.getBoundingClientRect(),s=getComputedStyle(e);return {x:r.x,y:r.y,right:r.right,bottom:r.bottom,width:r.width,height:r.height,font:s.font,color:s.color};}));
   if(width>=390)assert.equal(new Set(bounds.map(b=>b.y)).size,1,'common actions share a row when space allows');
   assert.equal(new Set(bounds.map(b=>b.font+'|'+b.color)).size,1,'all actions have the same typography/color');
   for(const b of bounds)assert.ok(b.width>=44&&b.height>=44&&b.x>=0&&b.right<=width,'visible touch target');
   for(let a=0;a<bounds.length;a++)for(let b=a+1;b<bounds.length;b++)assert.ok(bounds[a].right<=bounds[b].x||bounds[b].right<=bounds[a].x||bounds[a].bottom<=bounds[b].y||bounds[b].bottom<=bounds[a].y,'actions do not overlap');
   assert.ok(await complete.evaluate(e=>{const r=e.getBoundingClientRect();return r.width>=44&&r.height>=44&&r.right<=innerWidth;}));
   if(screenshotDir&&(width===390||width===834))await kid.screenshot({animations:'disabled',path:`${screenshotDir}/task-actions-${theme}-${width}.png`});
  }
 }
 await kid.setViewportSize({width:768,height:950});
 await actions.getByRole('button',{name:'专注',exact:true}).click();
 await kid.getByLabel('关闭专注模式',{exact:true}).waitFor();
 await kid.getByLabel('关闭专注模式',{exact:true}).click();
 await kid.getByRole('button',{name:'确认结束',exact:true}).click();
 await kid.getByLabel('关闭专注模式',{exact:true}).waitFor({state:'detached'});
 await actions.getByRole('button',{name:'安排时间',exact:true}).click();await kid.getByLabel('开始小时',{exact:true}).waitFor();
 await kid.getByRole('button',{name:'取消',exact:true}).click();
 await kid.getByRole('button',{name:'计时',exact:true}).first().click();
 assert.equal(await kid.getByRole('button',{name:'滑动完成: 计时任务',exact:true}).count(),1,'one slide completion control while timing');
 await kid.getByLabel('计时选项',{exact:true}).click();await kid.getByRole('menuitem',{name:'取消计时',exact:true}).press('Escape');
 assert.equal(await kid.getByRole('menu').count(),0);
 assert.equal(await kid.getByLabel('计时选项',{exact:true}).evaluate(e=>e===document.activeElement),true);
 await kid.getByLabel('计时选项',{exact:true}).click();await kid.getByRole('menuitem',{name:'取消计时',exact:true}).click();
 await kid.getByRole('alertdialog').waitFor();await kid.getByRole('button',{name:'保留',exact:true}).click();
 await kid.getByLabel('本机计时').waitFor();
 await kid.clock.fastForward(65000);await kid.getByLabel('本机计时').filter({hasText:'01:05'}).waitFor();
 await kid.getByRole('button',{name:'暂停',exact:true}).click();await kid.getByRole('status').filter({hasText:'已暂停'}).waitFor();await kid.clock.fastForward(60000);
 assert.ok((await kid.getByLabel('本机计时').innerText()).includes('01:05'));
 await kid.getByRole('button',{name:'继续',exact:true}).click();await kid.clock.fastForward(60000);
 assert.equal(mutationBodies.length,0,'timer actions must never upload a running timer');
 await kid.reload();await kid.getByLabel('本机计时').filter({hasText:'02:05'}).waitFor();
 assert.equal(await parent.getByText(/计时中|未记录/).count(),0);
 failCompletion=true;await slideTaskCompletion(kid,'计时任务',kid.getByLabel('本机计时'));
 await kid.getByText('完成结果待同步，联网后会自动重试',{exact:true}).waitFor();
 await kid.getByText('完成结果待同步',{exact:true}).first().waitFor();
 assert.equal(mutationBodies[0].actual_seconds,125);const operation=mutationBodies[0].operation_id;
 assert.equal(tasks[0].actual_seconds,undefined,'failed request did not publish the result');
 await kid.evaluate(()=>window.dispatchEvent(new Event('online')));
 await kid.getByLabel('任务已完成').first().waitFor();assert.equal(mutationBodies[1].operation_id,operation);
 await kid.locator('.task-actual-duration').filter({hasText:'02:05'}).waitFor();
 await parent.reload();await parent.getByText(/用时 2分5秒/).waitFor();
 await kid.getByRole('button',{name:'计时',exact:true}).click();await kid.clock.fastForward(3600000);
 await kid.getByLabel('本机计时').filter({hasText:'01:00:00'}).waitFor();
 for(const width of [320,390,834]){
  await kid.setViewportSize({width,height:950});
  assert.ok(await kid.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'no horizontal overflow at '+width);
  assert.ok(await kid.locator('.task-stopwatch-actions button,.task-stopwatch-options,.task-text-action').evaluateAll(es=>es.every(e=>{const r=e.getBoundingClientRect();return r.width>=44&&r.height>=44;})),'44px timer touch targets');
  assert.ok(await kid.locator('.task-stopwatch-digits').evaluate(e=>e.scrollWidth<=e.clientWidth),'long elapsed value fits');
 }
 await kid.getByLabel('计时选项',{exact:true}).click();await kid.getByRole('menuitem',{name:'取消计时',exact:true}).click();
 await kid.getByRole('alertdialog').getByRole('button',{name:'取消计时',exact:true}).click();
 await kid.getByLabel('本机计时').waitFor({state:'detached'});
 assert.equal(mutationBodies.length,2,'cancelling a local timer never uploads');
 await slideTaskCompletion(kid,'普通任务');await kid.getByLabel('任务已完成').nth(1).waitFor();
 assert.equal(await kid.getByLabel('任务已完成').nth(1).locator('svg').count(),1,'checkmark appears only after completion');
 assert.ok(!('actual_seconds' in mutationBodies.at(-1)));
 assert.equal(await kid.getByText('未记录',{exact:true}).count(),0);
 // Balance is now 9. A successful 8-star redemption must disable the remaining item.
 await kid.getByRole('button',{name:'商城',exact:true}).click();
 const redeem=kid.getByRole('button',{name:'兑换折扣礼物',exact:true});await redeem.waitFor();assert.ok(await redeem.isEnabled());
 await redeem.click();await kid.getByRole('button',{name:'立即兑换',exact:true}).click();
 const short=kid.getByRole('button',{name:'还差7星',exact:true});await short.waitFor();assert.ok(await short.isDisabled());assert.equal(redeemCount,1);
 await kid.setViewportSize({width:390,height:850});assert.ok(await kid.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
 assert.deepEqual(errors,[]);
 console.log('Feature browser passed: Copilot consumes published drafts, retains cancelled/failed edits for retry, guards parse/publish overlap; deliberate slide completion, directly visible matching timer/focus/schedule controls, responsive light/dark touch targets and focus entry; parent rewards/schedule, local-only timer, pause/reload/retry, final duration and affordability preserved.');
}finally{await browser?.close();for(const s of servers)await s.close();}
