/**
 * Scan tracked source files for accidental secret patterns.
 * Usage: node scripts/check-secrets.js
 */
import { execSync } from 'child_process';
import { readFileSync } from 'fs';
import path from 'path';

const IGNORE = [
  /^node_modules\//,
  /^frontend\/dist\//,
  /^backend\/data\//,
  /\.lock$/,
  /check-secrets\.js$/,
  /seed-admin\.js$/,
  /^\.env\.example$/,
];

const DOC_FILES = /\.(md|mdc)$/i;

function isEnvExampleFile(file) {
  return file === '.env.example' || file.endsWith('/.env.example');
}

function isBlockedEnvFile(file) {
  if (isEnvExampleFile(file)) return false;
  return file.endsWith('.env') || file.includes('.env.');
}

const PATTERNS = [
  { name: 'AWS key', re: /AKIA[0-9A-Z]{16}/ },
  { name: 'Private key block', re: /-----BEGIN (RSA |EC )?PRIVATE KEY-----/ },
  { name: 'Generic API key assignment', re: /(?:api[_-]?key|secret[_-]?key)\s*=\s*['"][^'"]{8,}['"]/i },
  { name: '.env file content', re: /^[A-Z_]+=.+$/m },
];

function listTrackedFiles() {
  try {
    const out = execSync('git ls-files', { encoding: 'utf8' });
    return out.split('\n').filter(Boolean);
  } catch {
    return [];
  }
}

const files = listTrackedFiles().filter((f) => !IGNORE.some((re) => re.test(f)));
let hits = 0;

for (const file of files) {
  if (isBlockedEnvFile(file)) {
    console.error(`[secrets] BLOCKED: tracked env file — ${file}`);
    hits += 1;
    continue;
  }

  let content;
  try {
    content = readFileSync(path.resolve(file), 'utf8');
  } catch {
    continue;
  }

  for (const { name, re } of PATTERNS) {
    if (file.endsWith('.env') && name === '.env file content') continue;
    if (name === '.env file content' && (DOC_FILES.test(file) || isEnvExampleFile(file))) continue;
    if (re.test(content)) {
      console.error(`[secrets] ${name} in ${file}`);
      hits += 1;
    }
  }
}

if (hits) {
  console.error(`\n[secrets] ${hits} issue(s) found — remove secrets before commit.`);
  process.exit(1);
}

console.log(`[secrets] OK — scanned ${files.length} tracked files`);
