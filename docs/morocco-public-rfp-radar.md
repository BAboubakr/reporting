# Morocco Public RFP Radar

## Dashboard

Open **Morocco Public RFP Radar** from the left navigation. It is a separate view and reads only `data/rfp-opportunities.json` and `data/rfp-source-status.json`; the general developments feed is unchanged. Filters cover status, authority, service category, fit and recent discovery. Sort options are relevance, publication date and deadline.

“New to Atlas” means the notice's persistent `firstDiscoveredAt` is less than seven days old. This does not reset when the monitor rediscovers the notice or sees an amendment. Publication date remains a separate field. The dashboard shows active/unclear notices, plus closed notices discovered or changed in the last 30 days. Full records are retained in `data/rfp-history.json`.

## Sources wired into the collector

The daily GitHub Actions workflow (`.github/workflows/rfp-radar.yml`) reads public HTML from:

- The [Portail Marocain des Marchés Publics](https://www.marchespublics.gov.ma/pmmp/) current consultation listing.
- MASEN e-Tendering public current-tender, award-notice and cancellation listings.

The monitor performs unauthenticated, low-volume GETs, sends conditional `If-None-Match` / `If-Modified-Since` headers when a source provides validators, and keeps the prior persistent history on HTTP 304. It does not log into supplier accounts or download tender dossiers. The MASEN platform states that its public supplier service supports searching tenders and downloading dossiers; some procurement documents or actions may require supplier registration. Direct documents are linked only when the public listing exposes an official detail URL.

During implementation, live fetching reached the PMMP listing and parsed nine notice rows; a public-energy match was not confirmed from those rows. MASEN listing endpoints were reachable but returned no parseable tender rows in that run. The result feed therefore starts empty and is populated by the scheduled collector; fixture records are not shipped as live opportunities. Each run records source success/failure and parsed-row counts. This is partial coverage, not an exhaustive Moroccan procurement feed. PMMP pagination beyond the first fetched listing page, restricted notices, and public organizations that publish outside the monitored pages remain coverage gaps. The monitor does not claim ONEE direct notices or IFI procurement pages are independently integrated.

## Relevance and exclusions

`data/rfp-capabilities.json` is the configurable text-screening taxonomy. It pairs a relevant service (such as engineering study, feasibility, owner’s engineering, technical assistance, consulting, supervision, commissioning or procurement advisory) with an energy technology/system (renewables, grid/storage, hydrogen or energy infrastructure). A topic word by itself does not qualify. Only formal notice rows with an official detail link are considered; general news, forecasts and pre-information notices are excluded. Private legal-form cues are excluded by default.

The fit score records paired textual evidence and is not an eligibility probability. The monitor flags unknown registrations, consortium, certification and turnover criteria and asks a human to review the official dossier. The repository does not currently provide an approved, cited Fichtner capability profile; the taxonomy is therefore an Atlas screening configuration and every match needs company-profile verification before a bid decision. It never asserts eligibility or likelihood of winning. Values and deadlines are displayed only when listed; date-only deadlines remain date-only, unknown deadlines receive `unclear` status, and expired deadlines are `closed`.

## Identity, amendments and status

The stable record ID uses the normalized official reference and authority, falling back to the official detail URL/title where the source omits a reference. Matching notices from multiple monitored sources update one record and add source references. The first publication and first-discovery values are retained. Changes to the title, evidence or deadline append an update entry; the same record is marked updated, not a new notice. Separate MASEN award/cancellation pages update an existing record's milestone status when their reference and authority match. A deadline in the past is closed; no deadline means unclear. No link or value is invented.

## Run, test and deploy

Locally, from the repository root, run:

```sh
python scripts/rfp_radar.py
python -m unittest discover -s scripts -p 'test_*.py'
node --test scripts/test_*.mjs
```

The collector writes the feed, persistent history and source-health JSON files. For display, serve the root over HTTP and open the Pages index (for example, `python -m http.server 8000` then `http://localhost:8000`). After merging to `master`, `.github/workflows/rfp-radar.yml` refreshes daily and commits feed/history/status; the existing hourly GitHub Pages workflow deploys the latest repository state. `workflow_dispatch` can run a manual refresh. Review the source coverage panel after each run and review the official procurement dossier before acting.

