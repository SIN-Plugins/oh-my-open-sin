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

import { discoverSkills, matchSkills, resolveDependencies, startSkillMCPs, stopSkillMCPs, getSkillPromptInjection, getSkillPermissions, getSkillHealth } from './skill-loader.js';
import { routeTaskV2, type RoutingDecisionV2 } from './router-v2.js';
import { healingLoopV2, type HealingResult } from './healing-loop-v2.js';
import { saveCheckpoint, loadCheckpoint, type CheckpointState } from './checkpoint-manager-v2.js';
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

/**
 * Initialisiert Session-Kontext mit Skills, Routing und Checkpoint
 */
export async function initSessionContext(
  sessionId: string,
  workspace: string,
  description: string,
  agentType: string
): Promise<SessionContext> {
  const ctx: SessionContext = { sessionId, workspace, metadata: {} };
  
  // 1. Skill Discovery & Injection
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
        session_id: sessionId,
        skills: ctx.activeSkills,
        mcp_count: Object.keys(health).length
      });
    }
  } catch (e: any) {
    structuredLog('warn', 'skill_init_failed', { session_id: sessionId, error: e.message });
  }
  
  // 2. Context-Aware Routing
  try {
    const routingDecision = await routeTaskV2(description, agentType, workspace);
    ctx.routingDecision = routingDecision;
    ctx.metadata.routing_decision = routingDecision;
    
    structuredLog('info', 'session_routing_decided', {
      session_id: sessionId,
      selected_agent: routingDecision.selectedAgent,
      confidence: routingDecision.confidence
    });
  } catch (e: any) {
    structuredLog('warn', 'routing_init_failed', { session_id: sessionId, error: e.message });
  }
  
  // 3. Initial Checkpoint
  try {
    const checkpointState: CheckpointState = {
      sessionId,
      workspace,
      timestamp: Date.now(),
      phase: 'initialized',
      metadata: ctx.metadata,
      taskHistory: []
    };
    
    const checkpointId = await saveCheckpoint(checkpointState);
    ctx.checkpointId = checkpointId;
    ctx.metadata.checkpoint_id = checkpointId;
    
    structuredLog('info', 'session_checkpoint_saved', {
      session_id: sessionId,
      checkpoint_id: checkpointId
    });
  } catch (e: any) {
    structuredLog('warn', 'checkpoint_init_failed', { session_id: sessionId, error: e.message });
  }
  
  sessionContexts.set(sessionId, ctx);
  return ctx;
}

/**
 * Bereitet Task vor mit Skill-Injection, Policy-Check und Checkpoint
 */
export async function prepareTaskExecution(
  sessionId: string,
  description: string
): Promise<{ preparedDescription: string; context: SessionContext }> {
  const ctx = sessionContexts.get(sessionId);
  if (!ctx) {
    throw new Error(`Session ${sessionId} not initialized`);
  }
  
  // Skill-Injection in Description
  const skillContext = ctx.metadata.skill_injection || '';
  const preparedDescription = skillContext
    ? `${description}\n\n${skillContext}`.trim()
    : description;
  
  // Policy-Check
  const policyResult = await policyEngine.evaluate('task_execution', {
    session_id: sessionId,
    description,
    agent_type: ctx.metadata.routing_decision?.selectedAgent
  });
  
  if (!policyResult.allowed) {
    throw new Error(`Policy violation: ${policyResult.violations.map(v => v.message).join(', ')}`);
  }
  
  // Pre-Execution Checkpoint
  if (ctx.checkpointId) {
    try {
      const state: CheckpointState = {
        sessionId,
        workspace: ctx.workspace,
        timestamp: Date.now(),
        phase: 'pre_execution',
        metadata: ctx.metadata,
        taskHistory: [...(ctx.metadata.task_history || []), { description, timestamp: Date.now() }]
      };
      ctx.checkpointId = await saveCheckpoint(state);
      ctx.metadata.checkpoint_id = ctx.checkpointId;
    } catch (e: any) {
      structuredLog('warn', 'pre_execution_checkpoint_failed', { session_id: sessionId, error: e.message });
    }
  }
  
  return { preparedDescription, context: ctx };
}

/**
 * Führt Task aus mit Self-Healing bei Failures
 */
