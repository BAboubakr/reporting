// Deterministic, explainable cross-source event grouping for Atlas.
// Keep the thresholds and safeguards in sync with scripts/event_deduplicator.py.
export const EVENT_DEDUPE_THRESHOLDS = Object.freeze({
  articleTitle: 0.88,
  articleCombined: 0.82,
  eventScore: 0.78,
  publicationWindowDays: 45
});

const TRACKING_PARAM = /^(?:utm_.+|fbclid|gclid|dclid|mc_cid|mc_eid|igshid|li_fat_id|mkt_tok|trk|ref_src|yclid)$/i;
const STOP_WORDS = new Set(('the a an and or to of in on for with from by as at is are was were be this that it its team help advance appointed selected project projects plant plants development renewable energy morocco maroc moroccan s news now international latest report says according le la les des un une de du et en pour dans sur avec aux par au open opens launched launches bid bids invited announces announced announcement said update new').split(' '));
const ORG_ALIASES = new Map([
  ['afdb','african development bank'],['african development bank','african development bank'],['afdb group','african development bank'],
  ['afd','agence francaise de developpement'],['agence francaise de developpement','agence francaise de developpement'],
  ['onee','onee'],['onee branche electricite','onee'],['onee branche electricité','onee'],
  ['ocp group','ocp'],['ocp','ocp'],['masen','masen'],['anre','anre'],['fichtner','fichtner'],
  ['rina','rina'],['novec','novec'],['jesa','jesa'],['dnv','dnv'],['wsp','wsp'],['worley','worley'],
  ['egis','egis'],['mott macdonald','mott macdonald'],['afry','afry'],['tractebel','tractebel']
]);
const TYPE_PATTERNS = [
  ['award',/\b(award(?:ed)?|won (?:the )?contract|selected as|appointed as|laureat|retenu|attribue)\b/],
  ['tender',/\b(tender|procurement|prequalification|rfp|rfq|appel d offres|consultation)\b/],
  ['financing',/\b(financial close|financing|loan|credit facility|funding)\b/],
  ['construction',/\b(construction|groundbreaking|construction starts|works begin)\b/],
  ['commissioning',/\b(commissioned|commissioning|inaugurated|commercial operation|mise en service)\b/],
  ['regulatory',/\b(regulation|regulatory|decree|law|tariff|decision|amendment)\b/],
  ['market-entry',/\b(market entry|opens? (?:an? )?office|launches? .*morocco|subsidiary|local entity)\b/],
  ['investment',/\b(investment|invests|invested|capital expenditure)\b/],
  ['partnership',/\b(partnership|agreement|memorandum|\bmou\b|joint venture|consortium)\b/]
];
const TYPE_ALIASES = new Map([
  ['award','award'],['contract award','award'],['awarded','award'],['laureat','award'],['attributed','award'],
  ['tender','tender'],['procurement','tender'],['appel d offres','tender'],['prequalification','tender'],
  ['financing','financing'],['financial close','financing'],['funding','financing'],
  ['construction','construction'],['commissioned','commissioning'],['commissioning','commissioning'],
  ['regulatory','regulatory'],['regulation','regulatory'],['market entry','market-entry'],
  ['investment','investment'],['partnership','partnership']
]);
const CITY_NAMES = ['rabat','casablanca','tanger','tangier','fes','meknes','ouarzazate','laayoune','dakhla','khouribga','benguerir','jorf lasfar','safi','agadir','nador','essaouira','kenitra','midelt','guelmim','boujdour','tarfaya','marrakech','taza','tetouan','al hoceima','beni mellal','taroudant','sidi ifni','tan tan','smara'];

export function normalizeEventText(value='') {
  return String(value||'').normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase()
    .replace(/https?:\/\/\S+/g,' ').replace(/[^a-z0-9\s]/g,' ').replace(/\s+/g,' ').trim();
}

