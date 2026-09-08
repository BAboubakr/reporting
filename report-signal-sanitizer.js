// Runs before the reporting engine. Mutates the shared signals array so every consumer sees one story once.
import { signals } from './data/signals.js?sanitizer=20260908-1';
const stop=new Set('the a an and or to of in on for with from by as at is are was were be this that team help advance appointed selected project projects plant plants development renewable energy morocco maroc news now international water power renewables latest report says according'.split(' '));
const norm=v=>String(v||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/https?:\/\/\S+/g,' ').replace(/[^a-z0-9\s]/g,' ').replace(/\s+/g,' ').trim();
const tokens=s=>new Set(norm(`${s?.title||s?.headline||s?.signal||''} ${s?.summary||''} ${s?.evidenceSnippet||''}`).split(' ').filter(x=>x.length>=3&&!stop.has(x)));
const similarity=(a,b)=>{if(!a.size||!b.size)return 0;let n=0;for(const x of a)if(b.has(x))n++;return n/Math.min(a.size,b.size)};
const canonical=s=>norm(s?.title||s?.headline||s?.signal||'').replace(/\b(?:african energy|africa energy|africa energy intelligence|energy intelligence|renewable energy news)\b/g,' ').replace(/\s+/g,' ').trim();
const ordered=[...signals].sort((a,b)=>(Number(b?.relevanceScore)||0)-(Number(a?.relevanceScore)||0));
const kept=[];
for(const s of ordered){const c=canonical(s),t=tokens(s);let dup=false;for(const k of kept){if(c&&c===canonical(k)){dup=true;break}const kt=tokens(k);const sim=similarity(t,kt);if(sim>=0.78||(sim>=0.62&&[...t].filter(x=>x.length>=6&&kt.has(x)).length>=4)){dup=true;break}}if(!dup)kept.push(s)}
signals.splice(0,signals.length,...kept);
window.__atlasSignalSanitized=true;
