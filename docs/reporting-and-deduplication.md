# Reporting and event deduplication

## Event identity and source history

`data/event-deduplicator.js` is the shared browser-side event identity layer. The Python port in `scripts/event_deduplicator.py` uses the same thresholds and identity rules for ingestion. The intake first canonicalizes tracking URLs, then checks source identifiers and distinctive titles, and finally compares project, event type, stage, dates, tender identifiers, organizations, location, and capacity. A common institution or generic topic word alone is never enough to merge two records.

The default thresholds are 0.88 for near-duplicate titles, 0.82 for combined evidence, and 0.78 for same-event evidence, with a 45-day publication window. Tender announcements and awards, different tender IDs, unrelated projects, and distinct project stages remain separate. Related records can share an `eventFamilyId` without being collapsed.

Merged events retain their source links and source count, original URLs, first and last seen times, representative-source metadata, and duplicate-match rationale. `scripts/monitor.py` migrates the existing `data/signals.js` records to `data/event-history.json` on its first run, then updates that history atomically. If the history file cannot be read, the monitor stops rather than replacing it with an empty file. Enrichment writes its updated fields back to the matching history record.

## PDF report

The PDF action builds a print-ready HTML report in the browser. Choose a reporting period, use **PDF**, then use the preview's **Print / Save as PDF** action and select the browser's PDF destination. The report ranks and caps developments at ten, shows reported facts separately from analytical interpretation, preserves clickable source links, and includes available project, event, and pipeline details. Missing fields are omitted or shown as unavailable; undated items are retained in the selected report period.

For local development, serve the repository root over HTTP (for example, `python -m http.server 8000`) and open `http://localhost:8000`. The report uses the same event deduplicator as the dashboard. The PowerPoint report remains available separately.

## Verification

Run the JavaScript checks with `node --test scripts/test_*.mjs`. Run Python checks with `python -m unittest discover -s scripts -p 'test_*.py'` and the enrichment regression with `python scripts/test_enrichment_priority.py`. Compile the ingestion modules with `python -m py_compile scripts/event_deduplicator.py scripts/monitor.py scripts/enrich_signals.py scripts/smart_filter.py`.

The test fixtures cover URL tracking variants, source aggregation, cross-language event matching, distinct tenders and stages, update history, idempotency, malformed data, empty and large reports, long text, and unsafe source URLs.

