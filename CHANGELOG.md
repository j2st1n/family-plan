# Changelog

## [v0.3.17] - 2026-05-24

### Documentation

- document realtime event streams


### Features

- refresh child pages from realtime events

- add child realtime refresh hooks

- refresh parent pages from realtime events

- add parent realtime refresh hooks

- publish realtime backend events

- add authenticated event streams

- add realtime event hub


## [v0.3.16] - 2026-05-24

### Bug Fixes

- show sunday in routine weekdays


### Maintenance

- bump version to 0.3.16


## [v0.3.15] - 2026-05-23

### Features

- fold fulfilled redemption history


### Maintenance

- bump version to 0.3.15


## [v0.3.14] - 2026-05-23

### Bug Fixes

- show parent web operation errors

- handle child shop token expiry

- harden redemptions and streak thresholds

- use slow hash for child access codes


### Maintenance

- bump version to 0.3.14

- track backend uv lockfile


### Other

- cover audit regression fixes


## [v0.3.13] - 2026-05-22

### Bug Fixes

- translate shop error messages to Chinese for child PWA


### Maintenance

- bump version to 0.3.13


## [v0.3.12] - 2026-05-22

### Bug Fixes

- child shop errors show reason, banner instead of full-page, wish catches


### Maintenance

- bump version to 0.3.12


## [v0.3.11] - 2026-05-22

### Bug Fixes

- keep tabs mounted to avoid state loss on switch


### Maintenance

- bump version to 0.3.11


## [v0.3.10] - 2026-05-22

### Features

- grade cascade select, input labels, threshold display on child card


### Maintenance

- bump version to 0.3.10


## [v0.3.9] - 2026-05-22

### Bug Fixes

- shallow copy per redemption to isolate identity map


### Maintenance

- bump version to 0.3.9


## [v0.3.8] - 2026-05-22

### Features

- structural redesign — tab navigation, shop page, login polish


### Maintenance

- bump version to 0.3.8


## [v0.3.7] - 2026-05-22

### Maintenance

- bump version to 0.3.7


### Other

- green accent color scheme


## [v0.3.6] - 2026-05-21

### Bug Fixes

- migration server_default for streak_threshold


### Maintenance

- bump version to 0.3.6


## [v0.3.5] - 2026-05-21

### Features

- streak threshold — parent sets completion rate requirement


### Maintenance

- bump version to 0.3.5


## [v0.3.4] - 2026-05-21

### Bug Fixes

- expunge_all before redeemed query to isolate identity map


### Maintenance

- bump version to 0.3.4


## [v0.3.3] - 2026-05-20

### Bug Fixes

- per-redemption shop items with independent status


### Maintenance

- bump version to 0.3.3


## [v0.3.2] - 2026-05-20

### Bug Fixes

- expunge redeemed items to prevent identity map pollution


### Maintenance

- bump version to 0.3.2


## [v0.3.1] - 2026-05-20

### Bug Fixes

- migration server_default for existing redemptions


### Maintenance

- bump version to 0.3.1


## [v0.3.0] - 2026-05-20

### Bug Fixes

- stock visibility + redemption status sync


### Maintenance

- bump version to 0.3.0


## [v0.2.8] - 2026-05-20

### Bug Fixes

- dedup active/redeemed items in child shop list


### Maintenance

- bump version to 0.2.8


## [v0.2.7] - 2026-05-20

### Bug Fixes

- unique constraint on redeem ledger, simplify query


### Maintenance

- bump version to 0.2.7


## [v0.2.6] - 2026-05-20

### Features

- redemption table for per-child redeem tracking


### Maintenance

- bump version to 0.2.6


## [v0.2.5] - 2026-05-20

### Bug Fixes

- filter shop items by status, add stock field, remove description


### Maintenance

- bump version to 0.2.5


## [v0.2.4] - 2026-05-20

### Features

- shop stock, redemptions history, fulfill flow


### Maintenance

- bump version to 0.2.4


## [v0.2.3] - 2026-05-20

### Bug Fixes

- redeem also supports parent-created items


### Maintenance

- bump version to 0.2.3


## [v0.2.2] - 2026-05-20

### Bug Fixes

- parent-created shop items now visible to child


### Maintenance

- bump version to 0.2.2


## [v0.2.1] - 2026-05-20

### Bug Fixes

- child shop route conflict + move shop to stars card


### Maintenance

- bump version to 0.2.1


## [v0.2.0] - 2026-05-20

### Bug Fixes

- template update/delete preserves today's tasks


### Documentation

- update all documentation to reflect current architecture


### Features

- star shop frontend — parent management and child store

- child edit wish + parent edit shop item

- star shop — redeem stars for items, child wishes

- reliable test suite with PostgreSQL and unique test data


### Maintenance

- bump version to 0.2.0


## [v0.1.11] - 2026-05-20

### Maintenance

- bump version to 0.1.11


### Other

- security headers + device token 30-day expiration


## [v0.1.10] - 2026-05-20

### Bug Fixes

- use alembic instead of uv in Docker CMD


### Maintenance

- bump version to 0.1.10


## [v0.1.9] - 2026-05-20

### Bug Fixes

- auto-run alembic migrations on startup


### Maintenance

- bump version to 0.1.9


## [v0.1.8] - 2026-05-20

### Bug Fixes

- host-based routing instead of sub-paths

- Caddy redirect root to /child/ and /parent/ per subdomain


### Documentation

- update quick start and JWT_SECRET docs


### Maintenance

- bump version to 0.1.8


## [v0.1.7] - 2026-05-20

### Bug Fixes

- serve frontend via FastAPI StaticFiles, remove volume mount


### Maintenance

- bump version to 0.1.7


## [v0.1.6] - 2026-05-20

### Maintenance

- bump version to 0.1.6


### Other

- Fix CI build: remove invalid test-dependencies, bind rate limit, bcrypt pin


## [v0.1.5] - 2026-05-19

### Maintenance

- bump version to 0.1.5


### Other

- Remove audit report from public repo

- P0 fixes: JWT_SECRET validation, rate limiting, reward idempotency, unapproved task guard


## [v0.1.4] - 2026-05-19

### Bug Fixes

- retry api health check in CI


### Maintenance

- bump version to 0.1.4


## [v0.1.3] - 2026-05-19

### Bug Fixes

- restore package-lock.json, anonymize paths


### Maintenance

- bump version to 0.1.3


## [v0.1.2] - 2026-05-19

### Maintenance

- bump version to 0.1.2


### Other

- Multi-stage Docker build with frontend, input validation


## [v0.1.1] - 2026-05-19

### Maintenance

- bump version to 0.1.1


## [v0.1.0] - 2026-05-19

### Features

- username/password registration and login


### Maintenance

- use placeholder domains in Caddyfile template

- regenerate CHANGELOG with git-cliff


### Other

- Build Docker image with GHCR, use image in compose

- Add dev compose, Caddyfile, fix CI branch

- Bind API to 127.0.0.1 only, not public

- Fix docker-compose download URL: main -> master

- Add LICENSE, rewrite README, fix JWT_SECRET default

- Remove lock files and cache from repo

- Initial commit: Family Plan v0.1.0


