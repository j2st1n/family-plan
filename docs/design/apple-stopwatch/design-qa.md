# Apple task stopwatch design QA

Historical preview verification, completed before the subsequent923fbb5 production release.

## Comparison evidence

- Source visual truth: `docs/design/apple-stopwatch/selected.png`, first displayed concept explicitly selected by the user.
- Rendered implementation: `docs/design/apple-stopwatch/running.jpg`; local isolated synthetic preview on port19152, running08:32, light, same task/child/date content as source.
- Full comparison: `docs/design/apple-stopwatch/comparison.jpg`, both artifacts together in one browser-rendered image.
- Source852×1846 normalized to375×812; implementation native IAB capture375×812 from requested CSS390×844. Native capture scales the viewport and reserves a15px scrollbar. Source and implementation are aligned at page top and equal display size; no OS/browser chrome. Earlier explicit-clip capture omitted the fixed navigation and was rejected as final evidence.
- Timer digits, status, menu and both controls are clearly readable in the full comparison; no separate focused crop is necessary.
- Additional rendered states: `docs/design/apple-stopwatch/paused-dark.jpg` (actual CSS390×844,01:02:05 paused, dark), `completed-menu.jpg` (completion result and unclipped secondary menu, dark).

## Findings and resolution

No actionable P0/P1/P2 findings remain.

1. [P1, resolved] Initial platform fallback made the thin numerals too heavy. Added self-hosted variable Inter fallback after native Apple type and before generic system-ui. Post-fix comparison shows thin, stable tabular digits.
2. [P2, resolved] First implementation was too tall and pushed add-task below the first viewport. Removed redundant summary ring, tightened header/card rhythm, kept44px targets, and placed secondary actions in the task menu. Final comparison retains add-task and persistent navigation in the initial viewport.
3. [P2, resolved] Active-row separator disappeared with the light theme's missing separator token. Added border-token fallback; final comparison has a quiet visible divider.
4. [P2, resolved] Secondary menu was clipped by grouped-card overflow. Scoped visible overflow and edge-row radii preserve the card while allowing the menu to extend; completed-menu evidence and actual scheduling action confirm accessibility.
5. [P2, resolved] Existing undefined completed-fill token made the white check invisible. Added green fallback and removed whole-row opacity so completed result and optional elapsed time remain readable.

## Fidelity surfaces

- Typography: native Apple system text retained; large weight200 tabular digits; hours switch to smaller HH:MM:SS. No per-second live announcements. Native/fallback antialiasing differs slightly from the raster target and is expected.
- Spacing/layout: same task-local hierarchy, title/status/time/two equal buttons; same grouped list order.44px controls are intentionally larger than the mock's approximate40px controls. Reserved scrollbar slightly narrows the captured content; no hidden app controls.
- Colors/tokens: existing light/dark surfaces and muted status colors; primary #0071E3 with white text in both themes for legible contrast. Completed indicator solid green preserves app completion semantics.
- Assets/image quality: existing supplied timer icon plus MIT Heroicons pause/play/ellipsis. No rasterized UI or invented decorative assets. Inter OFL license accompanies bundled font.
- Copy/content: 计时, 正在计时/已暂停, 暂停/继续, 完成任务, 取消计时. Completed duration is separate; untimed completed task has no duration placeholder. Fixture content is fictional.

## Comparison history

1. First combined comparison `/private/tmp/family-plan-timer-audit/comparison-first-full.jpg` found heavy fallback, excessive density, missing divider and extra summary/secondary controls; result blocked.
2. Recaptured after font and density fixes; fixed navigation was missing from the clip method, so recaptured native viewport at page top instead. Further tightened spacing and fixed completed check fill.
3. Final equal-size combined comparison `docs/design/apple-stopwatch/comparison.jpg` resolves earlier layout/type/divider findings. Dark paused and completed menu captures plus real menu navigation verify the additional states and overflow correction.

## Verification and boundaries

- Parent25 and child15 existing unit tests passed; shared feature model script passed including zero, minutes, hour/day and invalid elapsed formatting.
- Both production builds passed; font is a48.26KB same-origin WOFF2 and its license is included.
- Feature browser regression passed: single completion control while timing; menu Escape focus return; cancel confirmation preserves timer; pause excludes elapsed time; reload retains125 seconds; no running timer uploads; offline completion retry keeps its operation ID; final duration visible after sync; explicit cancel does not upload; subsequent untimed completion omits duration.
- Browser checks at320/390/834 CSSpx passed no horizontal overflow,44px timer targets and hour-format fit. IAB viewport override did not apply alternate sizes reliably, so alternate widths are asserted by the existing automated regression rather than claimed from IAB screenshots.
- Existing date, share/poster PNG, responsive layout, mutation guard and streak-settings browser regression passed.
- Dark confirm, pause, completion result and unclipped menu visually inspected. No page errors in automated tests. IAB log contains three older preview SSE reconnect warnings from02:01, preceding current flow; no new application errors observed during final interactions.
- No backend/API/storage/migration change. No production deployment or household mutations. Physical iPad lock-screen and native VoiceOver are not verified here.

- Anonymous TypeSafe delivery gate: Score1.98/2; local semantics0.95, bounded claims0.97. No code, images, credentials or household data submitted.

final result: passed
