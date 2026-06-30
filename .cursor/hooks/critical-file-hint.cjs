#!/usr/bin/env node
/**
 * Lightweight hint after edits to critical paths — does not run full build.
 * Hook: afterFileEdit
 */
const input = JSON.parse(require('fs').readFileSync(0, 'utf8'));
const file = input.file_path || input.path || '';

const critical =
  /frontend\/src\/(App\.jsx|main\.jsx|api\/|context\/|locales\/translations\.js)|backend\/(server\.js|routes\/)/.test(
    file.replace(/\\/g, '/')
  );

if (!critical) {
  process.stdout.write('{}');
  process.exit(0);
}

process.stdout.write(
  JSON.stringify({
    additional_context: `[hook] Critical file edited: ${file}. Before merge run: npm run build && npm run check:i18n (if translations changed).`,
  })
);
process.exit(0);
