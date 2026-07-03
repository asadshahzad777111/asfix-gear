/**
 * iPhone repair rate card — internal cost + retail range per model & part.
 * Customer UI shows min/max only; purchase + labor sent to owner via WhatsApp.
 */

export const IPHONE_RATE_PART_LABELS = {
  penal_service_pack: 'Display Service Pack',
  battery_cell: 'Battery',
  front_glass: 'Front Glass',
  back_glass: 'Back Glass',
  housing: 'Housing',
};

/** Compact source rows — expanded to flat records in buildIphoneRepairRateRecords(). */
const SOURCE = [
  {
    models: ['iPhone 6'],
    parts: {
      penal_service_pack: { p: 1600, l: 500, min: 2100, max: 3200 },
      battery_cell: { p: 800, l: 500, min: 1300, max: 2000 },
      front_glass: { p: 150, l: 1000, min: 1150, max: 1200 },
      housing: { p: 1000, l: 1000, min: 2000, max: 3000 },
    },
  },
  {
    models: ['iPhone 7'],
    parts: {
      penal_service_pack: { p: 1800, l: 500, min: 2300, max: 3400 },
      battery_cell: { p: 1000, l: 500, min: 1500, max: 2200 },
      front_glass: { p: 150, l: 1000, min: 1150, max: 1700 },
      housing: { p: 1500, l: 1000, min: 2500, max: 3500 },
    },
  },
  {
    models: ['iPhone 8'],
    parts: {
      penal_service_pack: { p: 2000, l: 500, min: 2500, max: 6000 },
      battery_cell: { p: 1000, l: 500, min: 1500, max: 2200 },
      front_glass: { p: 150, l: 1000, min: 1150, max: 1700 },
      back_glass: { p: 200, l: 1500, min: 1700, max: 2200 },
      housing: { p: 1500, l: 1500, min: 3000, max: 4000 },
    },
  },
  {
    models: ['iPhone X'],
    parts: {
      penal_service_pack: { p: 10000, l: 1000, min: 11000, max: 12500 },
      battery_cell: { p: 1800, l: 1000, min: 2800, max: 4000 },
      front_glass: { p: 200, l: 2000, min: 2200, max: 2750 },
      back_glass: { p: 250, l: 2500, min: 2750, max: 3300 },
      housing: { p: 2500, l: 2000, min: 4500, max: 5500 },
    },
  },
  {
    models: ['iPhone XS'],
    parts: {
      penal_service_pack: { p: 10000, l: 1000, min: 11000, max: 12500 },
      battery_cell: { p: 1800, l: 1500, min: 3300, max: 4500 },
      front_glass: { p: 200, l: 2000, min: 2200, max: 2750 },
      back_glass: { p: 250, l: 2500, min: 2750, max: 3300 },
      housing: { p: 2500, l: 2000, min: 4500, max: 5500 },
    },
  },
  {
    models: ['iPhone XS Max'],
    parts: {
      penal_service_pack: { p: 16000, l: 1500, min: 17500, max: 20000 },
      battery_cell: { p: 2500, l: 1500, min: 4000, max: 5000 },
      front_glass: { p: 250, l: 3000, min: 3250, max: 4300 },
      back_glass: { p: 300, l: 3000, min: 3300, max: 3850 },
      housing: { p: 4000, l: 2500, min: 6500, max: 8000 },
    },
  },
  {
    models: ['iPhone 11 Pro Max'],
    parts: {
      penal_service_pack: { p: 22000, l: 2000, min: 24000, max: 27000 },
      battery_cell: { p: 2500, l: 2000, min: 4500, max: 5500 },
      front_glass: { p: 250, l: 4000, min: 4250, max: 5300 },
      back_glass: { p: 350, l: 3500, min: 3850, max: 4350 },
      housing: { p: 6000, l: 3000, min: 9000, max: 11000 },
    },
  },
  {
    models: ['iPhone 12 Pro Max'],
    parts: {
      penal_service_pack: { p: 30000, l: 2000, min: 32000, max: 38000 },
      battery_cell: { p: 3000, l: 2500, min: 5500, max: 6500 },
      front_glass: { p: 350, l: 5000, min: 5350, max: 6400 },
      back_glass: { p: 400, l: 4000, min: 4400, max: 4950 },
      housing: { p: 10000, l: 4000, min: 14000, max: 17000 },
    },
  },
  {
    models: ['iPhone 13 Pro Max'],
    parts: {
      penal_service_pack: { p: 40000, l: 3000, min: 43000, max: 50000 },
      battery_cell: { p: 4000, l: 2500, min: 6500, max: 7500 },
      front_glass: { p: 350, l: 8000, min: 8350, max: 10400 },
      back_glass: { p: 400, l: 4500, min: 4900, max: 5500 },
      housing: { p: 12000, l: 5000, min: 17000, max: 21000 },
    },
  },
  {
    models: ['iPhone 14 Pro Max'],
    parts: {
      penal_service_pack: { p: 55000, l: 5000, min: 60000, max: 66000 },
      battery_cell: { p: 5000, l: 5000, min: 10000, max: 13000 },
      front_glass: { p: 500, l: 10000, min: 10500, max: 12600 },
      back_glass: { p: 600, l: 5000, min: 5600, max: 7700 },
      housing: { p: 14000, l: 6000, min: 20000, max: 23000 },
    },
  },
  {
    models: ['iPhone 15 Pro Max'],
    parts: {
      penal_service_pack: { p: 80000, l: 5000, min: 85000, max: 96000 },
      battery_cell: { p: 7000, l: 5000, min: 12000, max: 14000 },
      front_glass: { p: 600, l: 15000, min: 15600, max: 20700 },
      back_glass: { p: 3000, l: 10000, min: 13000, max: 15500 },
      housing: { p: 18000, l: 8000, min: 26000, max: 30000 },
    },
  },
  {
    models: ['iPhone 16 Pro Max'],
    parts: {
      penal_service_pack: { p: 100000, l: 7000, min: 107000, max: 120000 },
      battery_cell: { p: 8000, l: 8000, min: 16000, max: 20000 },
      front_glass: { p: 1000, l: 15000, min: 16000, max: 21500 },
      back_glass: { p: 4000, l: 12000, min: 16000, max: 19000 },
      housing: { p: 20000, l: 10000, min: 30000, max: 34000 },
    },
  },
  {
    models: ['iPhone 17 Pro Max'],
    parts: {
      penal_service_pack: { p: 130000, l: 10000, min: 140000, max: 165000 },
      battery_cell: { p: 12000, l: 12000, min: 24000, max: 27000 },
      front_glass: { p: 1500, l: 25000, min: 26500, max: 32000 },
      back_glass: { p: 5000, l: 12000, min: 17000, max: 20000 },
      housing: { p: 25000, l: 12000, min: 37000, max: 45000 },
    },
  },
];

export function buildIphoneRepairRateRecords() {
  const records = [];
  for (const row of SOURCE) {
    for (const model of row.models) {
      for (const [part_type, rates] of Object.entries(row.parts)) {
        records.push({
          brand: 'Apple iPhone',
          model,
          part_type,
          part_label: IPHONE_RATE_PART_LABELS[part_type] || part_type,
          purchase_price: rates.p,
          fitting_labor_charges: rates.l,
          min_selling_price: rates.min,
          max_selling_price: rates.max,
          active: true,
        });
      }
    }
  }
  return records;
}

export const MAZDORI_KEYWORDS = /\b(mazdori|mazdoori|fitting\s*only|labor\s*only|labou?r\s*charges?\s*only|sirf\s*mazdori|only\s*fitting)\b/i;
