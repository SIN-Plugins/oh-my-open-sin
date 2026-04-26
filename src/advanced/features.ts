/**
 * Advanced Features Module
 * Dynamic Skill Injection, Context-Aware Routing, Self-Healing Execution
 */

import { SubAgentResult, TaskContext } from '../types/index';
import { AgentOrchestrator } from '../core/AgentOrchestrator';

// Dynamic Skill Injection System
export class DynamicSkillInjector {
  private skills: Map<string, any> = new Map();
  private injectionQueue: Array<{ agent: string; skill: any }> = [];

  registerSkill(name: string, skill: any): void {
    this.skills.set(name, skill);
    console.log(`[DynamicSkillInjector] Registered skill: ${name}`);
  }

  async injectSkill(agentName: string, skillName: string): Promise<boolean> {
    const skill = this.skills.get(skillName);
    if (!skill) {
      console.error(`[DynamicSkillInjector] Skill not found: ${skillName}`);
      return false;
    }

    this.injectionQueue.push({ agent: agentName, skill });
    console.log(`[DynamicSkillInjector] Queued injection: ${skillName} -> ${agentName}`);
    
    return true;
  }

  async processInjectionQueue(): Promise<void> {
    while (this.injectionQueue.length > 0) {
      const { agent, skill } = this.injectionQueue.shift()!;
      await this.performInjection(agent, skill);
    }
  }

  private async performInjection(agentName: string, skill: any): Promise<void> {
    console.log(`[DynamicSkillInjector] Injecting skill into ${agentName}`);
  }

  getAvailableSkills(): string[] {
    return Array.from(this.skills.keys());
  }
}

// Context-Aware Routing System
export class ContextAwareRouter {
  private routingRules: Array<{
    pattern: RegExp;
    targetAgent: string;
    priority: number;
    context: any;
  }> = [];

  addRoutingRule(pattern: string, targetAgent: string, priority: number = 1, context?: any): void {
    this.routingRules.push({
      pattern: new RegExp(pattern, 'i'),
      targetAgent,
      priority,
      context: context || {}
    });
    this.routingRules.sort((a, b) => b.priority - a.priority);
  }

  async routeTask(task: string, context?: any): Promise<{ agent: string; confidence: number }> {
    for (const rule of this.routingRules) {
      if (rule.pattern.test(task)) {
        const confidence = await this.calculateConfidence(task, rule, context);
        return { agent: rule.targetAgent, confidence };
      }
    }
    return this.defaultRoute(task, context);
  }

  private async calculateConfidence(task: string, rule: any, context?: any): Promise<number> {
    const match = task.match(rule.pattern);
    const baseConfidence = match ? match[0].length / task.length : 0.5;
    const contextBonus = context ? 0.1 : 0;
    return Math.min(baseConfidence + contextBonus, 1.0);
  }

  private async defaultRoute(task: string, context?: any): Promise<{ agent: string; confidence: number }> {
    const taskLower = task.toLowerCase();
    if (taskLower.includes('research') || taskLower.includes('analyze')) {
      return { agent: 'athena', confidence: 0.7 };
    }
    if (taskLower.includes('plan') || taskLower.includes('strategy')) {
      return { agent: 'prometheus', confidence: 0.7 };
    }
    if (taskLower.includes('validate') || taskLower.includes('check')) {
      return { agent: 'zeus', confidence: 0.7 };
    }
    if (taskLower.includes('fix') || taskLower.includes('debug')) {
      return { agent: 'hades', confidence: 0.7 };
    }
    if (taskLower.includes('heal') || taskLower.includes('recover')) {
      return { agent: 'asclepius', confidence: 0.7 };
    }
    return { agent: 'sin_delegate', confidence: 0.5 };
  }

  getRoutingRules(): Array<{ pattern: string; target: string; priority: number }> {
    return this.routingRules.map(r => ({
      pattern: r.pattern.source,
      target: r.targetAgent,
      priority: r.priority
    }));
  }
}

// Self-Healing Execution Loop
export class SelfHealingExecutor {
  private maxRetries = 3;
  private retryDelays = [1000, 5000, 15000];
  private healthChecks: Array<() => Promise<boolean>> = [];

  constructor(private orchestrator: AgentOrchestrator) {}

  addHealthCheck(check: () => Promise<boolean>): void {
    this.healthChecks.push(check);
  }

