import {plannedEnd} from './taskTiming.js';
import FieldLabel from './FieldLabel.jsx';
export default function TaskTimingFields({minutes=20,start='',onChange,showDuration=true}) {
  const [hour='',minute='00']=(start||'').split(':');
  const duration=Number(minutes)||20, end=plannedEnd(start,duration);
  const durations=Array.from({length:48},(_,i)=>(i+1)*5);
  if(!durations.includes(duration))durations.push(duration);
  const minuteValues=Array.from({length:12},(_,i)=>String(i*5).padStart(2,'0'));
  if(!minuteValues.includes(minute))minuteValues.push(minute);
  const update=(m,s)=>onChange({minutes:String(m),start:s,end:plannedEnd(s,m).time});
  const style={display:'flex',justifyContent:'space-between',alignItems:'center',gap:8,padding:'10px 16px',flexWrap:'wrap'};
  return <div className="task-timing-fields">
    {showDuration&&<label style={style}><FieldLabel required>预计用时</FieldLabel><select required aria-label="预计用时" className="ios-time-input" value={duration} onChange={e=>update(Number(e.target.value),start)}>{durations.sort((a,b)=>a-b).map(n=><option key={n} value={n}>{n}分钟{n%5?'（原时长）':''}</option>)}</select></label>}
    <div style={style}><FieldLabel>开始时间</FieldLabel><div style={{display:'flex',gap:4,alignItems:'center'}}>
      <select aria-label="开始小时" className="ios-time-input" value={hour} onChange={e=>update(duration,e.target.value?`${e.target.value}:${minute}`:'')}><option value="">自由安排</option>{Array.from({length:24},(_,i)=>String(i).padStart(2,'0')).map(h=><option key={h} value={h}>{h}时</option>)}</select>
      {hour&&<select aria-label="开始分钟" className="ios-time-input" value={minute} onChange={e=>update(duration,`${hour}:${e.target.value}`)}>{minuteValues.sort().map(m=><option key={m} value={m}>{m}分</option>)}</select>}
    </div></div>
    {hour&&<div style={style}><span>结束时间（自动）</span><output aria-label="计划结束">{end.label}</output></div>}
  </div>;
}
