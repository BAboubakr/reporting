"""Atlas Signal Enrichment Engine.

Takes high-value monitored signals, searches public news sources using
signal-specific queries, then asks Gemini to synthesize evidence without
bypassing paywalls. Claims are explicitly separated from interpretation.
"""
import hashlib, html, json, os, re, urllib.parse, urllib.request, xml.etree.ElementTree as ET
from datetime import datetime, timedelta, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / 'data'
TIMEOUT = 20
MAX_SIGNALS = 12
MAX_RESULTS_PER_QUERY = 5
ENRICHMENT_TTL_HOURS = 24


def fetch(url):
    req = urllib.request.Request(url, headers={'User-Agent': 'Atlas-Morocco-Intelligence/3.0'})
    with urllib.request.urlopen(req, timeout=TIMEOUT) as r:
        return r.read()


def clean(text):
    return re.sub(r'\s+', ' ', html.unescape(re.sub(r'<[^>]+>', ' ', text or ''))).strip()


def norm(text):
    return re.sub(r'\s+', ' ', re.sub(r'[^a-z0-9àâçéèêëîïôûùüÿñæœ\s-]', ' ', (text or '').lower())).strip()


def rss(query):
    url = 'https://news.google.com/rss/search?' + urllib.parse.urlencode({
        'q': query + ' when:90d', 'hl': 'en-US', 'gl': 'US', 'ceid': 'US:en'
    })
    try:
        root = ET.fromstring(fetch(url))
    except Exception as exc:
        print('Enrichment RSS error:', query, exc)
        return []
    out = []
    for item in root.findall('./channel/item')[:MAX_RESULTS_PER_QUERY]:
        title = clean(item.findtext('title'))
        link = item.findtext('link') or ''
        desc = clean(item.findtext('description'))
        source_el = item.find('source')
        source = clean(source_el.text if source_el is not None else '') or 'Google News'
        pub = item.findtext('pubDate') or ''
        if title and link:
            out.append({'title': title, 'url': link, 'snippet': desc[:700], 'source': source, 'published': pub})
    return out


def slug(text):
    return re.sub(r'[^a-z0-9]+', ' ', norm(text)).strip()


def make_queries(signal):
    title = signal.get('title', '')
    entities = signal.get('entities') or []
    cats = signal.get('categories') or []
    project = signal.get('project') or signal.get('projectName') or ''
    queries = [
        f'"{title}"',
        f'Morocco {title}',
        f'Morocco {" ".join(entities[:3])} {" ".join(cats[:2])}',
    ]
    if project:
        queries += [f'"{project}" Morocco', f'"{project}" contractor', f'"{project}" tender']
    t = norm(title + ' ' + ' '.join(cats))
    if any(x in t for x in ['pumped', 'hydro', 'storage']):
        queries += ['Morocco pumped storage hydro project contractor', 'Morocco STEP pumped hydro tender', 'Morocco pumped storage ONEE contractor', 'Ifahsa pumped hydropower storage Morocco', 'Ifahsa contractor Morocco ONEE']
    if any(x in t for x in ['solar', 'photovoltaic', 'pv']):
        queries += ['Morocco solar PV project contractor tender ONEE MASEN', 'Morocco photovoltaic project award EPC']
    if any(x in t for x in ['wind', 'eolien', 'offshore']):
        queries += ['Morocco wind project contractor tender', 'Morocco offshore wind project developer']
    if any(x in t for x in ['hydrogen', 'ammonia', 'ptx']):
        queries += ['Morocco green hydrogen ammonia project investor contractor', 'Morocco Power to X tender project']
    if any(x in t for x in ['tender', 'procurement', 'award', 'selected', 'contractor']):
        queries += ['Morocco procurement tender award ' + ' '.join(entities[:2]), 'Morocco contractor selected ' + ' '.join(entities[:2])]
    seen = set(); out = []
    for q in queries:
        q = re.sub(r'\s+', ' ', q).strip()
        if len(q) >= 12 and q.lower() not in seen:
            seen.add(q.lower()); out.append(q)
    return out[:14]


def priority(signal):
    score = float(signal.get('actionabilityScore') or signal.get('relevanceScore') or 0)
    boost = 0
    title = norm(signal.get('title', ''))
    if signal.get('competitor'): boost += 25
    if signal.get('fichtnerRelevance') == 'HIGH': boost += 30
    elif signal.get('fichtnerRelevance') == 'MEDIUM': boost += 15
    if signal.get('signalType') in ('award', 'tender', 'investment', 'project milestone'): boost += 20
    if any(x in title for x in ('contractor selected', 'contract awarded', 'selected contractor', 'award')): boost += 25
    if any(x in title for x in ('pumped hydro', 'pumped storage', 'pumped hydropower', 'storage development')): boost += 20
    return score + boost


