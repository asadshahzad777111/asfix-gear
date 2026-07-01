import { buildContactPath, buildContactPrefill } from '../utils/contactPrefill';

/**
 * Single source of truth for every device brand/series/model AsFix & Gear
 * services and sells accessories for. Feeds BOTH:
 *  - `RepairModelsPanel.jsx` (repair quote chips on the Repair page)
 *  - `ShopMegaMenu.jsx` (Shop nav brand → model slide-out)
 *  - `repairIntake.js` `DEVICE_BRANDS` (repair booking form dropdown)
 *
 * Shape: [{ brand, series: [{ name, models: [string, ...] }] }]
 * Keep brands/series grouped and ordered the same way the catalog was
 * provided so it stays easy to audit against the source list.
 */
export const REPAIR_DEVICE_BRANDS = [
  {
    brand: 'Apple iPhone',
    series: [
      {
        name: 'iPhone 17 Series',
        models: ['iPhone 17 Pro Max', 'iPhone 17 Pro', 'iPhone Air', 'iPhone 17', 'iPhone 17e'],
      },
      {
        name: 'iPhone 16 Series',
        models: ['iPhone 16 Pro Max', 'iPhone 16 Pro', 'iPhone 16 Plus', 'iPhone 16', 'iPhone 16e'],
      },
      {
        name: 'iPhone 15 Series',
        models: ['iPhone 15 Pro Max', 'iPhone 15 Pro', 'iPhone 15 Plus', 'iPhone 15'],
      },
      {
        name: 'iPhone 14 Series',
        models: ['iPhone 14 Pro Max', 'iPhone 14 Pro', 'iPhone 14 Plus', 'iPhone 14'],
      },
      {
        name: 'iPhone 13 Series',
        models: ['iPhone 13 Pro Max', 'iPhone 13 Pro', 'iPhone 13', 'iPhone 13 Mini'],
      },
      {
        name: 'iPhone 12 Series',
        models: ['iPhone 12 Pro Max', 'iPhone 12 Pro', 'iPhone 12', 'iPhone 12 Mini'],
      },
      {
        name: 'iPhone 11 Series',
        models: ['iPhone 11 Pro Max', 'iPhone 11 Pro', 'iPhone 11'],
      },
      {
        name: 'Legacy',
        models: [
          'iPhone XS Max', 'iPhone XS', 'iPhone XR', 'iPhone X',
          'iPhone 8 Plus', 'iPhone 8', 'iPhone 7 Plus', 'iPhone 7',
          'iPhone 6s Plus', 'iPhone 6s', 'iPhone 6 Plus', 'iPhone 6',
          'iPhone SE (2020/2022)',
        ],
      },
    ],
  },
  {
    brand: 'Samsung',
    series: [
      {
        name: 'S-Series',
        models: [
          'S26 Ultra', 'S26+', 'S26', 'S25 Ultra', 'S25+', 'S25', 'S24 Ultra', 'S24+', 'S24',
          'S23 Ultra', 'S23+', 'S23', 'S22 Ultra', 'S22+', 'S22', 'S21 Ultra', 'S21+', 'S21', 'S21 FE',
          'S20 Ultra', 'S20+', 'S20', 'S20 FE', 'S10 Plus', 'S10', 'S9 Plus', 'S9', 'S8 Plus', 'S8',
        ],
      },
      {
        name: 'Note Series',
        models: ['Note 20 Ultra', 'Note 20', 'Note 10 Plus', 'Note 10', 'Note 9', 'Note 8'],
      },
      {
        name: 'A-Series',
        models: [
          'A55', 'A35', 'A15', 'A05s', 'A54', 'A34', 'A24', 'A14', 'A04s', 'A73', 'A53', 'A33', 'A23',
          'A13', 'A72', 'A52', 'A32', 'A22', 'A12', 'A71', 'A51', 'A31', 'A21s', 'A11', 'A70', 'A50',
          'A30', 'A20', 'A10',
        ],
      },
      {
        name: 'Z Series',
        models: ['Z Fold 6', 'Z Flip 6', 'Z Fold 5', 'Z Flip 5', 'Z Fold 4', 'Z Flip 4'],
      },
    ],
  },
  {
    brand: 'OnePlus',
    series: [
      {
        name: 'Latest Flagships',
        models: ['OnePlus 13', 'OnePlus 13R', 'OnePlus 12', 'OnePlus 12R', 'OnePlus 11', 'OnePlus 11R'],
      },
      {
        name: 'Older Flagships',
        models: [
          'OnePlus 10 Pro', '10T', '10R', '9 Pro', '9', '9R', '9RT', '8 Pro', '8', '8T',
          '7 Pro', '7', '7T', '7T Pro', '6', '6T',
        ],
      },
      {
        name: 'Nord Series',
        models: [
          'Nord 4', 'Nord CE 4', 'Nord 3', 'Nord CE 3', 'Nord CE 3 Lite', 'Nord 2',
          'Nord CE 2', 'Nord CE 2 Lite', 'Nord N20', 'Nord N10',
        ],
      },
    ],
  },
  {
    brand: 'Xiaomi / Redmi / POCO',
    series: [
      {
        name: 'Xiaomi Mi Series',
        models: [
          'Xiaomi 15 Ultra', '14 Ultra', '14', '13T Pro', '13T', '13 Ultra', '13', '12 Pro', '12',
          '12T', '12T Pro', '11T', '11T Pro', 'Mi 11 Lite', 'Mi 10T',
        ],
      },
      {
        name: 'Redmi Note Series',
        models: [
          'Redmi Note 14 Pro', 'Note 14 5G', 'Note 13 Pro Plus', 'Note 13 Pro', 'Note 13',
          'Note 12 Pro', 'Note 12', 'Note 11 Pro', 'Note 11', 'Note 10 Pro', 'Note 10',
          'Note 9 Pro', 'Note 9', 'Note 8 Pro', 'Note 8',
        ],
      },
      {
        name: 'Redmi Budget',
        models: ['Redmi 14C', 'Redmi 14', 'Redmi 13C', 'Redmi 13', 'Redmi 12', 'Redmi 12C', 'Redmi 10', 'Redmi A3', 'Redmi A2 Plus'],
      },
      {
        name: 'POCO Series',
        models: [
          'POCO F6 Pro', 'F6', 'X6 Pro', 'X6', 'M6 Pro', 'F5', 'X5 Pro', 'F4', 'X4 Pro', 'X3 Pro', 'X3 GT', 'F3',
        ],
      },
    ],
  },
  {
    brand: 'Vivo / iQOO',
    series: [
      {
        name: 'V-Series',
        models: [
          'V40 Pro', 'V40', 'V40 Lite', 'V30 Pro', 'V30', 'V30e', 'V29 Pro', 'V29', 'V29e',
          'V27 Pro', 'V27', 'V25 Pro', 'V25', 'V23 5G', 'V23e', 'V21', 'V21e', 'V20', 'V19',
        ],
      },
      {
        name: 'Y-Series',
        models: [
          'Y200', 'Y100', 'Y38', 'Y28', 'Y18', 'Y17s', 'Y27', 'Y36', 'Y02s', 'Y22', 'Y35',
          'Y16', 'Y21', 'Y20', 'Y30', 'Y51', 'Y19', 'Y15', 'Y12', 'Y93',
        ],
      },
      {
        name: 'X & iQOO',
        models: ['X100 Pro', 'X90 Pro', 'iQOO 12', 'iQOO Neo 9', 'iQOO Z9'],
      },
    ],
  },
  {
    brand: 'Oppo',
    series: [
      {
        name: 'Reno Series',
        models: [
          'Reno 12 Pro', 'Reno 12', 'Reno 11 Pro', 'Reno 11', 'Reno 11F', 'Reno 10 Pro', 'Reno 10',
          'Reno 8 Pro', 'Reno 8', 'Reno 8T', 'Reno 7', 'Reno 6 Pro', 'Reno 6', 'Reno 5',
        ],
      },
      {
        name: 'A-Series',
        models: [
          'A60', 'A38', 'A18', 'A78', 'A58', 'A98', 'A17', 'A57', 'A77', 'A96', 'A76', 'A16',
          'A54', 'A53', 'A15', 'A5 2020', 'A9 2020',
        ],
      },
      {
        name: 'Find Series',
        models: ['Find X7 Ultra', 'Find X6 Pro', 'Find N3 Flip'],
      },
    ],
  },
  {
    brand: 'Infinix',
    series: [
      {
        name: 'GT Series',
        models: ['GT 20 Pro', 'GT 10 Pro'],
      },
      {
        name: 'Zero Series',
        models: ['Zero 40', 'Zero 30 5G', 'Zero 30 4G', 'Zero Ultra', 'Zero 20'],
      },
      {
        name: 'Note Series',
        models: [
          'Note 50 Pro', 'Note 50', 'Note 40 Pro', 'Note 40', 'Note 30 Pro', 'Note 30',
          'Note 12', 'Note 12 G96', 'Note 11', 'Note 10 Pro',
        ],
      },
      {
        name: 'Hot Series',
        models: [
          'Hot 60 Pro', 'Hot 60i', 'Hot 50 Pro Plus', 'Hot 50', 'Hot 40 Pro', 'Hot 40', 'Hot 40i',
          'Hot 30', 'Hot 30i', 'Hot 20', 'Hot 12', 'Hot 11', 'Hot 10', 'Hot 9',
        ],
      },
      {
        name: 'Smart Series',
        models: ['Smart 8', 'Smart 7', 'Smart 6'],
      },
    ],
  },
  {
    brand: 'Tecno',
    series: [
      {
        name: 'Camon Series',
        models: [
          'Camon 30 Premier', 'Camon 30 Pro', 'Camon 30', 'Camon 20 Pro', 'Camon 20',
          'Camon 19 Pro', 'Camon 18', 'Camon 17',
        ],
      },
      {
        name: 'Spark Series',
        models: [
          'Spark 20 Pro Plus', 'Spark 20 Pro', 'Spark 20', 'Spark 20C', 'Spark 10 Pro',
          'Spark 10', 'Spark 8 Pro', 'Spark 7',
        ],
      },
      {
        name: 'Pova Series',
        models: ['Pova 6 Pro', 'Pova 6', 'Pova 5 Pro', 'Pova 4'],
      },
      {
        name: 'Pop Series',
        models: ['Pop 8', 'Pop 7'],
      },
    ],
  },
  {
    brand: 'Google Pixel',
    series: [
      {
        name: 'Latest',
        models: ['Pixel 10 Pro XL', 'Pixel 10 Pro', 'Pixel 10'],
      },
      {
        name: 'Current',
        models: ['Pixel 9 Pro XL', 'Pixel 9 Pro', 'Pixel 9', 'Pixel 9a'],
      },
      {
        name: 'Older',
        models: [
          'Pixel 8 Pro', 'Pixel 8', 'Pixel 8a', 'Pixel 7 Pro', 'Pixel 7', 'Pixel 7a',
          'Pixel 6 Pro', 'Pixel 6', 'Pixel 6a', 'Pixel 5', 'Pixel 4 XL', 'Pixel 4',
          'Pixel 3 XL', 'Pixel 3',
        ],
      },
    ],
  },
  {
    brand: 'Realme',
    series: [
      {
        name: 'Number Series',
        models: [
          'Realme 13 Pro+', '13', '12 Pro+', '12', '11 Pro+', '11', '10 Pro', '10', '9 Pro', '9',
          '8 Pro', '8', '7 Pro', '7', '6 Pro', '6', '5 Pro', '5',
        ],
      },
      {
        name: 'C-Series',
        models: ['C67', 'C65', 'C53', 'C51', 'C35', 'C33', 'C30', 'C25s', 'C21', 'C15', 'C12', 'C11'],
      },
      {
        name: 'GT Series',
        models: ['GT 6', 'GT 6T', 'GT Neo 5', 'GT Master Edition'],
      },
    ],
  },
  {
    brand: 'Motorola',
    series: [
      {
        name: 'All Models',
        models: ['Edge 50 Ultra', 'Edge 50 Pro', 'Edge 40', 'G85', 'G54', 'Moto G Play'],
      },
    ],
  },
  {
    brand: 'Nothing Phone',
    series: [
      {
        name: 'All Models',
        models: ['Nothing Phone (2a)', 'Nothing Phone (2)', 'Nothing Phone (1)', 'CMF Phone 1'],
      },
    ],
  },
  {
    brand: 'Honor',
    series: [
      {
        name: 'All Models',
        models: ['Honor 200 Pro', 'Honor 200', 'Honor 90', 'Honor X9b', 'Honor X8b', 'Honor X7b', 'Honor 70'],
      },
    ],
  },
  {
    brand: 'Itel',
    series: [
      {
        name: 'All Models',
        models: ['S24', 'P55+', 'P55', 'A70', 'Vision 3'],
      },
    ],
  },
];

