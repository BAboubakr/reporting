"""Atlas Smart Signal Filter v1: hybrid semantic scoring + optional Gemini review."""
import json, os, re, urllib.request

GENERIC_PATTERNS = [r"\b(?:market|tender|information|movement)\s+signal\s+relevant\s+to\b", r"\brenewable[- ]energy\s+activity\b", r"\be-?tendering@\S+"]
EVENT_WORDS = ["awarded","won","selected","appointed","tender","procurement","contract","project","plant","farm","construction","commissioned","investment","financing","funding","agreement","partnership","regulation","law","tariff","announces","launches","develop","pre-feed","feasibility","appel d'offres","lauréat","retenu","attribué","mise en service"]
ENTITY_HINTS = ["masen","onee","anre","ocp","iresen","amee","novec","afry","artelia","tractebel","wsp","worley","egis","fichtner","mott macdonald","dnv","ilf"]
TECH_HINTS = ["solar","photovoltaic","pv","bess","battery","storage","wind","eolien","grid","transmission","substation","hydrogen","ammonia","ptx","electrolysis","factory","module","cell"]
LOCATION_HINTS = ["morocco","maroc","rabat","casablanca","fez","fès","tanger","laâyoune","laayoune","ouarzazate","dakhla","khouribga","benguerir"]

def norm(s): return re.sub(r"\s+", " ", re.sub(r"[^\wÀ-ÿ@.-]", " ", str(s or "").lower())).strip()

def heuristic(item):
    title=str(item.get("title") or item.get("headline") or ""); desc=str(item.get("summary") or item.get("evidenceSnippet") or ""); source=str(item.get("source") or ""); text=norm(f"{title} {desc}"); score=0; reasons=[]
    if len(title)>=35: score+=10
    elif len(title)<18: score-=20
    if len(desc)>=80: score+=12
    if item.get("url"): score+=8
    if item.get("published") or item.get("detected"): score+=5
    eh=sum(w in text for w in EVENT_WORDS); ah=sum(w in text for w in ENTITY_HINTS); th=sum(w in text for w in TECH_HINTS); lh=sum(w in text for w in LOCATION_HINTS)
    score+=min(30,eh*5)+min(18,ah*6)+min(15,th*5)+min(10,lh*5)
    if re.search(r"\b\d+(?:[.,]\d+)?\s*(?:mw|mwh|gw|mdh|mmdh|million|billion|%)\b",text,re.I): score+=10; reasons.append("quantitative detail")
    if re.search(r"\b(?:202\d|20[3-9]\d)\b",text): score+=4
    if any(re.search(p,text,re.I) for p in GENERIC_PATTERNS): score-=35; reasons.append("generic/generated boilerplate")
    if "@" in source and len(desc)<60: score-=15; reasons.append("mailbox/portal-style source without evidence")
    score=max(0,min(100,score)); reasons += ([f"{eh} concrete event indicator(s)"] if eh else []) + ([f"{ah} identifiable actor(s)"] if ah else []) + ([f"{th} technology indicator(s)"] if th else []) + ([f"{lh} Morocco/location indicator(s)"] if lh else [])
    decision="KEEP" if score>=62 else ("REVIEW" if score>=42 else "REJECT")
    return {"decision":decision,"confidence":round(min(.98,.45+abs(score-50)/100),2),"qualityScore":score,"reason":"; ".join(reasons) or "insufficient substantive evidence"}

def gemini_review(items):
    key=os.getenv("GEMINI_API_KEY")
    if not key or not items: return {}
    model=os.getenv("ATLAS_AI_MODEL","gemini-2.5-flash")
    prompt={"task":"Classify Morocco renewable-energy intelligence candidates. Reject portal navigation, document headings without a development, generated boilerplate, generic labels and mailbox-like captures. Keep concrete projects, tenders, awards, investments, policy/regulation, grid, PV, BESS, wind, hydrogen/PtX, manufacturing and competitor developments. Use REVIEW when plausible but evidence is insufficient. Return ONLY a JSON array.","schema":{"decision":"KEEP|REVIEW|REJECT","confidence":"0..1","reason":"short explanation","fichtnerRelevance":"HIGH|MEDIUM|WATCH"},"items":[{"id":x["id"],"title":x.get("title",""),"summary":x.get("summary",""),"source":x.get("source","")} for x in items]}
    url=f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={key}"; body=json.dumps({"contents":[{"parts":[{"text":json.dumps(prompt,ensure_ascii=False)}]}],"generationConfig":{"temperature":0,"responseMimeType":"application/json"}}).encode()
    try:
        req=urllib.request.Request(url,data=body,headers={"Content-Type":"application/json"},method="POST")
        with urllib.request.urlopen(req,timeout=30) as r: data=json.loads(r.read().decode())
        parsed=json.loads(data["candidates"][0]["content"]["parts"][0]["text"]); return {str(x["id"]):x for x in parsed if x.get("id")}
    except Exception as exc: print("AI review unavailable; heuristic classification retained:",exc); return {}

def classify(items):
    prelim=[]
    for item in items:
        r=heuristic(item); prelim.append({**item,"qualityScore":r["qualityScore"],"filterDecision":r["decision"],"filterConfidence":r["confidence"],"filterReason":r["reason"]})
    ai=gemini_review([x for x in prelim if x["filterDecision"]!="REJECT"])
    for item in prelim:
        r=ai.get(str(item.get("id")))
        item["aiReviewed"]=bool(r)
        if r:
            item["filterDecision"]=r.get("decision",item["filterDecision"]); item["filterConfidence"]=float(r.get("confidence",item["filterConfidence"])); item["filterReason"]="AI: "+str(r.get("reason",item["filterReason"]))
            if r.get("fichtnerRelevance") in {"HIGH","MEDIUM","WATCH"}: item["fichtnerRelevance"]=r["fichtnerRelevance"]
    return prelim
