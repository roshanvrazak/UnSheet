#!/usr/bin/env bash
set -euo pipefail

# scripts/verify-sheetjs.sh
# Validates that SheetJS was installed from the official vendor tarball at https://cdn.sheetjs.com/
# rather than the stale/vulnerable npm registry package.
# Checks pnpm-lock.yaml or package resolution to verify the vendor tarball URL is pinned.

BOLD="\033[1m"
GREEN="\033[0;32m"
RED="\033[0;31m"
RESET="\033[0m"

echo -e "${BOLD}Verifying SheetJS Supply Chain Source...${RESET}"

LOCKFILE="pnpm-lock.yaml"

if [ ! -f "$LOCKFILE" ]; then
  echo -e "${RED}[ERROR] $LOCKFILE not found!${RESET}"
  exit 1
fi

# Check if xlsx or sheetjs is used and resolved via cdn.sheetjs.com in pnpm-lock.yaml
# SheetJS packages are typically named xlsx or similar or scoped (e.g. cdn.sheetjs.com).
# Let's inspect pnpm-lock.yaml for cdn.sheetjs.com references.
if grep -q "cdn.sheetjs.com" "$LOCKFILE"; then
  echo -e "${GREEN}[SUCCESS] SheetJS vendor tarball URL (cdn.sheetjs.com) found and pinned in $LOCKFILE.${RESET}"
else
  # Check if xlsx is even a dependency in the project
  if grep -q "xlsx" package.json || grep -q "xlsx" pnpm-lock.yaml; then
    # If xlsx exists but doesn't use cdn.sheetjs.com, check if it's pointing to the official CDN or if it's missing the vendor pin.
    # Note: Some setups might use enterprise or community build. Let's inspect carefully.
    if grep -q "sheetjs.com" "$LOCKFILE"; then
      echo -e "${GREEN}[SUCCESS] SheetJS domain found in lockfile.${RESET}"
    else
      echo -e "${RED}[ERROR] SheetJS dependency found in project, but is NOT pinned to the official vendor tarball (https://cdn.sheetjs.com/).${RESET}"
      echo -e "${RED}Please ensure xlsx is installed from https://cdn.sheetjs.com/ (e.g., pnpm add https://cdn.sheetjs.com/xlsx-0.20.3.tgz).${RESET}"
      exit 1
    fi
  else
    echo -e "${GREEN}[INFO] SheetJS (xlsx) dependency not detected in this repository. Skipping vendor verification.${RESET}"
  fi
fi

echo -e "${GREEN}${BOLD}✔ SheetJS supply chain verification completed successfully!${RESET}"