  async executeWithHealing(
    agentName: string, 
    context: TaskContext,
    input: unknown
  ): Promise<SubAgentResult & { healed: boolean; retries: number }> {
    let lastError: Error | null = null;
    let retries = 0;
    let healed = false;

    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      try {
        const healthy = await this.performHealthCheck();
        if (!healthy && attempt < this.maxRetries) {
          healed = await this.attemptHealing();
          if (!healed) {
            throw new Error('System unhealthy and healing failed');
          }
        }

        const result = await this.orchestrator.execute(agentName, context, input);
        return { ...result, healed, retries } as any;
      } catch (error) {
        lastError = error as Error;
        retries = attempt;
        
        if (attempt < this.maxRetries) {
          console.log(`[SelfHealingExecutor] Attempt ${attempt + 1} failed, retrying...`);
          await this.delay(this.retryDelays[attempt]);
          healed = await this.attemptHealing();
        }
      }
    }

    return {
      success: false,
      error: lastError?.message || 'Unknown error',
      metadata: { healed, retries, final_failure: true }
    } as any;
  }

  private async performHealthCheck(): Promise<boolean> {
    for (const check of this.healthChecks) {
      try {
        if (!await check()) return false;
      } catch (e) {
        return false;
      }
    }
    return true;
  }

  private async attemptHealing(): Promise<boolean> {
    console.log('[SelfHealingExecutor] Attempting system healing...');
    try {
      const mockContext: TaskContext = { sessionId: 'heal', taskId: 'recovery', workspace: '/tmp' };
      const result = await this.orchestrator.execute('asclepius', mockContext, {});
      return result.success;
    } catch (e) {
      console.error('[SelfHealingExecutor] Healing failed:', e);
      return false;
    }
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  setMaxRetries(max: number): void {
    this.maxRetries = max;
  }
}

// Multi-Modal Verification System
export class MultiModalVerifier {
  private verifiers: Array<{
    type: string;
    verify: (data: any) => Promise<{ valid: boolean; issues: string[] }>;
  }> = [];

  addVerifier(type: string, verifyFn: (data: any) => Promise<{ valid: boolean; issues: string[] }>): void {
    this.verifiers.push({ type, verify: verifyFn });
  }

  async verify(data: any): Promise<{
    overall_valid: boolean;
    results: Array<{ type: string; valid: boolean; issues: string[] }>;
    confidence: number;
  }> {
    const results = await Promise.all(
      this.verifiers.map(async v => ({ type: v.type, ...(await v.verify(data)) }))
    );
    const overall_valid = results.every(r => r.valid);
    const confidence = results.reduce((sum, r) => sum + (r.valid ? 1 : 0), 0) / results.length;
    return { overall_valid, results, confidence };
  }
}

// Deterministic State Checkpointing
export class StateCheckpointManager {
  private checkpoints: Map<string, any> = new Map();
  private checkpointHistory: Array<{ id: string; timestamp: number; state: any }> = [];

  createCheckpoint(id: string, state: any): void {
    const checkpoint = { id, timestamp: Date.now(), state: JSON.parse(JSON.stringify(state)) };
    this.checkpoints.set(id, checkpoint.state);
    this.checkpointHistory.push(checkpoint);
    console.log(`[StateCheckpoint] Created checkpoint: ${id}`);
  }

  restoreCheckpoint(id: string): any | null {
    const state = this.checkpoints.get(id);
    if (state !== undefined) {
      console.log(`[StateCheckpoint] Restored checkpoint: ${id}`);
      return JSON.parse(JSON.stringify(state));
    }
    console.warn(`[StateCheckpoint] Checkpoint not found: ${id}`);
    return null;
  }

  getCheckpointHistory(): Array<{ id: string; timestamp: number }> {
    return this.checkpointHistory.map(c => ({ id: c.id, timestamp: c.timestamp }));
  }

  clearOlderThan(ageMs: number): void {
    const cutoff = Date.now() - ageMs;
    this.checkpointHistory = this.checkpointHistory.filter(c => c.timestamp > cutoff);
    const validIds = new Set(this.checkpointHistory.map(c => c.id));
    for (const key of this.checkpoints.keys()) {
      if (!validIds.has(key)) this.checkpoints.delete(key);
    }
  }
}

export const AdvancedFeatures = {
  DynamicSkillInjector,
  ContextAwareRouter,
  SelfHealingExecutor,
  MultiModalVerifier,
  StateCheckpointManager
};

// Singleton instances for convenience
export const skillInjector = new DynamicSkillInjector();
export const contextRouter = new ContextAwareRouter();
export const selfHealingExecutorInstance = new SelfHealingExecutor(new AgentOrchestrator());