export function canonicalizeUrl(value='') {
  const raw=String(value||'').trim();
  if(!raw)return '';
  try {
    const url=new URL(raw);
    if(!/^https?:$/.test(url.protocol))return '';
    url.protocol=url.protocol.toLowerCase();
    url.hostname=url.hostname.toLowerCase().replace(/^www\./,'');
    if((url.protocol==='https:'&&url.port==='443')||(url.protocol==='http:'&&url.port==='80'))url.port='';
    url.hash='';
    const kept=[...url.searchParams.entries()].filter(([key])=>!TRACKING_PARAM.test(key)).sort(([a,av],[b,bv])=>a.localeCompare(b)||av.localeCompare(bv));
    url.search=''; for(const [key,val] of kept)url.searchParams.append(key,val);
    if(url.pathname.length>1)url.pathname=url.pathname.replace(/\/+$/,'');
    return url.toString();
  } catch {
    return raw.split('#')[0].replace(/\?.*$/,'').replace(/\/+$/,'').toLowerCase();
  }
}

const articleText=s=>[s?.title||s?.headline||s?.signal||'',s?.summary||'',s?.evidenceSnippet||''].join(' ');
const headline=s=>normalizeEventText(s?.title||s?.headline||s?.signal||'');
const tokens=s=>new Set(normalizeEventText(articleText(s)).split(' ').filter(t=>(t.length>=3||['pv','mw','gw','kw'].includes(t))&&!STOP_WORDS.has(t)));
const similarity=(a,b)=>{if(!a.size||!b.size)return 0;let n=0;for(const x of a)if(b.has(x))n++;return n/Math.max(1,Math.min(a.size,b.size));};
const normalizedName=value=>normalizeEventText(value);
const eventType=s=>{
  const explicit=normalizedName(s?.eventType||s?.signalType||'');
  if(TYPE_ALIASES.has(explicit))return TYPE_ALIASES.get(explicit);
  const stage=normalizedName(s?.projectStage||'');
  if(TYPE_ALIASES.has(stage))return TYPE_ALIASES.get(stage);
  const text=normalizeEventText(articleText(s));
  return TYPE_PATTERNS.find(([,pattern])=>pattern.test(text))?.[0]||'other';
};
const explicitStage=s=>{const value=normalizedName(s?.projectStage||s?.stage||'');return TYPE_ALIASES.get(value)||value;};
const explicitProject=s=>normalizedName(s?.projectIdentity||s?.projectName||s?.project||s?.facilityName||'');
const tenderIdentity=s=>{
  const explicit=normalizedName(s?.tenderId||s?.contractNumber||s?.procurementId||s?.awardId||'');
  if(explicit)return explicit;
  const match=String(articleText(s)+' '+(s?.capacity||'')).match(/\b(?:tender\s*)?(?:no\.?\s*)?(\d{1,4})\s*\/\s*(\d{2,4})\s*\/\s*([a-z][a-z0-9-]+)\b/i);
  return match?`${match[1]}/${match[2]}/${match[3].toLowerCase()}`:'';
};
const publishedDate=s=>Date.parse(s?.eventDate||s?.published||s?.publicationDate||s?.detected||'')||0;
const orgs=s=>{
  const text=normalizeEventText(articleText(s));
  const explicit=(Array.isArray(s?.entities)?s.entities:[]).map(normalizedName).filter(Boolean);
  const inferred=[...ORG_ALIASES.keys()].filter(alias=>{
    const pattern=normalizeEventText(alias).replace(/\s+/g,'\\s+');
    return new RegExp('\\b'+pattern+'\\b','i').test(text);
  });
  return new Set([...explicit,...inferred].map(x=>ORG_ALIASES.get(x)||x).filter(x=>x.length>=3&&x!=='morocco'));
};
const capacities=s=>new Set([...((normalizeEventText(articleText(s)+' '+String(s?.capacity||''))).matchAll(/\b(\d+(?:\.\d+)?)\s*[-–—]?\s*(mw|mwh|gw|gwh|kw|kwh)\b/gi))].map(m=>m[1]+' '+m[2].toLowerCase()));
const technologies=s=>{const text=normalizeEventText(articleText(s)+' '+(Array.isArray(s?.categories)?s.categories.join(' '):s?.categories||''));const out=new Set();if(/\b(solar|photovoltaic|pv)\b/.test(text))out.add('solar');if(/\b(bess|battery|storage)\b/.test(text))out.add('storage');if(/\b(wind)\b/.test(text))out.add('wind');if(/\b(hydrogen|ammonia|ptx)\b/.test(text))out.add('hydrogen');if(/\b(grid|transmission)\b/.test(text))out.add('grid');return out;};
const locations=s=>{
  const explicit=normalizedName([s?.location,s?.region].filter(Boolean).join(' '));
  const text=explicit+' '+normalizeEventText(articleText(s));
  return new Set(CITY_NAMES.filter(city=>new RegExp('\\b'+city.replace(/ /g,'\\s+')+'\\b','i').test(text)));
};
const sourceRecords=s=>{
  const input=Array.isArray(s?.sources)?s.sources:[];
  const records=input.length?input:[{url:s?.url,source:s?.source,author:s?.author,published:s?.published||s?.publicationDate,headline:s?.headline||s?.title,evidenceSnippet:s?.evidenceSnippet||s?.summary,sourceId:s?.sourceId,firstSeen:s?.firstSeen||s?.detected,lastSeen:s?.lastSeen||s?.detected}];
  return records.filter(x=>x&&typeof x==='object').map(x=>{
    const originalUrl=String(x.originalUrl||x.url||'').trim();
    return {...x,url:originalUrl,canonicalUrl:x.canonicalUrl||canonicalizeUrl(originalUrl),originalUrl,summary:x.summary||x.evidenceSnippet||'',evidenceSnippet:x.evidenceSnippet||x.summary||'',firstSeen:x.firstSeen||s?.firstSeen||s?.detected||null,lastSeen:x.lastSeen||s?.lastSeen||s?.detected||null};
  });
};
const sourceKey=s=>String(s?.canonicalUrl||canonicalizeUrl(s?.url)||s?.sourceId||s?.id||'');
const sourceQuality=s=>{
  const type=String(s?.sourceType||s?.evidenceLevel||'').toLowerCase();
  const reliability=/official|primary/.test(type)?30:/news|secondary/.test(type)?12:0;
  return reliability+(Number(s?.qualityScore)||0)*2+(Number(s?.relevanceScore)||0)*.2+
    (String(s?.headline||s?.title||'').length>30?4:0)+(String(s?.evidenceSnippet||s?.summary||'').length>80?4:0);
};
const eventQuality=s=>sourceRecords(s).reduce((n,x)=>n+sourceQuality(x),0)+sourceQuality(s)+(explicitProject(s)?12:0)+(s?.url?4:0)+(s?.summary?3:0);
const stableHash=value=>{let h=2166136261;for(const c of String(value)){h^=c.charCodeAt(0);h=Math.imul(h,16777619);}return (h>>>0).toString(16).padStart(8,'0');};
const eventId=s=>{
  const project=explicitProject(s),type=eventType(s),stage=explicitStage(s),tender=tenderIdentity(s);
  const milestone=eventMilestone(s);
  const stable=project?'project|'+project+'|'+type+'|'+stage+'|'+tender+(milestone?'|milestone|'+milestone:''):(s?.eventId||s?.id||s?.sourceId||canonicalizeUrl(s?.url)||headline(s));
  return 'evt-'+stableHash(stable);
};
const familyId=s=>{const p=explicitProject(s);return p?'family-'+stableHash(p):null;};
const overlaps=(a,b)=>[...a].filter(x=>b.has(x));
const daysApart=(a,b)=>{const x=publishedDate(a),y=publishedDate(b);return x&&y?Math.abs(x-y)/86400000:null;};

