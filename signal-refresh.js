import { signals as rawSignals } from './data/signals.js';
import { cleanSignals, getLastSignalUpdate } from './data-cleaner.js';

function formatTime(value){
  if(!value) return 'Timestamp unavailable';
  const d=value instanceof Date?value:new Date(value);
  if(Number.isNaN(d.getTime())) return 'Timestamp unavailable';
  return d.toLocaleString('en-GB',{day:'2-digit',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit',timeZoneName:'short'});
}

function render(){
  const signals=cleanSignals(rawSignals);
  const last=getLastSignalUpdate(signals);
  window.atlasLastUpdate=last;
  const text=last?`Signals refreshed · ${formatTime(last)}`:'Signal refresh timestamp unavailable';

  if(!document.getElementById('atlasRefreshStyle')){
    const style=document.createElement('style');
    style.id='atlasRefreshStyle';
    style.textContent=`
      .atlas-refresh-status{display:inline-flex;align-items:center;gap:7px;margin-left:14px;font-size:11px;font-weight:600;color:#647477;white-space:nowrap}
      .atlas-refresh-dot{width:7px;height:7px;border-radius:50%;display:inline-block;background:#2c6e68;box-shadow:0 0 0 3px rgba(44,110,104,.12)}
      .section-refresh-meta{display:flex;align-items:center;gap:7px;margin-top:9px;font-size:11px;font-weight:600;color:#647477}
      .section-refresh-meta .atlas-refresh-dot{width:6px;height:6px}
      @media(max-width:760px){.atlas-refresh-status{display:none}.section-refresh-meta{font-size:10px}}
    `;
    document.head.appendChild(style);
  }

  let global=document.getElementById('atlasRefreshStatus');
  if(!global){
    global=document.createElement('div');
    global.id='atlasRefreshStatus';
    global.className='atlas-refresh-status';
    document.querySelector('.crumb')?.appendChild(global);
  }
  global.innerHTML=`<span class="atlas-refresh-dot"></span>${text}`;

  document.querySelectorAll('.view').forEach(section=>{
    const heading=section.querySelector('.page-heading');
    if(!heading)return;
    let meta=heading.querySelector('.section-refresh-meta');
    if(!meta){meta=document.createElement('div');meta.className='section-refresh-meta';heading.appendChild(meta)}
    meta.innerHTML=`<span class="atlas-refresh-dot"></span>${text}`;
  });
}

if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(render,50),{once:true});
else setTimeout(render,50);
window.addEventListener('load',render,{once:true});
