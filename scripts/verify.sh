#!/usr/bin/env bash
set -euo pipefail

BOLD="\033[1m"
GREEN="\033[0;32m"
BLUE="\033[0;34m"
RED="\033[0;31m"
RESET="\033[0m"

log_step() {
  echo -e "\n${BLUE}${BOLD}=== [STEP: $1] ===${RESET}"
}

echo -e "${BOLD}Starting Unsheet Workspace Verification (pnpm verify)...${RESET}"

# Step 1: Linting
log_step "1/6 Linting (ESLint + Security Plugin)"
pnpm run lint

# Step 2: Typechecking
log_step "2/6 Strict Typechecking (tsc across all workspaces)"
pnpm run typecheck

# Step 3: Tests
log_step "3/6 Automated Tests (Vitest Workspace)"
pnpm run test

# Step 4: Build
log_step "4/6 Workspace Build"
pnpm run build

# Step 5: Secret Scanning
log_step "5/6 Secret Scanning"
pnpm run scan-secrets

# Step 6: Security Audit
log_step "6/6 Dependency Audit (--audit-level high)"
pnpm run audit

echo -e "\n${GREEN}${BOLD}✔ ALL VERIFICATION CHECKS PASSED SUCCESSFULLY!${RESET}\n"