// A project can generate several real developments. Preserve milestones within one family.
export function eventMilestone(s) {
  const text=normalizeEventText(articleText(s));
  if (/\b(begin|begins|began|start|starts|started|commence|commences|commenced) operations?\b|\bcommercial operation\b|\bcommission(?:ed|ing)\b|\bstarts? production\b/.test(text)) return 'operations-start';
  if (/\b(started|began|has started|has begun)\b.{0,60}\b(resource )?measurement (programme|program|campaign)\b/.test(text)) return 'measurement-programme-start';
  if (/\b(signed|signs|signing)\b.{0,50}\b(agreement|partnership|cooperation|memorandum|mou)\b|\bpartner(?:s|ed|ship)? to (?:boost|unlock|advance|support)\b/.test(text)) return 'agreement';
  if (/\b(backing|backed|financing|financed|funding|funded|loan|grant|financial close)\b|\$\s?\d/.test(text)) return 'financing';
  if (/\bconstruction (?:begins|starts|started|underway|launch(?:es|ed)?)\b|\bgroundbreaking\b|\bconstruction contract\b/.test(text)) return 'construction';
  if (/\b(prepares?|plans?|planned|set|scheduled|expected) to launch\b|\bplanned launch\b/.test(text)) return 'planned-launch';
  if (/\bapplications? (?:are |is )?(?:now )?open\b|\bopen for applications\b|\baccepting applications\b/.test(text)) return 'applications-open';
  if (/\bcall for projects\b|\blaunch(?:es|ed|ing) (?:a )?(?:call|programme|program)\b/.test(text)) return 'programme-call';
  if (/\b(tender|prequalification|request for qualification|procurement|rfp|rfq)\b/.test(text)) return 'tender';
  return null;
}

