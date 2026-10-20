"""Public-source Morocco procurement radar. Conservative, explainable screening."""
from __future__ import annotations
import hashlib, html, json, re, urllib.error, urllib.parse, urllib.request
from datetime import datetime, timedelta, timezone
from html.parser import HTMLParser
from pathlib import Path
from zoneinfo import ZoneInfo

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / 'data'
OPPORTUNITIES_FILE = DATA / 'rfp-opportunities.json'
HISTORY_FILE = DATA / 'rfp-history.json'
STATUS_FILE = DATA / 'rfp-source-status.json'
CAPABILITIES_FILE = DATA / 'rfp-capabilities.json'
TIMEOUT = 25
USER_AGENT = 'AtlasMoroccoPublicRfpRadar/1.0 (public procurement notice monitoring; contact via repository)'
SOURCES = [
    {'id':'pmmp','name':'Portail Marocain des Marchés Publics','url':'https://www.marchespublics.gov.ma/index.php5?AllCons=&EnCours=&page=entreprise.EntrepriseAdvancedSearch','kind':'official public procurement portal','enabled':True},
    {'id':'masen','name':'MASEN e-Tendering current tenders','url':'https://etendering.masen.ma/index.php?page=entreprise.EntrepriseAdvancedSearch&panierEntreprise=','kind':'official public energy-sector procurement platform','enabled':True},
    {'id':'masen-awards','name':'MASEN e-Tendering award notices','url':'https://etendering.masen.ma/index.php?AvisAttribution=&page=entreprise.EntrepriseAdvancedSearch','kind':'official procurement milestone notices','enabled':True},
    {'id':'masen-cancellations','name':'MASEN e-Tendering cancellations','url':'https://etendering.masen.ma/index.php?AllCons=&consAnnulee=1&page=entreprise.EntrepriseAdvancedSearch','kind':'official procurement milestone notices','enabled':True}
]
DATE_RE = re.compile(r'\b(\d{1,2}/\d{1,2}/\d{4})(?:\s+(\d{1,2}:\d{2}))?\b')
REF_RE = re.compile(r'\b(?=[A-Z0-9/-]*\d)(?:[A-Z0-9]+(?:[-/][A-Z0-9]+){1,5}|[A-Z][A-Z0-9]{4,})\b', re.I)
ENERGY_TERMS = ('solar','photovolta','pv ','wind','éolien','eolien','bess','battery','batterie','storage','stockage','hydrogen','hydrogène','hydrogene','power-to-x','ptx','énergie','energie','energy','electric','électricité','electricité','grid','réseau','reseau','transmission','substation','electrical','électrique','electrique','renewable','renouvelable')
SERVICE_TERMS = ('study','étude','etude','engineering','ingénierie','ingenierie','consult','assistance technique','technical assistance','feasibility','faisabilité','faisabilite','advisory','conseil','supervision','maîtrise d’ouvrage','maitrise d ouvrage','project management','gestion de projet','audit','due diligence','commissioning','mise en service','testing','essais','procurement','appel d’offres','appel d offres','tender preparation','bid evaluation','évaluation des offres','evaluation des offres','spécification','specification','design','conception','contrôle','controle')
PRIVATE_TERMS = ('sarl','s.a.r.l','private limited','ltd','limited company','spa','sasu','sas','plc','incorporated','gmbh')
PRIVATE_BUYERS = ('masen','onee','office national','ministère','ministere','commune','région','region','agence nationale','établissement public','etablissement public','société régionale multiservices','societe regionale multiservices','tgr','université','universite','afdb','african development bank','world bank','banque mondiale','eib','afd','kfw','ebrd','isdb','giz')
CANCEL_TERMS = ('cancelled','canceled','annulé','annule','résilié','resilie','termination decision','décision de résiliation')
AWARD_TERMS = ('awarded','award notice','attribution','résultat définitif','resultat definitif','adjudication','lauréat','laureat')
AMENDMENT_TERMS = ('corrigendum','amendment','addendum','avis rectificatif','rectificatif','prolongation','extension de délai','extension de delai','deadline extension')

