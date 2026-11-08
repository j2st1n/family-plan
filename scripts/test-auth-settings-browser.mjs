import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import {mkdir} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createServer} from '../src/child-pwa/node_modules/vite/dist/node/index.js';
import {chromium} from '../src/child-pwa/node_modules/playwright/index.mjs';
const servers=await Promise.all(['parent-web','child-pwa'].map((app,i)=>createServer({root:fileURLToPath(new URL(`../src/${app}/`,import.meta.url)),server:{host:'127.0.0.1',port:19163+i,strictPort:true}})));
let browser;
try {
 for(const server of servers)await server.listen();
 browser=await chromium.launch({...(process.env.PLAYWRIGHT_BROWSER==='chromium'?{}:{channel:'chrome'}),headless:true});
 const errors=[],writes=[];let failAuth=true,release;
 const childName='合成孩子的较长姓名用于验证顶栏省略显示';
 const artifacts=process.env.BROWSER_ARTIFACT_DIR || join(tmpdir(),'family-plan-header-brand-qa');
 await mkdir(artifacts,{recursive:true});
 const context=await browser.newContext({viewport:{width:1280,height:900}});
 await context.route('https://**/*',r=>r.abort());
 await context.route('**/api/v1/**',async r=>{
  const p=new URL(r.request().url()).pathname;
  if(p.includes('/events'))return r.fulfill({body:': ready\n\n',contentType:'text/event-stream'});
  if(p==='/api/v1/children')return r.fulfill({json:[{id:'kid',name:childName,streak_threshold:80}]});
  if(p.endsWith('/dashboard'))return r.fulfill({json:{today:{submitted_tasks:0},rewards:{stars_total:1,current_streak_days:0}}});
  if(p.endsWith('/daily-tasks'))return r.fulfill({json:{date:'2026-11-07',tasks:[],rewards:{stars_total:1,current_streak_days:0}}});
  if(p==='/api/v1/plans')return r.fulfill({json:[]});
  if(p==='/api/v1/ai/settings')return r.fulfill({json:{provider:'deepseek',is_enabled:false,has_api_key:false,model:'test'}});
  if(['/api/v1/auth/login','/api/v1/auth/register','/api/v1/child-devices/bind'].includes(p)) {
   writes.push({path:p,body:r.request().postDataJSON()});
   if(failAuth)return r.fulfill({status:400,json:{error:{message:'合成验证失败'}}});
   if(release)await new Promise(resolve=>release.resolve=resolve);
   return r.fulfill({json:p.endsWith('/bind')?{device_token:'synthetic-device',child:{id:'kid',name:'合成孩子'}}:{token:'synthetic-parent'}});
  }
  if(p==='/api/v1/child/today')return r.fulfill({json:{date:'2026-11-07',tasks:[],rewards:{stars_total:1,current_streak_days:0}}});
  if(p.endsWith('/shop/items'))return r.fulfill({json:[]});
  if(p.endsWith('/shop/freeze'))return r.fulfill({json:{available_count:0,max_limit:2,star_cost:5,can_purchase:false}});
  throw Error('Unexpected auth fixture API '+p);
 });
 const parent=await context.newPage();parent.on('pageerror',e=>errors.push(e.message));
 await parent.goto('http://127.0.0.1:19163');
 assert.equal(await parent.getByLabel('用户名',{exact:true}).getAttribute('autocomplete'),'username');
 assert.equal(await parent.getByLabel('密码',{exact:true}).getAttribute('autocomplete'),'current-password');
 assert.equal(await parent.evaluate(()=>document.activeElement.tagName),'BODY','no automatic keyboard on load');
 await parent.getByRole('button',{name:'登录',exact:true}).click();await parent.getByRole('alert').filter({hasText:'请填写用户名和密码'}).waitFor();assert.equal(writes.length,0);
 await parent.getByLabel('用户名',{exact:true}).fill('  demo  ');await parent.getByLabel('密码',{exact:true}).fill('synthetic-password');
 await parent.getByLabel('密码',{exact:true}).press('Enter');await parent.getByRole('alert').filter({hasText:'合成验证失败'}).waitFor();
 assert.deepEqual(writes.at(-1),{path:'/api/v1/auth/login',body:{username:'demo',password:'synthetic-password'}});
 assert.equal(await parent.getByLabel('用户名',{exact:true}).inputValue(),'  demo  ');
 await parent.getByRole('button',{name:'没有账号？注册',exact:true}).click();assert.equal(await parent.getByRole('alert').count(),0);
 assert.equal(await parent.getByLabel('密码',{exact:true}).getAttribute('autocomplete'),'new-password');
 for(const width of [320,390,834,1280]) {
  await parent.setViewportSize({width,height:700});assert.ok(await parent.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  assert.ok(await parent.locator('.auth-submit').evaluate(e=>e.getBoundingClientRect().height>=44));
 }
 failAuth=false;release={};await parent.getByRole('button',{name:'注册',exact:true}).click();await parent.getByRole('button',{name:'处理中…',exact:true}).waitFor();
 assert.ok(await parent.getByRole('button',{name:'已有账号？登录',exact:true}).isDisabled());
 while(!release.resolve)await new Promise(resolve=>setTimeout(resolve,10));release.resolve();release=null;
 await parent.getByRole('button',{name:'设置',exact:true}).first().waitFor();
 assert.equal(await parent.evaluate(()=>localStorage.getItem('parent_token')),'synthetic-parent');
 assert.equal(writes.at(-1).path,'/api/v1/auth/register');
 const header=parent.locator('.app-header'),brand=header.locator('.app-header-brand');
 await brand.getByRole('img',{name:'Family Habit Planner',exact:true}).evaluate(img=>img.decode());
 assert.equal(await brand.locator('.app-header-child').getAttribute('title'),childName);
 assert.equal((await brand.innerText()).trim(),childName);
 assert.ok(await brand.locator('.app-header-child').evaluate(e=>{const s=getComputedStyle(e);return parseFloat(s.fontSize)>=18&&Number(s.fontWeight)>=600&&s.color==='rgb(29, 29, 31)';}),'child name has primary readable weight and color');
 for(const scheme of ['light','dark']) {
  await parent.emulateMedia({colorScheme:scheme});
  for(const width of [320,390,767,768,834,1280]) {
   await parent.setViewportSize({width,height:900});
   assert.ok(await header.evaluate(e=>{const r=e.getBoundingClientRect();return r.left>=0&&r.right<=innerWidth&&e.scrollWidth<=e.clientWidth;}),'header fits at '+width);
   const bounds=await brand.boundingBox(), controls=await header.locator('.app-header-controls').boundingBox();
   assert.ok(bounds.x+bounds.width+8<=controls.x,'brand and navigation do not overlap at '+width);
   assert.ok(controls.x+controls.width<=width,'navigation remains within viewport');
   const nav=parent.locator(width>=768?'.desktop-nav-links':'.bottom-tabbar');
   assert.equal(await nav.getByRole('button',{name:'今天',exact:true}).count(),1);
   assert.equal(await header.getByText('今天',{exact:true}).count(),1,'one desktop Today label only');
   assert.equal(await brand.getByText('Small steps. Shared growth.',{exact:true}).count(),0,'no full slogan in compact header');
   if(width===390 || width===834) await parent.screenshot({path:join(artifacts,`parent-header-${scheme}-${width}.png`),animations:'disabled'});
  }
 }
 await parent.getByRole('button',{name:'设置',exact:true}).first().click();
 assert.equal((await brand.innerText()).trim(),childName,'brand stays stable when navigating');
 const theme=parent.locator('.settings-theme-row'),group=parent.getByRole('group',{name:'外观主题切换'});
 for(const scheme of ['light','dark']) {
  await parent.emulateMedia({colorScheme:scheme});await group.getByRole('button',{name:'系统',exact:true}).click();
  await parent.getByText('跟随系统',{exact:true}).waitFor();
  assert.equal(await group.getByRole('button',{name:'系统',exact:true}).getAttribute('aria-pressed'),'true');
  assert.equal(await theme.getByText(/跟随系统\s*\(/).count(),0);
 }
 for(const width of [320,390,834,1280]) {
  await parent.setViewportSize({width,height:900});
  const x=await parent.getByText('外观与主题',{exact:true}).evaluate(e=>e.getBoundingClientRect().left);
  const prior=await parent.getByText('AI 智能助手',{exact:true}).evaluate(e=>e.getBoundingClientRect().left);
  assert.ok(Math.abs(x-prior)<1,'theme title aligns at '+width);
  assert.ok(await parent.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  assert.ok(await group.evaluate(e=>{const r=e.getBoundingClientRect();return r.left>=0&&r.right<=innerWidth;}));
 }
 const kid=await context.newPage();kid.on('pageerror',e=>errors.push(e.message));await kid.goto('http://127.0.0.1:19164');
 const code=kid.getByLabel('设备访问码',{exact:true});assert.equal(await code.getAttribute('autocomplete'),'one-time-code');
 await code.fill('12a3');assert.equal(await code.inputValue(),'123');await kid.getByRole('button',{name:'绑定设备',exact:true}).click();
 await kid.getByRole('alert').filter({hasText:'请输入 6 位数字访问码'}).waitFor();assert.equal(writes.filter(w=>w.path.endsWith('/bind')).length,0);
 failAuth=true;await code.fill('123456');await code.press('Enter');await kid.getByRole('alert').filter({hasText:'合成验证失败'}).waitFor();
 assert.deepEqual(writes.at(-1),{path:'/api/v1/child-devices/bind',body:{code:'123456',display_name:'iPad'}});
 for(const width of [320,390,834]) {
  await kid.setViewportSize({width,height:700});assert.ok(await kid.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  assert.ok(await kid.locator('.auth-submit').evaluate(e=>e.getBoundingClientRect().height>=44));
 }
 failAuth=false;await code.press('Enter');await kid.getByRole('button',{name:'今天',exact:true}).waitFor();
 assert.equal(await kid.evaluate(()=>localStorage.getItem('device_token')),'synthetic-device');
 await kid.locator('.child-today-header').getByRole('img',{name:'Family Habit Planner',exact:true}).evaluate(img=>img.decode());
 await kid.getByText('今天还没有任务',{exact:true}).waitFor();
 assert.equal(await kid.getByText('今天的所有任务都整理好啦',{exact:true}).count(),0,'empty day is not described as completed');
 await kid.getByRole('button',{name:'+ 添加日常任务',exact:true}).click();await kid.getByText('添加任务',{exact:true}).waitFor();
 await kid.getByRole('button',{name:'取消',exact:true}).click();
 for(const scheme of ['light','dark'])for(const width of [320,390,834,1280]) {
  await kid.emulateMedia({colorScheme:scheme});await kid.setViewportSize({width,height:900});
  assert.ok(await kid.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'child identity fits '+width);
  const geometry=await kid.locator('.child-today-header').evaluate(e=>{const title=e.querySelector('h1').getBoundingClientRect(),tools=e.querySelector('.child-today-tools').getBoundingClientRect();return{right:tools.right,noOverlap:title.right<=tools.left||title.bottom<=tools.top};});
  assert.ok(geometry.right<=width&&geometry.noOverlap,'identity and utility controls do not overlap');
  assert.ok(await kid.locator('.child-today-tools button').evaluateAll(es=>es.every(e=>{let r=e.getBoundingClientRect();return r.width>=44&&r.height>=44;})),'44px child utility targets');
 }

 assert.deepEqual(errors,[]);
 console.log('Auth/settings browser passed: login/register and binding, authenticated brand mark/child name and no duplicated title, long-name bounds at 320/390/767/768/834/1280 in light/dark, stable brand across navigation, unchanged payload/session, theme text/alignment.');
} finally {await browser?.close();for(const server of servers)await server.close();}
