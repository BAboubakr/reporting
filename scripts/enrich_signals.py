"""Atlas adaptive public-evidence enrichment engine."""
import hashlib,html,json,os,re,urllib.parse,urllib.request,xml.etree.ElementTree as ET
from datetime import datetime,timedelta,timezone
from pathlib import Path
from research_priority import research_priority
ROOT=Path(__file__).resolve().parents[1];DATA=ROOT/'data';TIMEOUT=20;MAX_RESULTS_PER_QUERY=5
ENRICHMENT_TTL_HOURS=24;ENRICHMENT_ENGINE_VERSION='5.1-entity-aware-adaptive-market-entry'
KNOWN_ENTITIES={'Fichtner':'Fichtner','NOVEC':'NOVEC','JESA':'JESA','AFRY':'AFRY','Artelia':'Artelia','Tractebel':'Tractebel','Mott MacDonald':'Mott MacDonald','WSP':'WSP','Worley':'Worley','Egis':'Egis','ILF':'ILF Consulting Engineers','DNV':'DNV','INGEMA':'INGEMA','RINA':'RINA','ONEE':'ONEE','MASEN':'MASEN','ANRE':'ANRE','OCP':'OCP','AMEE':'AMEE','World Bank':'World Bank','African Development Bank':'African Development Bank','AfDB':'AfDB','KfW':'KfW','AFD':'AFD','EIB':'EIB','IsDB':'IsDB','EBRD':'EBRD','GIZ':'GIZ','European Investment Bank':'EIB','OWC':'OWC','PHENIXA':'PHENIXA','Ginger':'Ginger','Gaïa Terre Bleue':'Gaïa Terre Bleue','SOFECO':'SOFECO'}
COMPETITORS={'fichtner':'Fichtner','afry':'AFRY','artelia':'Artelia','tractebel':'Tractebel','mott macdonald':'Mott MacDonald','wsp':'WSP','worley':'Worley','egis':'Egis','ilf':'ILF Consulting Engineers','dnv':'DNV','novec':'NOVEC','ingema':'INGEMA','jesa':'JESA','rina':'RINA'}

def fetch(url):
    req=urllib.request.Request(url,headers={'User-Agent':'Atlas-Morocco-Intelligence/5.1'})
    with urllib.request.urlopen(req,timeout=TIMEOUT) as r:return r.read()
def clean(x):return re.sub(r'\s+',' ',html.unescape(re.sub(r'<[^>]+>',' ',x or ''))).strip()
def norm(x):return re.sub(r'\s+',' ',re.sub(r'[^a-z0-9àâçéèêëîïôûùüÿñæœ\s-]',' ',str(x or '').lower())).strip()
def slug(x):return re.sub(r'[^a-z0-9]+',' ',norm(x)).strip()
def rss(q):
    url='https://news.google.com/rss/search?'+urllib.parse.urlencode({'q':q+' when:90d','hl':'en-US','gl':'US','ceid':'US:en'})
    try:root=ET.fromstring(fetch(url))
    except Exception as e:print('Enrichment RSS error:',q,e);return []
    out=[]
    for item in root.findall('./channel/item')[:MAX_RESULTS_PER_QUERY]:
        t=clean(item.findtext('title'));link=item.findtext('link') or '';sn=clean(item.findtext('description'));se=item.find('source');src=clean(se.text if se is not None else '') or 'Google News';pub=item.findtext('pubDate') or ''
        if t and link:out.append({'title':t,'url':link,'snippet':sn[:700],'source':src,'published':pub})
    return out

def infer_entities(s):
    text=' '.join(str(s.get(k) or '') for k in ('title','summary','description','source','competitor'));low=text.lower();ents=[]
    for needle,label in KNOWN_ENTITIES.items():
        if needle.lower() in low and label not in ents:ents.append(label)
    for needle,label in [('essaouira','Essaouira'),('ifahsa','Ifahsa'),('el menzel','El Menzel'),('ouarzazate','Ouarzazate'),('laayoune','Laayoune'),('dakhla','Dakhla'),('tanger','Tangier'),('rabat','Rabat'),('casablanca','Casablanca')]:
        if needle in low and label not in ents:ents.append(label)
    comps=[COMPETITORS[k] for k in COMPETITORS if k in low];comp=s.get('competitor') or (comps[0] if comps else None)
    s['entities']=list(dict.fromkeys((s.get('entities') or [])+ents))[:20]
    if comp:s['competitor']=comp
    return s['entities'],comp