def clean(value):
    return re.sub(r'\s+', ' ', html.unescape(re.sub(r'<[^>]+>', ' ', value or ''))).strip()

def normalized(value):
    value = clean(value).lower().replace('’', "'")
    return re.sub(r'[^a-z0-9àâçéèêëîïôûùüÿñæœ]+', ' ', value).strip()

def authority_key(value):
    name=normalized(value)
    if 'masen' in name or 'moroccan agency for sustainable energy' in name:return 'masen'
    if 'onee' in name or 'office national de l electricite' in name:return 'onee'
    if 'anre' in name or 'autorite nationale de regulation de l electricite' in name:return 'anre'
    return name

def parse_date(raw, now=None):
    if not raw: return None
    match = DATE_RE.search(raw)
    if not match: return None
    day, month, year = map(int, match.group(1).split('/'))
    if not match.group(2):return f'{year:04d}-{month:02d}-{day:02d}'
    hour, minute = map(int, match.group(2).split(':'))
    try: return datetime(year, month, day, hour, minute, tzinfo=ZoneInfo('Africa/Casablanca')).astimezone(timezone.utc).isoformat()
    except ValueError: return None

class ListingParser(HTMLParser):
    """Extract explicit procurement rows and detail links; no generic news/article fallback."""
    def __init__(self):
        super().__init__(convert_charrefs=True); self.rows=[]; self.row=None; self.anchor=None; self.cell=None
    def handle_starttag(self, tag, attrs):
        attrs=dict(attrs)
        if tag.lower()=='tr': self.row={'text':'','links':[]}
        elif self.row is not None and tag.lower() in ('td','th'):self.cell=[]
        elif self.row is not None and tag.lower()=='a': self.anchor={'href':attrs.get('href',''),'text':''}
    def handle_data(self, data):
        if self.row is not None:
            self.row['text']+=' '+data
            if self.cell is not None:self.cell.append(data)
            if self.anchor is not None:self.anchor['text']+=' '+data
    def handle_endtag(self, tag):
        if tag.lower()=='a' and self.anchor is not None:
            self.row['links'].append(self.anchor); self.anchor=None
        elif tag.lower() in ('td','th') and self.row is not None and self.cell is not None:
            self.row.setdefault('cells',[]).append(clean(' '.join(self.cell)));self.cell=None
        elif tag.lower()=='tr' and self.row is not None:
            self.row['text']=clean(self.row['text']); self.rows.append(self.row); self.row=None

def _absolute(base, href):
    return urllib.parse.urljoin(base, html.unescape(href or ''))

