#!/usr/bin/env node
/**
 * Warn when git commands might commit .env or secret files.
 * Hook: beforeShellExecution
 */
const input = JSON.parse(require('fs').readFileSync(0, 'utf8'));
const command = input.command || '';

const riskyPatterns = [
  /\.env\b/i,
  /backend\/data\//i,
  /data\.json/i,
  /credentials/i,
  /\.pem\b/i,
  /id_rsa/i,
];

const isGit = /\bgit\s+(add|commit|push)\b/i.test(command);
const touchesRisky = riskyPatterns.some((re) => re.test(command));
const addsAll = /\bgit\s+add\s+(-A|--all|\.\s*$|\.\s)/i.test(command);

if (isGit && (touchesRisky || addsAll)) {
  const msg =
    'Git command may include .env or backend/data secrets. Ensure .gitignore covers them and run: node scripts/check-secrets.js';
  process.stdout.write(
    JSON.stringify({
      permission: 'ask',
      user_message: msg,
      agent_message: msg,
    })
  );
  process.exit(0);
}

process.stdout.write(JSON.stringify({ permission: 'allow' }));
process.exit(0);
