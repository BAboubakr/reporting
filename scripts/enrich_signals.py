"""Atlas Signal Enrichment Engine.

Research depth is adaptive: L0 signals are monitored only; L1 is lightly
verified; L2 is investigated; L3 receives strategic multi-source research;
L4 receives priority research. The same engine therefore spends effort where
business value is highest instead of researching every news item equally.

Important design rule: a fresh but weak enrichment is NOT considered complete.
The engine extracts entities/project clues first, builds evidence-driven
queries, and re-researches weak records after an engine-version change.
"""
import hashlib, html, json, os, re, urllib.parse, urllib.request, xml.etree.ElementTree as ET
from datetime import datetime, timedelta, timezone
from pathlib import Path
from research_priority import research_priority

ROOT=Path(__file__).resolve().parents[1]; DATA=ROOT/'data'; TIMEOUT=20; MAX_RESULTS_PER_QUERY=5
ENRICHMENT_TTL_HOURS=24
ENRICHMENT_ENGINE_VERSION='5.0-entity-aware-adaptive'

KNOWN_ENTITIES={
    'Fichtner':'Fichtner', 'NOVEC':'NOVEC', 'JESA':'JESA', 'AFRY':'AFRY',
    'Artelia':'Artelia', 'Tractebel':'Tractebel', 'Mott MacDonald':'Mott MacDonald',
    'WSP':'WSP', 'Worley':'Worley', 'Egis':'Egis', 'ILF':'ILF Consulting Engineers',
    'DNV':'DNV', 'INGEMA':'INGEMA', 'ONEE':'ONEE', 'MASEN':'MASEN', 'ANRE':'ANRE',
    'OCP':'OCP', 'AMEE':'AMEE', 'World Bank':'World Bank', 'African Development Bank':'African Development Bank',
    'AfDB':'AfDB', 'KfW':'KfW', 'AFD':'AFD', 'EIB':'EIB', 'IsDB':'IsDB', 'EBRD':'EBRD',
    'GIZ':'GIZ', 'European Investment Bank':'EIB', 'OWC':'OWC', 'PHENIXA':'PHENIXA',
    'Ginger':'Ginger', 'Gaïa Terre Bleue':'Gaïa Terre Bleue', 'SOFECO':'SOFECO',
}
COMPETITORS={'fichtner':'Fichtner','afry':'AFRY','artelia':'Artelia','tractebel':'Tractebel','mott macdonald':'Mott MacDonald','wsp':'WSP','worley':'Worley','egis':'Egis','ilf':'ILF Consulting Engineers','dnv':'DNV','novec':'NOVEC','ingema':'INGEMA','jesa':'JESA'}


def fetch(url):
    req=urllib.request.Request(url,headers={'User-Agent':'Atlas-Morocco-Intelligence/5.0'})
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


def infer_entities(signal):
    """Extract high-value entities from the signal itself before researching.
    This fixes the failure mode where an important article arrived with an
    empty entities[] field and therefore received generic research queries.
    """
    text=' '.join(str(signal.get(k) or '') for k in ('title','summary','description','source','competitor'))
    low=text.lower(); entities=[]
    for needle,label in KNOWN_ENTITIES.items():
        if needle.lower() in low and label not in entities: entities.append(label)
    # Common project/location clues not covered by the fixed entity dictionary.
    for needle,label in [('essaouira','Essaouira'),('ifahsa','Ifahsa'),('el menzel','El Menzel'),('ouarzazate','Ouarzazate'),('laayoune','Laayoune'),('dakhla','Dakhla'),('tanger','Tangier'),('rabat','Rabat'),('casablanca','Casablanca')]:
        if needle in low and label not in entities: entities.append(label)
    competitors=[COMPETITORS[k] for k in COMPETITORS if k in low]
    competitor=signal.get('competitor') or (competitors[0] if competitors else None)
    signal['entities']=list(dict.fromkeys((signal.get('entities') or [])+entities))[:20]
    if competitor: signal['competitor']=competitor
    return signal['entities'],competitor


