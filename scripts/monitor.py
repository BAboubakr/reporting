import hashlib, html, json, re, urllib.parse, urllib.request, xml.etree.ElementTree as ET
from datetime import datetime, timedelta, timezone
from pathlib import Path
from smart_filter import classify

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / 'data'
LOOKBACK_DAYS = 14
MAX_ITEMS = 80
TIMEOUT = 20

COMPETITORS = ['AFRY','Artelia','Tractebel','Mott MacDonald','WSP','Worley','Egis','ILF Consulting Engineers','DNV','NOVEC','INGEMA']
MARKET_QUERIES = ['Morocco renewable energy solar PV BESS battery wind hydrogen grid tender','Morocco MASEN renewable tender project','Morocco ONEE grid transmission renewable tender','Morocco ANRE electricity regulation renewable','Morocco green hydrogen ammonia PtX investment','Morocco renewable energy manufacturing investment']
COMPETITOR_QUERIES = [f'{c} Morocco renewable energy' for c in COMPETITORS]
OFFICIAL_PAGES = [('ONEE tenders','https://www.one.org.ma/FR/pages/aoselect.asp?action=1&domaine=&esp=2&id1=7&id2=64&id3=54&nao=&nature=&objet=&page=1&t1=&t2=&t3=1&type='),('ONEE results','https://www.one.org.ma/fr/pages/result.asp?esp=2&id1=7&id2=64&id3=56&page=1&t2=1&t3=1'),('MASEN e-Tendering','https://etendering.masen.ma/')]
KEYWORDS={'Solar PV':['solar','photovoltaic','pv','masen'],'BESS':['bess','battery','storage'],'Wind':['wind','eolien','éolien'],'Grid':['grid','transmission','substation','225 kv','onee'],'Regulation':['anre','regulation','tariff','law','decree','regulatory'],'Hydrogen / PtX':['hydrogen','ammonia','ptx','power-to-x','electrolysis'],'Investment':['investment','financing','funding','loan','mmdh','million','billion'],'Tender / Procurement':['tender','procurement','appel d’offres','appel d offres','consultation','prequalification'],'Manufacturing':['factory','manufacturing','module','cell','industrial']}
SIGNAL_RULES=[('award',['awarded','won the contract','wins contract','selected','appointed','attributed','adjudicated','lauréat','retenu','attribué']),('tender',['tender','appel d’offres','appel d offres','procurement','consultation','prequalification','rfp']),('project milestone',['construction','commissioned','inaugurated','groundbreaking','financial close','commercial operation','mise en service','construction starts']),('project announcement',['project','plant','farm','facility','development','announces','launches','to develop','will build']),('investment',['investment','financing','funding','loan','invests','million','billion','mmdh']),('regulatory',['regulation','tariff','law','decree','decision','anre','regulatory']),('partnership',['partnership','agreement','memorandum','mou','joint venture','consortium','collaboration']),('manufacturing',['factory','manufacturing','module','cell','industrial plant'])]
NOISE=['nouvel utilisateur','créer un compte','se connecter','connexion','menu','accueil','contact','recherche','newsletter','mentions légales','politique de confidentialité','cookies','subscribe','sign in','log in','home','search','0 entités publiques inscrites','tester la configuration de mon poste','soumettre une réclamation','liste des marchés attribués','liste des bons de commande attribués','annonce de programme prévisionnel','annonce de programme previsionnel','toutes les décisions de résiliation','tous les résultats définitifs','consultations et annonces','matériel accepté réseau onee','textes réglementaires et techniques','contrôle du maintien de la qualité','spécifications techniques','entreprises agréées en réseau','entreprises agres en reseau','travaux et prestations soumis agrément','travaux et prestations soumis agrement','agrément des entreprises de travaux et services','agrement des entreprises de travaux et services','constitution des dossiers de qualifications des microentreprises','qualification des microentreprises','liste des activités pouvant être confiées à des microentreprises','liste des activites pouvant etre confiees a des microentreprises']

def fetch(url):
    req=urllib.request.Request(url,headers={'User-Agent':'Atlas-Morocco-Intelligence/2.0'})
    with urllib.request.urlopen(req,timeout=TIMEOUT) as r:return r.read()

