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
        health_check_cmd?: string;
    }>;
    system_prompt_injection?: string;
    permissions?: {
        fs?: "read" | "write" | "deny";
        network?: "allow" | "deny";
        exec?: "sandbox" | "none";
    };
    lifecycle?: {
        on_start?: string;
        on_stop?: string;
        timeout_sec?: number;
    };
    min_opencode_version?: string;
    telemetry?: boolean;
}
export declare function validateSkillManifest(raw: any): SkillManifest;
//# sourceMappingURL=skill-schema.d.ts.map