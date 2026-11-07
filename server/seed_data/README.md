# FUTUREPRINT research dataset

Curated, version-controlled evidence for the FUTUREPRINT backend. The API serves this data from PostgreSQL after `flask seed load`, so there is no runtime dependency on external websites.

**Current version:** `2026.11.07` (retrieved through 2026-11-07). The loader appends a checksum, for example `2026.11.07+589cc455`.

## Files

| File | Contents |
|---|---|
| `manifest.json` | Dataset version, validation rules, methodology, glossary and known gaps (served by `GET /api/v1/methodology`) |
| `evidence_sources.json` | 15 cited sources, each with findings, dates, region, confidence and limitations |
| `occupations.json` | 6 occupations with ISCO-08 codes, ILO exposure classification, Kenya context and limitations |
| `tasks.json` | 40 ISCO-08 tasks with ILO 2025 task-level exposure scores |
| `skills.json` | 32 skills |
| `pathways.json` | 18 Adapt / Transform / Discover pathways (3 per occupation) |
| `scenarios.json` | 18 illustrative simulation scenarios, 54 choices |
| `workforce_events.json` | 3 verified public announcements and the companies behind them |

## Occupations

| Occupation | ISCO-08 | ILO 2025 exposure | Mean task score |
|---|---|---|---|
| Customer Service / Contact Centre Agent | 4222 | Gradient 3 | 0.58 |
| Accountant | 2411 | Gradient 3 | 0.51 |
| Software Developer | 2512 | Gradient 3 | 0.53 |
| Graphic Designer | 2166 | Gradient 2 | 0.49 |
| Secondary School Teacher | 2330 | Not exposed | 0.30 |
| Registered Nurse | 2221 | Not exposed | 0.25 |

These six were chosen to cover a range of exposure levels, to be relevant to Kenyan students and graduates, and because primary evidence exists for each.

## Provenance and methodology

1. **Primary sources first.** The sources are the ILO (Working Paper 140, the companion task-score dataset, *Mind the AI Divide*), ILOSTAT, the IMF, the WEF *Future of Jobs Report 2025*, WHO, UNESCO, research papers (NBER, arXiv) and official company statements (Klarna, Dropbox, Microsoft).
2. **Read, not remembered.** Every finding was read on the source page or document on the retrieval date. Findings marked `"verbatim": true` are exact quotations. `"verbatim": false` means transcribed values (for example table rows or data points) or quoted fragments with a label added.
3. **Tasks and exposure come from the ILO.** Task statements are the official ISCO-08 task descriptions, copied exactly. Scores and labels are taken from the ILO companion dataset by a script, not typed by hand.
4. **Editorial content is labelled.** Task titles are plain-language paraphrases. `likely_change` and every `transformation_note` (prefixed `FUTUREPRINT editorial note:`) are our assessments informed by the cited evidence. Pathways and scenarios are illustrative (`is_illustrative: true`) and contain no statistics.
5. **Concepts are kept separate.** *AI exposure*, *task automation*, *employment displacement* and *job transformation* are defined in `manifest.json` → `methodology.glossary`. Exposure is never presented as job loss.
6. **Evidence was excluded when it could not be verified.** Media-only claims (for example WHO regional nursing-shortage numbers quoted in news coverage) are not used. Pages that failed to load (WEF and OECD landing pages, BT's results page, Science) were not cited unless the primary document itself was obtained, as with the WEF report PDF.

## Geographic coverage

- **Kenya:** ILOSTAT informal employment (2019); KNBS Economic Survey 2025 figures through a secondary news report; the Microsoft–G42 investment announcement; Kenyan examples in *Mind the AI Divide* (M-Pesa, data-annotation work).
- **Africa:** Sub-Saharan Africa findings from the ILO/UN and WEF reports.
- **Global:** ILO, IMF, WEF, WHO and UNESCO.
- **Outside Africa:** Klarna, Dropbox, the NBER customer-support study and the Copilot experiment are labelled `region: "outside_africa"`, and the API exposes `is_african_evidence` so the frontend can show the label.

## Known gaps

- No verified Kenya-specific employment statistics for any of the six occupations.
- No verified data on AI adoption by Kenyan employers.
- The KNBS primary documents could not be retrieved securely on 2026-11-07 because `knbs.or.ke` and `planning.go.ke` presented expired or unverifiable TLS certificates. Kenyan job-creation figures therefore come from *The Star* (secondary source, medium confidence). Replace them with the KNBS Economic Survey when it is accessible.
- The ILOSTAT informality figure is for 2019.
- WEF projections cover formal jobs at mostly large employers.
- Only three workforce events met the verification standard, and two of them are from outside Africa.

## Update procedure

1. Edit the JSON files. Every new factual record needs `url`, `publication_date`, `retrieved_on`, `findings`, `region`, `confidence` and `limitations`.
2. Bump `dataset_version` in `manifest.json` if the change is substantive.
3. Validate: `flask seed validate`. This reports every schema and cross-reference error: unknown keys, missing pathway kinds, scenario cycles, unreachable scenarios and non-https URLs.
4. Load: `flask seed load`. The load is idempotent and runs in one transaction. Records you removed are pruned; if a removed record is still referenced by a user session or report, the whole load is rolled back.
5. Run `pytest tests/test_research_dataset.py`.

Content IDs are deterministic UUIDv5 values derived from slugs or keys (`app/seed/ids.py`). Renaming a slug creates a new ID, and the old record is pruned. Do not rename slugs that live sessions use.
