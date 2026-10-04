# Handoff: Devops Root Dev Script

Added `"dev"` and `"start"` scripts to the root `package.json` to facilitate running and starting `@unsheet/web`.

## Changes
- Updated [package.json](file:///home/rvr/Work/basi/UnSheet/package.json) to include:
  ```json
  "dev": "pnpm --filter @unsheet/web dev",
  "start": "pnpm --filter @unsheet/web start"
  ```
- Verified with `pnpm lint --quiet`.
