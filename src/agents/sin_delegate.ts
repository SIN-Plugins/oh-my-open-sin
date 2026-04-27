import { SubAgent } from '../core/SubAgent.js';
import { SubAgentConfig, TaskContext, SubAgentResult } from '../types/index.js';
import { PolicyEngine, getPolicyEngine } from '../core/PolicyEngine.js';
import { TelemetryManager, getTelemetryManager } from '../core/TelemetryManager.js';
import { contextRouter, type RoutingDecision } from '../advanced/context_routing.js';
import { updateRoutingWeights } from '../utils/routing-feedback.js';

/**
 * sin_delegate - Delegates tasks to appropriate subagents
 * Acts as a router and task dispatcher with enterprise features:
 * - Policy-based routing decisions
 * - Telemetry tracking for routing metrics
 * - Session-aware load balancing
 * - Zero-Trust delegation
 * - Context-Aware AST-based routing
 * - Feedback loop for continuous improvement
 */
export class SinDelegate extends SubAgent {
  private policyEngine: PolicyEngine;
  private telemetry: TelemetryManager;
  
  constructor() {
    super({
      name: 'sin_delegate',
      description: 'Delegates and routes tasks to appropriate subagents with policy enforcement and context-aware routing',
      capabilities: ['task-routing', 'delegation', 'load-balancing', 'policy-enforcement', 'context-analysis'],
      priority: 1,
    });
    
    this.policyEngine = getPolicyEngine();
    this.telemetry = getTelemetryManager();
  }

  async execute(context: TaskContext, input: unknown): Promise<SubAgentResult> {
    return this.trackExecution(context.taskId, async () => {
      if (!this.validateInput(input)) {
        this.telemetry.recordEvent('delegate_invalid_input', {
          sessionId: context.sessionId,
          taskId: context.taskId
        });
        return this.error('Invalid input for delegation');
      }

      const task = input as { type?: string; target?: string; payload?: unknown; code?: string; filePath?: string };

      // Policy check for delegation
      const policyCheck = await this.policyEngine.evaluate({
        agentId: context.sessionId,
        action: 'delegate.route',
        resource: `task:${context.taskId}`,
        capabilities: ['delegate:route'],
        timestamp: Date.now(),
        subject: context.sessionId,
        taskType: task.type,
        workspace: context.workspace,
        sessionId: context.sessionId,
        taskId: context.taskId
      });

      if (!policyCheck.allowed) {
        this.telemetry.recordEvent('delegate_policy_violation', {
          sessionId: context.sessionId,
          reason: policyCheck.reason
        });
        
        return this.error(`Delegation blocked by policy: ${policyCheck.reason}`, {
          policy_violation: true
        });
      }

      // Analyze task with context-aware routing
      const startTime = Date.now();
      let routing: RoutingDecision;
      
      // Use AST-based context routing if code is provided
      if (task.code || task.filePath) {
        routing = await this.analyzeWithContext(task);
      } else {
        routing = this.analyzeTask(task);
      }
      
      const duration = Date.now() - startTime;

      // Record routing decision
      this.telemetry.recordEvent('delegate_routing_decision', {
        sessionId: context.sessionId,
        targetType: routing.agentId,
        confidence: routing.confidence,
        suggestedAgents: routing.alternativeAgents,
        reason: routing.reason,
        duration
      });

      // Store routing context for feedback loop
      const routingContext = {
        taskId: context.taskId,
        sessionId: context.sessionId,
        routedTo: routing.agentId,
        timestamp: Date.now()
      };
      
      return this.success({
        routed: true,
        targetType: routing.agentId,
        confidence: routing.confidence,
        suggestedAgents: [routing.agentId, ...routing.alternativeAgents],
        policyApproved: true,
        reason: routing.reason,
        routingContext
      }, {
        sessionId: context.sessionId,
        routingDuration: duration
      });
    });
  }

  /**
   * Context-aware routing using AST analysis
   */
  private async analyzeWithContext(task: { type?: string; target?: string; payload?: unknown; code?: string; filePath?: string }): Promise<RoutingDecision> {
    const code = task.code || '';
    const filePath = task.filePath || 'unknown.ts';
    
    // Analyze code with context router
    const routingContext = contextRouter.analyzeCode(filePath, code);
    
    // Get routing decision from context router
    const decision = contextRouter.routeTask(routingContext);
    
    this.telemetry.recordEvent('context_routing_analysis', {
      taskType: routingContext.taskType,
      complexity: routingContext.complexity,
      symbolsCount: routingContext.symbols.length,
      dependenciesCount: routingContext.dependencies.length
    });
    
    return decision;
  }

  /**
   * Legacy task analysis based on keywords
   */
  private analyzeTask(task: { type?: string; target?: string; payload?: unknown }): {
    agentId: string;
    confidence: number;
    reason: string;
    alternativeAgents: string[];
  } {
    const type = task.type?.toLowerCase() || '';

    if (type.includes('git') || type.includes('commit') || type.includes('branch')) {
      return {
        agentId: 'sin_git_orchestrator',
        confidence: 0.95,
        reason: 'Git-related task detected',
        alternativeAgents: ['sin_git_conflict_resolver', 'sin_git_policy_enforcer']
      };
    }

    if (type.includes('health') || type.includes('monitor') || type.includes('telemetry')) {
      return {
        agentId: 'sin_health_server',
        confidence: 0.9,
        reason: 'Health monitoring task detected',
        alternativeAgents: ['sin_monitor', 'telemetry_manager']
      };
    }

    if (type.includes('edit') || type.includes('modify')) {
      return {
        agentId: 'sin_hash_edit',
        confidence: 0.85,
        reason: 'Code edit task detected',
        alternativeAgents: ['sin_swarm']
      };
    }

    if (type.includes('research') || type.includes('analyze')) {
      return {
        agentId: 'athena',
        confidence: 0.88,
        reason: 'Research task detected',
        alternativeAgents: ['argus', 'daedalus']
      };
    }

    if (type.includes('plan') || type.includes('strategy')) {
      return {
        agentId: 'prometheus',
        confidence: 0.87,
        reason: 'Planning task detected',
        alternativeAgents: ['metis', 'themis']
      };
    }

    if (type.includes('validate') || type.includes('verify') || type.includes('test')) {
      return {
        agentId: 'zeus',
        confidence: 0.92,
        reason: 'Validation task detected',
        alternativeAgents: ['aegis', 'hephaestus']
      };
    }

    if (type.includes('execute') || type.includes('deploy') || type.includes('run')) {
      return {
        agentId: 'atlas',
        confidence: 0.89,
        reason: 'Execution task detected',
        alternativeAgents: ['iris', 'janus']
      };
    }

    return {
      agentId: 'sin_swarm',
      confidence: 0.5,
      reason: 'General task - no specific pattern matched',
      alternativeAgents: []
    };
  }

  /**
   * Report task completion for feedback loop
   */
  async reportTaskCompletion(taskId: string, sessionId: string, agentId: string, success: boolean): Promise<void> {
    await updateRoutingWeights(sessionId, agentId, success);
    this.telemetry.recordEvent('task_completion_reported', {
      taskId,
      sessionId,
      agentId,
      success
    });
  }

  /**
   * Get routing statistics from telemetry
   */
  getRoutingStats(): any {
    return {
      agentName: this.getName(),
      capabilities: this.getCapabilities(),
      description: this.getDescription()
    };
  }
}
