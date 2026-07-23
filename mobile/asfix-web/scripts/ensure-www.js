import { mkdirSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const index = join(root, 'www', 'index.html');
if (!existsSync(index)) {
  mkdirSync(dirname(index), { recursive: true });
  writeFileSync(
    index,
    '<!DOCTYPE html><html><head><meta charset="UTF-8"><title>AsFix & Gear</title></head><body><p>AsFix & Gear shell</p></body></html>\n',
  );
}
