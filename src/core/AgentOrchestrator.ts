import { SubAgent } from './SubAgent.js';
import { TaskContext, SubAgentResult, AgentMessage, SwarmConfig } from '../types/index.js';
import { PolicyEngine, getPolicyEngine } from './PolicyEngine.js';
import { NATSMessageBus, getNATSMessageBus } from './NATSMessageBus.js';
import { TelemetryManager, getTelemetryManager } from './TelemetryManager.js';
import { DAGTaskScheduler, getDAGTaskScheduler } from './DAGTaskScheduler.js';
import { 
  initSessionContext, 
  prepareTaskExecution, 
  executeWithHealing, 
  cleanupSession,
  type SessionContext 
} from '../utils/runtime-integration.js';
import { loadConfig, startConfigWatch, onConfigChange, type SinConfig } from '../utils/config-loader.js';

/**
 * Orchestrates multiple subagents and manages task routing
 * Implements non-blocking, session-aware execution with enterprise features:
 * - Policy enforcement (Zero-Trust)
 * - Cryptographic provenance (Sigstore)
 * - Cross-swarm messaging (NATS)
 * - Telemetry & SLO monitoring
 * - DAG-based parallel orchestration
 * - Skill Injection & Context-Aware Routing v2
 * - Self-Healing Execution Loop
 */
export class AgentOrchestrator {
  private agents: Map<string, SubAgent> = new Map();
  private messageQueue: AgentMessage[] = [];
  private sessionContexts: Map<string, SessionContext> = new Map();
  private policyEngine: PolicyEngine;
  private messageBus: NATSMessageBus;
  private telemetry: TelemetryManager;
  private scheduler: DAGTaskScheduler;
  private config: SinConfig | null = null;
  
  async initialize(): Promise<void> {
    // Load configuration
    this.config = await loadConfig();
    
    // Start hot-reload watch
    await startConfigWatch();
    
    // Listen for config changes
    onConfigChange((newConfig) => {
      this.config = newConfig;
      console.log('[Orchestrator] Configuration reloaded');
    });
  }
  
  constructor() {
    this.policyEngine = getPolicyEngine();
    this.messageBus = getNATSMessageBus();
    this.telemetry = getTelemetryManager();
    this.scheduler = getDAGTaskScheduler();
  }

  register(agent: SubAgent): void {
    const name = agent.getName();
    if (this.agents.has(name)) {
      throw new Error(`Agent with name "${name}" already registered`);
    }
    this.agents.set(name, agent);
  }

  getAgent(name: string): SubAgent | undefined {
    return this.agents.get(name);
  }

  listAgents(): string[] {
    return Array.from(this.agents.keys());
  }

  async getSessionContext(sessionId: string, workspace: string, description?: string, agentType?: string): Promise<SessionContext> {
    if (!this.sessionContexts.has(sessionId)) {
      const ctx = await initSessionContext(
        sessionId,
        workspace,
        description || 'General task',
        agentType || 'general'
      );
      this.sessionContexts.set(sessionId, ctx);
    }
    return this.sessionContexts.get(sessionId)!;
  }

