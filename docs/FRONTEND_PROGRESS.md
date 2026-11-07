# FUTUREPRINT frontend progress record

**Owner:** Person 1 (Frontend developer and experience designer) · **Branch:** `ayieko` · **Remote:** not pushed (awaiting approval)
**Contributor identity:** `ayiekoderrick-8068 <ayiekoderrick@gmail.com>`. No AI co-author trailers. No history rewritten.

Every SHA below is copied from `git log`. Test results are from runs actually executed before each commit.

## Standing context
- The PRD, the Person 1 assignment, the approved API contract and the visual references (Pinterest, ZVÂC) are **not in the repository**. The frontend uses the provisional contract in [api-contract-provisional.md](api-contract-provisional.md). The only visual reference received is the approved landing image shared in chat.
- No teammate code or uncommitted teammate changes existed at any audit point. `origin/main` is still `9b37808`.
- Mock content is always labelled ("Mock mode" strip, `[Mock]` / `[Sample]` prefixes, example.org sources).

---

## Milestone 0: MVP baseline · `b2e4eef`
- **Built:** the four screens, typed API client, in-browser mock server, Vitest, React Testing Library and Playwright set-up.
- **Tests:** 33/33 unit; 5/5 Playwright.

## Milestone 1: Design foundation · `34165a8`
- **Design:** audit written ([DESIGN_AUDIT.md](DESIGN_AUDIT.md)); Bricolage Grotesque display paired with Figtree for the interface.
- **Implementation:** `Button`/`ButtonLink`, `PageHeader`, `Badge`/`SkillTag`, `Tabs`, `SearchInput`, `PathwayIcon`; navbar with a mobile menu disclosure; `scripts/shoot.mjs` for visual QA.
- **Bug found by screenshot:** 26px horizontal overflow at 360px before the web font loaded. Fixed with wordmark tracking and `shrink-0`.
- **Tests:** typecheck, lint, 33/33 unit.

## Sign-in / create account preview · `efc1994`
- **Design:** split-screen layout with a narrative panel listing planned account features, accessible tabs, and validation tied to fields with `aria-describedby`.
- **Honesty:** labelled "Design preview · accounts aren't live yet". No network call and no storage. "Continue as guest" is offered.
- **Visual fixes:** the scene overlapped the text on mobile, so it now sits in normal flow. The badge was stretching and "(coming soon)" was wrapping; both fixed.
- **Tests:** 38/38 unit, including "credentials are never sent or persisted".

## Milestone 2: Landing page · `665151f`, `67e55e4`
- **`665151f` (fix):** the first page load scrolled 126px past the header. A StrictMode double effect consumed a run-once flag. Found in a screenshot and confirmed with a scroll/focus probe.
- **`67e55e4`:** travellers on each pathway, foreground visitors, skyline and wind turbine; supporting copy updated to the brief; bubble taglines hidden below 640px (they were clipping).
- **Tests:** 38/38 unit; no overflow at 360/768/1440.

## Milestone 3: Occupation selection · `b4eb9e6`
- **Design:** occupations are arched doors onto a horizon with all three paths; the sun rises on hover (motion-safe only).
- **Implementation:** search that ignores accents, with a polite live result count and a no-match state; 2-column layout; heading set to "Which future would you like to explore?".
- **Tests:** 39/39 unit.

## Milestone 4: Scenario simulator · `279913d`
- **Design:** chapters instead of form steps; a "Your story so far" rail (sticky on desktop, collapsible on mobile) built only from choices the server recorded; decision cards with pathway icon, text label and a tinted selected state.
- **Interaction:** polite "Choice saved: '…'. On to chapter N." feedback; assertive stale-step notice; motion-safe slide between chapters.
- **Tests:** 39/39 unit; 5/5 Playwright, including axe WCAG 2.1 AA.

## Milestone 5: Futureprint report · `1147937`
- **Design:** keepsake header with pathway icon and generated date; chapter timeline; numbered evidence cards; suggestions in one full-width grid, each labelled with its category and its reason.
- **Print:** Print / Save as PDF; site chrome hidden; research panel made ink-friendly; source URLs printed; cards never split across pages. Verified with a Chromium print-media PDF render.
- **Bugs found by screenshot or print render:**
  - Suggestions left half the area empty.
  - `whileInView` would have printed unseen sections blank.
  - Source links were invisible in print.
- **Tests:** 40/40 unit.

## Milestone 6: Research interfaces · `000d27e`
- **Observatory (`/observatory`):** timeline grouped by year, industry toggles and search, with evidence-level and event-type labels plus a source on every event.
- **Task Scanner (`/occupations/:slug`):** task classifications shown with symbol and text, associated skills, limitations, and a "Simulate this occupation" button.
- **Methodology (`/methodology`):** principles plus evidence and task classes. Specifics belonging to Persons 3 and 5 are marked "to be completed".
- **Also:** site footer, scrolling for SPA hash links, provisional research endpoints documented.
- **Tests:** 46/46 unit.

## Milestone 7: Quality assurance · `ad83428`
- **Accessibility:** axe found colour-contrast failures on year headings and step numerals. Fixed by switching them to the lavender ink token.
- **Performance (measured):** Lighthouse "Slow 4G" profile (150ms round trip, 1.6 Mbps down) with 4× CPU slowdown and a cold cache.

  | Build | Runs (ms) | Median | Result |
  |---|---|---|---|
  | Before | 2024 / 2652 / 2232 | 2232ms | One run over the 2.5s budget |
  | After | 1608 / 1888 / 2216 | **1888ms** | All under budget |

  - **Fixes:** fonts no longer block rendering, and the Framer Motion features load lazily.
  - **Initial JS:** about 100 KB down to **81 KB gzipped** (budget is 250 KB).
- **New Playwright checks:** axe and no-overflow at 360px for the research and sign-in pages, the mobile menu, and the median page-load time over 3 runs.
- **Tests:** typecheck ✓, lint ✓, **46/46 unit**, **11/11 Playwright**.
- **Screenshots:** `client/e2e/screenshots/{mobile,tablet,desktop}-{1-portal,2-occupations,3-simulator,4-report}.png`

---

## Known issues
1. **API not confirmed.** All endpoints, including the research ones, are provisional (see the contract doc's questions for Persons 2–5).
2. **Research and recommendation content is placeholder.** Real findings, events, tasks and suggestion rules come from Persons 3 and 5.
3. **Fonts come from Google Fonts.** Self-hosting would remove a third-party request; that's a team decision (privacy and hosting).
4. **Screenshot capture can catch fades mid-way.** Reduced motion keeps short opacity fades, so some captures show elements at partial opacity. That's not a rendering defect.
5. **Not tested on real phones or in Firefox/Safari.** Playwright runs Chromium only.
6. **Lighthouse CLI not run.** Page load was measured with Chromium's performance APIs under Lighthouse's throttling profile.

## Next steps
1. Get the contract confirmed by Persons 2, 3 and 5, then update `src/types/api.ts` and switch off mocks (`VITE_USE_MOCKS=false`).
2. Connect to Person 2's running backend and re-run the Playwright suite against it.
3. Replace placeholder content with Person 4's scenarios and Person 3's research.
4. Optional milestone 8 (post-MVP design extensions), only after team sign-off.
