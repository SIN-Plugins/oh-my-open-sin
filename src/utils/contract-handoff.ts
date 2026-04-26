import crypto from "crypto";
import { structuredLog } from "./telemetry";

const HMAC_SECRET = process.env.SIN_HMAC_SECRET || "sin-swarm-zero-trust-default";

export interface ContractPayload {
  from: string;
  to: string;
  phase: string;
  artifact: Record<string, any>;
  verification_score?: number;
  signature: string;
  ts: number;
}

export function signContract(payload: Omit<ContractPayload, "signature">): ContractPayload {
  const sorted = JSON.stringify(payload.artifact, Object.keys(payload.artifact).sort());
  const hmac = crypto.createHmac("sha256", HMAC_SECRET);
  hmac.update(`${payload.from}:${payload.to}:${payload.phase}:${sorted}:${payload.ts}`);
  return { ...payload, signature: hmac.digest("hex") };
}

export function verifyContract(payload: ContractPayload): boolean {
  const expected = signContract({ from: payload.from, to: payload.to, phase: payload.phase, artifact: payload.artifact, verification_score: payload.verification_score, ts: payload.ts });
  return crypto.timingSafeEqual(Buffer.from(payload.signature), Buffer.from(expected.signature));
}

export function enforceContractSchema(artifact: any, requiredKeys: string[]): boolean {
  if (typeof artifact !== "object" || artifact === null) return false;
  return requiredKeys.every(k => k in artifact);
}

export function logContractHandoff(payload: ContractPayload, valid: boolean) {
  structuredLog(valid ? "info" : "warn", "contract_handoff", {
    from: payload.from, to: payload.to, phase: payload.phase, valid, score: payload.verification_score, ts: new Date(payload.ts).toISOString()
  });
}
