import { SubAgent } from './SubAgent.js';
import { TaskContext, SubAgentResult, AgentMessage, SwarmConfig } from '../types/index.js';

/**
 * Orchestrates multiple subagents and manages task routing
 * Implements non-blocking, session-aware execution
 */
export class AgentOrchestrator {
  private agents: Map<string, SubAgent> = new Map();
  private messageQueue: AgentMessage[] = [];
  private sessionContexts: Map<string, TaskContext> = new Map();

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
   */
  async execute(
    agentName: string,
    context: TaskContext,
    input: unknown
  ): Promise<SubAgentResult> {
    const agent = this.agents.get(agentName);
    
    if (!agent) {
      return {
        success: false,
        error: `Agent "${agentName}" not found`,
      };
    }

    if (agent.isBusy()) {
      return {
        success: false,
        error: `Agent "${agentName}" is currently busy`,
      };
    }

    const startTime = Date.now();
    
    try {
      const result = await agent.execute(context, input);
      result.duration = Date.now() - startTime;
      return result;
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        duration: Date.now() - startTime,
      };
    }
  }

  /**
   * Execute a swarm of agents
   */
  async executeSwarm(
    config: SwarmConfig,
    context: TaskContext,
    input: unknown
  ): Promise<SubAgentResult[]> {
    const results: SubAgentResult[] = [];

    if (config.orchestration === 'parallel') {
      const promises = config.agents.map(async (agentName) => {
        const result = await this.execute(agentName, context, input);
        return result;
      });
      return Promise.all(promises);
    } else if (config.orchestration === 'sequential') {
      let currentInput = input;
      for (const agentName of config.agents) {
        const result = await this.execute(agentName, context, currentInput);
        results.push(result);
        if (result.success && result.data !== undefined) {
          currentInput = result.data;
        }
      }
      return results;
    } else {
      // Dynamic orchestration - route based on capabilities
      return this.executeDynamic(config, context, input);
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
   * Get orchestrator status
   */
  getStatus() {
    return {
      totalAgents: this.agents.size,
      activeAgents: Array.from(this.agents.values()).filter(a => a.isBusy()).length,
      pendingMessages: this.messageQueue.length,
      activeSessions: this.sessionContexts.size,
    };
  }
}