def parse_listing(source, body, fetched_at=None):
    fetched_at=fetched_at or datetime.now(timezone.utc).isoformat()
    parser=ListingParser(); parser.feed(body or '')
    notices=[]
    for row in parser.rows:
        text=clean(row['text']); low=normalized(text)
        milestone='cancellation' if any(term in low for term in map(normalized,CANCEL_TERMS)) else ('award' if any(term in low for term in map(normalized,AWARD_TERMS)) else None)
        formal=any(term in low for term in ('appel d offres','consultation','request for proposal','tender notice','demande de propositions'))
        if not text or (not formal and not milestone): continue
        if any(term in low for term in ('consultation de test','test consultation','test tender','training tender')):continue
        if any(term in low for term in ('annonce de programme previsionnel','prior information notice')): continue
        detail=next((link for link in row['links'] if not link['href'].strip().lower().startswith('javascript:') and re.search(r'(EntrepriseDetails?Consultation|details?[/_-]?tender)',link['href'],re.I)),None)
        if not detail: continue
        url=_absolute(source['url'],detail['href'])
        if urllib.parse.urlsplit(url).hostname!=urllib.parse.urlsplit(source['url']).hostname:continue
        reference_text=row.get('cells',[None,None,None])[2] or text
        refmatches=[m for m in REF_RE.finditer(reference_text) if not DATE_RE.fullmatch(m.group(0))]
        ref=refmatches[0].group(0).strip(' .:-') if refmatches else ''
        cells=row.get('cells',[])
        subject_cell=next((c for c in cells if re.search(r'(?:Objet\s*:|Subject\s*:?)',c,re.I)),text)
        obj=re.search(r'(?:Objet\s*:|Subject\s*:?)\s*(.+?)(?=Acheteur public\s*:|Procuring entity\s*:|$)',subject_cell,re.I)
        title=clean(obj.group(1).split(' ... ')[0]) if obj else clean(detail.get('text') or '')
        if len(title)<16: continue
        buyer_source=next((c for c in cells if re.search(r'(?:Acheteur public|Procuring entity)\s*:',c,re.I)),text)
        buyer_match=re.search(r'(?:Acheteur public|Procuring entity)\s*:\s*(.+?)(?=Lieu d.?exécution|Place of performance|\s+\d{1,2}/\d{1,2}/\d{4}|$)',buyer_source,re.I)
        buyer=clean(buyer_match.group(1)) if buyer_match else ''
        location_match=re.search(r'(?:Lieu d.?exécution|Place of performance)\s*:?\s*(.+?)(?=Date limite|Submission deadline|$)',text,re.I)
        location=clean(location_match.group(1)) if location_match else (clean(cells[3]).lstrip('- ') if len(cells)>3 else '')
        dates=DATE_RE.findall(text)
        publication_dates=DATE_RE.findall(cells[1]) if len(cells)>1 else []
        deadline_dates=DATE_RE.findall(cells[4]) if len(cells)>4 else []
        published=parse_date(' '.join(publication_dates[0])) if publication_dates else (parse_date(' '.join(dates[0])) if dates else None)
        deadline=parse_date(' '.join(deadline_dates[-1])) if deadline_dates else (parse_date(' '.join(dates[-1])) if len(dates)>1 else None)
        deadline_time=(deadline_dates[-1][1] if deadline_dates else dates[-1][1] if len(dates)>1 else '')
        procurement_type_match=re.search(r'\b(Travaux|Services|Fournitures|Works|Services|Supplies)\b',cells[1] if len(cells)>1 else text,re.I)
        procurement_type=procurement_type_match.group(1) if procurement_type_match else ''
        # A title explicitly says the notice is an open call. Do not promote information,
        # award, cancellation or generic project/news rows into live procurement.
        notice_type=milestone or ('formal tender' if any(x in low for x in ('appel d offres','consultation','request for proposal','tender notice','demande de propositions')) else 'unclear')
        if notice_type=='unclear':continue
        amount=re.search(r'(?:estimation|budget|montant|amount|contract value)\s*[:=]?\s*([\d\s.,]+\s*(?:MAD|DH|EUR|USD|M\s*DH|MDH|EUR|USD))',text,re.I)
        notices.append({'sourceId':source['id'],'sourceName':source['name'],'sourceUrl':_absolute(source['url'],url),'officialUrl':_absolute(source['url'],url),'secondarySources':[], 'title':title,'scope':title,'authority':buyer,'reference':ref,'procurementType':procurement_type,'publishedAt':published,'deadlineAt':deadline,'deadlineTime':deadline_time,'geographicScope':location or 'Not stated in listing; verify tender dossier','contractValue':amount.group(1).strip() if amount else None,'eligibilityCriteria':'Not exposed in listing; review the official tender dossier','rawListing':text,'evidence':text[:1400],'noticeType':notice_type,'publicationStatus':normalized(text)})
    return notices

