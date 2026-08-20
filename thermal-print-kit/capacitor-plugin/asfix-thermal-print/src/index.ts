import { registerPlugin } from '@capacitor/core';
import type { AsfixThermalPrintPlugin } from './definitions';

const AsfixThermalPrint = registerPlugin<AsfixThermalPrintPlugin>('AsfixThermalPrint', {
  web: () => import('./web').then((m) => new m.AsfixThermalPrintWeb()),
});

export * from './definitions';
export { AsfixThermalPrint };
