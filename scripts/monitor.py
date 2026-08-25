import hashlib, html, json, re, urllib.parse, urllib.request, xml.etree.ElementTree as ET
from datetime import datetime, timedelta, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / 'data'
LOOKBACK_DAYS = 14
MAX_ITEMS = 80
TIMEOUT = 20

COMPETITORS = ['AFRY','Artelia','Tractebel','Mott MacDonald','WSP','Worley','Egis','ILF Consulting Engineers']
MARKET_QUERIES = [
    'Morocco renewable energy solar PV BESS battery wind hydrogen grid tender',
    'Morocco MASEN renewable tender project',
    'Morocco ONEE grid transmission renewable tender',
    'Morocco ANRE electricity regulation renewable',
    'Morocco green hydrogen ammonia PtX investment',
    'Morocco renewable energy manufacturing investment',
]
COMPETITOR_QUERIES = [f'{c} Morocco renewable energy' for c in COMPETITORS]
OFFICIAL_PAGES = [
    ('ONEE tenders','https://www.one.org.ma/FR/pages/aoselect.asp?action=1&domaine=&esp=2&id1=7&id2=64&id3=54&nao=&nature=&objet=&page=1&t1=&t2=&t3=1&type='),
    ('ONEE results','https://www.one.org.ma/fr/pages/result.asp?esp=2&id1=7&id2=64&id3=56&page=1&t2=1&t3=1'),
    ('MASEN e-Tendering','https://etendering.masen.ma/'),
]
KEYWORDS = {
    'Solar PV':['solar','photovoltaic','pv','masen'], 'BESS':['bess','battery','storage'],
    'Wind':['wind','eolien','éolien'], 'Grid':['grid','transmission','substation','225 kv','onee'],
    'Regulation':['anre','regulation','tariff','law','decree','regulatory'],
    'Hydrogen / PtX':['hydrogen','ammonia','ptx','power-to-x','electrolysis'],
    'Investment':['investment','financing','funding','loan','mmdh','million','billion'],
    'Tender / Procurement':['tender','procurement','appel d’offres','appel d offres','consultation','prequalification'],
    'Manufacturing':['factory','manufacturing','module','cell','industrial'],
}

def fetch(url):
    req = urllib.request.Request(url, headers={'User-Agent':'Atlas-Morocco-Monitor/1.0'})
    with urllib.request.urlopen(req, timeout=TIMEOUT) as r:
        return r.read()

def clean(text):
    text = html.unescape(re.sub(r'<[^>]+>', ' ', text or ''))
    return re.sub(r'\s+', ' ', text).strip()

def google_rss(query):
    url = 'https://news.google.com/rss/search?' + urllib.parse.urlencode({'q': query + ' when:14d', 'hl':'en-US','gl':'US','ceid':'US:en'})
    try:
        root = ET.fromstring(fetch(url))
    except Exception as exc:
        print('RSS error', query, exc); return []
    out=[]
    for item in root.findall('./channel/item'):
        title=clean(item.findtext('title'))
        link=item.findtext('link') or ''
        desc=clean(item.findtext('description'))
        pub=item.findtext('pubDate') or ''
        if title and link: out.append((title,link,desc,pub,'Google News'))
    return out

def page_items(name,url):
    try: body=fetch(url).decode('utf-8','ignore')
    except Exception as exc: print('Page error',name,exc); return []
    text=clean(body)
    # Capture meaningful headings/links from procurement pages without depending on fragile DOM structure.
    chunks=[]
    for m in re.finditer(r'<(?:a|h1|h2|h3|h4)[^>]*>(.*?)</(?:a|h1|h2|h3|h4)>', body, re.I|re.S):
        t=clean(m.group(1))
        if len(t)>=25: chunks.append(t)
    if not chunks and len(text)>=40: chunks=[text[:500]]
    return [(c,url,'',datetime.now(timezone.utc).isoformat(),name) for c in chunks[:30]]

def classify(title,desc):
    t=(title+' '+desc).lower(); found=[]
    for cat, words in KEYWORDS.items():
        if any(w.lower() in t for w in words): found.append(cat)
    return found or ['Market intelligence']

def competitor_hit(text):
    low=text.lower()
    return next((c for c in COMPETITORS if c.lower() in low), None)

def score(title,desc,competitor):
    t=(title+' '+desc).lower(); s=40
    for w in ['tender','award','contract','selected','prequalification','investment','project','masen','onee','hydrogen','bess']:
        if w in t: s += 6
    if competitor: s += 12
    return min(s,98)

def iso_date(raw):
    return raw or datetime.now(timezone.utc).isoformat()

def main():
    rows=[]
    for q in MARKET_QUERIES + COMPETITOR_QUERIES: rows += google_rss(q)
    for name,url in OFFICIAL_PAGES: rows += page_items(name,url)
    cutoff=datetime.now(timezone.utc)-timedelta(days=LOOKBACK_DAYS)
    seen=set(); signals=[]
    for title,link,desc,pub,source in rows:
        key=hashlib.sha1((title.lower()+'|'+link.split('?')[0]).encode()).hexdigest()[:12]
        if key in seen: continue
        seen.add(key)
        competitor=competitor_hit(title+' '+desc)
        categories=classify(title,desc)
        relevance=score(title,desc,competitor)
        signals.append({'id':'sig-'+key,'title':title,'summary':desc[:500], 'url':link, 'source':source,
                        'published':iso_date(pub),'detected':datetime.now(timezone.utc).isoformat(),
                        'categories':categories,'competitor':competitor,'relevanceScore':relevance,
                        'status':'new','evidenceLevel':'source link','fichtnerRelevance':'HIGH' if relevance>=80 else ('MEDIUM' if relevance>=60 else 'WATCH')})
    signals.sort(key=lambda x:x['relevanceScore'], reverse=True)
    signals=signals[:MAX_ITEMS]
    out='export const signals = '+json.dumps(signals,ensure_ascii=False,indent=2)+';\n'
    (DATA/'signals.js').write_text(out,encoding='utf-8')
    print(f'Collected {len(rows)} raw records; stored {len(signals)} signals.')

if __name__=='__main__': main()
