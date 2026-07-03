import { copyFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const dist = join(dirname(fileURLToPath(import.meta.url)), '..', 'dist');
copyFileSync(join(dist, 'index.html'), join(dist, '404.html'));
console.log('SPA 404.html copied for GitHub Pages routing');
