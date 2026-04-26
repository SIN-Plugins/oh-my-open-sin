/**
 * Advanced Features Module
 * Dynamic Skill Injection, Context-Aware Routing, Self-Healing Execution
 */
import { SubAgentResult, TaskContext } from '../types/index';
import { AgentOrchestrator } from '../core/AgentOrchestrator';
export declare class DynamicSkillInjector {
    private skills;
    private injectionQueue;
    registerSkill(name: string, skill: any): void;
    injectSkill(agentName: string, skillName: string): Promise<boolean>;
    processInjectionQueue(): Promise<void>;
    private performInjection;
    getAvailableSkills(): string[];
}
export declare class ContextAwareRouter {
    private routingRules;
    addRoutingRule(pattern: string, targetAgent: string, priority?: number, context?: any): void;
    routeTask(task: string, context?: any): Promise<{
        agent: string;
        confidence: number;
    }>;
    private calculateConfidence;
    private defaultRoute;
    getRoutingRules(): Array<{
        pattern: string;
        target: string;
        priority: number;
    }>;
}
export declare class SelfHealingExecutor {
    private orchestrator;
    private maxRetries;
    private retryDelays;
    private healthChecks;
    constructor(orchestrator: AgentOrchestrator);
    addHealthCheck(check: () => Promise<boolean>): void;
    executeWithHealing(agentName: string, context: TaskContext, input: unknown): Promise<SubAgentResult & {
        healed: boolean;
        retries: number;
    }>;
    private performHealthCheck;
    private attemptHealing;
    private delay;
    setMaxRetries(max: number): void;
}
export declare class MultiModalVerifier {
    private verifiers;
    addVerifier(type: string, verifyFn: (data: any) => Promise<{
        valid: boolean;
        issues: string[];
    }>): void;
    verify(data: any): Promise<{
        overall_valid: boolean;
        results: Array<{
            type: string;
            valid: boolean;
            issues: string[];
        }>;
        confidence: number;
    }>;
}
export declare class StateCheckpointManager {
    private checkpoints;
    private checkpointHistory;
    createCheckpoint(id: string, state: any): void;
    restoreCheckpoint(id: string): any | null;
    getCheckpointHistory(): Array<{
        id: string;
        timestamp: number;
    }>;
    clearOlderThan(ageMs: number): void;
}
export declare const AdvancedFeatures: {
    DynamicSkillInjector: typeof DynamicSkillInjector;
    ContextAwareRouter: typeof ContextAwareRouter;
    SelfHealingExecutor: typeof SelfHealingExecutor;
    MultiModalVerifier: typeof MultiModalVerifier;
    StateCheckpointManager: typeof StateCheckpointManager;
};
export declare const skillInjector: DynamicSkillInjector;
export declare const contextRouter: ContextAwareRouter;
export declare const selfHealingExecutorInstance: SelfHealingExecutor;
//# sourceMappingURL=features.d.ts.map