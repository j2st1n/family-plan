# Changelog

## [v0.1.6] - 2026-05-20

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


