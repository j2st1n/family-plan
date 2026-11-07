export function plannedEnd(start, minutes) {
  if (!/^\d{2}:\d{2}$/.test(start || '') || !Number.isFinite(Number(minutes)) || Number(minutes) <= 0) return {time:'',label:'自由安排'};
  const [h,m]=start.split(':').map(Number), total=h*60+m+Number(minutes);
  if(h>23 || m>59) return {time:'',label:'自由安排'};
  const time=`${String(Math.floor(total/60)%24).padStart(2,'0')}:${String(total%60).padStart(2,'0')}`;
  return {time,label:`${total>=1440?'次日 ':''}${time}`};
}
export function formatActualSeconds(value) {
  if(value == null) return '';
  const seconds=Math.max(0,Math.floor(Number(value)));
  if(seconds<60) return seconds===0?'小于1秒':`${seconds}秒`;
  return `${Math.floor(seconds/60)}分${seconds%60?`${seconds%60}秒`:''}`;
}

export function formatElapsedSeconds(value) {
  const seconds = Number.isFinite(Number(value)) ? Math.max(0, Math.floor(Number(value))) : 0;
  const pad = n => String(n).padStart(2, '0');
  const minutes = Math.floor(seconds / 60);
  return seconds >= 3600
    ? `${pad(Math.floor(seconds / 3600))}:${pad(minutes % 60)}:${pad(seconds % 60)}`
    : `${pad(minutes)}:${pad(seconds % 60)}`;
}
