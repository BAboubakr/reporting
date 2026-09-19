"""
Atlas LinkedIn early-warning collector.

LinkedIn is treated as a first-class *discovery* source, not as authoritative
evidence. We collect publicly indexed LinkedIn posts through Google News RSS
(site:linkedin.com/posts / site:linkedin.com/company searches), normalize them
into Atlas signals, and let the normal enrichment/research pipeline verify
important claims against primary sources.
"""
import hashlib, html, json, re, urllib.parse, urllib.request, xml.etree.ElementTree as ET
from datetime import datetime, timedelta, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "data"
LOOKBACK_DAYS = 30
TIMEOUT = 20
MAX_ITEMS = 80

# Tier 1 = institutional/project-originating accounts.
# Tier 2 = developers, industrials, investors and market participants.
# Tier 3 = Fichtner/competitors/engineering firms and DFIs.
LINKEDIN_ACCOUNTS = [
    {"name":"MASEN","url":"https://www.linkedin.com/company/masen/","tier":1,"queries":["MASEN Morocco renewable energy","MASEN solar Morocco","MASEN wind Morocco","MASEN hydrogen Morocco"]},
    {"name":"ONEE - Branche Electricité","url":"https://www.linkedin.com/company/onee-be/","tier":1,"queries":["ONEE Branche Electricité Morocco","ONEE renewable grid Morocco","ONEE transmission Morocco"]},
    {"name":"ONEE","url":"https://www.linkedin.com/company/office-national-de-l%E2%80%99electricit%C3%A9-et-de-l%E2%80%99eau-potable-onee/","tier":1,"queries":["ONEE Morocco electricity water energy"]},
    {"name":"Ministry of Energy Transition and Sustainable Development","url":"https://www.linkedin.com/company/ministry-of-energy-transition-and-sustainable-development-kingdom-of-morocco/","tier":1,"queries":["Morocco Ministry Energy Transition renewable","Leila Benali energy Morocco","Morocco energy transition hydrogen"]},
    {"name":"ANRE - Autorité Nationale de Régulation de l’Électricité","url":"https://ma.linkedin.com/company/anre-maroc/","tier":1,"queries":["ANRE Maroc electricity regulation","ANRE Morocco grid tariff","ANRE Morocco renewable energy"]},
    {"name":"IRESEN","url":"https://www.linkedin.com/company/iresen/","tier":1,"queries":["IRESEN Morocco solar energy","IRESEN green hydrogen Morocco","IRESEN innovation Morocco energy"]},
    {"name":"Green Energy Park","url":"https://www.linkedin.com/company/green-energy-park/","tier":1,"queries":["Green Energy Park Morocco solar","Green Energy Park hydrogen Morocco","Green Energy Park battery Morocco"]},
    {"name":"AMEE","url":"https://www.linkedin.com/company/ameeofficiel/","tier":1,"queries":["AMEE Morocco energy efficiency","AMEE Morocco decarbonization","AMEE renewable energy Morocco"]},

    {"name":"OCP Group","url":"https://www.linkedin.com/company/ocpgroup/","tier":2,"queries":["OCP Morocco renewable energy","OCP green hydrogen Morocco","OCP solar Morocco"]},
    {"name":"Nareva","url":"https://www.linkedin.com/company/nareva/","tier":2,"queries":["Nareva Morocco wind solar","Nareva renewable Morocco","Nareva hydrogen Morocco"]},
    {"name":"ACWA Power","url":"https://www.linkedin.com/company/acwa-power/","tier":2,"queries":["ACWA Power Morocco solar","ACWA Power Morocco green hydrogen","ACWA Power Morocco desalination energy"]},
    {"name":"ENGIE","url":"https://www.linkedin.com/company/engie/","tier":2,"queries":["ENGIE Morocco renewable energy","ENGIE Morocco hydrogen","ENGIE Morocco solar"]},
    {"name":"TAQA Morocco","url":"https://www.linkedin.com/company/taqa-morocco/","tier":2,"queries":["TAQA Morocco renewable energy","TAQA Morocco wind solar","TAQA Morocco energy transition"]},
    {"name":"Green of Africa","url":"https://www.linkedin.com/company/green-of-africa/","tier":2,"queries":["Green of Africa Morocco solar","Green of Africa renewable Morocco"]},
    {"name":"TotalEnergies","url":"https://www.linkedin.com/company/totalenergies/","tier":2,"queries":["TotalEnergies Morocco renewable","TotalEnergies Morocco solar","TotalEnergies Morocco hydrogen"]},

    {"name":"Fichtner","url":"https://www.linkedin.com/company/fichtner/","tier":3,"queries":["Fichtner Morocco energy","Fichtner Morocco renewable","Fichtner Morocco solar","Fichtner Morocco hydrogen"]},
    {"name":"RINA","url":"https://www.linkedin.com/company/rina/","tier":3,"queries":["RINA Morocco energy","RINA Morocco renewable","RINA Morocco hydrogen","RINA Morocco infrastructure"]},
    {"name":"AFRY","url":"https://www.linkedin.com/company/afry/","tier":3,"queries":["AFRY Morocco energy","AFRY Morocco renewable","AFRY Morocco hydrogen"]},
    {"name":"Artelia Maroc","url":"https://www.linkedin.com/company/artelia-maroc/","tier":3,"queries":["Artelia Maroc energy","Artelia Maroc renewable","Artelia Maroc infrastructure"]},
    {"name":"TRACTEBEL","url":"https://www.linkedin.com/company/tractebel-engie-group/","tier":3,"queries":["Tractebel Morocco energy","Tractebel Morocco renewable","Tractebel Morocco grid"]},
    {"name":"NOVEC","url":"https://www.linkedin.com/company/novec-sa/","tier":3,"queries":["NOVEC Morocco energy","NOVEC Morocco renewable","NOVEC Morocco hydropower"]},
    {"name":"DNV","url":"https://www.linkedin.com/company/dnv/","tier":3,"queries":["DNV Morocco renewable energy","DNV Morocco hydrogen","DNV Morocco grid"]},
    {"name":"WSP","url":"https://www.linkedin.com/company/wsp/","tier":3,"queries":["WSP Morocco energy","WSP Morocco renewable","WSP Morocco infrastructure"]},
    {"name":"Worley","url":"https://www.linkedin.com/company/worley/","tier":3,"queries":["Worley Morocco hydrogen","Worley Morocco energy","Worley Morocco infrastructure"]},
    {"name":"Egis","url":"https://www.linkedin.com/company/egis/","tier":3,"queries":["Egis Morocco energy","Egis Morocco renewable","Egis Morocco infrastructure"]},
    {"name":"Mott MacDonald","url":"https://www.linkedin.com/company/mott-macdonald/","tier":3,"queries":["Mott MacDonald Morocco energy","Mott MacDonald Morocco renewable","Mott MacDonald Morocco infrastructure"]},
    {"name":"ILF Consulting Engineers","url":"https://www.linkedin.com/company/ilf-consulting-engineers/","tier":3,"queries":["ILF Morocco energy","ILF Morocco hydrogen","ILF Morocco renewable"]},
    {"name":"JESA","url":"https://www.linkedin.com/company/jesa-sa/","tier":3,"queries":["JESA Morocco energy","JESA Morocco hydrogen","JESA Morocco infrastructure"]},

    {"name":"African Development Bank","url":"https://www.linkedin.com/company/african-development-bank/","tier":3,"queries":["African Development Bank Morocco energy","AfDB Morocco renewable","AfDB Morocco energy project"]},
    {"name":"European Investment Bank","url":"https://www.linkedin.com/company/european-investment-bank/","tier":3,"queries":["EIB Morocco energy","EIB Morocco renewable","EIB Morocco hydrogen"]},
    {"name":"KfW Development Bank","url":"https://www.linkedin.com/company/kfw/","tier":3,"queries":["KfW Morocco renewable energy","KfW Morocco hydrogen","KfW Morocco grid"]},
    {"name":"Agence Française de Développement","url":"https://www.linkedin.com/company/afd/","tier":3,"queries":["AFD Morocco energy","AFD Morocco renewable","AFD Morocco green hydrogen"]},
    {"name":"World Bank","url":"https://www.linkedin.com/company/the-world-bank/","tier":3,"queries":["World Bank Morocco energy","World Bank Morocco renewable","World Bank Morocco electricity"]},
    {"name":"Islamic Development Bank","url":"https://www.linkedin.com/company/islamic-development-bank/","tier":3,"queries":["IsDB Morocco energy","Islamic Development Bank Morocco renewable","IsDB Morocco hydrogen"]},
    {"name":"EBRD","url":"https://www.linkedin.com/company/ebrd/","tier":3,"queries":["EBRD Morocco energy","EBRD Morocco renewable","EBRD Morocco infrastructure"]},
    {"name":"GIZ","url":"https://www.linkedin.com/company/giz/","tier":3,"queries":["GIZ Morocco energy transition","GIZ Morocco renewable","GIZ Morocco hydrogen"]},
]

