import copy
import unittest

from event_deduplicator import canonicalize_url, deduplicate_events, explain_event_match


def article(**overrides):
    base = {
        "id": "source-a",
        "title": "MASEN awards Noor Atlas PV construction contract",
        "summary": "MASEN selected a contractor for the 350 MW Noor Atlas PV project in Ouarzazate, Morocco.",
        "url": "https://news.example/masen-noor-atlas-award",
        "source": "Energy Desk",
        "sourceType": "news",
        "published": "2026-10-10T09:00:00+00:00",
        "detected": "2026-10-10T10:00:00+00:00",
        "signalType": "award",
        "projectStage": "contract award",
        "project": "Noor Atlas PV",
        "entities": ["MASEN"],
        "categories": ["Solar PV"],
    }
    base.update(overrides)
    return base


class EventDeduplicatorTests(unittest.TestCase):
    def test_tracking_url_variants_are_one_source(self):
        a = article(url="https://www.news.example/story?id=7&utm_source=mail#top")
        b = article(id="source-b", url="https://news.example/story?utm_campaign=weekly&id=7&fbclid=abc")
        self.assertEqual(canonicalize_url(a["url"]), canonicalize_url(b["url"]))
        events = deduplicate_events([a, b])
        self.assertEqual(len(events), 1)
        self.assertEqual(events[0]["sourceCount"], 1)
        self.assertTrue(events[0]["sources"][0]["originalUrl"])

    def test_same_award_across_publications_aggregates_both_sources(self):
        a = article()
        b = article(
            id="source-b",
            title="Contractor selected for Noor Atlas photovoltaic project",
            summary="The 350 MW project at Ouarzazate will be built for MASEN.",
            url="https://journal.example/awarded-noor-atlas",
            source="Morocco Journal",
            sourceType="news",
            published="2026-10-11T09:00:00+00:00",
        )
        events = deduplicate_events([a, b])
        self.assertEqual(len(events), 1)
        self.assertEqual(events[0]["sourceCount"], 2)
        self.assertTrue(events[0]["duplicateMatches"])
        self.assertGreaterEqual(events[0]["matchConfidence"], 0.78)

    def test_english_and_french_identified_event_merge(self):
        english = article()
        french = article(
            id="source-fr",
            title="MASEN attribue le marché de construction du projet Noor Atlas PV",
            summary="Le projet photovoltaïque de 350 MW sera réalisé à Ouarzazate pour MASEN.",
            url="https://journal.example/fr/noor-atlas-marche",
            source="Journal du Maroc",
            published="2026-10-12T09:00:00+00:00",
            signalType="award",
            projectStage="lauréat",
        )
        self.assertTrue(explain_event_match(english, french)["match"])
        self.assertEqual(len(deduplicate_events([english, french])), 1)

    def test_separate_institution_tenders_stay_separate(self):
        first = article(signalType="tender", projectStage="tender", project="ONEE Midelt BESS tender", tenderId="ONEE-12/2026",
                        title="ONEE tenders 200 MW Midelt battery storage project", summary="ONEE invited bids for a 200 MW BESS near Midelt, Morocco.")
        second = article(signalType="tender", projectStage="tender", project="ONEE Safi grid tender", tenderId="ONEE-13/2026",
                         title="ONEE tenders Safi transmission substation works", summary="ONEE invited bids for a new grid substation at Safi, Morocco.")
        self.assertEqual(len(deduplicate_events([first, second])), 2)

    def test_tender_and_later_award_remain_distinct_but_linked(self):
        tender = article(signalType="tender", projectStage="tender", title="MASEN opens tender for Noor Atlas PV project",
                         summary="MASEN invites bids for the 350 MW solar project in Ouarzazate.")
        award = article(id="award-story", signalType="award", projectStage="contract award",
                        title="MASEN awards Noor Atlas PV construction contract",
                        url="https://journal.example/noor-atlas-award",
                        summary="MASEN selected a contractor for the 350 MW solar project in Ouarzazate.")
        events = deduplicate_events([tender, award])
        self.assertEqual(len(events), 2)
        self.assertEqual(events[0]["eventFamilyId"], events[1]["eventFamilyId"])

    def test_different_project_phases_remain_separate(self):
        first = article(signalType="project milestone", projectStage="construction phase 1",
                        title="Construction starts on Noor Atlas PV phase one", summary="Work begins on phase 1 of the 350 MW solar project in Ouarzazate.")
        second = article(id="phase-two", signalType="project milestone", projectStage="construction phase 2",
                         title="Construction starts on Noor Atlas PV phase two", url="https://journal.example/noor-phase-two",
                         summary="Work begins on phase 2 of the 350 MW solar project in Ouarzazate.")
        self.assertEqual(len(deduplicate_events([first, second])), 2)

    def test_later_article_update_keeps_prior_source_version(self):
        original = article()
        updated = copy.deepcopy(original)
        updated["detected"] = "2026-10-12T10:00:00+00:00"
        updated["summary"] += " The selected package includes commissioning support."
        updated["sources"] = [{"url": original["url"], "source": original["source"], "sourceType": original["sourceType"],
                               "published": original["published"], "headline": updated["title"], "summary": updated["summary"],
                               "lastSeen": updated["detected"]}]
        events = deduplicate_events([original, updated])
        self.assertEqual(len(events), 1)
        source = events[0]["sources"][0]
        self.assertTrue(source.get("updates"))
        self.assertIn("commissioning support", source.get("summary", ""))

    def test_reprocessing_batch_is_idempotent(self):
        batch = [article(), article(id="copy", url="https://journal.example/noor-award", source="Other News")]
        once = deduplicate_events(batch)
        twice = deduplicate_events(once)
        self.assertEqual(len(twice), len(once))
        self.assertEqual(twice[0]["sourceCount"], once[0]["sourceCount"])
        self.assertEqual(twice[0]["eventId"], once[0]["eventId"])

    def test_malformed_and_incomplete_metadata_is_safe(self):
        records = [
            {"title": "No metadata", "url": "ht!tp://bad url", "published": "not-a-date"},
            {"title": "Solar tender in Morocco", "url": 3, "summary": None, "published": None},
        ]
        self.assertEqual(len(deduplicate_events(records)), 2)

    def test_cross_run_merge_preserves_event_identity_and_old_source(self):
        previous = deduplicate_events([article()])
        next_run = article(id="tomorrow", url="https://journal.example/noor-award",
                           source="Tomorrow News", published="2026-10-11T09:00:00+00:00")
        merged = deduplicate_events([next_run], existing=previous)
        self.assertEqual(len(merged), 1)
        self.assertEqual(merged[0]["eventId"], previous[0]["eventId"])
        self.assertEqual(merged[0]["sourceCount"], 2)


if __name__ == "__main__":
    unittest.main()

