export interface ThermalPrinterDevice {
  name: string;
  address: string;
  bonded: boolean;
}

export interface ListPrintersResult {
  printers: ThermalPrinterDevice[];
}

export interface ConnectOptions {
  address: string;
}

export interface ConnectResult {
  connected: boolean;
  address: string;
  name?: string;
}

export interface PrintTextOptions {
  /** Plain receipt text (newlines OK). Native wraps with ESC/POS init + feed + cut. */
  text: string;
  /** Optional MAC; uses last connect() address if omitted. */
  address?: string;
}

export interface PrintEscPosOptions {
  /** Raw ESC/POS bytes as base64. */
  dataBase64: string;
  address?: string;
}

export interface StatusResult {
  connected: boolean;
  address: string | null;
  bluetoothEnabled: boolean;
}

export interface AsfixThermalPrintPlugin {
  listPrinters(): Promise<ListPrintersResult>;
  connect(options: ConnectOptions): Promise<ConnectResult>;
  disconnect(): Promise<void>;
  printText(options: PrintTextOptions): Promise<{ ok: boolean }>;
  printEscPos(options: PrintEscPosOptions): Promise<{ ok: boolean }>;
  getStatus(): Promise<StatusResult>;
  /** Request Android 12+ BLUETOOTH_CONNECT / SCAN when needed. */
  requestPermissions(): Promise<{ granted: boolean }>;
}
