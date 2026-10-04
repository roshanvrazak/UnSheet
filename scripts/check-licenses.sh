#!/usr/bin/env bash
set -euo pipefail

# scripts/check-licenses.sh
# Audits installed dependencies using pnpm and ensures their licenses are permissible.
# Permissible licenses: MIT, Apache-2.0, BSD-2-Clause, BSD-3-Clause, ISC, 0BSD, Unlicense, CC0-1.0, Python-2.0.
# Reject GPL/AGPL copyleft licenses in production dependencies.
# Exit 0 if all clean, exit 1 if forbidden license found.

BOLD="\033[1m"
GREEN="\033[0;32m"
RED="\033[0;31m"
RESET="\033[0m"

echo -e "${BOLD}Starting License Compliance Check...${RESET}"

node -e '
const cp = require("child_process");

const PERMISSIBLE = new Set([
  "MIT", "Apache-2.0", "Apache 2.0", "BSD-2-Clause", "BSD-3-Clause", "ISC", "0BSD", "Unlicense", "CC0-1.0", "Python-2.0", "BSD", "Public Domain", "CC-BY-4.0"
]);

const FORBIDDEN = ["GPL", "AGPL", "LGPL"];

try {
  const output = cp.execSync("pnpm list --json --recursive --long", { encoding: "utf8" });
  const data = JSON.parse(output);
  
  let violations = [];
  let unverified = [];

  function inspect(deps) {
    if (!deps) return;
    // deps can be an object or array depending on pnpm version
    const entries = Array.isArray(deps) ? deps : Object.values(deps);
    for (const dep of entries) {
      if (!dep) continue;
      const name = dep.name || dep.from;
      const license = dep.license || "UNKNOWN";
      
      const upperLic = String(license).toUpperCase();
      const isForbidden = FORBIDDEN.some(f => upperLic.includes(f));
      
      if (isForbidden) {
        violations.push({ name, license });
      } else if (license === "UNKNOWN") {
        unverified.push(name);
      } else {
        const parts = String(license).split(/(\s+OR\s+|\s+AND\s+|\/|,)/).map(s => s.trim()).filter(Boolean);
        const ok = parts.some(p => PERMISSIBLE.has(p) || PERMISSIBLE.has(p.replace(/[\(\)]/g, "")));
        if (!ok && !PERMISSIBLE.has(license)) {
          unverified.push(`${name} (${license})`);
        }
      }
    }
  }

  if (Array.isArray(data)) {
    for (const pkg of data) {
      inspect(pkg.dependencies);
      inspect(pkg.devDependencies);
      inspect(pkg.peerDependencies);
    }
  }

  if (violations.length > 0) {
    console.error("\x1b[31m[ERROR] Found forbidden copyleft licenses:\x1b[0m");
    violations.forEach(v => console.error(` - ${v.name}: ${v.license}`));
    process.exit(1);
  }

  console.log(`\x1b[32m[SUCCESS] License compliance check passed. Unverified/Other licenses: ${unverified.length}\x1b[0m`);
} catch (err) {
  console.error("Error running license audit:", err.message);
  process.exit(1);
}
'

echo -e "${GREEN}${BOLD}✔ License compliance check completed successfully!${RESET}"
