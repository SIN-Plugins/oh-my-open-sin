/**
 * Runtime Integration Layer - FIXED VERSION
 */
import { type RoutingDecisionV2 } from './router-v2.js';
import { type HealingContextV2 } from './healing-loop-v2.js';
import { SubAgentResult } from '../types/index.js';
export interface SessionContext {
    sessionId: string;
    workspace: string;
    metadata: Record<string, any>;
    activeSkills?: string[];
    checkpointId?: string;
    routingDecision?: RoutingDecisionV2;
    healingCtx?: HealingContextV2;
}
export interface IntegratedTaskResult extends SubAgentResult {
    checkpointId?: string;
    routingDecision?: RoutingDecisionV2;
    healingAttempts?: number;
    skillContext?: string;
}
declare const sessionContexts: Map<string, SessionContext>;
export declare function initSessionContext(sessionId: string, workspace: string, description: string, agentType: string): Promise<SessionContext>;
export declare function prepareTaskExecution(sessionId: string, description: string): Promise<{
    preparedDescription: string;
    context: SessionContext;
}>;
export declare function executeWithHealing(sessionId: string, agentExecuteFn: () => Promise<SubAgentResult>, maxRetries?: number, onComplete?: (success: boolean) => Promise<void>): Promise<IntegratedTaskResult>;
export declare function cleanupSession(sessionId: string): Promise<void>;
export declare function resumeSessionFromCheckpoint(sessionId: string, workspace: string): Promise<SessionContext | null>;
export { sessionContexts };
//# sourceMappingURL=runtime-integration.d.ts.map