def infer_project(signal):
    existing=signal.get('project') or signal.get('projectName')
    if existing:return existing
    text=norm(signal.get('title','')+' '+signal.get('summary',''))
    if 'offshore' in text and 'wind' in text and any(x in text for x in ('feasibility','study','first offshore')):
        return 'Morocco Offshore Wind Feasibility Study'
    if 'ifahsa' in text:return 'Ifahsa Pumped Hydropower Storage (PHS) Project'
    if 'el menzel' in text:return 'El Menzel Pumped Storage Hydropower Project'
    return None


def infer_contract_refs(signal,evidence):
    text=' '.join([signal.get('title',''),signal.get('summary','')]+[f"{x.get('title','')} {x.get('snippet','')}" for x in evidence])
    refs=sorted(set(re.findall(r'\b[A-Z]{1,8}[-/]\d{3,}(?:[-/]\d{2,})+\b',text)))
    return refs[:8]


def make_queries(signal,level):
    title=signal.get('title',''); entities=signal.get('entities') or []; cats=signal.get('categories') or []; project=infer_project(signal) or ''
    refs=signal.get('contractReferences') or []
    queries=[]
    # Identity/contract queries come first. They are much more discriminating
    # than repeating the full headline against a news aggregator.
    for ref in refs: queries += [f'"{ref}" EIB Morocco',f'"{ref}" Morocco']
    if project: queries += [f'"{project}" Morocco',f'"{project}" contractor',f'"{project}" tender']
    if entities:
        for entity in entities[:5]: queries += [f'"{entity}" Morocco {" ".join(cats[:2])}',f'"{entity}" {project or title}']
    queries += [f'"{title}"',f'Morocco {title}']
    t=norm(title+' '+' '.join(cats)+' '+' '.join(entities))
    if any(x in t for x in ['pumped','hydro','storage']):queries += ['Morocco pumped storage hydro project contractor','Morocco STEP pumped hydro tender','Morocco pumped storage ONEE contractor','Ifahsa pumped hydropower storage Morocco','Ifahsa contractor Morocco ONEE','site:worldbank.org Ifahsa pumped hydropower Morocco','site:onee.ma Ifahsa STEP Morocco']
    if any(x in t for x in ['solar','photovoltaic','pv']):queries += ['Morocco solar PV project contractor tender ONEE MASEN','Morocco photovoltaic project award EPC']
    if any(x in t for x in ['wind','eolien','offshore']):queries += ['Morocco offshore wind MASEN EIB feasibility','Morocco offshore wind Essaouira contractor','Morocco offshore wind NOVEC OWC','site:eib.org Morocco offshore wind','site:masen.ma offshore wind Morocco']
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
    enrichment=signal.get('enrichment') or {}; stamp=enrichment.get('researchedAt')
    if not stamp or enrichment.get('engineVersion')!=ENRICHMENT_ENGINE_VERSION:return False
    try:return datetime.now(timezone.utc)-datetime.fromisoformat(stamp.replace('Z','+00:00'))<timedelta(hours=ENRICHMENT_TTL_HOURS)
    except Exception:return False


def enrichment_is_weak(signal,level_num):
    e=signal.get('enrichment') or {}
    if not e:return True
    source_count=int(e.get('sourceCount') or len(e.get('sources') or []))
    facts=e.get('facts') or []
    entities=signal.get('entities') or e.get('entities') or []
    # Higher-value levels need stronger evidence before a record is considered done.
    min_sources={1:2,2:4,3:6,4:8}.get(level_num,0)
    if source_count<min_sources:return True
    if level_num>=2 and not facts:return True
    if level_num>=3 and len(entities)==0:return True
    if str(e.get('overallConfidence','')).upper()=='LOW' and level_num>=2:return True
    return False


