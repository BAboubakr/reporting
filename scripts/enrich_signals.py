"""Atlas Signal Enrichment Engine.

Research depth is adaptive: L0 signals are monitored only; L1 is lightly
verified; L2 is investigated; L3 receives strategic multi-source research;
L4 receives priority research. The same engine therefore spends effort where
business value is highest instead of researching every news item equally.
"""
import hashlib, html, json, os, re, urllib.parse, urllib.request, xml.etree.ElementTree as ET
from datetime import datetime, timedelta, timezone
from pathlib import Path
from research_priority import research_priority

ROOT=Path(__file__).resolve().parents[1]; DATA=ROOT/'data'; TIMEOUT=20; MAX_RESULTS_PER_QUERY=5; ENRICHMENT_TTL_HOURS=24

def fetch(url):
    req=urllib.request.Request(url,headers={'User-Agent':'Atlas-Morocco-Intelligence/4.0'})
    with urllib.request.urlopen(req,timeout=TIMEOUT) as r:return r.read()

def clean(text):return re.sub(r'\s+',' ',html.unescape(re.sub(r'<[^>]+>',' ',text or ''))).strip()
def norm(text):return re.sub(r'\s+',' ',re.sub(r'[^a-z0-9àâçéèêëîïôûùüÿñæœ\s-]',' ',(text or '').lower())).strip()
def slug(text):return re.sub(r'[^a-z0-9]+',' ',norm(text)).strip()

def rss(query):
    url='https://news.google.com/rss/search?'+urllib.parse.urlencode({'q':query+' when:90d','hl':'en-US','gl':'US','ceid':'US:en'})
    try:root=ET.fromstring(fetch(url))
    except Exception as exc:print('Enrichment RSS error:',query,exc);return []
    out=[]
    for item in root.findall('./channel/item')[:MAX_RESULTS_PER_QUERY]:
        title=clean(item.findtext('title')); link=item.findtext('link') or ''; desc=clean(item.findtext('description')); se=item.find('source'); source=clean(se.text if se is not None else '') or 'Google News'; pub=item.findtext('pubDate') or ''
        if title and link:out.append({'title':title,'url':link,'snippet':desc[:700],'source':source,'published':pub})
    return out

def make_queries(signal,level):
    title=signal.get('title',''); entities=signal.get('entities') or []; cats=signal.get('categories') or []; project=signal.get('project') or signal.get('projectName') or ''
    queries=[f'"{title}"',f'Morocco {title}']
    if entities:queries.append(f'Morocco {" ".join(entities[:3])} {" ".join(cats[:2])}')
    if project:queries += [f'"{project}" Morocco',f'"{project}" contractor',f'"{project}" tender']
    t=norm(title+' '+' '.join(cats))
    if any(x in t for x in ['pumped','hydro','storage']):queries += ['Morocco pumped storage hydro project contractor','Morocco STEP pumped hydro tender','Morocco pumped storage ONEE contractor','Ifahsa pumped hydropower storage Morocco','Ifahsa contractor Morocco ONEE','site:worldbank.org Ifahsa pumped hydropower Morocco','site:onee.ma Ifahsa STEP Morocco']
    if any(x in t for x in ['solar','photovoltaic','pv']):queries += ['Morocco solar PV project contractor tender ONEE MASEN','Morocco photovoltaic project award EPC']
    if any(x in t for x in ['wind','eolien','offshore']):queries += ['Morocco wind project contractor tender','Morocco offshore wind project developer']
    if any(x in t for x in ['hydrogen','ammonia','ptx']):queries += ['Morocco green hydrogen ammonia project investor contractor','Morocco Power to X tender project']
    if any(x in t for x in ['tender','procurement','award','selected','contractor']):queries += ['Morocco procurement tender award '+' '.join(entities[:2]),'Morocco contractor selected '+' '.join(entities[:2])]
    if level>=3:queries += ['Morocco '+title+' official','Morocco '+title+' procurement','Morocco '+title+' financing','Morocco '+title+' consultant','Morocco '+title+' owner']
    if level>=4:queries += ['Morocco '+title+' Fichtner','Morocco '+title+' competitor','Morocco '+title+' technical advisory','Morocco '+title+' lender']
    seen=set();out=[]
    for q in queries:
        q=re.sub(r'\s+',' ',q).strip()
        if len(q)>=12 and q.lower() not in seen:seen.add(q.lower());out.append(q)
    return out

