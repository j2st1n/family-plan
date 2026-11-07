# Authentication and settings visual QA — 2026-11-07

## Target and evidence

This is a scoped correction of the existing two entry forms and settings row, following the Family Plan visual language already selected by the user. It is not a pixel clone of the old login pages. User-provided current screenshots identify the problems; the accepted stopwatch concept establishes the quiet system typography, surfaces and control hierarchy.

- Current-flow source captures: `docs/design/auth-settings/parent-before.jpg`, `child-before.jpg`, fresh unauthenticated public-origin captures at1280×720 CSS/pixels, no browser chrome. No credentials entered.
- Same-state implementation: `parent-after.jpg`, `child-after.jpg`, synthetic local previews at1280×720, light, empty fields.
- Full combined comparison: `comparison-full.jpg`, source and implementation together, each1280×720 image displayed at640×360, equal density normalization.
- Focused combined comparison: `comparison-focused.jpg`, same source pixels at1:1 in480×500 crops from x400,y40. This makes text, brand and inputs readable while retaining the full comparison for composition.
- Additional accepted captures: `parent-dark.jpg`, `child-dark-filled.jpg`, and `settings-auto.jpg`. Actual viewport changed during later IAB work; these are state/color evidence, not equal-viewport comparisons. Filled access code is fictional.

## Findings and fixes

- [P1, resolved] Existing parent brand has an unstyled tiny emoji and blue heading, while Kids has a large blue badge. Shared AuthShell now uses the same56px existing🌟mark,28px system heading and14px description in both apps.
- [P2, resolved] Kids placeholder is as large and spaced as a real access code. Placeholder now16px with normal spacing; entered six-digit code is30px tabular text. A persistent label and concise location hint explain the field.
- [P2, resolved] Inputs rely on placeholders and remove visible focus. Parent now has visible labels in one divided group; both forms have visible focus, error alerts, busy/disabled feedback and appropriate autocomplete. Login no longer automatically opens the mobile keyboard.
- [P2, resolved] Theme row adds12px gap to the icon's existing14px margin, shifting its title. Removed duplicate spacing, retained the shared row/icon layout, and placed controls on a second aligned line at narrow widths.
- [P2, resolved] Automatic theme summary included the current resolved appearance. It now says only“跟随系统”; explicit light/dark labels and actual theme behavior remain.

## Required fidelity surfaces

- Fonts/typography: native system stack retained; consistent brand/title/body scale and regular-sized placeholder; no new font or decorative glyph system.
- Spacing/layout: same360px form width,56px parent rows,48px primary actions, restrained12px grouped corners, common header spacing. Desktop and mobile use the same form hierarchy. Theme title and AI title x coordinates match within1px at320/390/834/1280.
- Colors/tokens: existing light/dark backgrounds and cards; restrained neutral heading, blue primary control without shadow; secondary text uses legible light/dark values and visible focus.
- Assets/image quality: original user-visible🌟brand retained. Existing settings icons retained. No new bitmap, drawn logo, rasterized interface or remote asset added.
- Copy/content: parent login/register modes remain; Kids uses consistent“访问码”wording and“绑定设备”action. Theme summary removes only its parenthetical resolution.

## Comparison history

1. Captured and inspected both public entry pages and user-provided settings image before edits. Identified the brand/placeholder/label/alignment issues above.
2. Implemented the scoped corrections and captured equal-size full and focused before/after boards. No actionable P0/P1/P2 differences remain against the stated corrections and existing visual direction. A transient dark capture lacked header paint, so it was rejected and recaptured after confirming computed styles and visible title.
3. Checked dark input/focus and settings automatic label. Automated viewport and functional checks below passed.

## Validation

- Existing parent25/child15 unit tests and both production builds passed.
- New synthetic browser regression passed login validation, trimmed unchanged login payload, failed authentication retaining inputs, registration mode/autocomplete and session save, disabled mode switch during loading, child code sanitization/length/error/retry, unchanged binding payload and successful device session save.
- Theme auto summary and pressed state checked under both system colors; theme title alignment and group bounds checked at320/390/834/1280. Both entry forms checked for overflow and primary44px minimum target; no automatic initial focus.
- No page errors in new browser test. Preview-only event-stream fixture was corrected after the initial test failure; no product event transport changed.
- Backend, authentication endpoints, JWT/device token logic, database schema, rewards, stopwatch and focus behavior have no diff from production923fbb5. CI will run existing browser regressions plus this new authentication regression before publication.
- No real login, registration, binding or settings mutation submitted. Physical iPad keyboard/Keychain/VoiceOver are not claimed verified.

final result: passed
