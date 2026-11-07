# Growth boards and report sharing

Both apps use one aggregate analytics service and one shared board/report renderer.
Kids navigation is Today / Growth / Shop. Growth supports the latest 7, 30 and 90
calendar days. Parent Analytics retains its management actions and private insights.

## Definitions

- Completed tasks include approved, nondeleted tasks with completed status in the
  selected task-date range. Submitted tasks count as planned, not completed.
- Qualified days use the existing calendar statuses and configured threshold.
  Rest, vacation and protected dates are distinct from missed days.
- Current and longest streak are existing all-time records, labelled independently
  of the selected report period. This change does not alter streak or award rules.
- Earned stars are positive ledger entries within the selected date interval, using
  Decimal on the backend. They are separate from the all-time current balance.
- Actual time includes only completed tasks with a non-null actual_seconds value.
  Zero is a valid recorded result. If there are no records, no timing card or
  placeholder is rendered. No running timer data is uploaded for this feature.
- An explicit `[习惯分类]` description tag takes precedence over keyword inference.
- Existing application calendar/ledger date semantics are retained; this release
  does not introduce a new timezone setting.

## Authorization and privacy

`GET /api/v1/child/analytics?days=30` derives the child exclusively from the validated
bound-device token. It exposes a response allowlist of name, period, calendar,
categories, summary, streak and earned stars. No sibling selector, task title,
parent insight, balance, ledger, or child identifier is returned.

Both report buttons take an immutable aggregate-only snapshot. The preview defaults
to showing the nickname and offers a switch to hide it. Task names and balances
are never included in growth reports. Report filenames and system-share metadata
never include nicknames. Changing period/child closes the previous preview;
out-of-order responses cannot replace the current selection. During loading/errors,
sharing is disabled. An already opened report remains a consistent snapshot.

Reports are generated locally as PNG with the vector brand mark and
“Small steps. Shared growth.” Native file sharing is invoked only after a click;
unsupported environments use image download. Cancelling native share is neutral.
No public share link or new image-hosting service is introduced. Existing daily
achievement sharing stays available.

## Verification

- Backend tests cover child binding isolation, parent ownership, missing/wrong/
  revoked credentials, range validation, parent/child aggregate parity, fractional
  earned stars, range boundaries, approvals/deletions, exemptions and timed zero.
- Model tests check report allowlists, privacy at actual canvas draw calls, date
  alignment, decimal values and omission of untimed results.
- `node scripts/test-growth-browser.mjs` checks both apps, actual PNG download,
  nickname removal, native sharing/cancellation mocks, download fallback, late
  responses, parent child switching, empty/error/retry/expired session states and
  320/390/834/1280 widths in light/dark themes. All API data in this test is synthetic.
- Existing task/focus/stopwatch/share/auth/brand browser regressions remain in CI.
- Native iPad share destinations and physical device behavior require device-side
  verification; the browser test exercises the Web Share contract with a mock.