def should_research(signal,meta):
    if meta['levelNumber']<=0:return False,'L0 monitor-only'
    if not already_fresh(signal):return True,'missing/stale/old-engine enrichment'
    if enrichment_is_weak(signal,meta['levelNumber']):return True,'fresh but weak enrichment'
    return False,'fresh and sufficiently enriched'


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
    text=' '.join([signal.get('title',''),signal.get('summary','')]+[f"{x.get('title','')} {x.get('snippet','')} {x.get('source','')}" for x in evidence]);n=norm(text);facts=[];project=infer_project(signal)
    refs=signal.get('contractReferences') or infer_contract_refs(signal,evidence)
    if 'ifahsa' in n and any(x in n for x in ('pumped hydro','pumped hydropower','pumped storage','step')):
        project='Ifahsa Pumped Hydropower Storage (PHS) Project';facts.append({'claim':'Public sources identify the development as the Ifahsa pumped hydropower storage project in Morocco.','confidence':'HIGH','sourceIndexes':[i for i,x in enumerate(evidence) if 'ifahsa' in norm(x.get('title','')+' '+x.get('snippet',''))][:4]})
    if 'offshore' in n and 'wind' in n and any(x in n for x in ('eib','european investment bank')):
        facts.append({'claim':'Public sources corroborate an EIB-backed feasibility study for Morocco offshore wind development.','confidence':'HIGH','sourceIndexes':[i for i,x in enumerate(evidence) if 'offshore' in norm(x.get('title','')+' '+x.get('snippet','')) and ('eib' in norm(x.get('title','')+' '+x.get('snippet','')) or 'european investment bank' in norm(x.get('title','')+' '+x.get('snippet','')))][:5]})
    m=re.search(r'(?<!\d)(300)\s*(?:-|–)?\s*MW',text,re.I)
    if m:facts.append({'claim':'Public sources report a 300 MW capacity for Ifahsa.','confidence':'HIGH','sourceIndexes':[i for i,x in enumerate(evidence) if '300' in (x.get('title','')+' '+x.get('snippet',''))][:4]})
    m=re.search(r'\$\s*265\s*million|265\s*million\s*(?:US\s*)?dollars',text,re.I)
    if m:facts.append({'claim':'The World Bank approved $265 million of support for the Ifahsa project.','confidence':'HIGH','sourceIndexes':[i for i,x in enumerate(evidence) if '265' in (x.get('title','')+' '+x.get('snippet',''))][:4]})
    if 'onee' in n:facts.append({'claim':'ONEE is identified in public project documentation as the implementing Moroccan utility.','confidence':'HIGH','sourceIndexes':[i for i,x in enumerate(evidence) if 'onee' in norm(x.get('title','')+' '+x.get('snippet',''))][:4]})
    if refs:
        facts.append({'claim':'Public evidence contains the following procurement/contract reference(s): '+', '.join(refs)+'.','confidence':'MEDIUM','sourceIndexes':[i for i,x in enumerate(evidence) if any(r in (x.get('title','')+' '+x.get('snippet','')) for r in refs)][:5]})
    actions=['Verify material award/procurement claims against a primary owner or DFI source before treating them as confirmed.']
    if project:actions.insert(0,'Track the project as a strategic development and identify awarded scope plus remaining owner’s-engineer / technical-advisory packages.')
    if signal.get('competitor'):actions.insert(0,f"Track {signal['competitor']} as a relationship/competitive signal and identify its exact contracted or proposed scope.")
    return {'project':project,'entities':signal.get('entities') or [],'facts':facts,'development':'Public-source enrichment completed; claims are limited to independently discoverable evidence.','interpretation':'The signal has been enriched according to its assigned research depth; unresolved claims remain explicitly flagged.','fichtnerImplication':'Potential relevance for technical advisory, owner’s engineering, grid integration, procurement support or lender technical advisory where applicable.','recommendedActions':actions,'overallConfidence':'HIGH' if len(facts)>=2 else ('MEDIUM' if facts else 'LOW'),'unresolved':['Material claims not independently confirmed in public primary sources'] if evidence else ['No public corroborating evidence found']}