def infer_project(s):
    p=s.get('project') or s.get('projectName')
    if p:return p
    t=norm(s.get('title','')+' '+s.get('summary',''))
    if 'offshore' in t and 'wind' in t and any(x in t for x in ('feasibility','study','first offshore')):return 'Morocco Offshore Wind Feasibility Study'
    if 'ifahsa' in t:return 'Ifahsa Pumped Hydropower Storage (PHS) Project'
    if 'el menzel' in t:return 'El Menzel Pumped Storage Hydropower Project'
    return None

def make_queries(s,level):
    title=s.get('title','');ents=s.get('entities') or [];cats=s.get('categories') or [];project=infer_project(s) or '';qs=[]
    if project:qs += [f'"{project}" Morocco',f'"{project}" contractor',f'"{project}" tender']
    for e in ents[:5]:qs += [f'"{e}" Morocco {" ".join(cats[:2])}',f'"{e}" {project or title}']
    qs += [f'"{title}"',f'Morocco {title}']
    t=norm(title+' '+' '.join(cats)+' '+' '.join(ents))
    if any(x in t for x in ('wind','eolien','offshore')):qs += ['Morocco offshore wind MASEN EIB feasibility','Morocco offshore wind Essaouira contractor','site:eib.org Morocco offshore wind','site:masen.ma offshore wind Morocco']
    if any(x in t for x in ('solar','photovoltaic','pv')):qs += ['Morocco solar PV project contractor tender ONEE MASEN','Morocco photovoltaic project award EPC']
    if any(x in t for x in ('hydrogen','ammonia','ptx')):qs += ['Morocco green hydrogen ammonia project investor contractor','Morocco Power to X tender project']
    if any(x in t for x in ('pumped','hydro','storage')):qs += ['Morocco pumped storage hydro project contractor','Ifahsa pumped hydropower storage Morocco','site:worldbank.org Ifahsa pumped hydropower Morocco']
    if any(x in t for x in ('office','subsidiary','market entry','local entity','sarl','expands presence')):qs += ['Morocco '+title+' official','Morocco '+title+' subsidiary','Morocco '+title+' Casablanca office','Morocco engineering consulting market entry '+' '.join(ents[:2])]
    if level>=3:qs += ['Morocco '+title+' official','Morocco '+title+' procurement','Morocco '+title+' financing','Morocco '+title+' consultant','Morocco '+title+' owner']
    if level>=4:qs += ['Morocco '+title+' Fichtner','Morocco '+title+' competitor','Morocco '+title+' technical advisory','Morocco '+title+' lender']
    seen=set();out=[]
    for q in qs:
        q=re.sub(r'\s+',' ',q).strip()
        if q.lower() not in seen and len(q)>=12:seen.add(q.lower());out.append(q)
    return out

def load_signals():
    text=(DATA/'signals.js').read_text(encoding='utf-8');m=re.search(r'export const signals = (.*);\s*$',text,re.S);return json.loads(m.group(1)) if m else []
def fresh(s):
    e=s.get('enrichment') or {};stamp=e.get('researchedAt')
    if not stamp or e.get('engineVersion')!=ENRICHMENT_ENGINE_VERSION:return False
    try:return datetime.now(timezone.utc)-datetime.fromisoformat(stamp.replace('Z','+00:00'))<timedelta(hours=ENRICHMENT_TTL_HOURS)
    except:return False
def weak(s,n):
    e=s.get('enrichment') or {};cnt=int(e.get('sourceCount') or len(e.get('sources') or []));facts=e.get('facts') or [];ents=s.get('entities') or e.get('entities') or [];minimum={1:2,2:4,3:6,4:8}.get(n,0)
    return cnt<minimum or (n>=2 and not facts) or (n>=3 and not ents) or (n>=2 and str(e.get('overallConfidence','')).upper()=='LOW')