def clean(text):return re.sub(r'\s+',' ',html.unescape(re.sub(r'<[^>]+>',' ',text or ''))).strip()

def normalize(text):return re.sub(r'\s+',' ',re.sub(r'[^a-z0-9àâçéèêëîïôûùüÿñæœ\s-]',' ',(text or '').lower())).strip()

def is_noise(text):
    t=normalize(text)
    if len(t)<18 or len(t)>350:return True
    if any(t==n or t.startswith(n+' ') for n in NOISE):return True
    return False

def google_rss(query):
    url='https://news.google.com/rss/search?'+urllib.parse.urlencode({'q':query+' when:14d','hl':'en-US','gl':'US','ceid':'US:en'})
    try:root=ET.fromstring(fetch(url))
    except Exception as exc:print('RSS error',query,exc);return []
    out=[]
    for item in root.findall('./channel/item'):
        title=clean(item.findtext('title'));link=item.findtext('link') or '';desc=clean(item.findtext('description'));pub=item.findtext('pubDate') or '';se=item.find('source');source=clean(se.text if se is not None else '') or 'Google News'
        if title and link and not is_noise(title):out.append((title,link,desc,pub,source,'news'))
    return out

def page_items(name,url):
    try:body=fetch(url).decode('utf-8','ignore')
    except Exception as exc:print('Page error',name,exc);return []
    chunks=[]
    for m in re.finditer(r'<(?:a|h1|h2|h3|h4)[^>]*>(.*?)</(?:a|h1|h2|h3|h4)>',body,re.I|re.S):
        t=clean(m.group(1))
        if not is_noise(t):chunks.append(t)
    return [(c,url,'',datetime.now(timezone.utc).isoformat(),name,'official') for c in chunks[:30]]

def classify_categories(title,desc):
    t=(title+' '+desc).lower(); found=[]
    for cat,words in KEYWORDS.items():
        if any(w.lower() in t for w in words):found.append(cat)
    return found or ['Market intelligence']

def competitor_hit(text):
    low=text.lower()
    for c in COMPETITORS:
        if c.lower() in low:return c
    return None

def signal_type(title,desc):
    t=(title+' '+desc).lower()
    for label,words in SIGNAL_RULES:
        if any(w in t for w in words):return label
    return 'market movement'

def extract_entities(title,desc):
    text=title+' '+desc;entities=[]
    for c in ['MASEN','ONEE','ANRE','OCP','IRESEN','AMEE','Ministry of Energy Transition','CDG','Tanger Med']+COMPETITORS:
        if re.search(r'(?<!\w)'+re.escape(c)+r'(?!\w)',text,re.I):entities.append(c)
    return list(dict.fromkeys(entities))[:10]

def extract_stage(text):
    t=text.lower(); stages=[('commissioned',['commissioned','inaugurated','mise en service','commercial operation']),('construction',['construction','groundbreaking','built']),('financial close',['financial close','financing closed']),('contract award',['awarded','won the contract','selected','appointed','attributed','adjudicated','lauréat','retenu']),('tender',['tender','appel d’offres','procurement','prequalification','rfp']),('development',['pre-feasibility','feasibility','pre-feed','feasibility study','development']),('announcement',['announced','agreement','mou','partnership','plans to'])]
    for stage,words in stages:
        if any(w in t for w in words):return stage
    return 'monitoring'

def score(title,desc,competitor,source_type):
    t=(title+' '+desc).lower();s=28;weights={'tender':14,'contract':14,'awarded':18,'selected':18,'investment':12,'financing':14,'project':8,'masen':10,'onee':10,'hydrogen':8,'bess':10,'battery':8,'grid':8,'regulation':12,'anre':12,'factory':9,'manufacturing':9,'construction':10}
    for w,v in weights.items():
        if w in t:s+=v
    if source_type=='official':s+=15
    if competitor:s+=10
    return min(s,98)

def iso_date(raw):
    if not raw:return datetime.now(timezone.utc).isoformat()
    try:
        from email.utils import parsedate_to_datetime
        return parsedate_to_datetime(raw).astimezone(timezone.utc).isoformat()
    except Exception:return raw