TRIGGER_WORDS = {
    "tender":["tender","procurement","appel d’offres","appel d'offres","rfp","consultation","prequalification"],
    "award":["awarded","award","won","selected","appointed","contract","attributed","lauréat","retenu","attribué"],
    "project":["project","plant","farm","facility","development","construction","commissioned","inaugurated","groundbreaking"],
    "investment":["investment","financing","funding","loan","million","billion","mmdh","investment decision"],
    "market entry":["morocco office","morocco subsidiary","morocco sarl","opens office","new office","market entry","expands presence","local entity"],
    "partnership":["partnership","agreement","memorandum","mou","consortium","collaboration","cooperation"],
    "hydrogen":["hydrogen","green hydrogen","ammonia","electrolysis","power-to-x","ptx"],
    "grid":["grid","transmission","substation","interconnection","225 kv","electricity network"],
    "solar":["solar","photovoltaic","pv","masen","noor"],
    "wind":["wind","eolien","éolien","offshore wind","repowering"],
    "storage":["bess","battery","storage","pumped hydro","pumped storage"],
}

def fetch(url):
    req=urllib.request.Request(url,headers={"User-Agent":"Atlas-Morocco-Intelligence/3.0"})
    with urllib.request.urlopen(req,timeout=TIMEOUT) as r:return r.read()

