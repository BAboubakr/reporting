"""Deterministic event matching for Atlas ingestion and historical persistence.

The browser implementation is data/event-deduplicator.js. Keep rules and
thresholds aligned so the dashboard and reports see the same event identities.
"""
from __future__ import annotations

import copy
import re
import unicodedata
from datetime import datetime
from urllib.parse import parse_qsl, urlencode, urlsplit, urlunsplit

ARTICLE_TITLE_THRESHOLD = 0.88
ARTICLE_COMBINED_THRESHOLD = 0.82
EVENT_SCORE_THRESHOLD = 0.78
PUBLICATION_WINDOW_DAYS = 45
TRACKING_PARAMS = re.compile(r"^(?:utm_.+|fbclid|gclid|dclid|mc_cid|mc_eid|igshid|li_fat_id|mkt_tok|trk|ref_src|yclid)$", re.I)
STOP_WORDS = set("the a an and or to of in on for with from by as at is are was were be this that it its team help advance appointed selected project projects plant plants development renewable energy morocco maroc news now international latest report says according le la les des un une de du et en pour dans sur avec aux par au solar photovoltaic pv bess battery storage wind hydrogen ammonia ptx grid transmission tender tenders procurement procurements award awards awarded contract contracts construction constructions investment investments financing financings announcement masen onee mw mwh gw gwh open opens launched launches bid bids invited".split())
ORG_ALIASES = {
    "afdb": "african development bank", "african development bank": "african development bank",
    "afdb group": "african development bank", "afd": "agence francaise de developpement",
    "agence francaise de developpement": "agence francaise de developpement",
    "onee": "onee", "onee branche electricite": "onee", "ocp": "ocp", "ocp group": "ocp",
    "masen": "masen", "anre": "anre", "fichtner": "fichtner", "rina": "rina",
    "novec": "novec", "jesa": "jesa", "dnv": "dnv", "wsp": "wsp", "worley": "worley",
    "egis": "egis", "mott macdonald": "mott macdonald", "afry": "afry", "tractebel": "tractebel",
}
TYPE_ALIASES = {
    "award": "award", "contract award": "award", "awarded": "award", "laureat": "award",
    "attributed": "award", "tender": "tender", "procurement": "tender",
    "appel d offres": "tender", "prequalification": "tender", "financing": "financing",
    "financial close": "financing", "funding": "financing", "construction": "construction",
    "commissioned": "commissioning", "commissioning": "commissioning",
    "regulatory": "regulatory", "regulation": "regulatory", "market entry": "market-entry",
    "investment": "investment", "partnership": "partnership",
}
TYPE_PATTERNS = [
    ("award", re.compile(r"\b(award(?:ed)?|won (?:the )?contract|selected as|appointed as|laureat|retenu|attribue)\b")),
    ("tender", re.compile(r"\b(tender|procurement|prequalification|rfp|rfq|appel d offres|consultation)\b")),
    ("financing", re.compile(r"\b(financial close|financing|loan|credit facility|funding)\b")),
    ("construction", re.compile(r"\b(construction|groundbreaking|construction starts|works begin)\b")),
    ("commissioning", re.compile(r"\b(commissioned|commissioning|inaugurated|commercial operation|mise en service)\b")),
    ("regulatory", re.compile(r"\b(regulation|regulatory|decree|law|tariff|decision|amendment)\b")),
    ("market-entry", re.compile(r"\b(market entry|opens? (?:an? )?office|launches? .*morocco|subsidiary|local entity)\b")),
    ("investment", re.compile(r"\b(investment|invests|invested|capital expenditure)\b")),
    ("partnership", re.compile(r"\b(partnership|agreement|memorandum|\bmou\b|joint venture|consortium)\b")),
]
CITIES = ("rabat", "casablanca", "tanger", "tangier", "fes", "meknes", "ouarzazate",
          "laayoune", "dakhla", "khouribga", "benguerir", "jorf lasfar", "safi",
          "agadir", "nador", "essaouira", "kenitra", "midelt", "guelmim", "boujdour", "tarfaya")


