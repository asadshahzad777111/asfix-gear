import { WebPlugin } from '@capacitor/core';
import type {
  AsfixThermalPrintPlugin,
  ConnectOptions,
  ConnectResult,
  ListPrintersResult,
  PrintEscPosOptions,
  PrintTextOptions,
  StatusResult,
} from './definitions';

/** Browser stub — real print only runs inside the Android Capacitor shell. */
export class AsfixThermalPrintWeb extends WebPlugin implements AsfixThermalPrintPlugin {
  async listPrinters(): Promise<ListPrintersResult> {
    return { printers: [] };
  }

  async connect(_options: ConnectOptions): Promise<ConnectResult> {
    throw this.unavailable('AsfixThermalPrint requires the AsFix POS Android app');
  }

  async disconnect(): Promise<void> {
    /* no-op on web */
  }

  async printText(_options: PrintTextOptions): Promise<{ ok: boolean }> {
    throw this.unavailable('AsfixThermalPrint requires the AsFix POS Android app');
  }

  async printEscPos(_options: PrintEscPosOptions): Promise<{ ok: boolean }> {
    throw this.unavailable('AsfixThermalPrint requires the AsFix POS Android app');
  }

  async getStatus(): Promise<StatusResult> {
    return { connected: false, address: null, bluetoothEnabled: false };
  }

  async requestPermissions(): Promise<{ granted: boolean }> {
    return { granted: false };
  }
}
