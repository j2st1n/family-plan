export function starUnits(value){if(value==null||value==='')return null;const n=Number(value);return Number.isFinite(n)&&n>=0?Math.round(n*100):null;}
export function affordability(balance,cost){const b=starUnits(balance),c=starUnits(cost);return {known:b!=null&&c!=null,canAfford:b!=null&&c!=null&&b>=c,shortfall:b!=null&&c!=null?Math.max(0,c-b)/100:null};}