def clean(text):
    return re.sub(r"\s+"," ",html.unescape(re.sub(r"<[^>]+>"," ",text or ""))).strip()

def norm(text):
    return re.sub(r"\s+"," ",re.sub(r"[^a-z0-9àâçéèêëîïôûùüÿñæœ\s-]"," ",(text or "").lower())).strip()

def rss(query):
    url="https://news.google.com/rss/search?"+urllib.parse.urlencode({"q":f"site:linkedin.com/posts {query} when:{LOOKBACK_DAYS}d","hl":"en-US","gl":"US","ceid":"US:en"})
    try:root=ET.fromstring(fetch(url))
    except Exception as exc:
        print("LinkedIn RSS error",query,exc);return []
    out=[]
    for item in root.findall("./channel/item"):
        title=clean(item.findtext("title"));link=item.findtext("link") or "";desc=clean(item.findtext("description"));pub=item.findtext("pubDate") or ""
        source=clean(item.find("source").text if item.find("source") is not None else "") or "LinkedIn"
        if title and link and ("linkedin.com" in link.lower() or "linkedin" in source.lower()):
            out.append((title,link,desc,pub,source))
    return out

def iso_date(raw):
    if not raw:return datetime.now(timezone.utc).isoformat()
    try:
        from email.utils import parsedate_to_datetime
        return parsedate_to_datetime(raw).astimezone(timezone.utc).isoformat()
    except Exception:return raw

def signal_type(text):
    t=norm(text)
    for label,words in TRIGGER_WORDS.items():
        if any(w in t for w in words):return label
    return "market intelligence"

def score(text,account):
    t=norm(text);s=45
    if account["tier"]==1:s+=12
    elif account["tier"]==2:s+=7
    else:s+=5
    weights={"tender":24,"award":20,"project":12,"investment":14,"market entry":25,"partnership":10,"hydrogen":8,"grid":8,"solar":7,"wind":7,"storage":8}
    st=signal_type(text);s+=weights.get(st,0)
    if any(x in t for x in ["morocco","maroc","masen","onee","anre","iresen","amee","fichtner","rina"]):s+=12
    return min(98,s)