def normalize_text(value=""):
    text = unicodedata.normalize("NFKD", str(value or ""))
    text = "".join(ch for ch in text if not unicodedata.combining(ch)).lower()
    text = re.sub(r"https?://\S+", " ", text)
    return re.sub(r"\s+", " ", re.sub(r"[^a-z0-9\s]", " ", text)).strip()


def canonicalize_url(value=""):
    raw = str(value or "").strip()
    if not raw:
        return ""
    try:
        parts = urlsplit(raw)
        if parts.scheme.lower() not in ("http", "https") or not parts.hostname:
            return ""
        host = parts.hostname.lower().removeprefix("www.")
        port = parts.port
        if port and not ((parts.scheme.lower() == "https" and port == 443) or (parts.scheme.lower() == "http" and port == 80)):
            host += ":" + str(port)
        query = sorted((k, v) for k, v in parse_qsl(parts.query, keep_blank_values=True) if not TRACKING_PARAMS.match(k))
        path = parts.path.rstrip("/") or "/"
        return urlunsplit((parts.scheme.lower(), host, path, urlencode(query, doseq=True), ""))
    except (TypeError, ValueError):
        return raw.split("#", 1)[0].split("?", 1)[0].rstrip("/").lower()


def _article_text(item):
    return " ".join(str(item.get(key) or "") for key in ("title", "headline", "signal", "summary", "evidenceSnippet"))


def _headline(item):
    return normalize_text(item.get("title") or item.get("headline") or item.get("signal") or "")


def _tokens(item):
    return {word for word in normalize_text(_article_text(item)).split()
            if len(word) >= 3 and word not in STOP_WORDS}


def _similarity(left, right):
    if not left or not right:
        return 0.0
    return len(left & right) / max(1, min(len(left), len(right)))


def _event_type(item):
    explicit = normalize_text(item.get("eventType") or item.get("signalType") or "")
    if explicit in TYPE_ALIASES:
        return TYPE_ALIASES[explicit]
    stage = normalize_text(item.get("projectStage") or "")
    if stage in TYPE_ALIASES:
        return TYPE_ALIASES[stage]
    text = normalize_text(_article_text(item))
    return next((kind for kind, pattern in TYPE_PATTERNS if pattern.search(text)), "other")


def _stage(item):
    value = normalize_text(item.get("projectStage") or item.get("stage") or "")
    return TYPE_ALIASES.get(value, value)


def _project(item):
    return normalize_text(item.get("projectIdentity") or item.get("projectName") or item.get("project") or item.get("facilityName") or "")


def _tender(item):
    return normalize_text(item.get("tenderId") or item.get("contractNumber") or item.get("procurementId") or item.get("awardId") or "")


def _date(item):
    value = item.get("eventDate") or item.get("published") or item.get("publicationDate") or item.get("detected")
    if not value:
        return None
    try:
        return datetime.fromisoformat(str(value).replace("Z", "+00:00")).timestamp()
    except (TypeError, ValueError, OverflowError):
        return None


def _overlap(left, right):
    return left & right


def _organizations(item):
    raw = item.get("entities") if isinstance(item.get("entities"), list) else []
    return {ORG_ALIASES.get(normalize_text(value), normalize_text(value))
            for value in raw if normalize_text(value) not in ("", "morocco")}


def _capacities(item):
    text = _article_text(item) + " " + str(item.get("capacity") or "")
    return {re.sub(r"\s+", " ", match.group(0).lower()).strip()
            for match in re.finditer(r"\b\d+(?:\.\d+)?\s*(?:mw|mwh|gw|gwh|kw|kwh)\b", text, re.I)}


def _locations(item):
    text = normalize_text(" ".join(str(item.get(k) or "") for k in ("location", "region")) + " " + _article_text(item))
    return {city for city in CITIES if re.search(r"\b" + re.escape(city).replace(r"\ ", r"\s+") + r"\b", text)}


