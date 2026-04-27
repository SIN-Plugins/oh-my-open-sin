/**
 * Runtime Integration Layer - FIXED VERSION
 */

import { discoverSkills, matchSkills, resolveDependencies, startSkillMCPs, stopSkillMCPs, getSkillPromptInjection, getSkillPermissions, getSkillHealth } from './skill-loader.js';
import { routeTaskV2, type RoutingDecisionV2 } from './router-v2.js';
import { initHealingLoopV2, executeHealingStepV2, type HealingContextV2 } from './healing-loop-v2.js';
import { createCheckpoint, restoreCheckpoint, type CheckpointMeta } from './checkpoint-manager-v2.js';
import { structuredLog } from './telemetry.js';
import { TaskContext, SubAgentResult } from '../types/index.js';
import { PolicyEngine, getPolicyEngine } from '../core/PolicyEngine.js';
import { TelemetryManager, getTelemetryManager } from '../core/TelemetryManager.js';

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

const sessionContexts: Map<string, SessionContext> = new Map();
const policyEngine = getPolicyEngine();
const telemetry = getTelemetryManager();

export async function initSessionContext(
  sessionId: string,
  workspace: string,
  description: string,
  agentType: string
): Promise<SessionContext> {
  const ctx: SessionContext = { sessionId, workspace, metadata: {} };
  
  try {
    const allSkills = await discoverSkills();
    const matched = matchSkills(description, agentType, allSkills);
    
    if (matched.length > 0) {
      const resolved = await resolveDependencies(matched, allSkills);
      await startSkillMCPs(sessionId, resolved);
      
      const skillInjection = getSkillPromptInjection(sessionId);
      const permissions = getSkillPermissions(sessionId);
      const health = getSkillHealth(sessionId);
      
      ctx.metadata.skill_injection = skillInjection;
      ctx.metadata.skill_permissions = permissions;
      ctx.metadata.skill_health = health;
      ctx.activeSkills = resolved.map(s => s.id);
      
      structuredLog('info', 'session_skills_initialized', {
        sessionId: sessionId,
        skills: ctx.activeSkills,
        mcp_count: Object.keys(health).length
      });
    }
  } catch (e: any) {
    structuredLog('warn', 'skill_init_failed', { sessionId: sessionId, error: e.message });
  }
  
  try {
    const routingDecision = await routeTaskV2({ 
      description, 
      budget_pct: ctx.metadata.budget_consumed_usd || 50,
      breakerStates: {},
      config: { agents: {} },
      target_paths: [workspace]
    });
    ctx.routingDecision = routingDecision;
    ctx.metadata.routing_decision = routingDecision;
    
    structuredLog('info', 'session_routing_decided', {
      sessionId: sessionId,
      selected_agent: routingDecision.agent,
      intent: routingDecision.intent,
      complexity: routingDecision.metrics.complexity
    });
  } catch (e: any) {
    structuredLog('warn', 'routing_init_failed', { sessionId: sessionId, error: e.message });
  }
  
  try {
    const checkpoint: CheckpointMeta = await createCheckpoint(sessionId, workspace, false);
    ctx.checkpointId = checkpoint.id;
    ctx.metadata.checkpoint_id = checkpoint.id;
    
    structuredLog('info', 'session_checkpoint_saved', {
      sessionId: sessionId,
      checkpoint_id: checkpoint.id
    });
  } catch (e: any) {
    structuredLog('warn', 'checkpoint_init_failed', { sessionId: sessionId, error: e.message });
  }
  
  sessionContexts.set(sessionId, ctx);
  return ctx;
}

export async function prepareTaskExecution(
  sessionId: string,
  description: string
): Promise<{ preparedDescription: string; context: SessionContext }> {
  const ctx = sessionContexts.get(sessionId);
  if (!ctx) {
    throw new Error(`Session ${sessionId} not initialized`);
  }
  
  const skillContext = ctx.metadata.skill_injection || '';
  const preparedDescription = skillContext
    ? `${description}\n\n${skillContext}`.trim()
    : description;
  
  const policyResult = await policyEngine.evaluate({
    sessionId: sessionId,
    description,
    agent_type: ctx.metadata.routing_decision?.agent
  });
  
  if (!policyResult.allowed) {
    const violations = policyResult.violations || [];
    throw new Error(`Policy violation: ${violations.map(v => v.message).join(', ')}`);
  }
  
  if (ctx.checkpointId) {
    try {
      const state: CheckpointMeta = await createCheckpoint(sessionId, ctx.workspace, false);
      ctx.checkpointId = state.id;
      ctx.metadata.checkpoint_id = ctx.checkpointId;
    } catch (e: any) {
      structuredLog('warn', 'pre_execution_checkpoint_failed', { sessionId: sessionId, error: e.message });
    }
  }
  
  return { preparedDescription, context: ctx };
}

