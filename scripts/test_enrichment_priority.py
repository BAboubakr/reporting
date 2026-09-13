"""Regression tests for Atlas adaptive enrichment decisions.
Run with: python scripts/test_enrichment_priority.py
"""
import sys
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parent))
import enrich_signals as e


def check(condition,message):
    if not condition: raise AssertionError(message)


def test_offshore_wind_signal():
    s={'id':'sig-test-offshore','title':"European Investment Bank backs feasibility study for Morocco's first offshore wind project - Offshore Magazine",'summary':'EIB commissioned a two-year feasibility study near Essaouira. Consortium includes OWC, NOVEC and PHENIXA.','categories':['Wind','Investment'],'entities':[],'competitor':None,'actionabilityScore':40}
    entities,competitor=e.infer_entities(s)
    check('EIB' in entities,'EIB should be extracted')
    check('NOVEC' in entities,'NOVEC should be extracted')
    check('OWC' in entities,'OWC should be extracted')
    check(competitor=='NOVEC','NOVEC should become competitor')
    check(e.infer_project(s)=='Morocco Offshore Wind Feasibility Study','offshore project should be identified')
    meta=e.research_priority(s)
    check(meta['levelNumber']>=2,'offshore EIB/NOVEC signal must receive at least L2')
    check(len(e.make_queries(s,meta['levelNumber']))>=meta['maxQueries'],'query pool must support the assigned budget')


def test_fichtner_priority():
    s={'title':'Fichtner selected as technical advisor for major Morocco solar project','summary':'Contract awarded for owner engineering and grid studies in Morocco.','categories':['Solar'],'entities':['Fichtner'],'competitor':'Fichtner'}
    meta=e.research_priority(s)
    check(meta['levelNumber']==4,'Fichtner strategic award should be L4')


def test_minor_news_is_not_overresearched():
    s={'title':'Morocco renewable energy sector event announced','summary':'Industry networking event details published.','categories':['Events'],'entities':[],'competitor':None,'actionabilityScore':10}
    meta=e.research_priority(s)
    check(meta['levelNumber']<=1,'minor generic news should not be deep-researched')


def test_fresh_weak_record_is_researched_after_engine_upgrade():
    s={'title':'Morocco offshore wind study','summary':'EIB feasibility study','categories':['Wind'],'entities':['EIB'],'competitor':None,'enrichment':{'engineVersion':'4.0','researchedAt':'2099-01-01T00:00:00+00:00','sourceCount':9,'facts':[]}}
    meta=e.research_priority(s)
    do,reason=e.should_research(s,meta)
    check(do,'old engine enrichment must be re-researched')
    check('old-engine' in reason,'eligibility reason should explain the re-research')


if __name__=='__main__':
    test_offshore_wind_signal(); test_fichtner_priority(); test_minor_news_is_not_overresearched(); test_fresh_weak_record_is_researched_after_engine_upgrade(); print('PASS: adaptive enrichment regression tests')