def _source_records(item):
    sources = item.get("sources") if isinstance(item.get("sources"), list) and item.get("sources") else [
        {key: item.get(key) for key in ("url", "source", "sourceType", "author", "published", "headline", "title", "summary", "evidenceSnippet", "sourceId", "firstSeen", "lastSeen")}
    ]
    out = []
    for source in sources:
        if not isinstance(source, dict):
            continue
        record = copy.deepcopy(source)
        original = str(record.get("originalUrl") or record.get("url") or "").strip()
        record["originalUrl"] = original
        record["url"] = original
        record["canonicalUrl"] = record.get("canonicalUrl") or canonicalize_url(original)
        record["firstSeen"] = record.get("firstSeen") or item.get("firstSeen") or item.get("detected")
        record["lastSeen"] = record.get("lastSeen") or item.get("lastSeen") or item.get("detected")
        out.append(record)
    return out


def _source_key(source):
    return str(source.get("canonicalUrl") or canonicalize_url(source.get("url")) or source.get("sourceId") or source.get("id") or "")


def _source_quality(source):
    source_type = str(source.get("sourceType") or source.get("evidenceLevel") or "").lower()
    reliability = 30 if ("official" in source_type or "primary" in source_type) else 12 if ("news" in source_type or "secondary" in source_type) else 0
    headline = source.get("headline") or source.get("title") or ""
    evidence = source.get("evidenceSnippet") or source.get("summary") or ""
    return reliability + (float(source.get("qualityScore") or 0) * 2) + (float(source.get("relevanceScore") or 0) * .2) + (4 if len(headline) > 30 else 0) + (4 if len(evidence) > 80 else 0)


def _event_quality(item):
    try:
        score = sum(_source_quality(s) for s in _source_records(item)) + _source_quality(item)
        score += 12 if _project(item) else 0
        score += 4 if item.get("url") else 0
        score += 3 if item.get("summary") else 0
        return score
    except (TypeError, ValueError):
        return 0


def _event_id(item):
    project, kind, stage, tender = _project(item), _event_type(item), _stage(item), _tender(item)
    stable = "project|" + project + "|" + kind + "|" + stage + "|" + tender if project else str(
        item.get("eventId") or item.get("id") or item.get("sourceId") or canonicalize_url(item.get("url")) or _headline(item))
    return "evt-" + _stable_hash(stable)


def _family_id(item):
    project = _project(item)
    return "family-" + _stable_hash(project) if project else None


def _stable_hash(value):
    result = 2166136261
    for byte in str(value).encode("utf-8"):
        result = ((result ^ byte) * 16777619) & 0xFFFFFFFF
    return f"{result:08x}"


def _sources_by_key(records):
    result = {}
    for source in records:
        key = _source_key(source)
        if not key:
            continue
        current = result.get(key)
        if current is None or _source_quality(source) > _source_quality(current) or (
            _source_quality(source) == _source_quality(current)
            and str(source.get("lastSeen") or source.get("published") or "") > str(current.get("lastSeen") or current.get("published") or "")
        ):
            candidate = copy.deepcopy(source)
            if current:
                candidate["observedUrls"] = sorted(set((current.get("observedUrls") or []) + [current.get("originalUrl"), current.get("url")] + (current.get("observedUrls") or [])) - {None, ""})
            result[key] = candidate
        elif source.get("originalUrl") and source.get("originalUrl") != current.get("originalUrl"):
            current["observedUrls"] = sorted(set((current.get("observedUrls") or []) + [current.get("originalUrl"), source.get("originalUrl")]) - {None, ""})
    return list(result.values())