def make_signal(row,account,now):
    title,link,desc,pub,source=row
    text=f"{title} {desc}"
    st=signal_type(text)
    sc=score(text,account)
    return {
        "id":"sig-li-"+hashlib.sha1((norm(title)+"|"+link.split("?")[0]).encode()).hexdigest()[:14],
        "title":title,
        "headline":title,
        "summary":desc[:500],
        "url":link,
        "source":"LinkedIn",
        "sourceType":"linkedin",
        "sourceAccount":account["name"],
        "sourceAccountUrl":account["url"],
        "published":iso_date(pub),
        "detected":now,
        "categories":["LinkedIn"]+([x.title() for x in TRIGGER_WORDS if x in norm(text)] or ["Market intelligence"]),
        "signalType":st,
        "projectStage":"tender" if st=="tender" else ("contract award" if st=="award" else "monitoring"),
        "entities":[account["name"],"Morocco"],
        "competitor":account["name"] if account["name"] in {"Fichtner","RINA","AFRY","Artelia Maroc","TRACTEBEL","NOVEC","DNV","WSP","Worley","Egis","Mott MacDonald","ILF Consulting Engineers","JESA"} else None,
        "relevanceScore":sc,
        "actionabilityScore":min(98,sc+5),
        "noveltyScore":1,
        "status":"new",
        "evidenceLevel":"LinkedIn discovery",
        "evidenceSnippet":desc[:280] or title,
        "whyItMatters":f"LinkedIn early-warning signal from {account['name']}; verify material claims against primary or independent sources.",
        "fichtnerRelevance":"HIGH" if sc>=80 else ("MEDIUM" if sc>=60 else "WATCH"),
        "qualityScore":sc,
        "filterDecision":"KEEP",
        "filterConfidence":0.92,
        "filterReason":"First-class LinkedIn discovery source",
        "aiReviewed":False,
        "researchPriority":max(65,sc),
        "researchLevel":"L2" if sc>=75 else "L1",
        "researchLevelName":"Investigate" if sc>=75 else "Verify",
        "researchPriorityReasons":["LinkedIn source",account["name"],st,"Morocco context"],
        "researchTriggers":{"fichtner":account["name"]=="Fichtner","moroccoContext":True,"competitor":bool(make_competitor(account)),"competitorMove":st=="market entry","marketEntry":st=="market entry","tender":st=="tender","award":st=="award","dfi":account["name"] in {"African Development Bank","European Investment Bank","KfW Development Bank","Agence Française de Développement","World Bank","Islamic Development Bank","EBRD","GIZ"},"dfiDecision":False,"majorProject":st in {"project","tender","award"},"consultingPotential":True},
        "researchBudget":{"maxQueries":7 if sc>=75 else 3,"maxSources":9 if sc>=75 else 5},
        "researchEligibility":{"eligible":True,"willResearch":True,"reason":"LinkedIn first-class discovery","engineVersion":"linkedin-1.0"}
    }

def make_competitor(account):
    return account["name"] if account["name"] in {"Fichtner","RINA","AFRY","Artelia Maroc","TRACTEBEL","NOVEC","DNV","WSP","Worley","Egis","Mott MacDonald","ILF Consulting Engineers","JESA"} else None

def main():
    now=datetime.now(timezone.utc).isoformat()
    rows=[];seen=set();cutoff=datetime.now(timezone.utc)-timedelta(days=LOOKBACK_DAYS)
    for account in LINKEDIN_ACCOUNTS:
        for query in account["queries"]:
            for row in rss(query):
                key=hashlib.sha1((norm(row[0])+"|"+row[1].split("?")[0]).encode()).hexdigest()
                if key in seen:continue
                seen.add(key)
                try:
                    d=datetime.fromisoformat(iso_date(row[3]).replace("Z","+00:00"))
                    if d<cutoff:continue
                except Exception:pass
                rows.append((row,account))
    rows.sort(key=lambda x:score(f"{x[0][0]} {x[0][2]}",x[1]),reverse=True)
    signals=[];titles=[]
    for row,account in rows:
        title=row[0];words=set(norm(title).split())
        if any(len(words&set(norm(old).split()))/max(1,len(words|set(norm(old).split())))>=0.75 for old in titles):continue
        signals.append(make_signal(row,account,now));titles.append(title)
        if len(signals)>=MAX_ITEMS:break
    DATA.mkdir(exist_ok=True)
    (DATA/"linkedin-signals.js").write_text("export const linkedinSignals = "+json.dumps(signals,ensure_ascii=False,indent=2)+";\n",encoding="utf-8")
    (DATA/"linkedin-monitoring.js").write_text("export const linkedinAccounts = "+json.dumps(LINKEDIN_ACCOUNTS,ensure_ascii=False,indent=2)+";\n",encoding="utf-8")
    print(f"LinkedIn monitoring: accounts={len(LINKEDIN_ACCOUNTS)} raw={len(rows)} retained={len(signals)}")
    if not signals: print("LinkedIn returned no indexed posts; account coverage remains configured and the next run will retry.")

if __name__=="__main__":main()