export function explainEventMatch(a,b) {
  const typeA=eventType(a),typeB=eventType(b);
  const typeMismatch=typeA!=='other'&&typeB!=='other'&&typeA!==typeB;
  const stageA=explicitStage(a),stageB=explicitStage(b);
  const stageMismatch=!!stageA&&!!stageB&&stageA!==stageB;
  const ta=tokens(a),tb=tokens(b),textSim=similarity(ta,tb);
  const titleA=headline(a),titleB=headline(b);
  const sourcesA=sourceRecords(a),sourcesB=sourceRecords(b);
  const urlsA=new Set(sourcesA.map(x=>x.canonicalUrl).filter(Boolean)),urlsB=new Set(sourcesB.map(x=>x.canonicalUrl).filter(Boolean));
  const idsA=new Set(sourcesA.map(x=>String(x.sourceId||x.id||'')).filter(Boolean)),idsB=new Set(sourcesB.map(x=>String(x.sourceId||x.id||'')).filter(Boolean));
  const sameUrl=overlaps(urlsA,urlsB).length>0;
  const sameSourceId=overlaps(idsA,idsB).length>0;
  const projectA=explicitProject(a),projectB=explicitProject(b);
  const tenderA=tenderIdentity(a),tenderB=tenderIdentity(b);
  if(projectA&&projectB&&projectA!==projectB)return {match:false,score:0,reasons:['project-identity-mismatch']};
  if(tenderA&&tenderB&&tenderA!==tenderB)return {match:false,score:0,reasons:['tender-identity-mismatch']};
  const sameProject=!!projectA&&projectA===projectB;
  const orgOverlap=overlaps(orgs(a),orgs(b));
  const capOverlap=overlaps(capacities(a),capacities(b));
  const locationOverlap=overlaps(locations(a),locations(b));
  const technologyOverlap=overlaps(technologies(a),technologies(b));
  const dateGap=daysApart(a,b);
  const sameStage=!stageA||!stageB||stageA===stageB;
  const sameType=typeA===typeB;
  const compatibleType=typeA==='other'||typeB==='other'||sameType;
  if(sameUrl)return {match:true,score:.99,reasons:['same-canonical-url']};
  if(sameSourceId)return {match:true,score:.99,reasons:['same-source-id']};
  const milestoneA=eventMilestone(a),milestoneB=eventMilestone(b);
  if(milestoneA&&milestoneB&&milestoneA!==milestoneB)return {match:false,score:0,reasons:['different-event-milestones',milestoneA,milestoneB]};
  const sharedTokens=overlaps(ta,tb);
  const distinctive=sharedTokens.some(x=>x.length>=4);
  const closeInTime=dateGap===null||dateGap<=EVENT_DEDUPE_THRESHOLDS.publicationWindowDays;
  const storyAnchors=orgOverlap.length>0&&(capOverlap.length>0||locationOverlap.length>0);
  if(titleA&&titleA===titleB&&distinctive&&sameStage&&(!dateGap||dateGap<=180))return {match:true,score:.96,reasons:['same-normalized-headline','distinctive-title-anchor']};
  if(!stageMismatch&&textSim>=EVENT_DEDUPE_THRESHOLDS.articleTitle&&sharedTokens.length>=4&&distinctive&&sameStage&&(!dateGap||dateGap<=30)&&(!typeMismatch||storyAnchors))return {match:true,score:.9,reasons:['near-identical-article-text','distinctive-text-anchor']};
  if(!stageMismatch&&textSim>=EVENT_DEDUPE_THRESHOLDS.articleCombined&&sharedTokens.length>=4&&distinctive&&sameStage&&(!dateGap||dateGap<=21)&&(!typeMismatch||storyAnchors))return {match:true,score:.84,reasons:['high-text-similarity','distinctive-text-anchor']};
  // Headlines often vary by publisher. Link the report when independent facts align:
  // recognized actor + project location/capacity + close publication dates.
  if(!stageMismatch&&storyAnchors&&closeInTime&&textSim>=.16&&sharedTokens.length>=2&&(!typeMismatch||(capOverlap.length>0&&locationOverlap.length>0&&textSim>=.3)))return {match:true,score:.82,reasons:['shared-actor-and-project-facts','publication-window']};
  // Same procurement described by different publishers: match stable technical facts.
  if(!stageMismatch&&typeA==='tender'&&typeB==='tender'&&closeInTime&&capOverlap.length>0&&technologyOverlap.length>0&&(sharedTokens.length>=2||orgOverlap.length>0||locationOverlap.length>0))return {match:true,score:.86,reasons:['same-tender-capacity-and-technology','publication-window']};
  if(!stageMismatch&&sameType&&closeInTime&&orgOverlap.length>0&&locationOverlap.length>0&&textSim>=.28&&sharedTokens.length>=3)return {match:true,score:.8,reasons:['same-actor-location-and-story-context']};
  if(!stageMismatch&&!typeMismatch&&sameProject&&sameType&&sameStage&&orgOverlap.length>0&&closeInTime)return {match:true,score:.84,reasons:['same-project-and-actor']};
  if(!typeMismatch&&!stageMismatch&&sameProject&&sameType&&sameStage) {
    let score=.42; const reasons=['same-project','same-event-type'];
    if(tenderA&&tenderA===tenderB){score+=.2;reasons.push('same-tender-identity');}
    if(orgOverlap.length){score+=.12;reasons.push('shared-organization');}
    if(capOverlap.length){score+=.1;reasons.push('shared-capacity');}
    if(locationOverlap.length){score+=.08;reasons.push('shared-location');}
    if(dateGap===null||dateGap<=EVENT_DEDUPE_THRESHOLDS.publicationWindowDays){score+=.08;reasons.push(dateGap===null?'date-not-available':'within-publication-window');}
    if(dateGap!==null&&dateGap>EVENT_DEDUPE_THRESHOLDS.publicationWindowDays)return {match:false,score,reasons:['outside-publication-window',...reasons]};
    const enoughAnchors=!!tenderA||(orgOverlap.length>0&&(capOverlap.length>0||locationOverlap.length>0||textSim>=.28));
    if(enoughAnchors&&score>=EVENT_DEDUPE_THRESHOLDS.eventScore)return {match:true,score:Number(score.toFixed(2)),reasons};
  }
  return {match:false,score:Number(textSim.toFixed(2)),reasons:['insufficient-event-evidence']};
}