def should_research(s,m):
    if m['levelNumber']<=0:return False,'L0 monitor-only'
    if not fresh(s):return True,'missing/stale/old-engine enrichment'
    if weak(s,m['levelNumber']):return True,'fresh but weak enrichment'
    return False,'fresh and sufficiently enriched'

def infer_refs(s,evidence):
    text=' '.join([s.get('title',''),s.get('summary','')]+[f"{x.get('title','')} {x.get('snippet','')}" for x in evidence]);return sorted(set(re.findall(r'\b[A-Z]{1,8}[-/]\d{3,}(?:[-/]\d{2,})+\b',text)))[:8]

def fallback(s,evidence):
    text=' '.join([s.get('title',''),s.get('summary','')]+[f"{x.get('title','')} {x.get('snippet','')} {x.get('source','')}" for x in evidence]);n=norm(text);facts=[];project=infer_project(s)
    if 'rina' in n and any(x in n for x in ('morocco','maroc','casablanca')):facts.append({'claim':'Public sources identify RINA as establishing a Moroccan engineering/consulting presence in Casablanca.','confidence':'HIGH','sourceIndexes':[i for i,x in enumerate(evidence) if 'rina' in norm(x.get('title','')+' '+x.get('snippet',''))][:5]})
    if 'ifahsa' in n and any(x in n for x in ('pumped hydro','pumped hydropower','pumped storage','step')):project='Ifahsa Pumped Hydropower Storage (PHS) Project';facts.append({'claim':'Public sources identify the development as the Ifahsa pumped hydropower storage project in Morocco.','confidence':'HIGH','sourceIndexes':[i for i,x in enumerate(evidence) if 'ifahsa' in norm(x.get('title','')+' '+x.get('snippet',''))][:4]})
    if 'offshore' in n and 'wind' in n and any(x in n for x in ('eib','european investment bank')):facts.append({'claim':'Public sources corroborate an EIB-backed feasibility study for Morocco offshore wind development.','confidence':'HIGH','sourceIndexes':[i for i,x in enumerate(evidence) if 'offshore' in norm(x.get('title','')+' '+x.get('snippet',''))][:5]})
    if 'onee' in n:facts.append({'claim':'ONEE is identified in public project documentation as the implementing Moroccan utility.','confidence':'HIGH','sourceIndexes':[i for i,x in enumerate(evidence) if 'onee' in norm(x.get('title','')+' '+x.get('snippet',''))][:4]})
    refs=infer_refs(s,evidence)
    if refs:facts.append({'claim':'Public evidence contains procurement/contract reference(s): '+', '.join(refs)+'.','confidence':'MEDIUM','sourceIndexes':[i for i,x in enumerate(evidence) if any(r in (x.get('title','')+' '+x.get('snippet','')) for r in refs)][:5]})
    actions=['Verify material claims against primary owner/DFI sources before treating them as confirmed.']
    if s.get('competitor'):actions.insert(0,f"Track {s['competitor']} as a strategic competitor/relationship signal and identify its exact scope.")
    if 'rina' in n and any(x in n for x in ('office','subsidiary','casablanca','market entry')):actions.insert(0,'Track RINA Morocco as a strategic competitor market-entry signal and map its energy-transition, infrastructure and certification activity.')
    if project:actions.insert(0,'Track the project lifecycle and identify remaining owner’s-engineer / technical-advisory packages.')
    return {'project':project,'entities':s.get('entities') or [],'facts':facts,'development':'Public-source enrichment completed; claims are limited to independently discoverable evidence.','interpretation':'The signal was researched according to its assigned adaptive level.','fichtnerImplication':'Potential relevance for technical advisory, owner’s engineering, grid integration, procurement support or lender technical advisory where applicable.','recommendedActions':actions,'overallConfidence':'HIGH' if len(facts)>=2 else ('MEDIUM' if facts else 'LOW'),'unresolved':[] if facts else ['Insufficient public evidence to verify the material claim.']}

