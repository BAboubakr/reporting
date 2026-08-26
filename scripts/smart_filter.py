"""Atlas Smart Signal Filter v2: evidence-first semantic classifier with optional AI review."""
import json, os, re, urllib.request

GENERIC_PATTERNS = [r"\b(?:market|tender|information|movement)\s+signal\s+relevant\s+to\b", r"\brenewable[- ]energy\s+activity\b", r"\be-?tendering@\S+", r"\b(?:outils informatiques|guides? d.?utilisation|consultations? en cours|spécifications techniques|tester la configuration)\b"]
EVENT_WORDS = ["awarded","won","selected","appointed","tender","procurement","contract","project","plant","farm","construction","commissioned","investment","financing","funding","agreement","partnership","regulation","law","tariff","announces","launches","develop","pre-feed","feasibility","appel d'offres","lauréat","retenu","attribué","mise en service"]
ACTOR_WORDS = ["masen","onee","anre","ocp","iresen","amee","novec","afry","artelia","tractebel","wsp","worley","egis","fichtner","mott macdonald","dnv","ilf","kbr","ornx","green power morocco","chec"]
TECH_WORDS = ["solar","photovoltaic","pv","bess","battery","storage","wind","eolien","grid","transmission","substation","hydrogen","ammonia","ptx","electrolysis","factory","module","cell"]
LOCATION_WORDS = ["morocco","maroc","rabat","casablanca","fez","fès","tanger","laâyoune","laayoune","ouarzazate","dakhla","khouribga","benguerir","laâyoune"]
ACTION_PAIRS = [("selected", "for"), ("awarded", "contract"), ("wins", "contract"), ("appointed", "for"), ("launches", "tender"), ("signed", "agreement"), ("announces", "project"), ("develop", "project")]

def norm(s): return re.sub(r"\s+", " ", re.sub(r"[^\wÀ-ÿ@.-]", " ", str(s or "").lower())).strip()

def heuristic(item):
    title=str(item.get("title") or item.get("headline") or ""); desc=str(item.get("summary") or item.get("evidenceSnippet") or ""); source=str(item.get("source") or ""); text=norm(f"{title} {desc}"); score=0; reasons=[]
    if not title or len(title)<18: return {"decision":"REJECT","confidence":0.97,"qualityScore":5,"reason":"missing or non-substantive title"}
    if any(re.search(p,text,re.I) for p in GENERIC_PATTERNS): return {"decision":"REJECT","confidence":0.98,"qualityScore":5,"reason":"portal navigation or generated boilerplate"}
    if len(title)>=35: score+=12
    if len(desc)>=80: score+=12
    if item.get("url"): score+=8
    if item.get("published") or item.get("detected"): score+=5
    events=[w for w in EVENT_WORDS if w in text]; actors=[w for w in ACTOR_WORDS if w in text]; tech=[w for w in TECH_WORDS if w in text]; loc=[w for w in LOCATION_WORDS if w in text]
    score+=min(30,len(events)*5)+min(20,len(actors)*7)+min(15,len(tech)*5)+min(10,len(loc)*5)
    if events: reasons.append(f"{len(events)} event indicator(s)")
    if actors: reasons.append(f"{len(actors)} identifiable actor(s)")
    if tech: reasons.append(f"{len(tech)} technology indicator(s)")
    if loc: reasons.append(f"{len(loc)} Morocco/location indicator(s)")
    if re.search(r"\b\d+(?:[.,]\d+)?\s*(?:mw|mwh|gw|mdh|mmdh|million|billion|%)\b",text,re.I): score+=10; reasons.append("quantitative detail")
    if re.search(r"\b(?:202\d|20[3-9]\d)\b",text): score+=4
    # Strong combinations: a real actor + event + technology/project context is a high-quality development.
    if actors and events and (tech or "project" in text or "contract" in text): score+=15; reasons.append("strong actor/event/development combination")
    if any(a in text and b in text for a,b in ACTION_PAIRS): score+=10; reasons.append("concrete action relationship")
    if "@" in source and len(desc)<80: score-=25; reasons.append("mailbox/portal source without substantive evidence")
    score=max(0,min(100,score))
    decision="KEEP" if score>=62 else ("REVIEW" if score>=42 else "REJECT")
    return {"decision":decision,"confidence":round(min(.99,.50+abs(score-50)/100),2),"qualityScore":score,"reason":"; ".join(reasons) or "insufficient substantive evidence"}

def gemini_review(items):
    key=os.getenv("GEMINI_API_KEY")
    if not key or not items: return {}
    model=os.getenv("ATLAS_AI_MODEL","gemini-2.5-flash")
    prompt={"task":"Classify Morocco renewable-energy intelligence candidates. A KEEP must describe a concrete, evidenced development such as a project, tender, award, investment, policy/regulation, grid development, technology deployment or competitor move. Reject portal navigation, document headings without a development, generated boilerplate, generic labels and mailbox-like captures. Use REVIEW when plausible but evidence is insufficient. Do not reject a real development merely because the title is imperfect. Return ONLY JSON array.","schema":{"decision":"KEEP|REVIEW|REJECT","confidence":"0..1","reason":"short explanation","fichtnerRelevance":"HIGH|MEDIUM|WATCH"},"items":[{"id":x["id"],"title":x.get("title",""),"summary":x.get("summary",""),"source":x.get("source","")} for x in items]}
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
        r=ai.get(str(item.get("id"))); item["aiReviewed"]=bool(r)
        if r:
            item["filterDecision"]=r.get("decision",item["filterDecision"]); item["filterConfidence"]=float(r.get("confidence",item["filterConfidence"])); item["filterReason"]="AI: "+str(r.get("reason",item["filterReason"]))
            if r.get("fichtnerRelevance") in {"HIGH","MEDIUM","WATCH"}: item["fichtnerRelevance"]=r["fichtnerRelevance"]
    return prelim