def novelty(title,existing_titles):
    words=set(normalize(title).split())
    if len(words)<3 or not existing_titles:return 1.0
    best=0.0
    for old in existing_titles:
        ow=set(normalize(old).split())
        if ow:best=max(best,len(words&ow)/max(1,len(words|ow)))
    return round(1-best,2)

def dedupe_key(title,link):return hashlib.sha1((normalize(title)+'|'+link.split('?')[0]).encode()).hexdigest()[:12]

def main():
    rows=[]
    for q in MARKET_QUERIES+COMPETITOR_QUERIES:rows+=google_rss(q)
    for name,url in OFFICIAL_PAGES:rows+=page_items(name,url)
    cutoff=datetime.now(timezone.utc)-timedelta(days=LOOKBACK_DAYS);seen=set();candidates=[]
    for title,link,desc,pub,source,source_type in rows:
        published=iso_date(pub)
        try:
            if datetime.fromisoformat(published.replace('Z','+00:00'))<cutoff:continue
        except Exception:pass
        key=dedupe_key(title,link)
        if key in seen:continue
        seen.add(key);competitor=competitor_hit(title+' '+desc);categories=classify_categories(title,desc);relevance=score(title,desc,competitor,source_type)
        candidates.append((title,link,desc,published,source,source_type,competitor,categories,relevance))
    unique=[]
    for row in sorted(candidates,key=lambda r:r[8],reverse=True):
        words=set(normalize(row[0]).split());duplicate=False
        for existing in unique:
            ew=set(normalize(existing[0]).split());similarity=len(words&ew)/max(1,len(words|ew))
            if similarity>=0.72:duplicate=True;break
        if duplicate:continue
        unique.append(row)
        if len(unique)>=MAX_ITEMS:break
    existing_titles=[r[0] for r in unique];signals=[];now=datetime.now(timezone.utc).isoformat()
    for title,link,desc,published,source,source_type,competitor,categories,relevance in unique:
        sig_type=signal_type(title,desc);stage=extract_stage(title+' '+desc);novelty_score=novelty(title,existing_titles);actionability=min(99,round(relevance*0.72+novelty_score*28));evidence_level='official source' if source_type=='official' else 'news source';why=f"{sig_type.title()} signal relevant to Morocco renewable-energy activity"+(f"; {competitor} detected" if competitor else '')
        signals.append({'id':'sig-'+dedupe_key(title,link),'title':title,'headline':title,'summary':desc[:500],'url':link,'source':source,'sourceType':source_type,'published':published,'detected':now,'categories':categories,'signalType':sig_type,'projectStage':stage,'entities':extract_entities(title,desc),'competitor':competitor,'relevanceScore':relevance,'actionabilityScore':actionability,'noveltyScore':novelty_score,'status':'new','evidenceLevel':evidence_level,'evidenceSnippet':desc[:280],'whyItMatters':why,'fichtnerRelevance':'HIGH' if relevance>=80 else ('MEDIUM' if relevance>=60 else 'WATCH')})
    filtered=classify(signals)
    kept=[s for s in filtered if s.get('filterDecision')=='KEEP']
    review=[s for s in filtered if s.get('filterDecision')=='REVIEW']
    # REVIEW items remain available for analyst inspection but are not promoted to the main signal feed.
    for s in review:s['status']='review'
    signals=kept
    signals.sort(key=lambda x:(x['actionabilityScore'],x['relevanceScore']),reverse=True)
    (DATA/'signals.js').write_text('export const signals = '+json.dumps(signals,ensure_ascii=False,indent=2)+';\n',encoding='utf-8')
    (DATA/'signal-review.js').write_text('export const signalReview = '+json.dumps(review,ensure_ascii=False,indent=2)+';\n',encoding='utf-8')
    print(f'Collected {len(rows)} raw records; {len(candidates)} candidates; AI filter KEEP={len(kept)} REVIEW={len(review)} REJECT={len(filtered)-len(kept)-len(review)}.')

if __name__=='__main__':main()