function normalizedSourceList(records) {
  const byKey=new Map();
  for(const source of records) {
    const key=sourceKey(source); if(!key)continue;
    const current=byKey.get(key);
    if(!current||sourceQuality(source)>sourceQuality(current)||(sourceQuality(source)===sourceQuality(current)&&String(source.lastSeen||source.published||'')>String(current.lastSeen||current.published||''))) {
      const next={...source};
      if(current)next.observedUrls=[...new Set([...(current.observedUrls||[]),current.originalUrl,current.url,...(current.observedUrls||[])].filter(Boolean))];
      byKey.set(key,next);
    } else if(source.originalUrl&&source.originalUrl!==current.originalUrl) {
      current.observedUrls=[...new Set([...(current.observedUrls||[]),current.originalUrl,source.originalUrl].filter(Boolean))];
    }
  }
  return [...byKey.values()];
}

function appendSource(target,incoming,match) {
  const previous=sourceRecords(target),next=sourceRecords(incoming);
  const before=normalizedSourceList(previous),after=normalizedSourceList([...previous,...next]);
  const additionByKey=new Map(next.map(x=>[sourceKey(x),x]));
  for(const src of after) {
    const prior=before.find(x=>sourceKey(x)===sourceKey(src));
    if(prior) {
      const versions=[...(prior.updates||[])];
      const currentKey=[src.headline||src.title||'',src.summary||src.evidenceSnippet||''].join('|');
      for(const version of [prior,additionByKey.get(sourceKey(src))||{}]) {
        const headline=version.headline||version.title||'',summary=version.summary||version.evidenceSnippet||'';
        if([headline,summary].join('|')===currentKey)continue;
        const snapshot={headline,summary,published:version.published||version.publicationDate||null,observedAt:version.lastSeen||null};
        if(!versions.some(x=>x.headline===snapshot.headline&&x.summary===snapshot.summary&&x.published===snapshot.published))versions.push(snapshot);
      }
      if(versions.length)src.updates=versions;
      src.firstSeen=prior.firstSeen||src.firstSeen||null;
      src.lastSeen=src.lastSeen||incoming.lastSeen||incoming.detected||null;
    } else {
      src.firstSeen=src.firstSeen||incoming.firstSeen||incoming.detected||null;
      src.lastSeen=src.lastSeen||incoming.lastSeen||incoming.detected||null;
      src.matchConfidence=match.score;
      src.matchRationale=match.reasons;
    }
  }
  target.sources=after;
  target.sourceCount=after.length;
  target.firstSeen=[target.firstSeen,incoming.firstSeen,incoming.detected].filter(Boolean).sort()[0]||null;
  target.lastSeen=[target.lastSeen,incoming.lastSeen,incoming.detected].filter(Boolean).sort().at(-1)||null;
  const history=[...(target.duplicateMatches||[])];
  if(!history.some(x=>x.eventId===incoming.eventId&&x.score===match.score))history.push({eventId:incoming.eventId||eventId(incoming),score:match.score,reasons:match.reasons});
  target.duplicateMatches=history;
  const family=target.eventFamilyId||incoming.eventFamilyId||familyId(target)||familyId(incoming);
  if(family)target.eventFamilyId=family;
}