export async function executeWithHealing(
  sessionId: string,
  agentExecuteFn: () => Promise<SubAgentResult>,
  maxRetries = 3
): Promise<IntegratedTaskResult> {
  const ctx = sessionContexts.get(sessionId);
  let lastError: any = null;
  let healingAttempts = 0;
  
  if (!ctx?.healingCtx) {
    ctx!.healingCtx = await initHealingLoopV2(sessionId, ctx?.workspace, 'medium', 0);
  }
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const result = await agentExecuteFn();
      
      if (ctx?.checkpointId) {
        try {
          const state: CheckpointMeta = await createCheckpoint(sessionId, ctx.workspace, true);
          ctx.checkpointId = state.id;
        } catch (e: any) {
          structuredLog('warn', 'post_execution_checkpoint_failed', { sessionId: sessionId, error: e.message });
        }
      }
      
      return {
        ...result,
        checkpointId: ctx?.checkpointId,
        routingDecision: ctx?.routingDecision,
        healingAttempts,
        skillContext: ctx?.metadata.skill_injection
      };
    } catch (e: any) {
      lastError = e;
      healingAttempts++;
      
      structuredLog('error', 'task_execution_failed', {
        sessionId: sessionId,
        attempt,
        error: e.message
      });
      
      if (attempt < maxRetries) {
        try {
          const healingResult = await executeHealingStepV2(ctx!.healingCtx!, e.message);
          
          if (healingResult.should_retry) {
            structuredLog('info', 'healing_step_success', {
              sessionId: sessionId,
              strategy: healingResult.strategy_result?.strategy || 'unknown'
            });
            
            await new Promise(resolve => setTimeout(resolve, 1000));
            continue;
          }
        } catch (healingError: any) {
          structuredLog('error', 'healing_loop_failed', {
            sessionId: sessionId,
            error: healingError.message
          });
        }
      }
    }
  }
  
  throw lastError;
}

export async function cleanupSession(sessionId: string): Promise<void> {
  const ctx = sessionContexts.get(sessionId);
  if (!ctx) return;
  
  try {
    const state: CheckpointMeta = await createCheckpoint(sessionId, ctx.workspace, true);
    structuredLog('info', 'session_final_checkpoint', { sessionId: sessionId, checkpoint_id: state.id });
  } catch (e: any) {
    structuredLog('warn', 'final_checkpoint_failed', { sessionId: sessionId, error: e.message });
  }
  
  try {
    if (ctx.activeSkills && ctx.activeSkills.length > 0) {
      await stopSkillMCPs(sessionId);
      structuredLog('info', 'session_skills_cleaned', { session_id: sessionId });
    }
  } catch (e: any) {
    structuredLog('warn', 'skill_cleanup_failed', { sessionId: sessionId, error: e.message });
  }
  
  try {
    await telemetry.shutdown();
    structuredLog('info', 'session_telemetry_flushed', { session_id: sessionId });
  } catch (e: any) {
    structuredLog('warn', 'telemetry_flush_failed', { sessionId: sessionId, error: e.message });
  }
  
  sessionContexts.delete(sessionId);
}

export async function resumeSessionFromCheckpoint(
  sessionId: string,
  workspace: string
): Promise<SessionContext | null> {
  try {
    const restored = await restoreCheckpoint(sessionId, workspace);
    if (!restored) return null;
    
    const ctx: SessionContext = {
      sessionId,
      workspace,
      metadata: {},
      checkpointId: sessionId,
      activeSkills: []
    };
    
    if (ctx.activeSkills && ctx.activeSkills.length > 0) {
      const allSkills = await discoverSkills();
      const toStart = allSkills.filter(s => ctx.activeSkills!.includes(s.id));
      if (toStart.length > 0) {
        await startSkillMCPs(sessionId, toStart);
      }
    }
    
    sessionContexts.set(sessionId, ctx);
    structuredLog('info', 'session_resumed', { sessionId: sessionId, checkpoint_id: sessionId });
    
    return ctx;
  } catch (e: any) {
    structuredLog('error', 'session_resume_failed', { sessionId: sessionId, error: e.message });
    return null;
  }
}

export { sessionContexts };