def explain_event_match(left, right):
    kind_a, kind_b = _event_type(left), _event_type(right)
    if kind_a != "other" and kind_b != "other" and kind_a != kind_b:
        return {"match": False, "score": 0.0, "reasons": ["event-type-mismatch"]}
    stage_a, stage_b = _stage(left), _stage(right)
    if stage_a and stage_b and stage_a != stage_b:
        return {"match": False, "score": 0.0, "reasons": ["project-stage-mismatch"]}
    project_a, project_b = _project(left), _project(right)
    if project_a and project_b and project_a != project_b:
        return {"match": False, "score": 0.0, "reasons": ["project-identity-mismatch"]}
    tender_a, tender_b = _tender(left), _tender(right)
    if tender_a and tender_b and tender_a != tender_b:
        return {"match": False, "score": 0.0, "reasons": ["tender-identity-mismatch"]}
    sources_a, sources_b = _source_records(left), _source_records(right)
    urls_a = {_source_key(s) for s in sources_a if _source_key(s)}
    urls_b = {_source_key(s) for s in sources_b if _source_key(s)}
    ids_a = {str(s.get("sourceId") or s.get("id")) for s in sources_a if s.get("sourceId") or s.get("id")}
    ids_b = {str(s.get("sourceId") or s.get("id")) for s in sources_b if s.get("sourceId") or s.get("id")}
    same_url = bool(urls_a & urls_b)
    same_source_id = bool(ids_a & ids_b)
    same_project = bool(project_a and project_a == project_b)
    orgs = _organizations(left) & _organizations(right)
    capacities = _capacities(left) & _capacities(right)
    locations = _locations(left) & _locations(right)
    date_a, date_b = _date(left), _date(right)
    gap = abs(date_a - date_b) / 86400 if date_a is not None and date_b is not None else None
    compatible_type = kind_a == "other" or kind_b == "other" or kind_a == kind_b
    same_stage = not stage_a or not stage_b or stage_a == stage_b
    title_a, title_b = _headline(left), _headline(right)
    common = _tokens(left) & _tokens(right)
    text_similarity = _similarity(_tokens(left), _tokens(right))
    if same_url and compatible_type and same_stage:
        return {"match": True, "score": .99, "reasons": ["same-canonical-url"]}
    if same_source_id and compatible_type and same_stage:
        return {"match": True, "score": .99, "reasons": ["same-source-id"]}
    if title_a and title_a == title_b and any(len(token) >= 4 for token in common) and compatible_type and same_stage and (gap is None or gap <= 180):
        return {"match": True, "score": .96, "reasons": ["same-normalized-headline", "distinctive-title-anchor"]}
    if text_similarity >= ARTICLE_TITLE_THRESHOLD and len(common) >= 5 and compatible_type and same_stage and (gap is None or gap <= 21):
        return {"match": True, "score": .9, "reasons": ["near-identical-article-text", "compatible-event-type"]}
    if text_similarity >= ARTICLE_COMBINED_THRESHOLD and len(common) >= 5 and compatible_type and same_stage and (gap is None or gap <= 14):
        return {"match": True, "score": .84, "reasons": ["high-text-similarity", "compatible-event-type"]}
    if same_project and kind_a == kind_b and same_stage:
        score, reasons = .42, ["same-project", "same-event-type"]
        if tender_a and tender_a == tender_b:
            score += .2
            reasons.append("same-tender-identity")
        if orgs:
            score += .12
            reasons.append("shared-organization")
        if capacities:
            score += .1
            reasons.append("shared-capacity")
        if locations:
            score += .08
            reasons.append("shared-location")
        if gap is None or gap <= PUBLICATION_WINDOW_DAYS:
            score += .08
            reasons.append("date-not-available" if gap is None else "within-publication-window")
        if gap is not None and gap > PUBLICATION_WINDOW_DAYS:
            return {"match": False, "score": round(score, 2), "reasons": ["outside-publication-window", *reasons]}
        enough = bool(tender_a) or bool(orgs and (capacities or locations or text_similarity >= .28))
        if enough and score >= EVENT_SCORE_THRESHOLD:
            return {"match": True, "score": round(score, 2), "reasons": reasons}
    return {"match": False, "score": round(text_similarity, 2), "reasons": ["insufficient-event-evidence"]}


