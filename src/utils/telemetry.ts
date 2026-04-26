import fs from "fs/promises";
import path from "path";

const TELEMETRY_LOG = path.join(process.env.HOME || "", ".config/opencode/logs/telemetry.jsonl");

export interface TelemetryEvent {
  level: "info" | "warn" | "error";
  msg: string;
  [key: string]: any;
}

export async function structuredLog(level: "info" | "warn" | "error", msg: string, data: Record<string, any> = {}): Promise<void> {
  const event: TelemetryEvent = {
    level,
    msg,
    timestamp: new Date().toISOString(),
    ...data
  };

  try {
    await fs.mkdir(path.dirname(TELEMETRY_LOG), { recursive: true });
    await fs.appendFile(TELEMETRY_LOG, JSON.stringify(event) + "\n");
  } catch (e: any) {
    console.error(`[telemetry] Failed to write log: ${e.message}`);
  }
}
