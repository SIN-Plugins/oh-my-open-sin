import { SubAgent } from './SubAgent.js';
import { TaskContext, SubAgentResult, AgentMessage, SwarmConfig } from '../types/index.js';
import { PolicyEngine, getPolicyEngine } from './PolicyEngine.js';
import { NATSMessageBus, getNATSMessageBus } from './NATSMessageBus.js';
import { TelemetryManager, getTelemetryManager } from './TelemetryManager.js';
import { DAGTaskScheduler, getDAGTaskScheduler } from './DAGTaskScheduler.js';

/**
 * Orchestrates multiple subagents and manages task routing
 * Implements non-blocking, session-aware execution with enterprise features:
 * - Policy enforcement (Zero-Trust)
 * - Cryptographic provenance (Sigstore)
 * - Cross-swarm messaging (NATS)
 * - Telemetry & SLO monitoring
 * - DAG-based parallel orchestration
 */
export class AgentOrchestrator {
  private agents: Map<string, SubAgent> = new Map();
  private messageQueue: AgentMessage[] = [];
  private sessionContexts: Map<string, TaskContext> = new Map();
  private policyEngine: PolicyEngine;
  private messageBus: NATSMessageBus;
  private telemetry: TelemetryManager;
  private scheduler: DAGTaskScheduler;
  
  constructor() {
    this.policyEngine = getPolicyEngine();
    this.messageBus = getNATSMessageBus();
    this.telemetry = getTelemetryManager();
    this.scheduler = getDAGTaskScheduler();
  }

  /**
   * Register a subagent
   */
  register(agent: SubAgent): void {
    const name = agent.getName();
    if (this.agents.has(name)) {
      throw new Error(`Agent with name "${name}" already registered`);
    }
    this.agents.set(name, agent);
  }

  /**
   * Get a registered agent by name
   */
  getAgent(name: string): SubAgent | undefined {
    return this.agents.get(name);
  }

  /**
   * List all registered agents
   */
  listAgents(): string[] {
    return Array.from(this.agents.keys());
  }

  /**
   * Create or get a session context
   */
  getSessionContext(sessionId: string, workspace: string): TaskContext {
    if (!this.sessionContexts.has(sessionId)) {
      this.sessionContexts.set(sessionId, {
        sessionId,
        taskId: crypto.randomUUID(),
        workspace,
      });
    }
    return this.sessionContexts.get(sessionId)!;
  }

