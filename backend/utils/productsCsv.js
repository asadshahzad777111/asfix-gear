/** CSV helpers for staff Products Sheet export / import (Google Sheets compatible). */

export const PRODUCT_CSV_HEADERS = [
  'id',
  'name',
  'category',
  'brand',
  'price',
  'discount_percent',
  'sale_price',
  'stock',
  'compatible_models',
  'status',
  'sale_count',
  'purchase_count',
  'notes',
];

export function salePrice(price, discountPercent) {
  const p = Number(price);
  if (!Number.isFinite(p)) return '';
  const d = Math.min(90, Math.max(0, Number(discountPercent) || 0));
  return Math.round(p * (1 - d / 100));
}

function csvEscape(value) {
  const str = value == null ? '' : String(value);
  if (/[",\n\r]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export function productToCsvRecord(product) {
  return {
    id: product.id ?? '',
    name: product.name ?? '',
    category: product.category ?? '',
    brand: product.brand ?? '',
    price: product.price ?? '',
    discount_percent: product.discount_percent ?? 0,
    sale_price: salePrice(product.price, product.discount_percent),
    stock: product.stock ?? 0,
    compatible_models: product.compatible_models ?? '',
    status: product.status || 'published',
    sale_count: Math.max(0, Number(product.sale_count) || 0),
    purchase_count: Math.max(0, Number(product.purchase_count) || 0),
    notes: '',
  };
}

export function productToCsvRow(product) {
  const record = productToCsvRecord(product);
  return PRODUCT_CSV_HEADERS.map((header) => record[header] ?? '');
}

export function productsToCsv(products) {
  const lines = [PRODUCT_CSV_HEADERS.join(',')];
  for (const product of products) {
    lines.push(productToCsvRow(product).map(csvEscape).join(','));
  }
  return `${lines.join('\n')}\n`;
}

/** Minimal RFC4180-ish CSV parser (handles quoted commas / newlines). */
export function parseCsv(text) {
  const input = String(text || '').replace(/^\uFEFF/, '');
  const rows = [];
  let row = [];
  let cell = '';
  let inQuotes = false;

  for (let i = 0; i < input.length; i += 1) {
    const ch = input[i];
    const next = input[i + 1];

    if (inQuotes) {
      if (ch === '"' && next === '"') {
        cell += '"';
        i += 1;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        cell += ch;
      }
      continue;
    }

    if (ch === '"') {
      inQuotes = true;
    } else if (ch === ',') {
      row.push(cell);
      cell = '';
    } else if (ch === '\n') {
      row.push(cell);
      cell = '';
      if (row.some((c) => String(c).trim() !== '')) rows.push(row);
      row = [];
    } else if (ch === '\r') {
      /* skip */
    } else {
      cell += ch;
    }
  }

  row.push(cell);
  if (row.some((c) => String(c).trim() !== '')) rows.push(row);

  if (!rows.length) return { headers: [], records: [] };

  const headers = rows[0].map((h) => String(h || '').trim().toLowerCase());
  const records = [];
  for (let r = 1; r < rows.length; r += 1) {
    const cols = rows[r];
    const record = {};
    headers.forEach((header, idx) => {
      record[header] = cols[idx] != null ? String(cols[idx]).trim() : '';
    });
    if (!record.name && !record.id) continue;
    records.push(record);
  }
  return { headers, records };
}

export function csvRecordToPatch(record) {
  const patch = {};
  if (record.name) patch.name = String(record.name).slice(0, 200);
  if (record.category) patch.category = String(record.category).slice(0, 80);
  if (record.brand != null && record.brand !== '') patch.brand = String(record.brand).slice(0, 80);
  if (record.compatible_models != null) {
    patch.compatible_models = String(record.compatible_models).slice(0, 300);
  }
  if (record.price !== '' && record.price != null) {
    const price = Number(record.price);
    if (!Number.isFinite(price) || price < 0) throw new Error('Invalid price');
    patch.price = price;
  }
  if (record.discount_percent !== '' && record.discount_percent != null) {
    const d = Number(record.discount_percent);
    if (!Number.isFinite(d)) throw new Error('Invalid discount_percent');
    patch.discount_percent = Math.min(90, Math.max(0, d));
  }
  if (record.stock !== '' && record.stock != null) {
    const stock = Number(record.stock);
    if (!Number.isFinite(stock) || stock < 0) throw new Error('Invalid stock');
    patch.stock = Math.floor(stock);
  }
  if (record.sale_count !== '' && record.sale_count != null) {
    const saleCount = Number(record.sale_count);
    if (!Number.isFinite(saleCount) || saleCount < 0) throw new Error('Invalid sale_count');
    patch.sale_count = Math.floor(saleCount);
  }
  if (record.purchase_count !== '' && record.purchase_count != null) {
    const purchaseCount = Number(record.purchase_count);
    if (!Number.isFinite(purchaseCount) || purchaseCount < 0) throw new Error('Invalid purchase_count');
    patch.purchase_count = Math.floor(purchaseCount);
  }
  if (record.status) {
    const status = String(record.status).toLowerCase();
    if (status !== 'published' && status !== 'draft') {
      throw new Error('status must be published or draft');
    }
    patch.status = status;
  }
  return patch;
}