  async execute(
    agentName: string,
    context: TaskContext,
    input: unknown
  ): Promise<SubAgentResult> {
    const startTime = Date.now();

    // Initialize runtime context
    let sessionCtx: SessionContext;
    try {
      sessionCtx = await this.getSessionContext(context.sessionId, context.workspace, context.description || '', agentName);
    } catch (e: any) {
      this.telemetry.recordEvent('session_init_failed', { agent: agentName, sessionId: context.sessionId, error: e.message });
      return { success: false, error: `Session initialization failed: ${e.message}`, metadata: { session_init_error: true } };
    }

    // Prepare task with skill injection
    let preparedDescription: string;
    try {
      const prep = await prepareTaskExecution(context.sessionId, context.description || '');
      preparedDescription = prep.preparedDescription;
    } catch (e: any) {
      this.telemetry.recordEvent('task_prep_failed', { agent: agentName, sessionId: context.sessionId, error: e.message });
      return { success: false, error: `Task preparation failed: ${e.message}`, metadata: { task_prep_error: true } };
    }

    const enrichedContext: TaskContext = { ...context, description: preparedDescription };

    // Policy check
    const policyCheck = await this.policyEngine.evaluate({
      agentId: context.sessionId,
      action: 'agent.execute',
      resource: `agent:${agentName}`,
      capabilities: ['agent:execute'],
      timestamp: Date.now(),
      subject: context.sessionId,
      sessionId: context.sessionId,
      taskId: context.taskId,
      agent_type: agentName
    });
    
    if (!policyCheck.allowed) {
      this.telemetry.recordEvent('policy_violation', { agent: agentName, sessionId: context.sessionId, reason: policyCheck.reason });
      return { success: false, error: `Policy violation: ${policyCheck.reason}`, metadata: { policy_violation: true } };
    }

    const agent = this.agents.get(agentName);
    if (!agent) {
      return { success: false, error: `Agent "${agentName}" not found` };
    }

    if (agent.isBusy()) {
      this.sendMessage({ from: 'orchestrator', to: agentName, type: 'request', payload: { context: enrichedContext, input, queued: true }, timestamp: Date.now() });
      return { success: false, error: `Agent "${agentName}" is currently busy, task queued`, metadata: { queued: true } };
    }

    try {
      const result = await executeWithHealing(
        context.sessionId,
        async () => {
          this.telemetry.recordEvent('agent_execution_start', { agent: agentName, sessionId: context.sessionId, taskId: context.taskId });
          const result = await agent.execute(enrichedContext, input);
          const duration = Date.now() - startTime;
          result.duration = duration;
          this.telemetry.recordEvent('agent_execution_complete', { agent: agentName, sessionId: context.sessionId, success: result.success, duration });
          await this.messageBus.publish('agent.results', { agent: agentName, result, timestamp: Date.now() });
          return result;
        },
        3
      );
      return result;
    } catch (error) {
      const duration = Date.now() - startTime;
      this.telemetry.recordEvent('agent_execution_error', { agent: agentName, sessionId: context.sessionId, error: error instanceof Error ? error.message : 'Unknown error', duration, healing_exhausted: true });
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error', duration, metadata: { healing_attempts_exhausted: true } };
    } finally {
      await cleanupSession(context.sessionId).catch(e => {
        this.telemetry.recordEvent('session_cleanup_failed', { sessionId: context.sessionId, error: e.message });
      });
    }
  }

  async executeSwarm(config: SwarmConfig, context: TaskContext, input: unknown): Promise<SubAgentResult[]> {
    this.telemetry.recordEvent('swarm_execution_start', { swarmConfig: config, sessionId: context.sessionId, taskId: context.taskId });

    if (config.orchestration === 'parallel') {
      const results = await Promise.all(config.agents.map(agentName => this.execute(agentName, context, input)));
      this.telemetry.recordEvent('swarm_execution_complete', { sessionId: context.sessionId, resultsCount: results.length, successCount: results.filter(r => r.success).length });
      return results;
    } else if (config.orchestration === 'sequential') {
      const results: SubAgentResult[] = [];
      let currentInput = input;
      for (const agentName of config.agents) {
        const result = await this.execute(agentName, context, currentInput);
        results.push(result);
        if (result.success && result.data !== undefined) currentInput = result.data;
      }
      this.telemetry.recordEvent('swarm_execution_complete', { sessionId: context.sessionId, resultsCount: results.length, successCount: results.filter(r => r.success).length });
      return results;
    } else {
      const results = await this.executeDynamic(config, context, input);
      this.telemetry.recordEvent('swarm_execution_complete', { sessionId: context.sessionId, resultsCount: results.length, successCount: results.filter(r => r.success).length });
      return results;
    }
  }

  private async executeDynamic(config: SwarmConfig, context: TaskContext, input: unknown): Promise<SubAgentResult[]> {
    const results: SubAgentResult[] = [];
    for (const agentName of config.agents) {
      const agent = this.agents.get(agentName);
      if (agent && !agent.isBusy()) {
        const result = await this.execute(agentName, context, input);
        results.push(result);
      }
    }
    return results;
  }

  sendMessage(message: AgentMessage): void {
    this.messageQueue.push(message);
    this.messageBus.publish('agent.messages', message).catch(console.error);
  }

  processMessages(): AgentMessage[] {
    const processed = [...this.messageQueue];
    this.messageQueue = [];
    return processed;
  }

  getStatus() {
    const agentStats = Array.from(this.agents.values()).map(a => ({ name: a.getName(), busy: a.isBusy(), currentTask: a.getCurrentTaskId() }));
    return {
      totalAgents: this.agents.size,
      activeAgents: agentStats.filter(a => a.busy).length,
      pendingMessages: this.messageQueue.length,
      activeSessions: this.sessionContexts.size,
      agents: agentStats,
      messageBusStats: this.messageBus.getStats(),
      telemetryEnabled: this.telemetry.isEnabled()
    };
  }
}