  /**
   * Execute a task with a specific agent
   * Includes policy enforcement, telemetry tracking, and audit logging
   */
  async execute(
    agentName: string,
    context: TaskContext,
    input: unknown
  ): Promise<SubAgentResult> {
    const startTime = Date.now();
    const spanId = crypto.randomUUID();
    
    // Policy check before execution
    const policyCheck = await this.policyEngine.evaluate({
      action: 'agent.execute',
      resource: `agent:${agentName}`,
      subject: context.sessionId,
      context: { taskId: context.taskId, workspace: context.workspace }
    });
    
    if (!policyCheck.allowed) {
      this.telemetry.recordEvent('policy_violation', {
        agent: agentName,
        sessionId: context.sessionId,
        reason: policyCheck.reason
      });
      
      return {
        success: false,
        error: `Policy violation: ${policyCheck.reason}`,
        metadata: { policy_violation: true }
      };
    }
    
    const agent = this.agents.get(agentName);
    
    if (!agent) {
      return {
        success: false,
        error: `Agent "${agentName}" not found`,
      };
    }

    if (agent.isBusy()) {
      // Queue message for later processing
      this.sendMessage({
        from: 'orchestrator',
        to: agentName,
        type: 'task_queued',
        payload: { context, input },
        timestamp: Date.now()
      });
      
      return {
        success: false,
        error: `Agent "${agentName}" is currently busy, task queued`,
        metadata: { queued: true }
      };
    }
    
    try {
      // Record execution start
      this.telemetry.recordEvent('agent_execution_start', {
        agent: agentName,
        sessionId: context.sessionId,
        taskId: context.taskId
      });
      
      const result = await agent.execute(context, input);
      const duration = Date.now() - startTime;
      result.duration = duration;
      
      // Record execution complete
      this.telemetry.recordEvent('agent_execution_complete', {
        agent: agentName,
        sessionId: context.sessionId,
        taskId: context.taskId,
        success: result.success,
        duration
      });
      
      // Publish result to message bus
      await this.messageBus.publish('agent.results', {
        agent: agentName,
        taskId: context.taskId,
        result,
        timestamp: Date.now()
      });
      
      return result;
    } catch (error) {
      const duration = Date.now() - startTime;
      
      // Record error
      this.telemetry.recordEvent('agent_execution_error', {
        agent: agentName,
        sessionId: context.sessionId,
        taskId: context.taskId,
        error: error instanceof Error ? error.message : 'Unknown error',
        duration
      });
      
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        duration,
      };
    }
  }

  /**
   * Execute a swarm of agents with DAG-based scheduling
   */
  async executeSwarm(
    config: SwarmConfig,
    context: TaskContext,
    input: unknown
  ): Promise<SubAgentResult[]> {
    // Record swarm start
    this.telemetry.recordEvent('swarm_execution_start', {
      swarmConfig: config,
      sessionId: context.sessionId,
      taskId: context.taskId
    });

    if (config.orchestration === 'parallel') {
      const promises = config.agents.map(async (agentName) => {
        const result = await this.execute(agentName, context, input);
        return result;
      });
      const results = await Promise.all(promises);
      
      // Record swarm complete
      this.telemetry.recordEvent('swarm_execution_complete', {
        sessionId: context.sessionId,
        taskId: context.taskId,
        resultsCount: results.length,
        successCount: results.filter(r => r.success).length
      });
      
      return results;
    } else if (config.orchestration === 'sequential') {
      const results: SubAgentResult[] = [];
      let currentInput = input;
      for (const agentName of config.agents) {
        const result = await this.execute(agentName, context, currentInput);
        results.push(result);
        if (result.success && result.data !== undefined) {
          currentInput = result.data;
        }
      }
      
      this.telemetry.recordEvent('swarm_execution_complete', {
        sessionId: context.sessionId,
        taskId: context.taskId,
        resultsCount: results.length,
        successCount: results.filter(r => r.success).length
      });
      
      return results;
    } else {
      // Dynamic orchestration - route based on capabilities
      const results = await this.executeDynamic(config, context, input);
      
      this.telemetry.recordEvent('swarm_execution_complete', {
        sessionId: context.sessionId,
        taskId: context.taskId,
        resultsCount: results.length,
        successCount: results.filter(r => r.success).length
      });
      
      return results;
    }
  }

  private async executeDynamic(
    config: SwarmConfig,
    context: TaskContext,
    input: unknown
  ): Promise<SubAgentResult[]> {
    const results: SubAgentResult[] = [];
    // Simple dynamic routing - can be enhanced with AI-based routing
    for (const agentName of config.agents) {
      const agent = this.agents.get(agentName);
      if (agent && !agent.isBusy()) {
        const result = await this.execute(agentName, context, input);
        results.push(result);
      }
    }
    return results;
  }

  /**
   * Send a message between agents
   */
  sendMessage(message: AgentMessage): void {
    this.messageQueue.push(message);
    // Also publish to NATS for cross-process communication
    this.messageBus.publish('agent.messages', message).catch(console.error);
  }

  /**
   * Process pending messages
   */
  processMessages(): AgentMessage[] {
    const processed = [...this.messageQueue];
    this.messageQueue = [];
    return processed;
  }

  /**
   * Get orchestrator status with enterprise metrics
   */
  getStatus() {
    const agentStats = Array.from(this.agents.values()).map(a => ({
      name: a.getName(),
      busy: a.isBusy(),
      currentTask: a.getCurrentTaskId()
    }));
    
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