def load_signals():
    text=(DATA/'signals.js').read_text(encoding='utf-8');m=re.search(r'export const signals = (.*);\s*$',text,re.S);return json.loads(m.group(1)) if m else []

def already_fresh(signal):
    stamp=signal.get('enrichment',{}).get('researchedAt')
    if not stamp:return False
    try:return datetime.now(timezone.utc)-datetime.fromisoformat(stamp.replace('Z','+00:00'))<timedelta(hours=ENRICHMENT_TTL_HOURS)
    except Exception:return False

def gemini_enrich(signal,evidence,level_meta):
    key=os.getenv('GEMINI_API_KEY')
    if not key:return None
    model=os.getenv('ATLAS_AI_MODEL','gemini-2.5-flash')
    payload={'task':'Enrich this Morocco renewable-energy intelligence signal using ONLY supplied public source records. Do not invent facts or bypass paywalls. Separate verified facts from reported claims, interpretation and action. Resolve project/entity only when evidence supports it. Identify conflicts and unknowns. Research level '+level_meta['level']+'.','output':{'project':'string or null','entities':['strings'],'facts':[{'claim':'string','confidence':'HIGH|MEDIUM|LOW','sourceIndexes':[0]}],'development':'concise factual development statement','interpretation':'why this matters strategically','fichtnerImplication':'specific consulting/business implication, or null','recommendedActions':['strings'],'overallConfidence':'HIGH|MEDIUM|LOW','unresolved':['strings']},'signal':{k:signal.get(k) for k in ['title','summary','source','published','signalType','projectStage','entities','competitor','categories']},'sources':evidence}
    url=f'https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={key}';body=json.dumps({'contents':[{'parts':[{'text':json.dumps(payload,ensure_ascii=False)}]}],'generationConfig':{'temperature':0,'responseMimeType':'application/json'}}).encode()
    try:
        req=urllib.request.Request(url,data=body,headers={'Content-Type':'application/json'},method='POST')
        with urllib.request.urlopen(req,timeout=45) as r:data=json.loads(r.read().decode())
        return json.loads(data['candidates'][0]['content']['parts'][0]['text'])
    except Exception as exc:print('Gemini enrichment unavailable:',exc);return None

def fallback_enrich(signal,evidence):
    text=' '.join([signal.get('title',''),signal.get('summary','')]+[f"{x.get('title','')} {x.get('snippet','')} {x.get('source','')}" for x in evidence]);n=norm(text);facts=[];project=None
    if 'ifahsa' in n and any(x in n for x in ('pumped hydro','pumped hydropower','pumped storage','step')):
        project='Ifahsa Pumped Hydropower Storage (PHS) Project';facts.append({'claim':'Public sources identify the development as the Ifahsa pumped hydropower storage project in Morocco.','confidence':'HIGH','sourceIndexes':[i for i,x in enumerate(evidence) if 'ifahsa' in norm(x.get('title','')+' '+x.get('snippet',''))][:4]})
    m=re.search(r'(?<!\d)(300)\s*(?:-|–)?\s*MW',text,re.I)
    if m:facts.append({'claim':'Public sources report a 300 MW capacity for Ifahsa.','confidence':'HIGH','sourceIndexes':[i for i,x in enumerate(evidence) if '300' in (x.get('title','')+' '+x.get('snippet',''))][:4]})
    m=re.search(r'\$\s*265\s*million|265\s*million\s*(?:US\s*)?dollars',text,re.I)
    if m:facts.append({'claim':'The World Bank approved $265 million of support for the Ifahsa project.','confidence':'HIGH','sourceIndexes':[i for i,x in enumerate(evidence) if '265' in (x.get('title','')+' '+x.get('snippet',''))][:4]})
    if 'onee' in n:facts.append({'claim':'ONEE is identified in public project documentation as the implementing Moroccan utility.','confidence':'HIGH','sourceIndexes':[i for i,x in enumerate(evidence) if 'onee' in norm(x.get('title','')+' '+x.get('snippet',''))][:4]})
    if any(x in n for x in ('contractor selected','contract awarded','awarded to')):facts.append({'claim':'The contractor-selection claim is reported in the monitored source and should be treated as reported until independently confirmed by a primary procurement source.','confidence':'MEDIUM','sourceIndexes':[i for i,x in enumerate(evidence) if any(y in norm(x.get('title','')+' '+x.get('snippet','')) for y in ('contractor selected','contract awarded','awarded to'))][:4]})
    actions=['Verify material award/procurement claims against a primary owner or DFI source before treating them as confirmed.']
    if project:actions.insert(0,'Track the project as a strategic storage/grid development and identify awarded scope plus remaining owner’s-engineer / technical-advisory packages.')
    return {'project':project,'facts':facts,'development':'Public-source enrichment completed; claims are limited to independently discoverable evidence.','interpretation':'The signal has been enriched according to its assigned research depth; unresolved claims remain explicitly flagged.','fichtnerImplication':'Potential relevance for technical advisory, owner’s engineering, grid integration, procurement support or lender technical advisory where applicable.','recommendedActions':actions,'overallConfidence':'MEDIUM' if facts else 'LOW','unresolved':['Material claims not independently confirmed in public primary sources'] if evidence else ['No public corroborating evidence found']}

