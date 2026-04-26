/**
 * SIN Policy Engine - OpenPolicyAgent Integration
 * Zero-Trust Policy-as-Code für Enterprise-Swarm
 *
 * Features:
 * - Rego Policy Evaluation
 * - CIS/SOC2 Compliance Rules
 * - Capability-Based Access Control
 * - Real-time Policy Updates
 */
import { EventEmitter } from 'events';
export interface PolicyContext {
    agentId: string;
    action: string;
    resource: string;
    capabilities: string[];
    session?: string;
    timestamp: number;
    metadata?: Record<string, any>;
    subject?: string;
}
export interface PolicyDecision {
    allowed: boolean;
    reason?: string;
    obligations?: string[];
    advice?: string[];
}
export interface PolicyRule {
    id: string;
    name: string;
    description: string;
    rego: string;
    severity: 'critical' | 'high' | 'medium' | 'low';
    category: 'security' | 'compliance' | 'governance' | 'custom';
}
export declare class PolicyEngine extends EventEmitter {
    private policies;
    private policyCache;
    private evaluationCount;
    private denialCount;
    constructor();
    private loadDefaultPolicies;
    registerPolicy(rule: PolicyRule): void;
    evaluate(context: PolicyContext): Promise<PolicyDecision>;
    private isPolicyApplicable;
    private evaluatePolicy;
    getPolicies(category?: string): PolicyRule[];
    getStats(): {
        evaluations: number;
        denials: number;
        policies: number;
    };
    exportRegoBundle(): string;
}
export declare function getPolicyEngine(): PolicyEngine;
export default PolicyEngine;
//# sourceMappingURL=PolicyEngine.d.ts.map