export function repairQuoteContactPath(serviceName, modelHint = '') {
  return buildContactPath(buildContactPrefill({ type: 'repair-service', serviceName, modelHint }));
}

export function generalRepairQuoteContactPath(modelHint = '') {
  return buildContactPath(buildContactPrefill({ type: 'repair-model', modelHint }));
}

/**
 * Maps a `SHOP_BRANDS` id (frontend/src/config/products.js) to its matching
 * `REPAIR_DEVICE_BRANDS` group, so shop UI (e.g. the Shop mega menu) can
 * reuse the same brand → model data instead of inventing a new device list.
 * Every id in `SHOP_BRANDS` MUST have an entry here — the fallback catches
 * the case where a shop brand id is added without a matching mapping.
 */
export const SHOP_BRAND_TO_REPAIR_BRAND = {
  iphone: 'Apple iPhone',
  samsung: 'Samsung',
  oneplus: 'OnePlus',
  xiaomi: 'Xiaomi / Redmi / POCO',
  vivo: 'Vivo / iQOO',
  oppo: 'Oppo',
  infinix: 'Infinix',
  tecno: 'Tecno',
  pixel: 'Google Pixel',
  realme: 'Realme',
  motorola: 'Motorola',
  nothing: 'Nothing Phone',
  honor: 'Honor',
  itel: 'Itel',
};

function findBrandGroup(shopBrandId) {
  const brandName = SHOP_BRAND_TO_REPAIR_BRAND[shopBrandId];
  return REPAIR_DEVICE_BRANDS.find((g) => g.brand === brandName) || null;
}

/** Flat list of every model string for a shop brand id (used for search links). */
export function getModelsForShopBrand(shopBrandId) {
  const group = findBrandGroup(shopBrandId);
  if (!group) return [];
  return group.series.flatMap((s) => s.models);
}

/** Series-grouped models for a shop brand id (used for grouped chip UI). */
export function getSeriesForShopBrand(shopBrandId) {
  const group = findBrandGroup(shopBrandId);
  return group ? group.series : [];
}
