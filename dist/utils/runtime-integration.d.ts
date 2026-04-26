/**
 * Runtime Integration Layer - FIXED VERSION
 */
import { type RoutingDecisionV2 } from './router-v2.js';
import { type HealingContextV2 } from './healing-loop-v2.js';
import { type CheckpointMeta } from './checkpoint-manager-v2.js';
import { SubAgentResult } from '../types/index.js';
import { PolicyEngine } from '../core/PolicyEngine.js';
import { TelemetryManager } from '../core/TelemetryManager.js';
import { type SinConfig } from './config-loader.js';
export interface RuntimeContext {
    sessionId: string;
    config: SinConfig;
    policyEngine: PolicyEngine;
    telemetryManager: TelemetryManager;
    checkpoint?: CheckpointMeta;
    healingCtx?: HealingContextV2;
    routingDecision?: RoutingDecisionV2;
}
export declare function initRuntimeContext(sessionId: string): Promise<RuntimeContext>;
export declare function executeWithRuntimeIntegration(ctx: RuntimeContext, description: string, targetPaths?: string[], worktreePath?: string): Promise<SubAgentResult>;
export declare function cleanupRuntimeContext(ctx: RuntimeContext): Promise<void>;
//# sourceMappingURL=runtime-integration.d.ts.map