export async function executeWithHealing(
  sessionId: string,
  agentExecuteFn: () => Promise<SubAgentResult>,
  maxRetries = 3
): Promise<IntegratedTaskResult> {
  const ctx = sessionContexts.get(sessionId);
  let lastError: any = null;
  let healingAttempts = 0;
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const result = await agentExecuteFn();
      
      // Success - Save Post-Execution Checkpoint
      if (ctx?.checkpointId) {
        try {
          const state: CheckpointState = {
            sessionId,
            workspace: ctx.workspace,
            timestamp: Date.now(),
            phase: 'post_execution',
            metadata: { ...ctx.metadata, result_summary: result.summary },
            taskHistory: ctx.metadata.task_history || []
          };
          ctx.checkpointId = await saveCheckpoint(state);
        } catch (e: any) {
          structuredLog('warn', 'post_execution_checkpoint_failed', { session_id: sessionId, error: e.message });
        }
      }
      
      // Routing Feedback
      if (ctx?.routingDecision) {
        try {
          const feedback = { success: true, duration_ms: result.duration_ms || 0 };
          // routingFeedbackLoop(ctx.routingDecision, feedback);
        } catch (e: any) {
          structuredLog('warn', 'routing_feedback_failed', { session_id: sessionId, error: e.message });
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
        session_id: sessionId,
        attempt,
        error: e.message
      });
      
      if (attempt < maxRetries) {
        try {
          const healingResult: HealingResult = await healingLoopV2(e, {
            sessionId,
            attempt,
            lastError: e.message
          });
          
          if (healingResult.shouldRetry) {
            structuredLog('info', 'healing_retry_scheduled', {
              session_id: sessionId,
              strategy: healingResult.strategy,
              backoff_ms: healingResult.backoffMs
            });
            
            if (healingResult.backoffMs > 0) {
              await new Promise(resolve => setTimeout(resolve, healingResult.backoffMs));
            }
            continue;
          }
        } catch (healingError: any) {
          structuredLog('error', 'healing_loop_failed', {
            session_id: sessionId,
            error: healingError.message
          });
        }
      }
    }
  }
  
  // All retries exhausted
  throw lastError;
}

/**
 * Cleanup Session am Ende
 */
export async function cleanupSession(sessionId: string): Promise<void> {
  const ctx = sessionContexts.get(sessionId);
  if (!ctx) return;
  
  // Final Checkpoint
  try {
    const state: CheckpointState = {
      sessionId,
      workspace: ctx.workspace,
      timestamp: Date.now(),
      phase: 'completed',
      metadata: ctx.metadata,
      taskHistory: ctx.metadata.task_history || []
    };
    await saveCheckpoint(state);
    structuredLog('info', 'session_final_checkpoint', { session_id: sessionId });
  } catch (e: any) {
    structuredLog('warn', 'final_checkpoint_failed', { session_id: sessionId, error: e.message });
  }
  
  // Skill Cleanup
  try {
    if (ctx.activeSkills && ctx.activeSkills.length > 0) {
      await stopSkillMCPs(sessionId);
      structuredLog('info', 'session_skills_cleaned', { session_id: sessionId });
    }
  } catch (e: any) {
    structuredLog('warn', 'skill_cleanup_failed', { session_id: sessionId, error: e.message });
  }
  
  // Telemetry Flush
  try {
    await telemetry.flush();
    structuredLog('info', 'session_telemetry_flushed', { session_id: sessionId });
  } catch (e: any) {
    structuredLog('warn', 'telemetry_flush_failed', { session_id: sessionId, error: e.message });
  }
  
  sessionContexts.delete(sessionId);
}

/**
 * Resume Session von Checkpoint nach Crash
 */
export async function resumeSessionFromCheckpoint(
  sessionId: string,
  workspace: string
): Promise<SessionContext | null> {
  try {
    const checkpoint = await loadCheckpoint(sessionId);
    if (!checkpoint) return null;
    
    const ctx: SessionContext = {
      sessionId,
      workspace,
      metadata: checkpoint.metadata || {},
      checkpointId: checkpoint.id,
      activeSkills: checkpoint.metadata?.active_skills
    };
    
    // Re-start Skills wenn vorhanden
    if (ctx.activeSkills && ctx.activeSkills.length > 0) {
      const allSkills = await discoverSkills();
      const toStart = allSkills.filter(s => ctx.activeSkills!.includes(s.id));
      if (toStart.length > 0) {
        await startSkillMCPs(sessionId, toStart);
      }
    }
    
    sessionContexts.set(sessionId, ctx);
    structuredLog('info', 'session_resumed', { session_id: sessionId, checkpoint_id: checkpoint.id });
    
    return ctx;
  } catch (e: any) {
    structuredLog('error', 'session_resume_failed', { session_id: sessionId, error: e.message });
    return null;
  }
}

export { sessionContexts };