def candidate(signal):
    score = float(signal.get('actionabilityScore') or signal.get('relevanceScore') or 0)
    if score >= 72: return True
    if signal.get('competitor'): return True
    if signal.get('fichtnerRelevance') in ('HIGH', 'MEDIUM'): return True
    if signal.get('signalType') in ('award', 'tender', 'project milestone', 'project announcement', 'investment'):
        return score >= 55
    if any(x in ' '.join(signal.get('categories') or []).lower() for x in ('tender', 'procurement', 'investment')):
        return score >= 60
    return False


def load_signals():
    p = DATA / 'signals.js'
    text = p.read_text(encoding='utf-8')
    m = re.search(r'export const signals = (.*);\s*$', text, re.S)
    return json.loads(m.group(1)) if m else []


def already_fresh(signal):
    stamp = signal.get('enrichment', {}).get('researchedAt')
    if not stamp: return False
    try:
        dt = datetime.fromisoformat(stamp.replace('Z', '+00:00'))
        return datetime.now(timezone.utc) - dt < timedelta(hours=ENRICHMENT_TTL_HOURS)
    except Exception:
        return False


def gemini_enrich(signal, evidence):
    key = os.getenv('GEMINI_API_KEY')
    if not key: return None
    model = os.getenv('ATLAS_AI_MODEL', 'gemini-2.5-flash')
    payload = {
        'task': 'Enrich a Morocco renewable-energy intelligence signal using ONLY the supplied source records. Do not invent facts. Do not claim a paywalled source is independently verified. Resolve the likely project/entity when evidence supports it, but mark uncertainty. Separate confirmed facts from interpretation and recommended action.',
        'output': {
            'project': 'string or null',
            'entities': ['strings'],
            'facts': [{'claim': 'string', 'confidence': 'HIGH|MEDIUM|LOW', 'sourceIndexes': [0]}],
            'development': 'concise factual development statement',
            'interpretation': 'why this matters strategically',
            'fichtnerImplication': 'specific consulting/business implication, or null',
            'recommendedActions': ['strings'],
            'overallConfidence': 'HIGH|MEDIUM|LOW',
            'unresolved': ['strings']
        },
        'signal': {k: signal.get(k) for k in ['title','summary','source','published','signalType','projectStage','entities','competitor','categories']},
        'sources': evidence
    }
    url = f'https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={key}'
    body = json.dumps({'contents':[{'parts':[{'text':json.dumps(payload, ensure_ascii=False)}]}], 'generationConfig':{'temperature':0,'responseMimeType':'application/json'}}).encode()
    try:
        req = urllib.request.Request(url, data=body, headers={'Content-Type':'application/json'}, method='POST')
        with urllib.request.urlopen(req, timeout=45) as r:
            data = json.loads(r.read().decode())
        text = data['candidates'][0]['content']['parts'][0]['text']
        return json.loads(text)
    except Exception as exc:
        print('Gemini enrichment unavailable:', exc)
        return None


def main():
    signals = load_signals()
    pool = [s for s in signals if candidate(s) and not already_fresh(s)]
    targets = sorted(pool, key=lambda s: priority(s), reverse=True)[:MAX_SIGNALS]
    now = datetime.now(timezone.utc).isoformat()
    enriched_count = 0
    for signal in targets:
        queries = make_queries(signal)
        evidence = []
        seen = set()
        for q in queries:
            for item in rss(q):
                key = hashlib.sha1((slug(item['title']) + item['url'].split('?')[0]).encode()).hexdigest()[:16]
                if key == signal.get('id','').replace('sig-','') or key in seen: continue
                seen.add(key); evidence.append({**item, 'query': q})
        unique = []
        title_words = set(slug(signal.get('title','')).split())
        for item in evidence:
            iw = set(slug(item['title']).split())
            overlap = len(title_words & iw) / max(1, len(title_words | iw))
            item['relevance'] = round(overlap, 3)
        for item in sorted(evidence, key=lambda x: (x['relevance'], x.get('published','')), reverse=True):
            source_key = norm(item['source'])
            if sum(1 for x in unique if norm(x['source']) == source_key) >= 2: continue
            unique.append(item)
            if len(unique) >= 14: break
        result = gemini_enrich(signal, unique)
        enrichment = {
            'researchedAt': now,
            'status': 'enriched' if result else ('sources-found' if unique else 'no-public-match'),
            'researchQueries': queries,
            'sources': [{k:v for k,v in x.items() if k != 'relevance'} for x in unique],
            'sourceCount': len(unique)
        }
        if result:
            enrichment.update(result)
            enriched_count += 1
        signal['enrichment'] = enrichment
        signal['evidenceLevel'] = 'multi-source enriched' if result else ('public search evidence' if unique else signal.get('evidenceLevel','news source'))
        signal['aiReviewed'] = bool(result) or signal.get('aiReviewed', False)
    (DATA/'signals.js').write_text('export const signals = '+json.dumps(signals, ensure_ascii=False, indent=2)+';\n', encoding='utf-8')
    print(f'Enrichment complete: targets={len(targets)} AI-enriched={enriched_count}')


if __name__ == '__main__':
    main()