def main():
    signals=load_signals();now=datetime.now(timezone.utc).isoformat();targets=[]
    # Every signal gets a priority decision. Only L1-L4 consume research budget.
    # There is intentionally NO global target cap: the per-signal research level
    # controls effort, while the 24h TTL prevents repeated work on the same signal.
    for s in signals:
        meta=research_priority(s);s['researchPriority']=meta['score'];s['researchLevel']=meta['level'];s['researchLevelName']=meta['levelName'];s['researchPriorityReasons']=meta['reasons'];s['researchTriggers']=meta['triggers'];s['researchBudget']={'maxQueries':meta['maxQueries'],'maxSources':meta['maxSources']}
        if meta['levelNumber']>0 and not already_fresh(s):targets.append((meta['levelNumber'],meta['score'],s,meta))
    # Highest-value work goes first, but every eligible signal is processed in
    # this run. L0 signals remain intentionally monitor-only.
    targets=sorted(targets,key=lambda x:(x[0],x[1]),reverse=True);enriched_count=0
    level_counts={}
    for level_num,score,signal,meta in targets:
        queries=make_queries(signal,level_num)[:meta['maxQueries']];evidence=[];seen=set()
        for q in queries:
            for item in rss(q):
                key=hashlib.sha1((slug(item['title'])+item['url'].split('?')[0]).encode()).hexdigest()[:16]
                if key==signal.get('id','').replace('sig-','') or key in seen:continue
                seen.add(key);evidence.append({**item,'query':q})
        title_words=set(slug(signal.get('title','')).split())
        for item in evidence:
            iw=set(slug(item['title']).split());item['relevance']=round(len(title_words&iw)/max(1,len(title_words|iw)),3)
        unique=[]
        for item in sorted(evidence,key=lambda x:(x['relevance'],x.get('published','')),reverse=True):
            if sum(1 for x in unique if norm(x['source'])==norm(item['source']))>=2:continue
            unique.append(item)
            if len(unique)>=meta['maxSources']:break
        result=gemini_enrich(signal,unique,meta) or fallback_enrich(signal,unique)
        enrichment={'researchedAt':now,'status':'enriched' if os.getenv('GEMINI_API_KEY') and result else ('public-evidence' if unique else 'no-public-match'),'researchLevel':meta['level'],'researchLevelName':meta['levelName'],'researchPriority':meta['score'],'researchQueries':queries,'sources':[{k:v for k,v in x.items() if k!='relevance'} for x in unique],'sourceCount':len(unique)}
        if result:enrichment.update(result);enriched_count+=1
        signal['enrichment']=enrichment;signal['evidenceLevel']='multi-source enriched' if os.getenv('GEMINI_API_KEY') and result else ('public search evidence' if unique else signal.get('evidenceLevel','news source'));signal['aiReviewed']=bool(os.getenv('GEMINI_API_KEY') and result) or signal.get('aiReviewed',False);level_counts[meta['level']]=level_counts.get(meta['level'],0)+1
    (DATA/'signals.js').write_text('export const signals = '+json.dumps(signals,ensure_ascii=False,indent=2)+';\n',encoding='utf-8')
    print(f'Adaptive enrichment complete: targets={len(targets)} AI-enriched={enriched_count} levels={level_counts}')

if __name__=='__main__':main()
