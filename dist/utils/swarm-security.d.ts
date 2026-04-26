import { SwarmMessage } from "./swarm-messaging";
export interface SwarmPolicy {
    allowed_tools: string[];
    allowed_files: string[];
    network: "allow" | "deny";
    exec: "sandbox" | "none";
    max_tokens: number;
}
export declare function registerSwarmPolicy(agent: string, policy: SwarmPolicy): void;
export declare function enforceSwarmPolicy(agent: string, action: string, target?: string): boolean;
export declare function processSwarmMessage(msg: SwarmMessage): {
    valid: boolean;
    sanitized: any;
    reason?: string;
};
//# sourceMappingURL=swarm-security.d.ts.map