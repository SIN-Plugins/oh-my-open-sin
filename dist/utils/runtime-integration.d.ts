/**
 * Runtime Integration Layer
 *
 * Verbindet alle Module im tatsächlichen Execution-Flow:
 * - Skill-Injection vor Agent-Execution
 * - Context-Aware Routing v2
 * - Self-Healing Loop bei Failures
 * - Checkpoint Auto-Save
 * - Native OpenCode Hooks
 */
import { type RoutingDecisionV2 } from './router-v2.js';
import { SubAgentResult } from '../types/index.js';
export interface SessionContext {
    sessionId: string;
    workspace: string;
    metadata: Record<string, any>;
    activeSkills?: string[];
    checkpointId?: string;
    routingDecision?: RoutingDecisionV2;
}
export interface IntegratedTaskResult extends SubAgentResult {
    checkpointId?: string;
    routingDecision?: RoutingDecisionV2;
    healingAttempts?: number;
    skillContext?: string;
}
declare const sessionContexts: Map<string, SessionContext>;
/**
 * Initialisiert Session-Kontext mit Skills, Routing und Checkpoint
 */
export declare function initSessionContext(sessionId: string, workspace: string, description: string, agentType: string): Promise<SessionContext>;
/**
 * Bereitet Task vor mit Skill-Injection, Policy-Check und Checkpoint
 */
export declare function prepareTaskExecution(sessionId: string, description: string): Promise<{
    preparedDescription: string;
    context: SessionContext;
}>;
/**
 * Führt Task aus mit Self-Healing bei Failures
 */
export declare function executeWithHealing(sessionId: string, agentExecuteFn: () => Promise<SubAgentResult>, maxRetries?: number): Promise<IntegratedTaskResult>;
/**
 * Cleanup Session am Ende
 */
export declare function cleanupSession(sessionId: string): Promise<void>;
/**
 * Resume Session von Checkpoint nach Crash
 */
export declare function resumeSessionFromCheckpoint(sessionId: string, workspace: string): Promise<SessionContext | null>;
export { sessionContexts };
//# sourceMappingURL=runtime-integration.d.ts.map