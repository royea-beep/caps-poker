/**
 * @caps/debugger — Config
 * Runtime configuration singleton. Call initDebugger() once at app startup.
 */

export interface DebuggerConfig {
  appName: string;              // 'caps' | 'wingman' | 'clubgg'
  version: string;              // app version string
  supabaseUrl: string;
  supabaseAnonKey: string;
  whatsappEdgeFunctionUrl: string; // full URL to whatsapp-bot-handler edge function
  alertPhone: string;           // e.g. '+972526173700'
  enabled: boolean;             // false = disable all (production/testers)
  screenshotFps: number;        // default 2
  maxScreenshots: number;       // default 10
}

let _config: DebuggerConfig | null = null;

export function initDebugger(config: DebuggerConfig): void {
  _config = config;
}

export function getConfig(): DebuggerConfig {
  if (!_config) throw new Error('@caps/debugger: call initDebugger() first');
  return _config;
}

export function isDebuggerReady(): boolean {
  return _config !== null;
}
