# Graph Report - ascent  (2026-08-08)

## Corpus Check
- 380 files · ~467,258 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 1831 nodes · 3965 edges · 180 communities (127 shown, 53 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 37 edges (avg confidence: 0.66)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `98cb2fe9`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- Analytics Engine
- Backup/Export Schema + ICS Export
- Roadmap Templates Registry
- Feedback Report Schema + Share Schema
- Import Validation & Corruption Detection
- Feedback Metadata & Rate Limiting
- E2E Test Suite
- Review Scheduling & Celebration State
- Package Dependencies
- Brand & Auth Marketing Panel
- Auth & Account Guards
- Changelog & Feature Badges
- UI Styling Rules (Alpenglow tokens)
- LocalStorage Adapter
- Share Card Canvas Rendering
- Component Library (avatar/empty state/skeleton/sidebar)
- Time Tracking & Daily Todo Panel
- Auth/Roadmap-Store Agent Rules
- Command Palette & Router
- Daily Todo Limits & Activity Log Store
- LocalStorage Keys & Filter Preferences
- Public API Docs
- Roadmap Store Agent Rules (multi-roadmap)
- Share/Delete Account Modals
- PWA Offline Cache Strategy
- Reminder Scheduling
- Guide & Changelog Drawer Components
- Root Docs (CLAUDE.md/AGENTS.md/ADR-001/ADR-007)
- CSP/SRI Security ADRs
- Chart Wrapper Component
- PWA Install & Theme Service
- Theme Lint Script
- App Bootstrap (main.js)
- Confirm Dialog & Sign-out Utils
- AI Import Corruption-Fix Agent Rules
- Hosting/Anonymous-User/Feedback ADRs
- Issue Templates & Docs Index
- Theme Service
- Graphify Skill References
- Guest Data Risk Nudge
- structuralVersion & Echo-Guard Agent Rules
- Responsive/Touch Rules & Workflow Skills
- PWA Manifest
- Icon System Agent Rules
- Product Rename Migration
- Brand Asset Generation Script
- Icon Lint Script
- Responsive Breakpoint ADR-006
- CI Workflow Jobs
- Backup Actions Tests
- Chart Wrapper Tests
- Storage Adapter Agent Rules
- Feedback Store Integration Tests
- Firebase Test Mocks
- Data Science Template
- Frontend Developer Template
- GenAI/Agentic AI Template
- Marketing Template
- Math Grade 12 Template
- Piano Template
- Tabs Component
- Backup Reminder Banner Tests
- Daily Todo Panel Tests
- Animation/Overflow Styling Rules
- Issue Tracker Sync Workflow
- Blank Template
- AI Import Test Fixtures
- main.js Tests
- Print Roadmap Tests
- SEO Meta Tests
- Sign-out Tests
- Verification Banner Tests
- Theme Lint Agent Rules
- Print/PDF Export Agent Rules
- Test Setup Helpers
- Manifest Tests
- Shared Roadmap View Tests
- Theme Bootstrap Tests
- Password Reset & Error Toast Rules
- Focus Trap Accessibility Rules
- Card Grid Layout Rules
- Safe-Area Inset Rules
- No-FOUC Theme Bootstrap Rules
- Sticky Layout & Modal Pattern Rules
- Firebase Config Example
- My Reports Tests
- Account Deletion Ordering Rule
- CSP connect-src Rule
- Guest Data Loss Messaging Rule
- Password Utility Module Rule
- SRI/CSP Lockstep Rule
- Button Action Label Rule
- Grammar/Mechanics Baseline Rule
- Plain Language Rule
- Vocabulary/Topics Rule
- Worked Before/After Examples Rule
- Resource URL Validation Rule
- Resources Filter Chip Rule
- Scroll-to-Phase Signal Rule
- 100dvh Fallback Rule
- Grid Track Minwidth Rule
- Accent Token Rule
- Active Roadmap Visibility Rule
- Sidebar Icon Stack Rule
- Icon-Only Sidebar Rule
- Modal Overlay Centering Rule
- No Inline Style Rule
- Onboarding Account Affordance Rule
- Feedback Widget Tests
- Screenshot Capture Test
- Contributing to Ascent
- Theming, layout, and responsive/touch conventions
- check-cache-version.mjs
- Issue template config (contact links)
- nextUp.js
- dev-server.mjs
- auth-security.md
- roadmap-store.md
- notificationBell.js
- csp.test.js
- Security Policy
- reminderScheduler.js
- dom.js
- migration.js
- topbar.js
- progressDigestBanner.test.js
- shareStore.test.js
- feedback.test.js
- MockIntersectionObserver
- globalTopicSearch.test.js
- roadmapComparisonModal.js
- completionCelebration.test.js
- customRoadmap.test.js
- dailyTodoPanel.js
- customRoadmapRace.test.js
- ADR-002: CSP + SRI security hardening
- globalTopicSearch.js
- createSelect
- dashboard.js
- CLAUDE.md (root agent instructions)
- backupReminderBanner.js
- typeScaleFloor.test.js
- freshProgress
- flatContentSurfaces.test.js
- roadmapStore.test.js
- icsExport.js
- guestDataRisk.js
- markdownExport.js
- celebrationShownStore.js
- uiPreferences.js
- icons.js
- decorativeIcon.js
- dashboard.test.js
- authCleanup.js
- customRoadmapIcon.js
- itemPanel.js

## God Nodes (most connected - your core abstractions)
1. `el()` - 198 edges
2. `createIcon()` - 66 edges
3. `KEYS` - 38 edges
4. `showToast()` - 34 edges
5. `attachFocusTrap()` - 30 edges
6. `test` - 29 edges
7. `createBrandMark()` - 26 edges
8. `FirebaseAdapter` - 25 edges
9. `navigate()` - 25 edges
10. `withTimeout()` - 22 edges

## Surprising Connections (you probably didn't know these)
- `favicon.svg — Ascent brand mark (gradient triangle icon)` --references--> `index.html (CSP meta tag, SRI modulepreload, viewport meta)`  [EXTRACTED]
  public/favicon.svg → docs/adr/ADR-002-csp-sri-security.md
- `Brand rules — createBrandMark()/createBrandWordmark()/createBrandIcon()` --conceptually_related_to--> `favicon.svg — Ascent brand mark (gradient triangle icon)`  [INFERRED]
  CLAUDE.md → public/favicon.svg
- `initReminderScheduler()` --indirect_call--> `todo()`  [INFERRED]
  src/services/reminderScheduler.js → tests/unit/icsExport.test.js
- `openCreateRoadmapModal()` --indirect_call--> `items()`  [INFERRED]
  src/ui/components/importRoadmapModal.js → tests/unit/analytics/projection.test.js
- `Issue template config (contact links)` --references--> `CLAUDE.md (root agent instructions)`  [EXTRACTED]
  .github/ISSUE_TEMPLATE/config.yml → CLAUDE.md

## Import Cycles
- 1-file cycle: `src/data/changelog.js -> src/data/changelog.js`

## Hyperedges (group relationships)
- **Sign-Out Data-Safety Flow** — claude_rules_auth_security_confirm_and_sign_out, claude_rules_roadmap_store_flush_dirty_stores, claude_rules_roadmap_store_dirty_flush_before_signout, claude_rules_roadmap_store_confirm_sign_out_despite_failed_flush, claude_rules_auth_security_sign_out_with_cleanup [INFERRED 0.85]
- **Portal Pattern for Floating Positioned Elements** — claude_rules_ui_styling_select_portal_pattern, claude_rules_ui_styling_dropdown_portal, claude_rules_ui_styling_tooltip_portal, claude_rules_ui_styling_bucketed_bar_chart [INFERRED 0.85]
- **AI-Import Validation/Sanitization Pipeline** — claude_rules_roadmap_store_validate_import_text, claude_rules_roadmap_store_adapt_import_to_roadmap, claude_rules_roadmap_store_sanitize_resources, claude_rules_roadmap_store_looks_corrupted, claude_rules_roadmap_store_build_import_fix_prompt [INFERRED 0.95]
- **Mandatory docs-sync convention across issue/PR templates and CI** — changelog_md, docs_architecture, claude_md, agents_md, docs_api, github_workflows_ci_pr_checklist_job, github_pull_request_template [EXTRACTED 1.00]
- **CSP allowlist pattern applied consistently across CDN/SDK exceptions** — docs_adr_adr_002_csp_sri_security, docs_adr_adr_002_cdn_loading_exceptions, docs_adr_adr_002_apis_google_com_allowlist, index_html, src_ui_components_chartwrapper [EXTRACTED 1.00]
- **Firebase Hosting deploy pipeline (config injection, secrets, preview channels)** — github_workflows_deploy, docs_adr_adr_003_firebase_hosting_platform, docs_adr_adr_003_cache_strategy_table, github_workflows_ci_security_job [INFERRED 0.85]
- **AI-import prompt → validate → adapt pipeline** — docs_api_importprompt, docs_api_importvalidator, docs_api_schemaadapter [INFERRED 0.85]
- **Backup export/validate/restore pipeline** — docs_api_backupschema, docs_api_backupvalidator, docs_api_importbackupmodal [INFERRED 0.80]
- **Considered monetization model options** — concept_monetization_freemium, concept_monetization_subscription, concept_monetization_one_time_purchase [EXTRACTED 1.00]

## Communities (180 total, 53 thin omitted)

### Community 0 - "Analytics Engine"
Cohesion: 0.23
Nodes (15): createSkeletonCard(), createSkeletonText(), buildChrome(), computePhaseCounts(), createProgressBar(), formatPublishedDate(), getShareIdFromRoute(), groupItemsByPhaseSection() (+7 more)

### Community 1 - "Backup/Export Schema + ICS Export"
Cohesion: 0.15
Nodes (25): RFC-5322, authErrorMessage(), createAuthMarketingPanel(), authShell(), createNotificationBadge(), el(), buildSectionRows(), renderPhaseCard() (+17 more)

### Community 2 - "Roadmap Templates Registry"
Cohesion: 0.11
Nodes (22): applyCrossRoadmapCompletionDelta(), applyRemoteSnapshot(), backfillLegacyOnboardingMeta(), buildCrossRoadmapDonePatch(), completionDelta(), fetchColdTemplateBase(), fetchLegacyRoadmapSafely(), hasRealProgress() (+14 more)

### Community 3 - "Feedback Report Schema + Share Schema"
Cohesion: 0.07
Nodes (28): bugTypeFields(), buildReportPayload(), featureTypeFields(), feedbackTypeFields(), isNonEmptyString(), REPORT_TYPES, SEVERITIES, typeSpecificFields() (+20 more)

### Community 4 - "Import Validation & Corruption Detection"
Cohesion: 0.05
Nodes (55): ADR-008: Backup export/import schema versioning strategy, Exact-match-or-reject schema versioning (EXPORT_SCHEMA_VERSION), activityLog day-count map vs item.completedAt distinction, ADR-009: Progress analytics data model (completedAt vs activityLog), buildEffectiveActivityLog() backfill for pre-existing history, onCompletionToggle(delta) dependency-injected hook, collectItemTitles(), CORRUPTION_MARKERS (+47 more)

### Community 5 - "Feedback Metadata & Rate Limiting"
Cohesion: 0.25
Nodes (5): app, auth, inResetView(), setup(), setup()

### Community 7 - "Review Scheduling & Celebration State"
Cohesion: 0.06
Nodes (57): buildDerivedLogFromItems(), buildEffectiveActivityLog(), computeAnalytics(), computeOverview(), computePhaseBreakdown(), computePriorityBreakdown(), effectiveCompletedAt(), ADR-0009 (+49 more)

### Community 8 - "Package Dependencies"
Cohesion: 0.11
Nodes (19): @axe-core/playwright, eslint, @eslint/js, firebase-tools, globals, jsdom, devDependencies, @axe-core/playwright (+11 more)

### Community 9 - "Brand & Auth Marketing Panel"
Cohesion: 0.15
Nodes (21): isInstallable(), listeners, onInstallabilityChange(), promptInstall(), getAnimationsOff(), setAnimationsOff(), setTextSize(), openDeleteAccountModal() (+13 more)

### Community 10 - "Auth & Account Guards"
Cohesion: 0.18
Nodes (11): determineOnboardingAndActiveRoadmap(), fetchStoredBlankRoadmap(), freshStateForNewUid(), genId(), migrateLegacyBlankTemplateIfNeeded(), newShapeOnboardingState(), persistBlankMigrationToFirebase(), readLocalRoadmaps() (+3 more)

### Community 11 - "Changelog & Feature Badges"
Cohesion: 0.33
Nodes (6): ADR-005: Anonymous Firebase Auth user lifecycle, Delete anonymous Auth user + data on unlinked sign-out, Client-side feedback rate limiting (localStorage timestamp log), ADR-010: In-app feedback storage (Firebase write-only reports/), reports/{reportId} write-only, creation-only Firebase path, firebase/database.rules.json

### Community 12 - "UI Styling Rules (Alpenglow tokens)"
Cohesion: 0.06
Nodes (33): --accent-lime Token Family (Phase A), Auth Marketing Panel Radial-Glow Redesign, .bg-grid-glow, Brand Mark Kept Untouched (Product Identity), .btn-cta, createBucketedBarChart() (chartWrapper.js, Phase B), .card-arrow-badge (Phase B), createChartLegend() (Phase B) (+25 more)

### Community 14 - "Share Card Canvas Rendering"
Cohesion: 0.08
Nodes (43): openModal(), drawActivitySquares(), drawBackground(), drawBadgeGlyph(), drawBadgeHeadline(), drawBadgeLabel(), drawDate(), drawHeaderRule() (+35 more)

### Community 15 - "Component Library (avatar/empty state/skeleton/sidebar)"
Cohesion: 0.06
Nodes (37): DEVELOPER_PROFILE, activityLogStore, app, dailyTodoStore, guardApp(), lazyGuard(), NO_UID_SEEN_YET, store (+29 more)

### Community 16 - "Time Tracking & Daily Todo Panel"
Cohesion: 0.60
Nodes (4): collectCurrentMetadata(), collectMetadata(), parseBrowser(), parseOs()

### Community 17 - "Auth/Roadmap-Store Agent Rules"
Cohesion: 0.09
Nodes (18): Anonymous Firebase Auth User Cleanup (issue #24), confirmAndSignOut(), signOutWithCleanup(), Manual 'Start Truly Blank' Retirement (issue #100), 'blank' Template Retirement & Migration (issue #4 follow-up), createCustomRoadmap(), Daily Todo Nav Badge on dashboard.js, Custom Roadmap IDs (issue #4) (+10 more)

### Community 18 - "Command Palette & Router"
Cohesion: 0.17
Nodes (20): exportFileBaseName(), diffBackupItems(), mergeButtonLabel(), openImportBackupModal(), summarySentence(), ensureRoot(), showToast(), createVerificationBanner() (+12 more)

### Community 19 - "Daily Todo Limits & Activity Log Store"
Cohesion: 0.17
Nodes (11): 0. Source of truth, 1. Identity, 2. Color tokens (the only colors allowed), 3. Type scale, 4. Structure — radius, depth, and grid, 5. Components, 6. Interaction states, 7. Motion (+3 more)

### Community 20 - "LocalStorage Keys & Filter Preferences"
Cohesion: 0.12
Nodes (27): buildCta(), buildFeatures(), buildFooter(), buildHero(), buildHeroMock(), buildMiniHeatmap(), buildMockCheckIcon(), buildNav() (+19 more)

### Community 21 - "Public API Docs"
Cohesion: 0.16
Nodes (20): createActivityLogStore() — activityLogStore.js, computeAnalytics() and analytics engine — src/core/analytics/, backupSchema.js — backup export format, backupValidator.js — backup JSON validation, changelog.js / changelog.json — What's New data, chartWrapper.js — lazy Chart.js loader, createRoadmapStore() — roadmapStore.js, featureBadge.js / core/changelog/featureBadge.js — 'New' pill eligibility (+12 more)

### Community 22 - "Roadmap Store Agent Rules (multi-roadmap)"
Cohesion: 0.12
Nodes (18): Realtime Database $other Catch-All Constraint, Server-Side Data Caps (issue #122), sharedRoadmaps/{shareId} Public-Read Exception (issue #131), favoriteRoadmapIds (issue #177), fetchTemplateData Sequential-Prerequisite Fix, Flush-Before-Switch Guard, hiddenTemplateIds Per-User Hidden Templates, Multi-Roadmap Support (issue #58) (+10 more)

### Community 23 - "Share/Delete Account Modals"
Cohesion: 0.15
Nodes (13): scripts, check:cache-version, dev, generate:brand-assets, lint, lint:fix, start, test (+5 more)

### Community 24 - "PWA Offline Cache Strategy"
Cohesion: 0.17
Nodes (15): apis.google.com / frame-src allowlist entry (issue #168, gapi cross-tab auth iframe), Background sync rejected (Firebase SDK bypasses service worker fetch), Cache-first strategy for static assets, Network-first with stale-cache fallback for Firebase requests, ADR-011: PWA offline caching strategy, cacheFirst(), FIREBASE_API_HOSTS, isFirebaseApiRequest() (+7 more)

### Community 25 - "Reminder Scheduling"
Cohesion: 0.29
Nodes (7): ICONS, iconSvg(), VALUE_PROPS, createProgressRing(), iconSvg(), svgEl(), svgIcon()

### Community 26 - "Guide & Changelog Drawer Components"
Cohesion: 0.60
Nodes (4): buildSeedItems(), PHASES, RESOURCE_LIBRARY, TOPIC_RESOURCES

### Community 27 - "Root Docs (CLAUDE.md/AGENTS.md/ADR-001/ADR-007)"
Cohesion: 0.47
Nodes (6): buildSeedItems(), getLegacyBlankTemplateData(), getTemplate(), getTemplatePhases(), LOADERS, TEMPLATES

### Community 28 - "CSP/SRI Security ADRs"
Cohesion: 0.33
Nodes (3): listenMyReports, submitReport, USER

### Community 29 - "Chart Wrapper Component"
Cohesion: 0.22
Nodes (7): get, off, onValue, ref, remove, set, update

### Community 30 - "PWA Install & Theme Service"
Cohesion: 0.17
Nodes (11): bugs, url, description, license, name, private, repository, type (+3 more)

### Community 31 - "Theme Lint Script"
Cohesion: 0.25
Nodes (13): APP_CSS_PATH, BUTTON_COLOR_ALLOWLIST, classHasExplicitColor(), findColorLiteralViolations(), findCustomButtonClasses(), findMissingButtonColors(), findRootBlockRanges(), isInsideAnyRange() (+5 more)

### Community 32 - "App Bootstrap (main.js)"
Cohesion: 0.14
Nodes (20): createBottomNav(), NAV_ITEMS, createGuestBanner(), createGuestDataRiskNudge(), renderDashboard(), buildHeroStatement(), dominantPriorityFor(), formatLongDate() (+12 more)

### Community 33 - "Confirm Dialog & Sign-out Utils"
Cohesion: 0.23
Nodes (6): KEYS, verifyDismissedKey(), readDefaultFilterPreference(), fakeStore(), freshSettings(), freshSidebar()

### Community 34 - "AI Import Corruption-Fix Agent Rules"
Cohesion: 0.17
Nodes (11): adaptImportToRoadmap(), AI-Assisted Roadmap Creation (issues #4/#64/#100), ChatGPT Corruption Confirmed via Real Payload (issue #121 item 1), Corruption Copy-Guidance Reversal (issue #121 item 1 follow-up), Cross-Provider/Edge-Case Test Matrix (issue #121 item 2), droppedResourceCount Signal (issue #121 item 3), looksCorrupted() Corrupted-Text Detection (issue #100), Malformed Resource URL / Priority Casing Fix (issue #100) (+3 more)

### Community 35 - "Hosting/Anonymous-User/Feedback ADRs"
Cohesion: 0.21
Nodes (9): canSubmit(), getSubmitLog(), msUntilNextSubmit(), recordSubmit(), buildFieldInputAttrs(), createField(), createSystemInfoCheckbox(), REPORT_TYPE_META (+1 more)

### Community 36 - "Issue Templates & Docs Index"
Cohesion: 0.29
Nodes (9): docs/api.md (public store/service contracts), Bug report issue template, Chore/Refactor issue template, Documentation issue template, Feature request issue template, PR template, Issue #122 — server-side Firebase data caps, Issue #155 v2 redefinition — lime/near-black design pass (+1 more)

### Community 37 - "Theme Service"
Cohesion: 0.17
Nodes (15): RFC-4180, buildRoadmapCsv(), buildRoadmapExport(), CSV_COLUMNS, csvField(), toExportItem(), isNonEmptyString(), isValidBackupTitle() (+7 more)

### Community 38 - "Graphify Skill References"
Cohesion: 0.24
Nodes (10): graphify Skill Pointer, graphify add-watch Reference, graphify exports Reference, graphify extraction-spec Reference, graphify github-and-merge Reference, graphify hooks Reference, graphify query Reference, graphify transcribe Reference (+2 more)

### Community 39 - "Guest Data Risk Nudge"
Cohesion: 0.20
Nodes (10): keywords, career, data-science, firebase, frontend, genai, java, learning-tracker (+2 more)

### Community 40 - "structuralVersion & Echo-Guard Agent Rules"
Cohesion: 0.22
Nodes (8): item.completedViaTodoAt Field, Never Apply Remote Snapshot While Dirty (issue #58 hardening), Firebase Echo Guard (stableStringify), item.notes Personal Notes (issue #15), Linking Roadmap Topic to Daily Todo (issue #56 follow-up), roadmapStore.setItemDoneInTemplate(), structuralVersion Counter, Undoing a Linked Todo / Soft-Delete Edge Case (issue #56 follow-up)

### Community 41 - "Responsive/Touch Rules & Workflow Skills"
Cohesion: 0.28
Nodes (9): iOS Auto-Zoom 16px Font Fix (issue #36), Six-Tier Responsive Breakpoint Scale (issue #36), Touch vs Hover Capability Detection (issue #36), after-merge Skill, open-pr Skill, parallel-work Skill, raise-issue Skill, start-issue Skill (+1 more)

### Community 42 - "PWA Manifest"
Cohesion: 0.22
Nodes (8): background_color, description, display, icons, name, short_name, start_url, theme_color

### Community 43 - "Icon System Agent Rules"
Cohesion: 0.25
Nodes (8): Onboarding Card Delete vs Hide Affordance (issue #61), pickCustomRoadmapIcon(), createDecorativeIcon() (decorativeIcon.js, issue #136 Phase 2), Icon System (issue #107), icons.js createIcon() Factory, scripts/lint-icons.mjs, Same-Row Icon-Button Size Consistency, svg.js (svgEl/svgIcon)

### Community 44 - "Product Rename Migration"
Cohesion: 0.16
Nodes (14): Firebase Hosting security headers (HSTS, X-Frame-Options, etc.), Hosting cache-control strategy (index.html no-cache, src/** immutable), Cloudflare Pages migration path (fallback if bandwidth exceeded), ADR-003: Firebase Hosting as production platform, docs/architecture.md (living architecture guide + Build Log), firebase.json (Hosting headers + emulator config), CI — PR Quality Gate workflow, CI Lighthouse performance budget job (+6 more)

### Community 45 - "Brand Asset Generation Script"
Cohesion: 0.29
Nodes (7): __dirname, faviconSvg, ICONS, main(), publicDir, root, sizedSvg()

### Community 46 - "Icon Lint Script"
Cohesion: 0.43
Nodes (7): EXEMPT_FILES, findEmojiViolations(), main(), ROOT, SCAN_DIRS, stripJsComments(), walk()

### Community 47 - "Responsive Breakpoint ADR-006"
Cohesion: 0.50
Nodes (5): Freemium monetization option, One-time purchase monetization option (recommended), Subscription monetization option, Stripe payment provider dependency, Monetization model decision (Issue #135)

### Community 49 - "Backup Actions Tests"
Cohesion: 0.29
Nodes (5): downloadTextFile, markBackupTaken, openImportBackupModal, readFileAsText, showToast

### Community 51 - "Storage Adapter Agent Rules"
Cohesion: 0.33
Nodes (6): FirebaseAdapter, Google Drive Sync / Sign-In Dropped (issue #5/#71), LocalStorageAdapter (Tested, Not Wired In), Storage Adapter Abstraction (issue #5 part 1), StorageAdapter Base Contract, withTimeout() (15s Firebase Call Timeout)

### Community 52 - "Feedback Store Integration Tests"
Cohesion: 0.33
Nodes (5): off, onValue, push, ref, update

### Community 53 - "Firebase Test Mocks"
Cohesion: 0.33
Nodes (4): auth, authApi, dbApi, firebaseClock

### Community 55 - "Data Science Template"
Cohesion: 0.40
Nodes (3): PHASES, RESOURCE_LIBRARY, TOPIC_RESOURCES

### Community 56 - "Frontend Developer Template"
Cohesion: 0.40
Nodes (3): PHASES, RESOURCE_LIBRARY, TOPIC_RESOURCES

### Community 57 - "GenAI/Agentic AI Template"
Cohesion: 0.40
Nodes (3): PHASES, RESOURCE_LIBRARY, TOPIC_RESOURCES

### Community 58 - "Marketing Template"
Cohesion: 0.40
Nodes (3): PHASES, RESOURCE_LIBRARY, TOPIC_RESOURCES

### Community 59 - "Math Grade 12 Template"
Cohesion: 0.40
Nodes (3): PHASES, RESOURCE_LIBRARY, TOPIC_RESOURCES

### Community 60 - "Piano Template"
Cohesion: 0.40
Nodes (3): PHASES, RESOURCE_LIBRARY, TOPIC_RESOURCES

### Community 61 - "Tabs Component"
Cohesion: 0.15
Nodes (19): onThemeChange(), createDropdown(), openFeedbackModal(), createIcon(), openImportBackupDropZoneModal(), openMyReports(), buildAccountMenu(), createSidebar() (+11 more)

### Community 62 - "Backup Reminder Banner Tests"
Cohesion: 0.40
Nodes (3): exportBackupJson, guestUser, user

### Community 63 - "Daily Todo Panel Tests"
Cohesion: 0.16
Nodes (24): args, buildFfmpegArgs(), buildStepList(), captureAnimatedFrames(), CHORD_PROGRESSION_HZ, __dirname, fadeOutCurrentPage(), installOverlay() (+16 more)

### Community 64 - "Animation/Overflow Styling Rules"
Cohesion: 0.50
Nodes (4): triggerConfetti() One-Shot Animation Pattern (issue #181), overflow:hidden Hijacks position:sticky Context, .phase-body-animating Fix, Sticky Section Headers Reuse --topbar-h

### Community 65 - "Issue Tracker Sync Workflow"
Cohesion: 0.23
Nodes (17): ADR-0002, axisOptions(), barValueLabelsPlugin, BUCKET_FALLBACKS, BUCKET_LEGEND, BUCKET_TOKENS, bucketColor(), createBarChart() (+9 more)

### Community 68 - "main.js Tests"
Cohesion: 0.33
Nodes (5): renderDashboard, renderOnboarding, renderSignIn, roadmapStoreSetUser, signInCleanup

### Community 72 - "Verification Banner Tests"
Cohesion: 0.50
Nodes (3): emailUser, guestUser, verifiedUser

### Community 73 - "Theme Lint Agent Rules"
Cohesion: 0.67
Nodes (3): Custom Interactive Element Must Set color/font (issue #116), scripts/lint-theme.mjs, Literal Color Requires /* intentional */ Comment (issue #116)

### Community 74 - "Print/PDF Export Agent Rules"
Cohesion: 0.67
Nodes (3): Print Fixed-Position Header/Footer Pattern, Print Stylesheet Literal Priority Colors, Branded Print/PDF Export (issue #160)

### Community 77 - "Shared Roadmap View Tests"
Cohesion: 0.20
Nodes (5): CONTRAST_FALSE_POSITIVE_SELECTORS, runAxe(), seriousOrCritical(), openRowOverflowMenu(), openItemPanelForRow()

### Community 119 - "Feedback Widget Tests"
Cohesion: 0.25
Nodes (7): brandGlyph(), createBrandIcon(), createBrandMark(), createBrandWordmark(), buildPopover(), buildWelcomeOverlay(), startTour()

### Community 124 - "Contributing to Ascent"
Cohesion: 0.07
Nodes (23): Branch naming, Code conventions, Commit message style, Contributing to Ascent, Local setup, Pull requests, Reporting bugs and requesting features, ADR-012: In-app AI roadmap generation — a server-side proxy to a real LLM API (+15 more)

### Community 125 - "Theming, layout, and responsive/touch conventions"
Cohesion: 0.25
Nodes (7): A "Filter" panel reuses `itemPanel.js`'s bottom-sheet pattern instead of a new overlay component (`dashboard.js`, issue #487), Branded print/PDF export (issue #160, restructured onto `<thead>`/`<tfoot>` in a follow-up), First-time feature tour — spotlight/portal/focus-trap convention (`featureTour.js`, issue #17), Theming, layout, and responsive/touch conventions, Visual design language (issue #155, ZeBeyond direction), Visual design language v2 (issue #155 redefinition — lime/near-black direction), Visual design language v3 — "Alpenglow" (issue #206, supersedes v2 above)

### Community 126 - "check-cache-version.mjs"
Cohesion: 0.33
Nodes (6): base, changedFiles, git(), resolveBase(), srcChanged, swVersionChanged

### Community 127 - "Issue template config (contact links)"
Cohesion: 0.50
Nodes (4): Issue template config (contact links), Sync master tracker workflow, Tracker-sync concurrency group fix (issue #56 race condition), Master Tracker issue #11

### Community 128 - "nextUp.js"
Cohesion: 0.43
Nodes (4): pickTargetPhase(), PRIORITY_RANK, priorityRank(), selectNextUpTopics()

### Community 129 - "dev-server.mjs"
Cohesion: 0.40
Nodes (3): MIME_TYPES, ROOT, server

### Community 132 - "notificationBell.js"
Cohesion: 0.17
Nodes (19): isFeatureBadgeActive(), getUnseenEntries(), hasUnseenEntries(), isNewerVersion(), VALID_ENTRY_TYPES, validateChangelog(), APP_VERSION, CHANGELOG (+11 more)

### Community 135 - "csp.test.js"
Cohesion: 0.40
Nodes (3): cspMatch, indexHtml, indexHtmlPath

### Community 136 - "Security Policy"
Cohesion: 0.33
Nodes (5): Reporting a vulnerability, Scope, Security Policy, Supported versions, What's already in place

### Community 138 - "reminderScheduler.js"
Cohesion: 0.24
Nodes (12): computeReminderFireAt(), shouldScheduleReminder(), cancelTimer(), clearAllTimers(), disableReminders(), enableReminders(), fireNotification(), initReminderScheduler() (+4 more)

### Community 139 - "dom.js"
Cohesion: 0.14
Nodes (16): listenMyReports(), authApi, openBuildYourOwnGuide(), confirmDialog(), attachFocusTrap(), buildMyReportsView(), buildReportRow(), formatDate() (+8 more)

### Community 140 - "migration.js"
Cohesion: 0.21
Nodes (9): Brand rules — createBrandMark()/createBrandWordmark()/createBrandIcon(), themeBootstrap.js external-script extraction rationale (no-inline-script CSP), Brand component consolidation (createBrandMark/createBrandIcon/createBrandWordmark), localStorage key migration (switchprep-* to ascent-*), ADR-004: Product rename to Ascent, favicon.svg — Ascent brand mark (gradient triangle icon), migrateLocalStorageKeys(), RENAMES (+1 more)

### Community 141 - "topbar.js"
Cohesion: 0.11
Nodes (20): createAvatar(), initialsFor(), bindCommandPaletteShortcut(), fuzzyMatch(), openCommandPalette(), createNotificationBell(), buildResultSubtitle(), buildTopicResultItem() (+12 more)

### Community 143 - "shareStore.test.js"
Cohesion: 0.40
Nodes (3): get, ref, update

### Community 149 - "globalTopicSearch.test.js"
Cohesion: 0.83
Nodes (3): createCustomRoadmapViaImport(), dismissTourIfPresent(), minimalImportJson()

### Community 152 - "roadmapComparisonModal.js"
Cohesion: 0.18
Nodes (17): buildComparisonSummary(), compareRoadmapTopics(), comparisonKey(), groupComparisonByPhase(), matchStatus(), normalizeKeyPart(), toComparableList(), toComparisonRow() (+9 more)

### Community 156 - "dailyTodoPanel.js"
Cohesion: 0.21
Nodes (10): clampDurationMs(), accumulateElapsed(), computeElapsedSeconds(), formatTimeSpent(), buildRowMeta(), resolveRoadmapName(), formatRemaining(), isExpired() (+2 more)

### Community 158 - "ADR-002: CSP + SRI security hardening"
Cohesion: 0.24
Nodes (11): CDN loading exceptions (Chart.js jsdelivr, no SRI on dynamic import), Content Security Policy (CSP), ADR-002: CSP + SRI security hardening, Firebase SDK upgrade process (sync import URL + SRI hash x3), Subresource Integrity (SRI), index.html (CSP meta tag, SRI modulepreload, viewport meta), index.html Content-Security-Policy meta tag, WebApplication JSON-LD structured data block (+3 more)

### Community 159 - "globalTopicSearch.js"
Cohesion: 0.31
Nodes (8): bestFieldRank(), buildMatchEntry(), buildSnippet(), FIELD_MATCHERS, FIELD_PRIORITY, matchedFields(), matchRoadmapItems(), searchTopicsAcrossRoadmaps()

### Community 160 - "createSelect"
Cohesion: 0.14
Nodes (6): DURATION_PRESETS, openAddToDailyTodoModal(), openDailyTodoGuide(), createSelect(), mount(), OPTIONS

### Community 161 - "dashboard.js"
Cohesion: 0.10
Nodes (24): getReviewDueItems(), groupReviewDueItemsByTag(), isReviewDue(), animatePhaseBody(), applySectionPlan(), collectAllMountedRows(), collectPrunableRowsFromBottom(), collectPrunableRowsFromTop() (+16 more)

### Community 162 - "CLAUDE.md (root agent instructions)"
Cohesion: 0.11
Nodes (23): AGENTS.md (pointer file), CLAUDE.md (root agent instructions), confirmDialog() — styled confirm/cancel modal, el(tag, attrs, children) — DOM-construction helper, GitHub issue label taxonomy (type/priority/domain), ADR-001: Current flat module architecture (pre-restructure baseline), Target folder restructure (core/services/ui/data/utils/styles), 100vh + 100dvh progressive-enhancement pairing (+15 more)

### Community 163 - "backupReminderBanner.js"
Cohesion: 0.41
Nodes (9): backupFirstSeenAtKey(), backupReminderDismissedAtKey(), lastBackupAtKey(), createBackupReminderBanner(), dismissBackupReminder(), ensureBackupFirstSeenAt(), markBackupTaken(), readTimestamp() (+1 more)

### Community 164 - "typeScaleFloor.test.js"
Cohesion: 0.33
Nodes (3): css, cssPath, SUB_16PX_TOKENS

### Community 165 - "freshProgress"
Cohesion: 0.83
Nodes (3): fakeActivityLogStore(), fakeStore(), freshProgress()

### Community 167 - "roadmapStore.test.js"
Cohesion: 0.14
Nodes (10): MAX_CUSTOM_ROADMAP_TITLE_LENGTH, createActivityLogStore(), createDailyTodoStore(), createRoadmapStore(), isCustomRoadmapId(), migrateLocalRoadmapsShape(), getStorageAdapter(), setupCustomRoadmap() (+2 more)

### Community 168 - "icsExport.js"
Cohesion: 0.38
Nodes (8): RFC-5545, buildEvent(), buildTodosIcs(), escapeIcsText(), foldLine(), formatIcsDate(), pad(), todo()

### Community 169 - "guestDataRisk.js"
Cohesion: 0.43
Nodes (4): guestRiskNudgeShownKey(), markGuestRiskNudgeShown(), shouldShowGuestRiskNudge(), freshNudge()

### Community 170 - "markdownExport.js"
Cohesion: 0.50
Nodes (5): buildItemLines(), buildResourceLines(), buildRoadmapMarkdown(), escapeMarkdown(), groupByPhaseAndSection()

### Community 171 - "celebrationShownStore.js"
Cohesion: 0.58
Nodes (7): hasShownPhaseCelebration(), hasShownRoadmapCelebration(), markPhaseCelebrationShown(), markRoadmapCelebrationShown(), read(), write(), celebrationShownKey()

### Community 172 - "uiPreferences.js"
Cohesion: 0.25
Nodes (5): animationsOffSubscribers, getTextSize(), TEXT_SIZES, textSizeSubscribers, freshPrefs()

### Community 173 - "icons.js"
Cohesion: 0.17
Nodes (9): openChangelogDrawer(), renderEntryItem(), renderVersionGroup(), TYPE_LABELS, createEmptyState(), ICON_SHAPES, VALID_SIZES, ENTRIES (+1 more)

### Community 174 - "decorativeIcon.js"
Cohesion: 0.28
Nodes (7): createDecorativeIcon(), createIconPicker(), DECORATIVE_ICON_SHAPES, openIconPickerModal(), VALID_SIZES, renderInlineResources(), buildTemplateStrip()

### Community 175 - "dashboard.test.js"
Cohesion: 0.33
Nodes (4): build(), buildWrapper(), format(), mount()

### Community 178 - "customRoadmapIcon.js"
Cohesion: 0.43
Nodes (6): CUSTOM_ROADMAP_ICONS, getCustomRoadmapIconOverride(), pickCustomRoadmapIcon(), readOverrides(), resolveCustomRoadmapIcon(), setCustomRoadmapIconOverride()

### Community 181 - "itemPanel.js"
Cohesion: 0.20
Nodes (12): checkResourceLink(), LINK_CHECK_MESSAGES, LINK_CHECK_STATUS, openItemPanel(), detectLinkType(), LINK_TYPE_META, LINK_TYPES, PRIORITY_LABELS (+4 more)

## Ambiguous Edges - Review These
- `sharedRoadmaps/{shareId} Public-Read Exception (issue #131)` → `favoriteRoadmapIds (issue #177)`  [AMBIGUOUS]
  .claude/rules/auth-security.md · relation: references
- `ADR-006: Responsive breakpoint scale and touch/hover detection strategy` → `ADR-007: Agent memory architecture (split CLAUDE.md into rules + skills)`  [AMBIGUOUS]
  docs/adr/ADR-006-responsive-breakpoints-touch-hover.md · relation: conceptually_related_to

## Knowledge Gaps
- **332 isolated node(s):** `name`, `version`, `private`, `license`, `type` (+327 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **53 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **What is the exact relationship between `sharedRoadmaps/{shareId} Public-Read Exception (issue #131)` and `favoriteRoadmapIds (issue #177)`?**
  _Edge tagged AMBIGUOUS (relation: references) - confidence is low._
- **What is the exact relationship between `ADR-006: Responsive breakpoint scale and touch/hover detection strategy` and `ADR-007: Agent memory architecture (split CLAUDE.md into rules + skills)`?**
  _Edge tagged AMBIGUOUS (relation: conceptually_related_to) - confidence is low._
- **Why does `el()` connect `Backup/Export Schema + ICS Export` to `Analytics Engine`, `notificationBell.js`, `Import Validation & Corruption Detection`, `Review Scheduling & Celebration State`, `Brand & Auth Marketing Panel`, `reminderScheduler.js`, `dom.js`, `topbar.js`, `Share Card Canvas Rendering`, `Component Library (avatar/empty state/skeleton/sidebar)`, `Command Palette & Router`, `LocalStorage Keys & Filter Preferences`, `roadmapComparisonModal.js`, `Reminder Scheduling`, `dailyTodoPanel.js`, `createSelect`, `App Bootstrap (main.js)`, `dashboard.js`, `backupReminderBanner.js`, `Hosting/Anonymous-User/Feedback ADRs`, `icons.js`, `decorativeIcon.js`, `itemPanel.js`, `Tabs Component`, `Issue Tracker Sync Workflow`, `Feedback Widget Tests`?**
  _High betweenness centrality (0.089) - this node is a cross-community bridge._
- **Why does `KEYS` connect `Confirm Dialog & Sign-out Utils` to `Roadmap Templates Registry`, `notificationBell.js`, `Import Validation & Corruption Detection`, `Review Scheduling & Celebration State`, `Brand & Auth Marketing Panel`, `reminderScheduler.js`, `Auth & Account Guards`, `migration.js`, `LocalStorage Adapter`, `topbar.js`, `Component Library (avatar/empty state/skeleton/sidebar)`, `dailyTodoPanel.js`, `CSP/SRI Security ADRs`, `App Bootstrap (main.js)`, `dashboard.js`, `createSelect`, `Hosting/Anonymous-User/Feedback ADRs`, `roadmapStore.test.js`, `uiPreferences.js`, `customRoadmapIcon.js`, `Tabs Component`?**
  _High betweenness centrality (0.039) - this node is a cross-community bridge._
- **Why does `CLAUDE.md (root agent instructions)` connect `CLAUDE.md (root agent instructions)` to `Issue Templates & Docs Index`, `migration.js`, `Product Rename Migration`, `Public API Docs`, `ADR-002: CSP + SRI security hardening`, `Issue template config (contact links)`?**
  _High betweenness centrality (0.036) - this node is a cross-community bridge._
- **What connects `name`, `version`, `private` to the rest of the system?**
  _332 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Backup/Export Schema + ICS Export` be split into smaller, more focused modules?**
  _Cohesion score 0.14509246088193456 - nodes in this community are weakly interconnected._