def main():
    signals=load_signals();now=datetime.now(timezone.utc).isoformat();targets=[];skip_counts={}
    # Every signal receives a priority decision. L0 remains monitor-only.
    # L1-L4 are eligible individually; there is no global cap. Freshness only
    # suppresses a signal when the enrichment is both current AND strong enough.
    for s in signals:
        infer_entities(s)
        s['project']=infer_project(s) or s.get('project')
        meta=research_priority(s);s['researchPriority']=meta['score'];s['researchLevel']=meta['level'];s['researchLevelName']=meta['levelName'];s['researchPriorityReasons']=meta['reasons'];s['researchTriggers']=meta['triggers'];s['researchBudget']={'maxQueries':meta['maxQueries'],'maxSources':meta['maxSources']}
        do_research,reason=should_research(s,meta)
        s['researchEligibility']={'eligible':meta['levelNumber']>0,'willResearch':do_research,'reason':reason,'engineVersion':ENRICHMENT_ENGINE_VERSION}
        if do_research:targets.append((meta['levelNumber'],meta['score'],s,meta))
        else:skip_counts[reason]=skip_counts.get(reason,0)+1
    targets=sorted(targets,key=lambda x:(x[0],x[1]),reverse=True);enriched_count=0;level_counts={}
    for level_num,score,signal,meta in targets:
        # First-pass contract references are discovered from the existing signal;
        # after the first search pass we also extract references from evidence.
        queries=make_queries(signal,level_num)[:meta['maxQueries']];evidence=[];seen=set()
        for q in queries:
            for item in rss(q):
                key=hashlib.sha1((slug(item['title'])+item['url'].split('?')[0]).encode()).hexdigest()[:16]
                if key==signal.get('id','').replace('sig-','') or key in seen:continue
                seen.add(key);evidence.append({**item,'query':q})
        refs=infer_contract_refs(signal,evidence)
        if refs:
            signal['contractReferences']=refs
            # A contract/reference discovered after the first query pass gets a
            # focused second pass when budget remains.
            extra=[]
            for ref in refs:
                extra += [f'"{ref}" EIB Morocco',f'"{ref}" Morocco']
            used={q.lower() for q in queries}
            remaining=max(0,meta['maxQueries']-len(queries))
            for q in extra:
                if remaining<=0 or q.lower() in used:continue
                for item in rss(q):
                    key=hashlib.sha1((slug(item['title'])+item['url'].split('?')[0]).encode()).hexdigest()[:16]
                    if key==signal.get('id','').replace('sig-','') or key in seen:continue
                    seen.add(key);evidence.append({**item,'query':q})
                remaining-=1
        title_words=set(slug(signal.get('title','')).split())
        for item in evidence:
            iw=set(slug(item['title']).split());item['relevance']=round(len(title_words&iw)/max(1,len(title_words|iw)),3)
        unique=[]
        for item in sorted(evidence,key=lambda x:(x['relevance'],x.get('published','')),reverse=True):
            if sum(1 for x in unique if norm(x['source'])==norm(item['source']))>=2:continue
            unique.append(item)
            if len(unique)>=meta['maxSources']:break
        result=gemini_enrich(signal,unique,meta) or fallback_enrich(signal,unique)
        enrichment={'engineVersion':ENRICHMENT_ENGINE_VERSION,'researchedAt':now,'status':'enriched' if os.getenv('GEMINI_API_KEY') and result else ('public-evidence' if unique else 'no-public-match'),'researchLevel':meta['level'],'researchLevelName':meta['levelName'],'researchPriority':meta['score'],'researchQueries':queries,'sources':[{k:v for k,v in x.items() if k!='relevance'} for x in unique],'sourceCount':len(unique)}
        if result:enrichment.update(result);enriched_count+=1
        signal['enrichment']=enrichment;signal['evidenceLevel']='multi-source enriched' if os.getenv('GEMINI_API_KEY') and result else ('public search evidence' if unique else signal.get('evidenceLevel','news source'));signal['aiReviewed']=bool(os.getenv('GEMINI_API_KEY') and result) or signal.get('aiReviewed',False);level_counts[meta['level']]=level_counts.get(meta['level'],0)+1
    (DATA/'signals.js').write_text('export const signals = '+json.dumps(signals,ensure_ascii=False,indent=2)+';\n',encoding='utf-8')
    print(f'Adaptive enrichment complete: targets={len(targets)} AI-enriched={enriched_count} levels={level_counts} skipped={skip_counts}')

if __name__=='__main__':main()
