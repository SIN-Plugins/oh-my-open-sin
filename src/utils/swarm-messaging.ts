import crypto from "crypto";
import { structuredLog } from "./telemetry";

const HMAC_SECRET = process.env.SIN_HMAC_SECRET || "sin-swarm-zero-trust-default";
const INJECTION_PATTERNS = [
  /ignore previous instructions/gi,
  /system prompt override/gi,
  /<\|.*?\|>/g,
  /act as.*administrator/gi,
  /bypass.*policy/gi
];

export interface SwarmMessage {
  from: string;
  to: string;
  type: "handoff" | "critique" | "request" | "response" | "alert";
  payload: Record<string, any>;
  signature: string;
  ts: number;
}

export function signMessage(msg: Omit<SwarmMessage, "signature">): SwarmMessage {
  const payloadStr = JSON.stringify(msg.payload, Object.keys(msg.payload).sort());
  const hmac = crypto.createHmac("sha256", HMAC_SECRET);
  hmac.update(`${msg.from}:${msg.to}:${msg.type}:${payloadStr}:${msg.ts}`);
  return { ...msg, signature: hmac.digest("hex") };
}

export function verifyMessage(msg: SwarmMessage): boolean {
  const expected = signMessage({ from: msg.from, to: msg.to, type: msg.type, payload: msg.payload, ts: msg.ts });
  return crypto.timingSafeEqual(Buffer.from(msg.signature), Buffer.from(expected.signature));
}

export function sanitizePayload(payload: Record<string, any>): Record<string, any> {
  const sanitized: Record<string, any> = {};
  for (const [k, v] of Object.entries(payload)) {
    if (typeof v === "string") {
      let clean = v;
      for (const p of INJECTION_PATTERNS) clean = clean.replace(p, "");
      sanitized[k] = clean.trim();
    } else {
      sanitized[k] = v;
    }
  }
  return sanitized;
}

export function logSwarmInteraction(msg: SwarmMessage, verified: boolean) {
  structuredLog(verified ? "info" : "warn", "swarm_message", {
    from: msg.from,
    to: msg.to,
    type: msg.type,
    verified,
    payload_keys: Object.keys(msg.payload),
    ts: new Date(msg.ts).toISOString()
  });
}
