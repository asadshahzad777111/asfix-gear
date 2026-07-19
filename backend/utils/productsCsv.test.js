import assert from 'node:assert/strict';
import {
  productsToCsv,
  parseCsv,
  csvRecordToPatch,
  salePrice,
} from './productsCsv.js';

const sample = [
  {
    id: 1,
    name: 'iPhone 13 Soft Case',
    category: 'Cases',
    brand: 'AsFix',
    price: 1500,
    discount_percent: 10,
    stock: 12,
    compatible_models: 'iPhone 13',
    status: 'published',
  },
];

const csv = productsToCsv(sample);
assert.match(csv, /^id,name,category,brand,price/);
assert.match(csv, /iPhone 13 Soft Case/);
assert.equal(salePrice(1500, 10), 1350);

const { records } = parseCsv(csv);
assert.equal(records.length, 1);
assert.equal(records[0].name, 'iPhone 13 Soft Case');
assert.equal(records[0].discount_percent, '10');

const patch = csvRecordToPatch(records[0]);
assert.equal(patch.price, 1500);
assert.equal(patch.discount_percent, 10);
assert.equal(patch.stock, 12);

const quoted = parseCsv('id,name\n2,"Case, Black"\n');
assert.equal(quoted.records[0].name, 'Case, Black');

console.log('productsCsv.test.js OK');
