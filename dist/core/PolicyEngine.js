"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.PolicyEngine = void 0;
exports.getPolicyEngine = getPolicyEngine;
const events_1 = require("events");
class PolicyEngine extends events_1.EventEmitter {
    policies = new Map();
    policyCache = new Map();
    evaluationCount = 0;
    denialCount = 0;
    constructor() {
        super();
        this.loadDefaultPolicies();
    }
    loadDefaultPolicies() {
        // CIS Benchmark Policy
        this.registerPolicy({
            id: 'cis-001',
            name: 'No Root Execution',
            description: 'Prevent agents from executing as root',
            rego: `
        package sin.policy.cis
        
        default allow = false
        
        allow {
          input.capabilities[_] != "exec:root"
          not input.action == "execute"
        }
        
        allow {
          input.capabilities[_] == "exec:root"
          input.metadata?.approvedBy == "security-officer"
        }
      `,
            severity: 'critical',
            category: 'security'
        });
        // SOC2 Compliance - Audit Logging
        this.registerPolicy({
            id: 'soc2-001',
            name: 'Mandatory Audit Logging',
            description: 'All actions must be logged for audit trail',
            rego: `
        package sin.policy.soc2
        
        default allow = false
        
        allow {
          input.metadata?.auditId != null
          input.metadata?.timestamp != null
        }
        
        obligation {
          ["log_action", {
            "agent": input.agentId,
            "action": input.action,
            "resource": input.resource,
            "timestamp": input.timestamp
          }]
        }
      `,
            severity: 'high',
            category: 'compliance'
        });
        // Capability-Based Access Control
        this.registerPolicy({
            id: 'cbac-001',
            name: 'Capability Validation',
            description: 'Validate agent has required capabilities',
            rego: `
        package sin.policy.cbac
        
        default allow = false
        
        required_caps = {
          "git:push": ["git:read", "git:write"],
          "fs:delete": ["fs:read", "fs:write"],
          "net:outbound": ["net:dns", "net:http"]
        }
        
        allow {
          not required_caps[input.action]
        }
        
        allow {
          deps := required_caps[input.action]
          all(deps, dep => input.capabilities[_] == dep)
        }
      `,
            severity: 'high',
            category: 'security'
        });
        // Git Branch Protection
        this.registerPolicy({
            id: 'git-001',
            name: 'Main Branch Protection',
            description: 'Require PR review for main branch',
            rego: `
        package sin.policy.git
        
        default allow = false
        
        allow {
          input.resource != "refs/heads/main"
        }
        
        allow {
          input.resource == "refs/heads/main"
          input.metadata?.prReview == true
          input.metadata?.ciPassed == true
        }
      `,
            severity: 'critical',
            category: 'governance'
        });
        // Secret Management
        this.registerPolicy({
            id: 'sec-001',
            name: 'Secret Handling',
            description: 'Prevent secret leakage in logs',
            rego: `
        package sin.policy.secret
        
        default allow = true
        
        deny {
          contains(input.metadata?.logOutput, "password")
        }
        
        deny {
          contains(input.metadata?.logOutput, "token")
        }
        
        deny {
          contains(input.metadata?.logOutput, "secret")
        }
      `,
            severity: 'critical',
            category: 'security'
        });
    }
    registerPolicy(rule) {
        this.policies.set(rule.id, rule);
        this.policyCache.delete(rule.id);
        this.emit('policy:registered', rule);
    }
    async evaluate(context) {
        this.evaluationCount++;
        const applicablePolicies = Array.from(this.policies.values())
            .filter(p => this.isPolicyApplicable(p, context));
        const decisions = [];
        const obligations = [];
        const advice = [];
        for (const policy of applicablePolicies) {
            const decision = await this.evaluatePolicy(policy, context);
            decisions.push(decision);
            if (!decision.allowed) {
                this.denialCount++;
                this.emit('policy:denied', { policy, context, decision });
                return {
                    allowed: false,
                    reason: `Policy ${policy.id} (${policy.name}) denied: ${decision.reason}`,
                    obligations,
                    advice
                };
            }
            if (decision.obligations) {
                obligations.push(...decision.obligations);
            }
            if (decision.advice) {
                advice.push(...decision.advice);
            }
        }
        this.emit('policy:evaluated', { context, decision: { allowed: true } });
        return {
            allowed: true,
            obligations: obligations.length > 0 ? obligations : undefined,
            advice: advice.length > 0 ? advice : undefined
        };
    }
    isPolicyApplicable(policy, context) {
        // Simple heuristic - in production, use AST analysis of rego
        if (policy.category === 'security' && context.action.includes('exec')) {
            return true;
        }
        if (policy.category === 'compliance') {
            return true;
        }
        if (policy.category === 'governance' && context.action.includes('git')) {
            return true;
        }
        if (policy.category === 'custom') {
            return true;
        }
        return true; // Default: evaluate all
    }
    async evaluatePolicy(policy, context) {
        // Simplified Rego evaluation - in production, use OPA WASM
        const rego = policy.rego;
        // Simulate policy evaluation based on policy ID
        switch (policy.id) {
            case 'cis-001':
                if (context.action === 'execute' && context.capabilities.includes('exec:root')) {
                    if (!context.metadata?.approvedBy || context.metadata.approvedBy !== 'security-officer') {
                        return { allowed: false, reason: 'Root execution requires security officer approval' };
                    }
                }
                return { allowed: true };
            case 'soc2-001':
                if (!context.metadata?.auditId || !context.metadata?.timestamp) {
                    return {
                        allowed: false,
                        reason: 'Audit logging required',
                        obligations: ['log_action']
                    };
                }
                return {
                    allowed: true,
                    obligations: [`log_action:${JSON.stringify({ agent: context.agentId, action: context.action })}`]
                };
            case 'cbac-001':
                const requiredCaps = {
                    'git:push': ['git:read', 'git:write'],
                    'fs:delete': ['fs:read', 'fs:write'],
                    'net:outbound': ['net:dns', 'net:http']
                };
                const required = requiredCaps[context.action];
                if (required) {
                    const hasAll = required.every(cap => context.capabilities.includes(cap));
                    if (!hasAll) {
                        return {
                            allowed: false,
                            reason: `Missing capabilities: ${required.filter(c => !context.capabilities.includes(c)).join(', ')}`
                        };
                    }
                }
                return { allowed: true };
            case 'git-001':
                if (context.resource === 'refs/heads/main') {
                    if (!context.metadata?.prReview || !context.metadata?.ciPassed) {
                        return {
                            allowed: false,
                            reason: 'Main branch requires PR review and CI passing'
                        };
                    }
                }
                return { allowed: true };
            case 'sec-001':
                const logOutput = context.metadata?.logOutput || '';
                if (logOutput.includes('password') || logOutput.includes('token') || logOutput.includes('secret')) {
                    return {
                        allowed: false,
                        reason: 'Potential secret leakage detected in log output',
                        advice: ['Use secret masking for sensitive data']
                    };
                }
                return { allowed: true };
            default:
                return { allowed: true };
        }
    }
    getPolicies(category) {
        const policies = Array.from(this.policies.values());
        if (category) {
            return policies.filter(p => p.category === category);
        }
        return policies;
    }
    getStats() {
        return {
            evaluations: this.evaluationCount,
            denials: this.denialCount,
            policies: this.policies.size
        };
    }
    exportRegoBundle() {
        const bundles = [];
        for (const [id, policy] of this.policies.entries()) {
            bundles.push(`# Policy: ${policy.name} (${id})`);
            bundles.push(`# ${policy.description}`);
            bundles.push(policy.rego);
            bundles.push('---');
        }
        return bundles.join('\n');
    }
}
exports.PolicyEngine = PolicyEngine;
// Singleton instance
let policyEngineInstance = null;
function getPolicyEngine() {
    if (!policyEngineInstance) {
        policyEngineInstance = new PolicyEngine();
    }
    return policyEngineInstance;
}
exports.default = PolicyEngine;
//# sourceMappingURL=PolicyEngine.js.map