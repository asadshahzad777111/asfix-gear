#!/usr/bin/env node
/**
 * Copy backend/data/data.json to backups/data-YYYY-MM-DDTHH-mm-ss.json
 *
 * Usage: node scripts/backup-data-json.mjs
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_FILE = path.join(__dirname, '..', 'backend', 'data', 'data.json');
const BACKUP_DIR = path.join(__dirname, '..', 'backups');

function timestamp() {
  return new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
}

function main() {
  if (!fs.existsSync(DATA_FILE)) {
    console.error(`No data file at ${DATA_FILE}`);
    process.exit(1);
  }

  fs.mkdirSync(BACKUP_DIR, { recursive: true });
  const dest = path.join(BACKUP_DIR, `data-${timestamp()}.json`);
  fs.copyFileSync(DATA_FILE, dest);

  const stat = fs.statSync(dest);
  console.log('Backup saved:', dest);
  console.log('Size (bytes):', stat.size);
}

main();
