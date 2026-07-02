/**
 * Simulates production deploy seed (without fix-images.js).
 * Verifies staff-uploaded product images are NOT overwritten.
 */
import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const DATA_FILE = path.join(ROOT, 'backend', 'data', 'data.json');
const BACKEND = path.join(ROOT, 'backend');
const BACKUP = `${DATA_FILE}.test-backup`;

const CUSTOM_IMAGE = 'https://example.com/custom-staff-uploaded-image.jpg';

function main() {
  const hadDataFile = fs.existsSync(DATA_FILE);

  if (!hadDataFile) {
    console.log('No data.json — bootstrapping with seed scripts first');
    execSync('node seed.js && node seed-gaming.js && node seed-admin.js', {
      cwd: BACKEND,
      stdio: 'inherit',
    });
  }

  if (!fs.existsSync(DATA_FILE)) {
    console.error('FAIL: backend/data/data.json not found after bootstrap');
    process.exit(1);
  }

  fs.copyFileSync(DATA_FILE, BACKUP);

  try {
    const data = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
    if (!data.products?.length) {
      console.error('FAIL: No products in data.json — cannot test image preservation');
      process.exit(1);
    }

    const testProduct = data.products[0];
    const { id } = testProduct;
    testProduct.image = CUSTOM_IMAGE;
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), 'utf8');
    console.log(`Set product #${id} image to custom URL before seed`);

    execSync('node seed.js && node seed-gaming.js && node seed-admin.js', {
      cwd: BACKEND,
      stdio: 'inherit',
    });

    const after = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
    const product = after.products.find((p) => p.id === id);

    if (!product) {
      console.error(`FAIL: Product #${id} missing after seed`);
      process.exit(1);
    }

    if (product.image === CUSTOM_IMAGE) {
      console.log('PASS: Custom product image preserved after seed (fix-images.js not run)');
      process.exit(0);
    }

    console.error(`FAIL: Image was overwritten`);
    console.error(`  Expected: ${CUSTOM_IMAGE}`);
    console.error(`  Got:      ${product.image}`);
    process.exit(1);
  } finally {
    fs.copyFileSync(BACKUP, DATA_FILE);
    fs.unlinkSync(BACKUP);
    if (!hadDataFile) {
      fs.unlinkSync(DATA_FILE);
      console.log('Removed bootstrap data.json (was not present before test)');
    } else {
      console.log('Restored original data.json');
    }
  }
}

main();
