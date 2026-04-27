import { SubAgent } from '../core/SubAgent.js';
import { TaskContext, SubAgentResult, SwarmConfig } from '../types/index.js';
import { PolicyEngine, getPolicyEngine } from '../core/PolicyEngine.js';
import { TelemetryManager, getTelemetryManager } from '../core/TelemetryManager.js';
import { DAGTaskScheduler, getDAGTaskScheduler } from '../core/DAGTaskScheduler.js';
import { NATSMessageBus, getNATSMessageBus } from '../core/NATSMessageBus.js';

/**
 * sin_swarm - Coordinates swarm-based task execution with enterprise features
 * Manages parallel and sequential agent collaboration with:
 * - Policy enforcement for swarm creation
 * - Telemetry tracking for swarm metrics
 * - DAG-based task scheduling
 * - NATS messaging for cross-swarm communication
 * - Self-healing capabilities
 */
export class SinSwarm extends SubAgent {
  private activeSwarms: Map<string, SwarmConfig> = new Map();
  private policyEngine: PolicyEngine;
  private telemetry: TelemetryManager;
  private scheduler: DAGTaskScheduler;
  private messageBus: NATSMessageBus;

  constructor() {
    super({
      name: 'sin_swarm',
      description: 'Coordinates swarm-based multi-agent collaboration with enterprise governance',
      capabilities: ['swarm-orchestration', 'parallel-execution', 'collaborative-tasks', 'dag-scheduling', 'policy-enforcement'],
      priority: 2,
    });
    
    this.policyEngine = getPolicyEngine();
    this.telemetry = getTelemetryManager();
    this.scheduler = getDAGTaskScheduler();
    this.messageBus = getNATSMessageBus();
  }

  async execute(context: TaskContext, input: unknown): Promise<SubAgentResult> {
    return this.trackExecution(context.taskId, async () => {
      if (!this.validateInput(input)) {
        this.telemetry.recordEvent('swarm_invalid_input', {
          sessionId: context.sessionId,
          taskId: context.taskId
        });
        return this.error('Invalid input for swarm execution');
      }

      const swarmRequest = input as {
        name?: string;
        agents?: string[];
        orchestration?: 'sequential' | 'parallel' | 'dynamic';
        task?: unknown;
        dependencies?: Array<{ from: string; to: string }>;
      };

      // Policy check for swarm creation
      const policyCheck = await this.policyEngine.evaluate({
        agentId: context.sessionId,
        action: 'swarm.create',
        resource: `swarm:${swarmRequest.name || context.taskId}`,
        capabilities: ['swarm:create'],
        timestamp: Date.now(),
        subject: context.sessionId,
        sessionId: context.sessionId,
        taskId: context.taskId,
        metadata: {
          agentCount: swarmRequest.agents?.length || 0,
          orchestration: swarmRequest.orchestration
        }
      });

      if (!policyCheck.allowed) {
        this.telemetry.recordEvent('swarm_policy_violation', {
          sessionId: context.sessionId,
  
          reason: policyCheck.reason
        });
        
        return this.error(`Swarm creation blocked by policy: ${policyCheck.reason}`, {
          policy_violation: true
        });
      }

      const config: SwarmConfig = {
        name: swarmRequest.name || `swarm-${context.taskId}`,
        agents: swarmRequest.agents || [],
        orchestration: swarmRequest.orchestration || 'dynamic',
      };

      if (config.agents.length === 0) {
        this.telemetry.recordEvent('swarm_no_agents', {
          sessionId: context.sessionId,
          taskId: context.taskId
        });
        return this.error('No agents specified for swarm');
      }

      const startTime = Date.now();
      this.activeSwarms.set(config.name, config);

      try {
        // Record swarm creation
        this.telemetry.recordEvent('swarm_created', {
          swarmId: config.name,
          sessionId: context.sessionId,
  
          agentCount: config.agents.length,
          orchestration: config.orchestration
        });

        // Publish swarm creation to message bus
        await this.messageBus.publish('swarm.events', {
          type: 'swarm_created',
          swarmId: config.name,
          config,
          timestamp: Date.now()
        });

        const duration = Date.now() - startTime;

        // Return swarm configuration ready for execution by orchestrator
        return this.success({
          swarmId: config.name,
          configured: true,
          agentCount: config.agents.length,
          orchestration: config.orchestration,
          ready: true,
          policyApproved: true,
          duration
        }, {
  
          sessionId: context.sessionId,
          swarmCreationDuration: duration
        });
      } catch (error) {
        this.telemetry.recordEvent('swarm_creation_error', {
          swarmId: config.name,
          sessionId: context.sessionId,
  
          error: error instanceof Error ? error.message : 'Unknown error'
        });
        
        throw error;
      } finally {
        this.activeSwarms.delete(config.name);
      }
    });
  }

  /**
   * Create a DAG-based swarm with task dependencies
   */
  async createDagSwarm(
    context: TaskContext,
    agents: string[],
    dependencies: Array<{ from: string; to: string }>
  ): Promise<SubAgentResult> {
    const startTime = Date.now();
    
    try {
      // Schedule tasks with DAG
      const scheduleResult = await this.scheduler.schedule(agents.map((agent, idx) => ({
        id: `task-${agent}-${idx}`,
        name: agent,
        action: 'execute',
        dependencies: dependencies
          .filter(d => d.to === agent)
          .map(d => `task-${d.from}-${agents.indexOf(d.from)}`),
        priority: 1,
        payload: { agent, context }
      })));

      const duration = Date.now() - startTime;

      this.telemetry.recordEvent('swarm_dag_scheduled', {
        sessionId: context.sessionId,

        taskCount: agents.length,
        dependencyCount: dependencies.length,
        duration
      });

      return this.success({
        scheduled: true,
        taskId: scheduleResult.executionId,
        taskCount: agents.length,
        parallelGroups: scheduleResult.parallelGroups.length,
        estimatedDuration: scheduleResult.estimatedDuration
      });
    } catch (error) {
      this.telemetry.recordEvent('swarm_dag_error', {
        sessionId: context.sessionId,

        error: error instanceof Error ? error.message : 'Unknown error'
      });
      
      return this.error(`DAG scheduling failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  getActiveSwarms(): string[] {
    return Array.from(this.activeSwarms.keys());
  }

  getSwarmConfig(name: string): SwarmConfig | undefined {
    return this.activeSwarms.get(name);
  }

  /**
   * Get swarm statistics
   */
  getSwarmStats(): any {
    return {
      activeSwarms: this.activeSwarms.size,
      schedulerStats: this.scheduler.getStats(),
      messageBusStats: this.messageBus.getStats()
    };
  }
}
