import { chromium } from 'playwright';

const baseUrl = process.env.POS_SMOKE_BASE_URL || 'http://127.0.0.1:4173';
const today = new Date().toISOString().slice(0, 10);

const saleSummary = {
  id: 10,
  order_id: 'ASF-1010',
  created_at: `${today}T10:15:00.000Z`,
  customer_name: 'Walk-in Customer',
  payment_mode: 'cash',
  total_amount: 1250,
  source: 'counter_sale',
};

const fullSale = {
  ...saleSummary,
  created_by_staff_id: 7,
  created_by_staff_name: 'Counter Staff',
  items: [
    {
      product_id: 501,
      name: 'Test Cable',
      qty: 1,
      price: 1250,
    },
  ],
};

const product = {
  id: 501,
  name: 'Test Cable',
  category: 'Accessories',
  brand: 'AsFix',
  price: 1250,
  discount_percent: 0,
  stock: 5,
  status: 'published',
};

function json(body) {
  return {
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify(body),
  };
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  let detailFetches = 0;

  await page.addInitScript(() => {
    window.localStorage.setItem('asfix_auth_token', 'pos-smoke-token');
    window.__printCalls = 0;
    window.print = () => {
      const root = document.querySelector('.counter-print-root');
      const appRoot = document.body.querySelector(':scope > :not(.counter-print-root)');
      window.__printCalls += 1;
      window.__printSnapshot = {
        rootText: root?.innerText || '',
        activeReceipts: root?.querySelectorAll('.counter-bill-print--active').length || 0,
        bodyClass: document.body.className,
        pageStyle: document.getElementById('thermal-page-size')?.textContent || '',
        appDisplay: appRoot ? getComputedStyle(appRoot).display : '',
        rootDisplay: root ? getComputedStyle(root).display : '',
      };
      window.dispatchEvent(new Event('afterprint'));
    };
  });

  await page.route('**/api/health', (route) => route.fulfill(json({ status: 'ok', ready: true })));
  await page.route('**/api/auth/me', (route) =>
    route.fulfill(json({
      user: {
        id: 7,
        username: 'counter',
        name: 'Counter Staff',
        role: 'counter',
        active: true,
      },
    }))
  );
  await page.route('**/api/products**', (route) => route.fulfill(json([product])));
  await page.route('**/api/orders/counter-sales/10', (route) => {
    detailFetches += 1;
    return route.fulfill(json(fullSale));
  });
  await page.route('**/api/orders/counter-sales?**', (route) => route.fulfill(json([saleSummary])));

  await page.goto(`${baseUrl}/pos`, { waitUntil: 'networkidle' });
  await page.emulateMedia({ media: 'print' });
  const row = page.getByRole('row').filter({ hasText: 'ASF-1010' });
  await row.getByRole('button', { name: 'Print Receipt' }).click();
  await page.waitForFunction(() => window.__printCalls === 1);

  const snapshot = await page.evaluate(() => window.__printSnapshot);
  await browser.close();

  const failures = [];
  if (detailFetches !== 1) failures.push(`expected one detail fetch, got ${detailFetches}`);
  if (!snapshot.rootText.includes('ASF-1010')) failures.push('receipt root is missing ASF-1010');
  if (!snapshot.rootText.includes('Test Cable')) failures.push('receipt root is missing full item data');
  if (snapshot.activeReceipts !== 1) failures.push(`expected one active receipt, got ${snapshot.activeReceipts}`);
  if (!snapshot.bodyClass.includes('counter-receipt-printing')) failures.push('print body class was not active');
  if (!snapshot.pageStyle.includes('size: 58mm auto')) failures.push('thermal @page size was not injected');
  if (snapshot.appDisplay !== 'none') failures.push(`non-receipt app root display was ${snapshot.appDisplay}`);
  if (snapshot.rootDisplay !== 'block') failures.push(`print root display was ${snapshot.rootDisplay}`);

  if (failures.length) {
    throw new Error(`POS historical print smoke failed:\n- ${failures.join('\n- ')}`);
  }

  console.log('POS historical print smoke passed: ASF-1010 rendered full receipt in one active print root.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
