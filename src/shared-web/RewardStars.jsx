import {useState} from 'react';
export function validReward(value) {return Number.isInteger(Number(value)) && Number(value)>=1 && Number(value)<=99;}
export default function RewardStars({value,onChange}) {
  const [custom,setCustom]=useState(false);
  const show=custom || ![1,2,3,5].includes(Number(value));
  return <div style={{display:'flex',flexWrap:'wrap',alignItems:'center',gap:6}}>
    <div className="ios-segmented-control" role="group" aria-label="奖励星星">
      {[1,2,3,5].map(n=><button type="button" key={n} className={`ios-segmented-item ${!show&&Number(value)===n?'active':''}`} onClick={()=>{setCustom(false);onChange(n);}}>{n}星</button>)}
      <button type="button" className={`ios-segmented-item ${show?'active':''}`} onClick={()=>setCustom(true)}>自定义</button>
    </div>
    {show&&<label style={{display:'inline-flex',gap:4,alignItems:'center'}}><input aria-label="自定义奖励星星" type="number" inputMode="numeric" min="1" max="99" step="1" value={value??''} onChange={e=>onChange(e.target.value===''?'':Number(e.target.value))} className="ios-time-input" style={{width:70}}/>星</label>}
    {!validReward(value)&&<small role="alert" style={{color:'var(--danger)'}}>请选择1–99星的整数奖励</small>}
  </div>;
}
