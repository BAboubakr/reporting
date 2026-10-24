import json, sys, unittest
from datetime import datetime, timedelta, timezone
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parent))
import rfp_radar as radar

NOW=datetime(2026,10,17,12,tzinfo=timezone.utc)
TAXONOMY={'capabilities':[{'category':'Grid advisory','technologies':['grid','energy','bess','wind'],'services':['study','technical assistance','consulting','engineering','feasibility','supervision']},{'category':'Renewables','technologies':['solar','wind'],'services':['study','engineering','consulting','technical assistance']}]}
PUBLIC={'id':'pmmp','name':'Official Moroccan public procurement portal','url':'https://www.marchespublics.gov.ma/list'}

def notice(reference='AO/42/2026',title='Consulting study for a 100 MW solar photovoltaic project and grid connection',authority='MASEN - Moroccan Agency for Sustainable Energy',published='2026-10-16T10:00:00+00:00',deadline='2026-11-17T09:00:00+00:00',rawListing='Appel d’offres ouvert Services',sourceId='pmmp'):
    return {'sourceId':sourceId,'sourceName':'Official Moroccan public procurement portal','sourceUrl':f'https://www.marchespublics.gov.ma/detail/{reference}','officialUrl':f'https://www.marchespublics.gov.ma/detail/{reference}','title':title,'authority':authority,'reference':reference,'publishedAt':published,'deadlineAt':deadline,'rawListing':rawListing,'evidence':f'{rawListing} Objet : {title}. Acheteur public : {authority}.','noticeType':'formal tender'}