def capability_assessment(notice, taxonomy):
    text=normalized(' '.join(str(notice.get(k) or '') for k in ('title','scope','evidence','rawListing','authority')))
    public_text=normalized(notice.get('authority',''))
    private_cue=any(term in public_text for term in PRIVATE_TERMS)
    authority_public=(notice.get('sourceId') in {'pmmp','masen'} or any(term in public_text for term in PRIVATE_BUYERS)) and not private_cue
    if private_cue:
        return {'fit':'Low fit / excluded','fitScore':0,'fitReasons':[],'eligibilityReview':['Private-sector contracting entity inferred from its legal form; excluded by default.'],'risks':['Confirm contracting entity is public before reconsidering.'],'serviceCategories':[],'technologies':[]}
    matches=[]; services=[]; technologies=[]; reasons=[]
    for capability in taxonomy.get('capabilities',[]):
        tech=[term for term in capability.get('technologies',[]) if normalized(term) and normalized(term) in text]
        svc=[term for term in capability.get('services',[]) if normalized(term) and normalized(term) in text]
        if tech and svc:
            matches.append(capability['category']); technologies.extend(tech); services.extend(svc)
            reasons.append(f"Scope mentions {', '.join(svc[:3])} and {', '.join(tech[:3])}; both service and technology evidence are present.")
    explicit_public_notice=notice.get('noticeType')=='formal tender'
    if not explicit_public_notice:
        fit='Low fit / excluded'; reasons=['No formal public tender notice type was verified.']
    elif not authority_public:
        fit='Low fit / excluded'; reasons=['The contracting authority could not be verified as public from the notice text.']
    elif not matches:
        fit='Low fit / excluded'; reasons=['No paired energy-technology and advisory-service evidence matched the configured capability taxonomy.']
    elif len(matches)>=2 and len(set(services))>=2:
        fit='Strong potential fit'
    else:
        fit='Possible fit — review required'
    required=[]
    if re.search(r'\b(registre de commerce|commercial register|local registration|immatriculation|registration)\b',text): required.append('Local or commercial registration is mentioned; verify the exact entity/consortium requirement.')
    if re.search(r'\b(consortium|joint venture|groupement|co-traitance|consortium)\b',text): required.append('Consortium or joint-venture language is present; verify partner and lead-member rules.')
    if re.search(r'\b(turnover|chiffre d.?affaires|revenue|financial capacity|capacité financière|capacite financiere)\b',text): required.append('Turnover/financial-capacity criteria are mentioned; thresholds require document review.')
    if re.search(r'\b(certification|certificat|qualification|agrément|agrement|qualification)\b',text): required.append('Certification or qualification criteria are mentioned; validate exact evidence required.')
    if not required: required=['Eligibility, registrations, certifications and turnover thresholds are unknown until the official tender dossier is reviewed.']
    if not authority_public: required.append('Public status of the contracting entity is not verified from the available listing row.')
    if matches: required.append('Capability match is a text-based screening aid; confirm the scope against Fichtner’s current approved service profile and references.')
    return {'fit':fit,'fitScore':min(100,20*len(set(services))+10*len(set(technologies))) if matches else 0,'fitReasons':reasons,'eligibilityReview':required,'risks':['Verify the complete official dossier, eligibility rules, required references and bid deadline/time zone before deciding.'],'serviceCategories':matches,'technologies':list(dict.fromkeys(technologies))}

def stable_id(notice):
    reference=normalized(notice.get('reference',''))
    authority=normalized(notice.get('authority',''))
    if reference: key=f"ref|{authority_key(notice.get('authority',''))}|{reference}"
    else:
        title=normalized(notice.get('title',''))
        path=urllib.parse.urlsplit(notice.get('officialUrl') or notice.get('sourceUrl') or '').path
        key=f"url|{path}|{authority}|{title}"
    return 'rfp-'+hashlib.sha256(key.encode()).hexdigest()[:16]

def procurement_status(notice, now=None):
    now=now or datetime.now(timezone.utc); text=normalized(notice.get('rawListing') or notice.get('title') or '')
    if any(term in text for term in map(normalized,CANCEL_TERMS)):return 'cancelled'
    if any(term in text for term in map(normalized,AWARD_TERMS)):return 'awarded'
    deadline=notice.get('deadlineAt')
    if not deadline:return 'unclear'
    if re.fullmatch(r'\d{4}-\d{2}-\d{2}',deadline):
        try: return 'closed' if datetime.strptime(deadline,'%Y-%m-%d').date()<now.date() else ('closing soon' if datetime.strptime(deadline,'%Y-%m-%d').date()<=now.date()+timedelta(days=7) else 'open')
        except ValueError:return 'unclear'
    try: due=datetime.fromisoformat(deadline.replace('Z','+00:00'))
    except ValueError:return 'unclear'
    if due<=now:return 'closed'
    return 'closing soon' if due<=now+timedelta(days=7) else 'open'

