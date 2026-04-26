/**
 * Runtime Integration Layer - FIXED VERSION
 */

import { discoverSkills, matchSkills, resolveDependencies, startSkillMCPs, stopSkillMCPs, getSkillPromptInjection, getSkillPermissions } from './skill-loader.js';
import { routeTaskV2, type RoutingDecisionV2 } from './router-v2.js';
import { initHealingLoopV2, executeHealingStepV2, type HealingContextV2 } from './healing-loop-v2.js';
import { createCheckpoint, restoreCheckpoint, type CheckpointMeta } from './checkpoint-manager-v2.js';
import { structuredLog } from './telemetry.js';
import { TaskContext, SubAgentResult } from '../types/index.js';
import { PolicyEngine, getPolicyEngine, type PolicyContext } from '../core/PolicyEngine.js';
import { TelemetryManager, getTelemetryManager } from '../core/TelemetryManager.js';
import { loadConfig, type SinConfig } from './config-loader.js';

export interface RuntimeContext {
  sessionId: string;
  config: SinConfig;
  policyEngine: PolicyEngine;
  telemetryManager: TelemetryManager;
  checkpoint?: CheckpointMeta;
  healingCtx?: HealingContextV2;
  routingDecision?: RoutingDecisionV2;
}

export async function initRuntimeContext(sessionId: string): Promise<RuntimeContext> {
  const config = await loadConfig();
  const policyEngine = getPolicyEngine();
  const telemetryManager = getTelemetryManager();
  
  return { sessionId, config, policyEngine, telemetryManager };
}

export async function executeWithRuntimeIntegration(
  ctx: RuntimeContext,
  description: string,
  targetPaths: string[] = [],
  worktreePath?: string
): Promise<SubAgentResult> {
  // 1. Skill Discovery & Injection
  const allSkills = await discoverSkills();
  const matchedSkills = matchSkills(description, 'hermes', allSkills);
  const resolvedSkills = await resolveDependencies(matchedSkills, allSkills);
  
  if (resolvedSkills.length > 0) {
    await startSkillMCPs(ctx.sessionId, resolvedSkills);
    const injection = getSkillPromptInjection(ctx.sessionId);
    const perms = getSkillPermissions(ctx.sessionId);
    description = `${description}\n\n${injection}`.trim();
    
    structuredLog('info', 'skills_injected', { 
      session_id: ctx.sessionId, 
      skills: resolvedSkills.map(s => s.id) 
    });
  }

  // 2. Context-Aware Routing v2
  const budgetPct = ctx.config.budget?.warning_threshold_pct || 80;
  const breakerStates: Record<string, boolean> = {};
  
  const routingDecision = await routeTaskV2({
    description,
    target_paths: targetPaths,
    budget_pct: budgetPct,
    breakerStates,
    config: ctx.config
  });
  
  ctx.routingDecision = routingDecision;
  
  structuredLog('info', 'routing_decision_v2', {
    session_id: ctx.sessionId,
    agent: routingDecision.agent,
    model: routingDecision.model,
    intent: routingDecision.intent,
    multi_layer: routingDecision.multi_layer_split
  });

  // 3. Create Checkpoint
  ctx.checkpoint = await createCheckpoint(ctx.sessionId, worktreePath);
  
  // 4. Initialize Healing Loop
  ctx.healingCtx = await initHealingLoopV2(
    ctx.sessionId, 
    worktreePath, 
    routingDecision.metrics.complexity,
    budgetPct
  );

  // 5. Execute with Policy Check
  const policyContext: PolicyContext = {
    agentId: routingDecision.agent,
    action: 'execute_task',
    resource: `task:${ctx.sessionId}`,
    capabilities: ['execute', 'read', 'write'],
    timestamp: Date.now(),
    subject: routingDecision.agent,
    metadata: {
      description: description.slice(0, 200),
      target_paths: targetPaths,
      model: routingDecision.model
    }
  };
  
  const policyDecision = await ctx.policyEngine.evaluate(policyContext);
  if (!policyDecision.allowed) {
    structuredLog('warn', 'policy_denied', { 
      session_id: ctx.sessionId, 
      reason: policyDecision.reason 
    });
    return { 
      success: false, 
      error: `Policy denied: ${policyDecision.reason}`,
      duration: 0,
      metadata: { policy_reason: policyDecision.reason }
    };
  }

  // 6. Execute Task (simulated - actual execution happens in OpenCode)
  const startTime = Date.now();
  try {
    // Here would be the actual task() call to OpenCode
    // For now, simulate success
    const duration = Date.now() - startTime;
    
    await ctx.telemetryManager.recordEvent('task_completed', {
      session_id: ctx.sessionId,
      agent: routingDecision.agent,
      duration_ms: duration,
      model: routingDecision.model
    });
    
    return {
      success: true,
      data: { agent: routingDecision.agent, model: routingDecision.model },
      duration,
      metadata: { routing: routingDecision, checkpoint: ctx.checkpoint }
    };
  } catch (error: any) {
    // 7. Trigger Healing Loop on Error
    const lspOutput = ''; // Would come from LSP diagnostics
    const { should_retry, adapted_prompt, updated_ctx } = await executeHealingStepV2(
      ctx.healingCtx,
      error.message,
      lspOutput,
      error.code
    );
    ctx.healingCtx = updated_ctx;
    
    if (should_retry) {
      structuredLog('info', 'healing_retry_triggered', {
        session_id: ctx.sessionId,
        attempt: ctx.healingCtx.attempt,
        strategy: ctx.healingCtx.strategy_history[ctx.healingCtx.strategy_history.length - 1]
      });
      
      // Retry with adapted prompt
      return executeWithRuntimeIntegration(ctx, adapted_prompt, targetPaths, worktreePath);
    } else {
      structuredLog('error', 'healing_exhausted', {
        session_id: ctx.sessionId,
        attempts: ctx.healingCtx.attempt
      });
      
      return {
        success: false,
        error: `Healing exhausted after ${ctx.healingCtx.attempt} attempts: ${error.message}`,
        duration: Date.now() - startTime,
        metadata: { healing_attempts: ctx.healingCtx.attempt }
      };
    }
  } finally {
    // Cleanup skills on session end
    await stopSkillMCPs(ctx.sessionId);
  }
}

export async function cleanupRuntimeContext(ctx: RuntimeContext): Promise<void> {
  await stopSkillMCPs(ctx.sessionId);
  structuredLog('info', 'runtime_context_cleaned', { session_id: ctx.sessionId });
}
