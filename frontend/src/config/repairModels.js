import { whatsappLink } from './shop';

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

export function repairQuoteWhatsApp(serviceName, modelHint = '') {
  const modelLine = modelHint ? `Model: *${modelHint}*\n` : '';
  return whatsappLink(
    `Assalam o Alaikum! Main AsFix & Gear se rabta kar raha/rahi hoon.\n\n${modelLine}Service: *${serviceName}*\n\nMere phone ki exact repair cost bata dein — shukriya!`
  );
}

export function generalRepairQuoteWhatsApp(modelHint = '') {
  const modelLine = modelHint ? `Mera phone: *${modelHint}*\n` : '';
  return whatsappLink(
    `Assalam o Alaikum! ${modelLine}Repair ki price aur availability bata dein — AsFix & Gear.`
  );
}
