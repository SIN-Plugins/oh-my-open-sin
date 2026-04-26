/**
 * Strict Skill Schema & Runtime Validator
 * Enterprise-grade validation for skill manifests
 */

export interface SkillManifest {
  id: string;
  name: string;
  version: string;
  description: string;
  triggers: string[];
  agents: string[];
  dependencies?: string[];
  mcp_servers?: Record<string, { 
    command: string; 
    args: string[]; 
    env?: Record<string, string>; 
    health_check_cmd?: string 
  }>;
  system_prompt_injection?: string;
  permissions?: { 
    fs?: "read" | "write" | "deny"; 
    network?: "allow" | "deny"; 
    exec?: "sandbox" | "none" 
  };
  lifecycle?: { 
    on_start?: string; 
    on_stop?: string; 
    timeout_sec?: number 
  };
  min_opencode_version?: string;
  telemetry?: boolean;
}

export function validateSkillManifest(raw: any): SkillManifest {
  const errors: string[] = [];
  
  if (!raw?.id || typeof raw.id !== "string") {
    errors.push("Missing/invalid id");
  }
  
  if (!raw?.name || typeof raw.name !== "string") {
    errors.push("Missing/invalid name");
  }
  
  if (!raw?.version || !/^\d+\.\d+\.\d+$/.test(raw.version)) {
    errors.push("Invalid version (must be semver)");
  }
  
  if (!Array.isArray(raw?.triggers) || raw.triggers.length === 0) {
    errors.push("triggers must be non-empty array");
  }
  
  if (!Array.isArray(raw?.agents)) {
    errors.push("agents must be array");
  }
  
  if (raw.mcp_servers && typeof raw.mcp_servers !== "object") {
    errors.push("mcp_servers must be object");
  }
  
  if (raw.permissions) {
    const p = raw.permissions;
    if (p.fs && !["read", "write", "deny"].includes(p.fs)) {
      errors.push("Invalid fs permission");
    }
    if (p.network && !["allow", "deny"].includes(p.network)) {
      errors.push("Invalid network permission");
    }
    if (p.exec && !["sandbox", "none"].includes(p.exec)) {
      errors.push("Invalid exec permission");
    }
  }
  
  if (errors.length > 0) {
    throw new Error(`❌ Skill ${raw?.id || "unknown"} invalid: ${errors.join(", ")}`);
  }
  
  return raw as SkillManifest;
}
