import { SubAgent } from '../core/SubAgent.js';
import { TaskContext, SubAgentResult, SwarmConfig } from '../types/index.js';

/**
 * sin_swarm - Coordinates swarm-based task execution
 * Manages parallel and sequential agent collaboration
 */
export class SinSwarm extends SubAgent {
  private activeSwarms: Map<string, SwarmConfig> = new Map();

  constructor() {
    super({
      name: 'sin_swarm',
      description: 'Coordinates swarm-based multi-agent collaboration',
      capabilities: ['swarm-orchestration', 'parallel-execution', 'collaborative-tasks'],
      priority: 2,
    });
  }

  async execute(context: TaskContext, input: unknown): Promise<SubAgentResult> {
    return this.trackExecution(context.taskId, async () => {
      if (!this.validateInput(input)) {
        return this.error('Invalid input for swarm execution');
      }

      const swarmRequest = input as {
        name?: string;
        agents?: string[];
        orchestration?: 'sequential' | 'parallel' | 'dynamic';
        task?: unknown;
      };

      const config: SwarmConfig = {
        name: swarmRequest.name || `swarm-${context.taskId}`,
        agents: swarmRequest.agents || [],
        orchestration: swarmRequest.orchestration || 'dynamic',
      };

      if (config.agents.length === 0) {
        return this.error('No agents specified for swarm');
      }

      this.activeSwarms.set(config.name, config);

      try {
        // Return swarm configuration ready for execution by orchestrator
        return this.success({
          swarmId: config.name,
          configured: true,
          agentCount: config.agents.length,
          orchestration: config.orchestration,
          ready: true,
        }, {
          taskId: context.taskId,
          sessionId: context.sessionId,
        });
      } finally {
        this.activeSwarms.delete(config.name);
      }
    });
  }

  getActiveSwarms(): string[] {
    return Array.from(this.activeSwarms.keys());
  }

  getSwarmConfig(name: string): SwarmConfig | undefined {
    return this.activeSwarms.get(name);
  }
}