def _append_sources(target, incoming, rationale):
    previous = _sources_by_key(_source_records(target))
    additions = _source_records(incoming)
    merged = _sources_by_key(previous + additions)
    previous_by_key = {_source_key(source): source for source in previous}
    additions_by_key = {_source_key(source): source for source in additions}
    for source in merged:
        prior = previous_by_key.get(_source_key(source))
        if prior:
            addition = additions_by_key.get(_source_key(source), {})
            versions = list(prior.get("updates") or [])
            snapshots = (prior, addition)
            for version in snapshots:
                headline = version.get("headline") or version.get("title") or ""
                summary = version.get("summary") or version.get("evidenceSnippet") or ""
                if (headline, summary) == (source.get("headline") or source.get("title") or "",
                                           source.get("summary") or source.get("evidenceSnippet") or ""):
                    continue
                if (headline, summary) == ((prior.get("headline") or prior.get("title") or ""),
                                           (prior.get("summary") or prior.get("evidenceSnippet") or "")) and \
                        (headline, summary) == ((addition.get("headline") or addition.get("title") or ""),
                                                (addition.get("summary") or addition.get("evidenceSnippet") or "")):
                    continue
                snapshot = {"headline": headline, "summary": summary,
                            "published": version.get("published") or version.get("publicationDate"),
                            "observedAt": version.get("lastSeen")}
                if snapshot not in versions:
                    versions.append(snapshot)
            if versions:
                source["updates"] = versions
        else:
            source["matchConfidence"] = rationale["score"]
            source["matchRationale"] = rationale["reasons"]
    target["sources"] = merged
    target["sourceCount"] = len(merged)
    seen = [value for value in (target.get("firstSeen"), incoming.get("firstSeen"), incoming.get("detected")) if value]
    target["firstSeen"] = min(seen) if seen else None
    last_seen = [value for value in (target.get("lastSeen"), incoming.get("lastSeen"), incoming.get("detected")) if value]
    target["lastSeen"] = max(last_seen) if last_seen else None
    matches = list(target.get("duplicateMatches") or [])
    event_key = incoming.get("eventId") or _event_id(incoming)
    entry = {"eventId": event_key, "score": rationale["score"], "reasons": rationale["reasons"]}
    if entry not in matches:
        matches.append(entry)
    target["duplicateMatches"] = matches
    family = target.get("eventFamilyId") or incoming.get("eventFamilyId") or _family_id(target) or _family_id(incoming)
    if family:
        target["eventFamilyId"] = family


def _merge_event(target, incoming, rationale):
    before = copy.deepcopy(target)
    representative = incoming if _event_quality(incoming) > _event_quality(target) else target
    merged = {**target, **incoming, **representative}
    merged["eventId"] = target.get("eventId") or _event_id(target)
    merged["id"] = target.get("id") or merged["eventId"]
    family = target.get("eventFamilyId") or incoming.get("eventFamilyId") or _family_id(target) or _family_id(incoming)
    if family:
        merged["eventFamilyId"] = family
    merged["matchConfidence"] = max(float(target.get("matchConfidence") or 0), rationale["score"])
    merged["matchRationale"] = list(dict.fromkeys((target.get("matchRationale") or []) + rationale["reasons"]))
    merged["categories"] = list(dict.fromkeys((target.get("categories") or []) + (incoming.get("categories") or [])))
    merged["entities"] = list(dict.fromkeys((target.get("entities") or []) + (incoming.get("entities") or [])))
    _append_sources(merged, incoming, rationale)
    if before.get("id") != merged.get("id"):
        merged["previousIds"] = list(dict.fromkeys((target.get("previousIds") or []) + [before["id"]]))
    return merged


def deduplicate_events(candidates=(), existing=()):
    """Merge a batch into existing canonical events, preserving source history."""
    events = [copy.deepcopy(item) for item in existing if isinstance(item, dict)]
    ordered = [copy.deepcopy(item) for item in candidates if isinstance(item, dict)]
    ordered.sort(key=lambda item: (-_event_quality(item), -(_date(item) or 0), _headline(item)))
    for candidate in ordered:
        candidate["eventType"] = _event_type(candidate)
        candidate["eventId"] = candidate.get("eventId") or _event_id(candidate)
        candidate["id"] = candidate.get("id") or candidate["eventId"]
        candidate["eventFamilyId"] = candidate.get("eventFamilyId") or _family_id(candidate)
        candidate["sources"] = _sources_by_key(_source_records(candidate))
        candidate["sourceCount"] = len(candidate["sources"])
        candidate["firstSeen"] = candidate.get("firstSeen") or candidate.get("detected")
        candidate["lastSeen"] = candidate.get("lastSeen") or candidate.get("detected")
        best_index, best = None, None
        for index, current in enumerate(events):
            rationale = explain_event_match(candidate, current)
            if rationale["match"] and (best is None or rationale["score"] > best["score"]):
                best_index, best = index, rationale
        if best is None:
            events.append(candidate)
        else:
            events[best_index] = _merge_event(events[best_index], candidate, best)
    return events

