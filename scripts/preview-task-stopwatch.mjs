// Isolated synthetic preview; never used in the production build or connected to real accounts.
import {createServer} from '../src/child-pwa/node_modules/vite/dist/node/index.js';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../src/child-pwa/',import.meta.url));
const child={id:'preview-child',name:'小禾'};
const makeTasks=()=>[
 {id:'piano',title:'练琴20分钟',expected_minutes:20,reward_stars:2,status:'pending',approved:true,created_by:'parent',require_approval:false,completion_version:0},
 {id:'reading',title:'读一本喜欢的书',expected_minutes:20,reward_stars:1,status:'pending',approved:true,created_by:'parent',require_approval:false,completion_version:0},
 {id:'exercise',title:'跳绳200下',expected_minutes:10,reward_stars:1,status:'completed',approved:true,created_by:'parent',actual_seconds:null,completion_version:0}
];
let tasks=makeTasks();
const handler=async(req,res,next)=>{
 const url=new URL(req.url,'http://127.0.0.1');
 const json=(data,status=200)=>{res.statusCode=status;res.setHeader('Content-Type','application/json');res.end(JSON.stringify(data));};
 if(url.pathname==='/preview'){
  tasks=makeTasks();const mode=url.searchParams.get('state')||'idle';const theme=url.searchParams.get('theme')||'light';
  const elapsed=Math.max(0,Math.min(86400,Number(url.searchParams.get('elapsed'))||512));
  if(mode==='completed'){tasks[0].status='completed';tasks[0].actual_seconds=elapsed;}
  const timer=mode==='running'||mode==='paused'?{taskId:'piano',title:tasks[0].title,phase:mode,accumulatedMs:mode==='paused'?elapsed*1000:0,runningSince:mode==='running'?Date.now()-elapsed*1000:null}:null;
  res.setHeader('Content-Type','text/html');return res.end(`<meta charset="utf-8"><script>localStorage.clear();localStorage.setItem('device_token','preview-token');localStorage.setItem('child_profile',${JSON.stringify(JSON.stringify(child))});localStorage.setItem('family_plan_theme',${JSON.stringify(theme)});${timer?`localStorage.setItem('family_plan_timer_v1:preview-child',${JSON.stringify(JSON.stringify(timer))});`:''}location.replace('/');</script>`);
 }
 if(!url.pathname.startsWith('/api/'))return next();
 if(url.pathname.endsWith('/events')){res.setHeader('Content-Type','text/event-stream');res.write(': ready\n\n');return;}
 if(url.pathname.endsWith('/child/today'))return json({date:'2026-11-07',child,tasks,rewards:{stars_total:12.5,current_streak_days:7}});
 if(url.pathname.endsWith('/complete')){
  let raw='';for await(const chunk of req)raw+=chunk;const body=JSON.parse(raw||'{}');const task=tasks.find(t=>t.id===url.pathname.split('/').at(-2));
  if(!task)return json({error:{message:'not found'}},404);task.status='completed';task.actual_seconds=body.actual_seconds??null;return json({status:'completed',stars_awarded:task.reward_stars});
 }
 if(url.pathname.endsWith('/shop/freeze'))return json({available_count:0,max_limit:2,star_cost:5,can_purchase:true});
 if(url.pathname.endsWith('/shop/items'))return json([]);
 return json({error:{message:'preview route missing'}},404);
};
const app=await createServer({root,plugins:[{name:'timer-audit-fixture',configureServer(server){server.middlewares.use(handler);}}],server:{host:'127.0.0.1',port:19152,strictPort:true}});
await app.listen();console.log('Timer audit preview: http://127.0.0.1:19152/preview');
