import { structuredLog } from "./telemetry";
import { verifyMessage, sanitizePayload, logSwarmInteraction, SwarmMessage } from "./swarm-messaging";

export interface SwarmPolicy {
  allowed_tools: string[];
  allowed_files: string[];
  network: "allow" | "deny";
  exec: "sandbox" | "none";
  max_tokens: number;
}

const policyStore: Record<string, SwarmPolicy> = {};

export function registerSwarmPolicy(agent: string, policy: SwarmPolicy) {
  policyStore[agent] = policy;
  structuredLog("info", "swarm_policy_registered", { agent, tools: policy.allowed_tools.length, network: policy.network });
}

export function enforceSwarmPolicy(agent: string, action: string, target?: string): boolean {
  const policy = policyStore[agent];
  if (!policy) return true; // Default allow if no policy
  if (action === "tool" && target && !policy.allowed_tools.includes(target)) {
    structuredLog("warn", "swarm_policy_violation", { agent, action, target, reason: "tool_not_allowed" });
    return false;
  }
  if (action === "file" && target && !policy.allowed_files.some(f => target.startsWith(f))) {
    structuredLog("warn", "swarm_policy_violation", { agent, action, target, reason: "file_not_allowed" });
    return false;
  }
  if (action === "network" && policy.network === "deny") {
    structuredLog("warn", "swarm_policy_violation", { agent, action, reason: "network_denied" });
    return false;
  }
  if (action === "exec" && policy.exec === "none") {
    structuredLog("warn", "swarm_policy_violation", { agent, action, reason: "exec_denied" });
    return false;
  }
  return true;
}

export function processSwarmMessage(msg: SwarmMessage): { valid: boolean; sanitized: any; reason?: string } {
  const verified = verifyMessage(msg);
  logSwarmInteraction(msg, verified);
  if (!verified) return { valid: false, sanitized: {}, reason: "signature_mismatch" };
  
  const sanitized = sanitizePayload(msg.payload);
  return { valid: true, sanitized, reason: undefined };
}