class RadarTests(unittest.TestCase):
    def test_new_relevant_public_rfp_appears_with_explained_match(self):
        rows=radar.merge_history([], [notice()], TAXONOMY, NOW)
        self.assertEqual(len(rows),1);self.assertEqual(rows[0]['fit'],'Strong potential fit');self.assertTrue(rows[0]['newToAtlas']);self.assertTrue(rows[0]['fitReasons'])

    def test_out_of_scope_public_notice_is_excluded(self):
        rows=radar.merge_history([], [notice(title='Supply of office furniture and desks for administration')],TAXONOMY,NOW)
        self.assertEqual(rows,[])

    def test_private_sector_is_excluded_by_default(self):
        rows=radar.merge_history([], [notice(authority='Solar Private Limited')],TAXONOMY,NOW)
        self.assertEqual(rows,[])

    def test_project_news_without_formal_notice_is_not_extracted(self):
        html='<article>MASEN announces a new solar project in Morocco. Read more</article>'
        self.assertEqual(radar.parse_listing(PUBLIC,html,NOW.isoformat()),[])

    def test_same_reference_from_two_sources_is_one_record_with_both_sources(self):
        second=notice(sourceId='masen');second['sourceName']='MASEN e-Tendering';second['sourceUrl']='https://etendering.masen.ma/detail/AO42';second['officialUrl']=second['sourceUrl']
        rows=radar.merge_history([], [notice(),second],TAXONOMY,NOW)
        self.assertEqual(len(rows),1);self.assertEqual({x['sourceId'] for x in rows[0]['sourceReferences']},{'pmmp','masen'})

    def test_deadline_extension_updates_existing_notice_and_keeps_first_discovery(self):
        first=radar.merge_history([], [notice()],TAXONOMY,NOW)[0]
        revised=notice(deadline='2026-11-30T09:00:00+00:00',rawListing='Appel d’offres ouvert Services corrigendum deadline extension')
        rows=radar.merge_history([first],[revised],TAXONOMY,NOW+timedelta(days=8))
        self.assertEqual(len(rows),1);self.assertEqual(rows[0]['id'],first['id']);self.assertEqual(rows[0]['firstDiscoveredAt'],first['firstDiscoveredAt']);self.assertEqual(rows[0]['deadlineAt'],revised['deadlineAt']);self.assertTrue(rows[0]['updatedRecently']);self.assertFalse(rows[0]['newToAtlas'])

    def test_cancellation_and_award_are_milestones_not_new_rfps(self):
        first=radar.merge_history([], [notice()],TAXONOMY,NOW)[0]
        for kind,expected in [('cancellation','cancelled'),('award','awarded')]:
            milestone=notice(sourceId='masen-awards');milestone['noticeType']=kind
            rows=radar.merge_history([first],[milestone],TAXONOMY,NOW+timedelta(days=8))
            self.assertEqual(len(rows),1);self.assertEqual(rows[0]['status'],expected);self.assertFalse(rows[0]['newToAtlas']);self.assertEqual(rows[0]['updates'][-1]['change'],'status')

    def test_repeated_milestone_is_idempotent(self):
        first=radar.merge_history([], [notice()],TAXONOMY,NOW)[0]
        milestone=notice(sourceId='masen-awards');milestone['noticeType']='award'
        once=radar.merge_history([first],[milestone],TAXONOMY,NOW+timedelta(days=1))[0]
        twice=radar.merge_history([once],[milestone],TAXONOMY,NOW+timedelta(days=2))[0]
        self.assertEqual(len(twice['updates']),1)

    def test_expired_deadline_is_closed_not_open(self):
        item=notice(deadline='2026-10-16T09:00:00+00:00')
        self.assertEqual(radar.procurement_status(item,NOW),'closed')

    def test_missing_deadline_is_unclear_and_not_guessed(self):
        item=notice(deadline=None)
        self.assertEqual(radar.procurement_status(item,NOW),'unclear');self.assertIsNone(item['deadlineAt'])

    def test_date_without_a_time_keeps_time_unknown(self):
        date=radar.parse_date('17/11/2026')
        self.assertEqual(date,'2026-11-17');self.assertEqual(radar.procurement_status({'deadlineAt':date},NOW),'open')

    def test_rediscovery_does_not_reset_new_to_atlas_age(self):
        first=radar.merge_history([], [notice()],TAXONOMY,NOW)[0]
        again=radar.merge_history([first],[notice()],TAXONOMY,NOW+timedelta(days=8))[0]
        self.assertFalse(again['newToAtlas']);self.assertEqual(again['firstDiscoveredAt'],first['firstDiscoveredAt'])

    def test_official_link_and_evidence_are_retained(self):
        row=radar.merge_history([], [notice()],TAXONOMY,NOW)[0]
        self.assertEqual(row['officialUrl'],notice()['officialUrl']);self.assertIn('Appel d’offres',row['evidence']);self.assertEqual(row['sourceReferences'][0]['sourceId'],'pmmp')

    def test_listing_parser_needs_formal_notice_and_official_detail_link(self):
        html='<table><tr><td>Appel d’offres ouvert Services 16/10/2026 AO/42/2026 Objet : Consulting study for a 100 MW solar PV project Acheteur public : MASEN</td><td><a href="javascript:popUp(\'index.php?page=commun.PopUpDetailLots&amp;refConsultation=42\')">Lots</a><a href="index.php?page=entreprise.EntrepriseDetailConsultation&amp;refConsultation=42">Détail</a></td><td>17/11/2026 10:00</td></tr></table>'
        rows=radar.parse_listing(PUBLIC,html,NOW.isoformat())
        self.assertEqual(len(rows),1);self.assertTrue(rows[0]['officialUrl'].startswith('https://www.marchespublics.gov.ma/'));self.assertEqual(rows[0]['noticeType'],'formal tender');self.assertIn('MASEN',rows[0]['authority'])

    def test_empty_and_large_feeds_are_supported(self):
        self.assertEqual(radar.merge_history([],[],TAXONOMY,NOW),[])
        many=[notice(reference=f'AO/{i}/2026',title=f'Engineering feasibility study of {i} MW wind energy grid project in Morocco') for i in range(500)]
        rows=radar.merge_history([],many,TAXONOMY,NOW)
        self.assertEqual(len(rows),500)

    def test_repository_keeps_pages_deployment_workflow(self):
        workflow=Path(__file__).resolve().parents[1]/'.github/workflows/pages.yml'
        self.assertTrue(workflow.exists());self.assertIn('deploy-pages',workflow.read_text(encoding='utf-8'))

if __name__=='__main__':unittest.main()

