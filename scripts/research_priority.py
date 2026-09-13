"""Adaptive research-depth engine for Atlas signals."""
import re

LEVELS={0:{"name":"Monitor","code":"L0","max_queries":0,"max_sources":0},1:{"name":"Verify","code":"L1","max_queries":3,"max_sources":5},2:{"name":"Investigate","code":"L2","max_queries":7,"max_sources":9},3:{"name":"Strategic","code":"L3","max_queries":11,"max_sources":14},4:{"name":"Priority","code":"L4","max_queries":16,"max_sources":18}}
COMPETITORS=["AFRY","Artelia","Tractebel","Mott MacDonald","WSP","Worley","Egis","ILF Consulting Engineers","DNV","NOVEC","INGEMA","JESA"]
DFIS=["AfDB","African Development Bank","KfW","AFD","EIB","World Bank","IsDB","EBRD","GIZ","EU Global Gateway"]
STRATEGIC_ACTORS=["MASEN","ONEE","ANRE","OCP","AMEE","Ministry of Energy Transition"]

def norm(v): return re.sub(r"\s+"," ",re.sub(r"[^a-z0-9àâçéèêëîïôûùüÿñæœ\s-]"," ",str(v or "").lower())).strip()

def research_priority(signal):
    text=norm(" ".join([signal.get("title", ""),signal.get("summary", "")," ".join(signal.get("categories") or [])," ".join(signal.get("entities") or []),str(signal.get("competitor") or "")]))
    score=float(signal.get("actionabilityScore") or 0); reasons=[]; hard=0
    hit=lambda words:any(w in text for w in words)
    fichtner="fichtner" in text
    competitor=bool(signal.get("competitor")) or any(norm(c) in text for c in COMPETITORS)
    dfi=any(norm(x) in text for x in DFIS)
    tender=hit(["tender","procurement","appel d offres","prequalification","rfp","consultation"])
    award=hit(["contract awarded","awarded","won the contract","selected contractor","contractor selected","appointed","adjudicated","laureat","retenu","attribue"])
    project=hit(["project","plant","farm","facility","development","construction"])
    financing=hit(["financing","funding","loan","investment","financial close","grant"])
    dfi_decision=dfi and hit(["approved","approval","signed","financing","loan","grant","decision","project","procurement"])
    major_project=bool(re.search(r"\b(?:[2-9]\d{2}|[1-9]\d{3,})\s*(?:mw|mwh|gw|gwh)\b",text)) or hit(["major infrastructure","strategic project","national project"])
    competitor_move=competitor and hit(["contract","project","tender","appointed","selected","award","partnership","expands","wins"])
    consulting=hit(["consultant","consulting","technical assistance","owner engineer","owners engineer","advisory","feasibility","detailed studies","engineering"])
    if fichtner:
        score+=35; hard=max(hard,3); reasons.append("Fichtner mentioned")
    if fichtner and (competitor or project or tender or award):
        hard=max(hard,4); reasons.append("Fichtner + strategic development relationship")
    if competitor:
        score+=25; hard=max(hard,3 if competitor_move else 2); reasons.append("competitor detected")
    if competitor_move: score+=15; reasons.append("competitor move")
    if tender: score+=20; hard=max(hard,2); reasons.append("tender/procurement")
    if award: score+=25; hard=max(hard,3); reasons.append("award/contract decision")
    if dfi_decision: score+=25; hard=max(hard,3); reasons.append("DFI decision/financing")
    elif dfi: score+=12; hard=max(hard,2); reasons.append("DFI involvement")
    if major_project: score+=20; hard=max(hard,2); reasons.append("major project scale/strategic infrastructure")
    if consulting: score+=12; reasons.append("consulting/advisory potential")
    if financing: score+=10; hard=max(hard,2); reasons.append("investment/financing")
    if project: score+=8; reasons.append("project development")
    if any(norm(x) in text for x in STRATEGIC_ACTORS): score+=8; reasons.append("strategic Moroccan actor")
    score=min(100,round(score))
    if hard==0: hard=2 if score>=72 else (1 if score>=48 else 0)
    generic=not(tender or award or dfi or competitor or fichtner or major_project or financing or consulting)
    if generic and hard<2: hard=1 if score>=45 else 0
    meta=LEVELS[hard]
    return {"score":score,"level":meta["code"],"levelNumber":hard,"levelName":meta["name"],"maxQueries":meta["max_queries"],"maxSources":meta["max_sources"],"reasons":reasons[:8],"triggers":{"fichtner":fichtner,"competitor":competitor,"competitorMove":competitor_move,"tender":tender,"award":award,"dfi":dfi,"dfiDecision":dfi_decision,"majorProject":major_project,"consultingPotential":consulting}}
