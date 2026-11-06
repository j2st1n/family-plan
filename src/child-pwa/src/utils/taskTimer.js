const timerKey=id=>`family_plan_timer_v1:${id}`;
const queueKey=id=>`family_plan_completion_v1:${id}`;
const read=(key,fallback)=>{try{return JSON.parse(localStorage.getItem(key))??fallback;}catch{return fallback;}};
export const readTimer=id=>read(timerKey(id),null);
export const readCompletions=id=>read(queueKey(id),{});
export function saveTimer(id,timer){if(timer)localStorage.setItem(timerKey(id),JSON.stringify(timer));else localStorage.removeItem(timerKey(id));return timer;}
export function timerMilliseconds(timer,now=Date.now()) {
 if(!timer)return 0;
 return Math.max(0,Number(timer.accumulatedMs)||0)+(timer.phase==='running'?Math.max(0,now-timer.runningSince):0);
}
export function startTimer(id,task,now=Date.now()) {
 const current=readTimer(id);
 if(current&&current.taskId!==task.id)throw new Error('请先完成或取消当前任务的计时');
 if(readCompletions(id)[task.id])throw new Error('这个任务的完成结果正在等待同步');
 if(current?.phase==='running')return current;
 return saveTimer(id,{taskId:task.id,title:task.title,phase:'running',accumulatedMs:current?.accumulatedMs||0,runningSince:now});
}
export function pauseTimer(id,now=Date.now()) {
 const timer=readTimer(id);if(!timer)return null;
 return saveTimer(id,{...timer,phase:'paused',accumulatedMs:timerMilliseconds(timer,now),runningSince:null});
}
export function freezeCompletion(id,task,now=Date.now()) {
 const queue=readCompletions(id);
 if(queue[task.id])return queue[task.id];
 const timer=readTimer(id);
 const packet={taskId:task.id,operation_id:crypto.randomUUID(),expected_version:task.completion_version??0};
 if(timer?.taskId===task.id){
   if(timer.phase==='running' && now<timer.runningSince)throw new Error('设备时间有变化，请核对或取消计时');
   const ms=timerMilliseconds(timer,now);
   if(ms>86400000)throw new Error('计时超过24小时，请先核对或取消计时');
   packet.actual_seconds=Math.floor(ms/1000);
   saveTimer(id,{...timer,phase:'stopped',accumulatedMs:ms,runningSince:null});
 }
 queue[task.id]=packet;localStorage.setItem(queueKey(id),JSON.stringify(queue));
 if(timer?.taskId===task.id)saveTimer(id,null);
 return packet;
}
export function acknowledgeCompletion(id,taskId){
 const queue=readCompletions(id);delete queue[taskId];localStorage.setItem(queueKey(id),JSON.stringify(queue));
 if(readTimer(id)?.taskId===taskId)saveTimer(id,null);
}
