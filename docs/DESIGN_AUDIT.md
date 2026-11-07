# FUTUREPRINT frontend design audit

**Date:** 2026-11-07 · **Branch:** `ayieko` · **Audited build:** `b2e4eef`
**Method:** real Chromium screenshots at 360 / 768 / 1440 px (`client/e2e/screenshots/`).

## Repository state

- The only history is `9b37808` (initial commit, Chariey Eng.) and `b2e4eef` (frontend MVP, ayiekoderrick-8068). No teammate code, uncommitted changes or other remote branches exist.
- **Missing inputs:** the PRD, the Person 1 assignment, an approved API contract, the Pinterest references and the ZVÂC screenshots are not in the repository or the conversation. The frontend codes against `docs/api-contract-provisional.md`. The approved landing image (shared in chat) is the only visual reference.

## Findings

| #   | Area            | Issue                                                                                                                                                                                    | Severity                    | Fix (milestone)                                                                                |
| --- | --------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------- | ---------------------------------------------------------------------------------------------- |
| 1   | Typography      | One family (Figtree) does everything. Inner pages read as a generic SaaS product, with no editorial voice.                                                                               | High                        | Add a display face (Bricolage Grotesque) for headlines and keep Figtree for the interface (M1) |
| 2   | Navigation      | At 360px the header wraps to three lines and "My journey" sits on its own row. There is no mobile pattern.                                                                               | High                        | Mobile menu disclosure (M1)                                                                    |
| 3   | Consistency     | Buttons are ad-hoc class strings, and the Begin pill is restyled inline in two places.                                                                                                   | Medium                      | Shared `Button` / `ButtonLink` variants (M1)                                                   |
| 4   | Portal          | Supporting copy differs from the approved brief. The scene has no people, though the brief asks for a human-centred composition.                                                         | Medium                      | Updated copy and walking figures on the paths (M2)                                             |
| 5   | Occupations     | No search. The 4th card is orphaned on desktop. It reads like a job board, and the heading copy is outdated.                                                                             | Medium                      | Search, a "choose a door" card treatment and new copy (M3)                                     |
| 6   | Simulator       | Feels like a form, not a story: there's no sense of "the story so far", no visual identity per choice, no feedback after locking in, no step transition, and empty space below the fold. | **High (signature screen)** | Story rail of past choices, pathway icons, "choice saved" feedback and step transitions (M4)   |
| 7   | Report          | Suggestions render one card per row in a half-width column, leaving about 50% of the area empty. The header is flat, there's no journey visual, and nothing is print-friendly.           | High                        | Journey timeline, balanced suggestion grid, print stylesheet and a Print button (M5)           |
| 8   | Inner pages     | Flat ivory background with no link to the portal's atmosphere.                                                                                                                           | Low                         | Subtle horizon motif in page headers (M3–M5)                                                   |
| 9   | Pathway meaning | Pathways are shown by colour plus a text label. That passes, but icons would strengthen it.                                                                                              | Low                         | Pathway icons are shared across simulator, report and portal (M4)                              |

## What already works (keep)

- Brand colours as tokens. Pathway "ink" shades pass AA on ivory (5.9–6.7:1).
- axe WCAG 2.1 AA scans pass, with visible focus rings and native radio semantics in decision cards.
- Mock-mode strip, lazy routes, and about 100 KB gzipped initial JS.

## Design direction

"Exhibition rooms." Each screen is a room in the same landscape: the portal is the horizon, occupations are doors, the simulator is a path you walk, and the report is the keepsake you take home. Cut-paper shapes, a warm ivory paper ground, midnight for depth, and the three pathway colours as the only accents. Motion is limited to entrances, selection and step changes, and is disabled under `prefers-reduced-motion`.

### Type

- **Display:** Bricolage Grotesque (SIL OFL, Google Fonts). Characterful and editorial, close to the approved landing headline.
- **Interface:** Figtree (SIL OFL). Highly legible at small sizes.
- **Scale (px):** 12 eyebrow · 14 meta · 16 body · 18–20 lead · 24 / 30 / 36 / 48 / 60 / 72 headings. Line height 1.05–1.15 for display, 1.5–1.7 for body.

### Space and grid

Tailwind 4px scale; sections use 64/96 px vertical rhythm; `container-page` max 72rem with 16/24/32 px gutters; reading width ≤ 42rem.

### Components

`Button` (primary / accent / secondary / light), `PageHeader`, `Badge` / `SkillTag`, `Tabs`, `SearchInput`, `PathwayIcon`, `PublicNavbar` with mobile menu, plus the existing `DecisionCard`, `OccupationCard`, `ProgressSteps`, `ReportSection`, `SourceLink` and Loading / Error / Empty states.
