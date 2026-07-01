import { buildContactPath, buildContactPrefill } from '../utils/contactPrefill';

export const REPAIR_DEVICE_BRANDS = [
  {
    brand: 'Apple iPhone',
    models: ['iPhone X', '11', '12', '13', '14', '15', '16', 'SE'],
  },
  {
    brand: 'Samsung',
    models: ['Galaxy A series', 'S series', 'Note', 'Z Fold / Flip'],
  },
  {
    brand: 'Xiaomi / Redmi',
    models: ['Redmi Note', 'Redmi A', 'Poco', 'Mi series'],
  },
  {
    brand: 'Oppo / Vivo / Realme',
    models: ['Oppo A & Reno', 'Vivo Y & V', 'Realme C & Narzo'],
  },
  {
    brand: 'Infinix / Tecno / Itel',
    models: ['Hot', 'Spark', 'Camon', 'Pop & Smart'],
  },
  {
    brand: 'Huawei / Honor',
    models: ['P series', 'Y series', 'Honor X & Magic'],
  },
];

export function repairQuoteContactPath(serviceName, modelHint = '') {
  return buildContactPath(buildContactPrefill({ type: 'repair-service', serviceName, modelHint }));
}

export function generalRepairQuoteContactPath(modelHint = '') {
  return buildContactPath(buildContactPrefill({ type: 'repair-model', modelHint }));
}