def merge_history(existing, candidates, taxonomy, now=None):
    now=now or datetime.now(timezone.utc); now_iso=now.astimezone(timezone.utc).isoformat(); records={r['id']:r for r in existing if isinstance(r,dict) and r.get('id')}
    for raw in candidates:
        notice=dict(raw); notice['id']=stable_id(notice); old=records.get(notice['id'])
        if notice.get('noticeType') in ('award','cancellation'):
            if old:
                previous_status=old.get('status'); new_status='awarded' if notice['noticeType']=='award' else 'cancelled'
                old['terminalStatus']=new_status;old['status']=new_status;old['lastSeenAt']=now_iso
                if previous_status!=new_status:
                    old.setdefault('updates',[]).append({'observedAt':now_iso,'change':'status','previous':previous_status,'current':new_status,'type':notice['noticeType'],'evidence':notice.get('evidence'),'sourceUrl':notice.get('officialUrl')})
                try:old['updatedRecently']=(now-datetime.fromisoformat(old['updates'][-1]['observedAt'].replace('Z','+00:00'))).total_seconds()<30*86400
                except (IndexError,ValueError):old['updatedRecently']=False
                old.setdefault('sourceReferences',[])
                ref={'sourceId':notice.get('sourceId'),'sourceName':notice.get('sourceName'),'url':notice.get('officialUrl') or notice.get('sourceUrl')}
                if ref not in old['sourceReferences']:old['sourceReferences'].append(ref)
            continue
        assessment=capability_assessment(notice,taxonomy)
        if assessment['fit']=='Low fit / excluded': continue
        notice.update(assessment); notice['status']=old.get('terminalStatus') if old and old.get('terminalStatus') else procurement_status(notice,now)
        notice['firstDiscoveredAt']=old.get('firstDiscoveredAt',now_iso) if old else now_iso
        notice['lastSeenAt']=now_iso
        notice['updates']=list(old.get('updates',[])) if old else []
        notice['sourceReferences']=list(old.get('sourceReferences',[])) if old else []
        source_ref={'sourceId':notice.get('sourceId'),'sourceName':notice.get('sourceName'),'url':notice.get('officialUrl') or notice.get('sourceUrl')}
        if source_ref not in notice['sourceReferences']:notice['sourceReferences'].append(source_ref)
        if old:
            changed=[]
            for field in ('deadlineAt','title','evidence'):
                before=old.get(field); after=notice.get(field)
                if before and after and before!=after:changed.append(field)
            if changed:
                notice['updates'].extend({'observedAt':now_iso,'change':field,'previous':old.get(field),'current':notice.get(field),'type':'amendment' if 'corrigendum' in normalized(notice.get('rawListing','')) or 'rectificatif' in normalized(notice.get('rawListing','')) else 'notice update'} for field in changed)
            for ref in old.get('sourceReferences',[]):
                if ref not in notice['sourceReferences']:notice['sourceReferences'].append(ref)
            # Preserve the original publication/discovery identity and earlier evidence.
            notice['publishedAt']=old.get('publishedAt') or notice.get('publishedAt')
            if not notice.get('evidence'):notice['evidence']=old.get('evidence','')
        notice['newToAtlas']=not old and (now-datetime.fromisoformat(notice['firstDiscoveredAt'].replace('Z','+00:00'))).total_seconds()<7*86400
        notice['updatedRecently']=bool(notice['updates'] and (now-datetime.fromisoformat(notice['updates'][-1]['observedAt'].replace('Z','+00:00'))).total_seconds()<30*86400)
        records[notice['id']]=notice
    for notice in records.values():
        notice['status']=notice.get('terminalStatus') or procurement_status(notice,now)
        try: notice['newToAtlas']=(now-datetime.fromisoformat(notice['firstDiscoveredAt'].replace('Z','+00:00'))).total_seconds()<7*86400
        except (KeyError,ValueError):notice['newToAtlas']=False
    return sorted(records.values(),key=lambda n:(n.get('status') in ('open','closing soon'),n.get('firstDiscoveredAt','')),reverse=True)

