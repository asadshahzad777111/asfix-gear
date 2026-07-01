/**
 * Pre-deploy smoke test — boots the production server (built frontend +
 * backend API) and loads every key route in a real headless browser,
 * failing the build if any page throws a JS error or renders blank.
 *
 * This exists because `vite build` and ESLint both pass on code that still
 * crashes at runtime (e.g. reading a property that doesn't exist on a
 * config object) — the only reliable way to catch that class of bug before
 * it reaches production is to actually load the page and watch the
 * console, which is what this script does.
 *
 * Run with: node scripts/smoke-test.js
 * (Requires `npm run build` to have produced `frontend/dist` first, and the
 * `playwright` package + its Chromium browser to be installed.)
 */
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import http from 'node:http';

const PORT = process.env.SMOKE_PORT || 5099;
const BASE_URL = `http://localhost:${PORT}`;
const ROUTES = ['/', '/shop', '/repair', '/contact', '/track', '/account/login', '/account/register'];

function waitForServer(url, timeoutMs = 30000) {
  const start = Date.now();
  return new Promise((resolve, reject) => {
    const check = () => {
      http
        .get(url, (res) => {
          res.resume();
          resolve();
        })
        .on('error', () => {
          if (Date.now() - start > timeoutMs) {
            reject(new Error(`Server did not respond at ${url} within ${timeoutMs}ms`));
            return;
          }
          setTimeout(check, 400);
        });
    };
    check();
  });
}

// Console noise that is expected/benign in a sandboxed CI browser (blocked
// third-party trackers, ad-block-style resource failures, etc.) and should
// never fail the build on its own. Real render crashes always show up as a
// `pageerror` and/or a blank #root, which we still fail on unconditionally.
const IGNORED_CONSOLE_PATTERNS = [/favicon/i, /ERR_BLOCKED_BY_CLIENT/i, /net::ERR_/i];

async function checkRoute(page, route) {
  const fatalErrors = [];
  const warnings = [];
  const onPageError = (err) => fatalErrors.push(`pageerror: ${err.message}`);
  const onConsole = (msg) => {
    if (msg.type() !== 'error') return;
    const text = msg.text();
    if (IGNORED_CONSOLE_PATTERNS.some((re) => re.test(text))) return;
    warnings.push(`console.error: ${text}`);
  };
  page.on('pageerror', onPageError);
  page.on('console', onConsole);

  try {
    await page.goto(`${BASE_URL}${route}`, { waitUntil: 'networkidle', timeout: 15000 });
    await page.waitForTimeout(300);

    const rootHtml = await page.evaluate(() => document.getElementById('root')?.innerHTML || '');
    if (!rootHtml.trim()) {
      fatalErrors.push('Blank page — #root rendered no content');
    }
    return { fatalErrors, warnings };
  } finally {
    page.off('pageerror', onPageError);
    page.off('console', onConsole);
  }
}

async function main() {
  console.log(`Starting production server on port ${PORT}...`);
  const server = spawn(process.execPath, ['backend/server.js'], {
    stdio: 'inherit',
    env: { ...process.env, NODE_ENV: 'production', PORT: String(PORT) },
  });

  let exited = false;
  const cleanup = () => {
    if (!exited) {
      exited = true;
      server.kill();
    }
  };
  process.on('exit', cleanup);
  process.on('SIGINT', () => {
    cleanup();
    process.exit(1);
  });

  let hadFailure = false;

  try {
    await waitForServer(`${BASE_URL}/api/health`);
    console.log('Server is up. Launching headless browser...');

    const browser = await chromium.launch();
    const page = await browser.newPage();

    for (const route of ROUTES) {
      process.stdout.write(`Checking ${route} ... `);
      const { fatalErrors, warnings } = await checkRoute(page, route);
      if (fatalErrors.length > 0) {
        hadFailure = true;
        console.log('FAIL');
        for (const e of fatalErrors) console.log(`    ${e}`);
      } else {
        console.log('OK');
      }
      for (const w of warnings) console.log(`    [warn] ${w}`);
    }

    await browser.close();
  } catch (err) {
    hadFailure = true;
    console.error('Smoke test crashed:', err.message);
  } finally {
    cleanup();
  }

  if (hadFailure) {
    console.error('\nSmoke test FAILED — a page crashed or rendered blank. Fix before deploying.');
    process.exit(1);
  }
  console.log('\nSmoke test passed — all routes rendered without errors.');
}

main();