function mergeEvent(target,incoming,match) {
  const targetQuality=eventQuality(target),incomingQuality=eventQuality(incoming);
  const representative=incomingQuality>targetQuality?incoming:target;
  const merged={...target,...incoming,...representative};
  merged.eventId=target.eventId||eventId(target);
  merged.id=target.id||merged.eventId;
  merged.eventFamilyId=target.eventFamilyId||incoming.eventFamilyId||familyId(target)||familyId(incoming)||undefined;
  merged.matchConfidence=Math.max(Number(target.matchConfidence)||0,match.score);
  merged.matchRationale=[...new Set([...(target.matchRationale||[]),...match.reasons])];
  appendSource(merged,{...incoming,sources:sourceRecords(incoming),detected:incoming.detected},match);
  return merged;
}

export function deduplicateEvents(input=[]) {
  const candidates=(Array.isArray(input)?input:[]).filter(x=>x&&typeof x==='object').map(s=>({...s,eventType:eventType(s)}));
  const rank=s=>eventQuality(s);
  candidates.sort((a,b)=>rank(b)-rank(a)||publishedDate(b)-publishedDate(a)||headline(a).localeCompare(headline(b)));
  const events=[];
  for(const candidate of candidates) {
    candidate.eventId=candidate.eventId||eventId(candidate);
    candidate.id=candidate.id||candidate.eventId;
    candidate.eventFamilyId=candidate.eventFamilyId||familyId(candidate)||undefined;
    candidate.sources=normalizedSourceList(sourceRecords(candidate));
    candidate.sourceCount=candidate.sources.length;
    candidate.firstSeen=candidate.firstSeen||candidate.detected||null;
    candidate.lastSeen=candidate.lastSeen||candidate.detected||null;
    let best=null;
    for(const existing of events) {
      const rationale=explainEventMatch(candidate,existing);
      if(rationale.match&&(!best||rationale.score>best.score))best={event:existing,...rationale};
    }
    if(!best){events.push(candidate);continue;}
    const index=events.indexOf(best.event);
    events[index]=mergeEvent(best.event,candidate,best);
  }
  return events;
}