def fetch_source(source, previous=None, timeout=TIMEOUT):
    headers={'User-Agent':USER_AGENT,'Accept':'text/html,application/xhtml+xml'}
    if previous and previous.get('etag'):headers['If-None-Match']=previous['etag']
    if previous and previous.get('lastModified'):headers['If-Modified-Since']=previous['lastModified']
    req=urllib.request.Request(source['url'],headers=headers)
    try:
        with urllib.request.urlopen(req,timeout=timeout) as response:
            raw=response.read()
            try:body=raw.decode(response.headers.get_content_charset() or 'utf-8')
            except UnicodeDecodeError:body=raw.decode('cp1252','replace')
            return body,response.geturl(),response.headers
    except urllib.error.HTTPError as exc:
        if exc.code==304:return None,source['url'],exc.headers
        raise

def atomic_json(path, value):
    path.parent.mkdir(parents=True,exist_ok=True); temp=path.with_suffix(path.suffix+'.tmp')
    temp.write_text(json.dumps(value,ensure_ascii=False,indent=2)+'\n',encoding='utf-8'); temp.replace(path)

def main():
    taxonomy=json.loads(CAPABILITIES_FILE.read_text(encoding='utf-8')); history=json.loads(HISTORY_FILE.read_text(encoding='utf-8')) if HISTORY_FILE.exists() else []
    old_status=json.loads(STATUS_FILE.read_text(encoding='utf-8')) if STATUS_FILE.exists() else {}; previous={x.get('id'):x for x in old_status.get('sources',[]) if isinstance(x,dict)}
    fetched_at=datetime.now(timezone.utc).isoformat(); candidates=[]; statuses=[]
    for source in SOURCES:
        record={'id':source['id'],'name':source['name'],'url':source['url'],'checkedAt':fetched_at,'ok':False,'noticesParsed':0,'message':''}
        try:
            body,final_url,response_headers=fetch_source(source,previous.get(source['id']))
            if body is None:
                prior=previous.get(source['id'],{});record.update(ok=True,noticesParsed=prior.get('noticesParsed',0),etag=prior.get('etag'),lastModified=prior.get('lastModified'),message='HTTP 304; official source listing unchanged, persistent notice history reused.')
            else:
                resolved={**source,'url':final_url}; rows=parse_listing(resolved,body,fetched_at)
                candidates.extend(rows); record.update(ok=True,noticesParsed=len(rows),etag=response_headers.get('ETag'),lastModified=response_headers.get('Last-Modified'),message='Public listing fetched; only explicit notice rows with a detail link are considered.')
        except Exception as exc:record['message']=f'Fetch or parse failed: {type(exc).__name__}: {exc}'
        statuses.append(record)
    merged=merge_history(history,candidates,taxonomy)
    # Expose only active, recently discovered or recently amended opportunities; retain the full history privately in the state file.
    now=datetime.now(timezone.utc); visible=[]
    for item in merged:
        try: recent=(now-datetime.fromisoformat(item.get('firstDiscoveredAt','').replace('Z','+00:00'))).days<30
        except ValueError: recent=False
        if item.get('status') in ('open','closing soon','unclear') or recent or item.get('updatedRecently'):visible.append(item)
    atomic_json(HISTORY_FILE,merged)
    atomic_json(OPPORTUNITIES_FILE,{'generatedAt':fetched_at,'definition':{'newToAtlasDays':7,'visibleDiscoveryDays':30,'text':'New to Atlas means first discovered in the last 7 days. Publication date is separate. Visible opportunities are active/unclear or discovered/updated in the last 30 days.'},'opportunities':visible})
    atomic_json(STATUS_FILE,{'generatedAt':fetched_at,'coverage':'partial','sources':statuses,'message':'Only listed official sources are monitored; this is not exhaustive coverage of Moroccan public procurement.'})
    print(f"RFP radar: fetched {sum(x['ok'] for x in statuses)}/{len(statuses)} sources; parsed {len(candidates)} notices; retained {len(visible)} visible opportunities.")

if __name__=='__main__':main()