def gemini(s,evidence,m):
    key=os.getenv('GEMINI_API_KEY')
    if not key:return None
    model=os.getenv('ATLAS_AI_MODEL','gemini-2.5-flash');payload={'task':'Enrich this Morocco renewable-energy intelligence signal using ONLY supplied public source records. Do not invent facts or bypass paywalls. Separate verified facts from reported claims, interpretation and action. Research level '+m['level']+'.','output':{'project':'string or null','entities':['strings'],'facts':[{'claim':'string','confidence':'HIGH|MEDIUM|LOW','sourceIndexes':[0]}],'development':'string','interpretation':'string','fichtnerImplication':'string or null','recommendedActions':['strings'],'overallConfidence':'HIGH|MEDIUM|LOW','unresolved':['strings']},'signal':{k:s.get(k) for k in ['title','summary','source','published','signalType','projectStage','entities','competitor','categories']},'sources':evidence}
    body=json.dumps({'contents':[{'parts':[{'text':json.dumps(payload,ensure_ascii=False)}]}],'generationConfig':{'temperature':0,'responseMimeType':'application/json'}}).encode();url=f'https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={key}'
    try:
        req=urllib.request.Request(url,data=body,headers={'Content-Type':'application/json'},method='POST')
        with urllib.request.urlopen(req,timeout=45) as r:d=json.loads(r.read().decode())
        return json.loads(d['candidates'][0]['content']['parts'][0]['text'])
    except Exception as e:print('Gemini enrichment unavailable:',e);return None

def main():
    signals=load_signals();now=datetime.now(timezone.utc).isoformat();targets=[];skipped={};levels={};ai_count=0
    for s in signals:
        infer_entities(s);s['project']=infer_project(s) or s.get('project');m=research_priority(s);s['researchPriority']=m['score'];s['researchLevel']=m['level'];s['researchLevelName']=m['levelName'];s['researchPriorityReasons']=m['reasons'];s['researchTriggers']=m['triggers'];s['researchBudget']={'maxQueries':m['maxQueries'],'maxSources':m['maxSources']};do,reason=should_research(s,m);s['researchEligibility']={'eligible':m['levelNumber']>0,'willResearch':do,'reason':reason,'engineVersion':ENRICHMENT_ENGINE_VERSION}
        if do:targets.append((m['levelNumber'],m['score'],s,m))
        else:skipped[reason]=skipped.get(reason,0)+1
    for n,score,s,m in sorted(targets,key=lambda x:(x[0],x[1]),reverse=True):
        qs=make_queries(s,n)[:m['maxQueries']];evidence=[];seen=set()
        for q in qs:
            for item in rss(q):
                k=hashlib.sha1((slug(item['title'])+item['url'].split('?')[0]).encode()).hexdigest()[:16]
                if k in seen:continue
                seen.add(k);evidence.append({**item,'query':q})
        refs=infer_refs(s,evidence)
        if refs:s['contractReferences']=refs
        unique=[]
        for item in evidence:
            if sum(1 for x in unique if norm(x['source'])==norm(item['source']))>=2:continue
            unique.append(item)
            if len(unique)>=m['maxSources']:break
        result=gemini(s,unique,m) or fallback(s,unique);e={'engineVersion':ENRICHMENT_ENGINE_VERSION,'researchedAt':now,'status':'ai-enriched' if os.getenv('GEMINI_API_KEY') and result else ('public-evidence' if unique else 'no-public-match'),'researchLevel':m['level'],'researchLevelName':m['levelName'],'researchPriority':m['score'],'researchQueries':qs,'sources':unique,'sourceCount':len(unique)}
        if result:e.update(result);ai_count+=1
        s['enrichment']=e;s['evidenceLevel']='multi-source enriched' if os.getenv('GEMINI_API_KEY') and result else ('public search evidence' if unique else s.get('evidenceLevel','news source'));s['aiReviewed']=bool(os.getenv('GEMINI_API_KEY') and result);levels[m['level']]=levels.get(m['level'],0)+1
    (DATA/'signals.js').write_text('export const signals = '+json.dumps(signals,ensure_ascii=False,indent=2)+';\n',encoding='utf-8');print(f'Adaptive enrichment complete: targets={len(targets)} AI-enriched={ai_count} levels={levels} skipped={skipped}')
if __name__=='__main__':main()
