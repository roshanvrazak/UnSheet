#!/usr/bin/env bash
set -euo pipefail

echo "==> Running Secret Scanning..."

if command -v gitleaks >/dev/null 2>&1; then
  echo "Using gitleaks binary..."
  gitleaks detect --no-git --config .gitleaks.toml --verbose
  echo "✔ Gitleaks scan completed successfully."
else
  echo "gitleaks binary not found in PATH; running built-in fallback regex scanner..."
  node - << 'EOF'
import fs from 'node:fs';
import path from 'node:path';

const IGNORED_DIRS = new Set([
  '.git',
  'node_modules',
  '.pnpm-store',
  'dist',
  'build',
  '.next',
  '.turbo',
  'coverage'
]);

const IGNORED_FILES = new Set([
  'pnpm-lock.yaml',
  'package-lock.json',
  'yarn.lock',
  '.gitleaks.toml'
]);

const SECRET_PATTERNS = [
  { name: 'Private Key', regex: /-----BEGIN (?:RSA|OPENSSH|DSA|EC|PGP)? PRIVATE KEY-----/ },
  { name: 'Generic API Key / Secret', regex: /(?:api[_-]?key|client[_-]?secret|auth[_-]?token|app[_-]?secret)\s*[:=]\s*["']([A-Za-z0-9_\-\.]{20,80})["']/i },
  { name: 'AWS Access Key ID', regex: /(?:A3T[A-Z0-9]|AKIA|AGPA|AIDA|AROA|AIPA|ANPA|ANVA|ASIA)[A-Z0-9]{16}/ },
  { name: 'GitHub Personal Access Token', regex: /gh[pousr]_[A-Za-z0-9_]{36,255}/ },
  { name: 'Slack Token', regex: /xox[baprs]-[0-9]{10,13}-[0-9]{10,13}[a-zA-Z0-9-]*/ },
  { name: 'Anthropic API Key', regex: /\bsk-ant-[A-Za-z0-9_\-]{20,}/ },
  { name: 'OpenAI API Key', regex: /\bsk-[A-Za-z0-9_\-]{20,}/ },
  { name: 'Supabase Service Key', regex: /\bsbp_[a-f0-9]{40}\b|eyJhbGciOi[A-Za-z0-9_\-]{10,}\.eyJ[A-Za-z0-9_\-]{10,}\.[A-Za-z0-9_\-]{10,}/ }
];

let findings = 0;

function walk(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    if (IGNORED_DIRS.has(entry.name)) continue;
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(fullPath);
    } else if (entry.isFile()) {
      if (IGNORED_FILES.has(entry.name)) continue;
      scanFile(fullPath);
    }
  }
}

function scanFile(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    const lines = content.split('\n');
    lines.forEach((line, idx) => {
      for (const pattern of SECRET_PATTERNS) {
        if (pattern.regex.test(line)) {
          console.error(`[SECRET SCAN ERROR] ${pattern.name} found in ${filePath}:${idx + 1}`);
          findings++;
          break;
        }
      }
    });
  } catch (err) {
    // Ignore binary or unreadable files
  }
}

walk(process.cwd());

if (findings > 0) {
  console.error(`\n❌ Secret scan failed: ${findings} potential secret(s) found.`);
  process.exit(1);
} else {
  console.log("✔ Fallback secret scanner: No secrets detected.");
}
EOF
fi
