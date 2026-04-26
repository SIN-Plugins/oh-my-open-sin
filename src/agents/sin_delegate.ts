import { SubAgent } from '../core/SubAgent.js';
import { SubAgentConfig, TaskContext, SubAgentResult } from '../types/index.js';

/**
 * sin_delegate - Delegates tasks to appropriate subagents
 * Acts as a router and task dispatcher
 */
export class SinDelegate extends SubAgent {
  constructor() {
    super({
      name: 'sin_delegate',
      description: 'Delegates and routes tasks to appropriate subagents',
      capabilities: ['task-routing', 'delegation', 'load-balancing'],
      priority: 1,
    });
  }

  async execute(context: TaskContext, input: unknown): Promise<SubAgentResult> {
    return this.trackExecution(context.taskId, async () => {
      if (!this.validateInput(input)) {
        return this.error('Invalid input for delegation');
      }

      const task = input as { type?: string; target?: string; payload?: unknown };
      
      // Analyze task and route appropriately
      const routing = this.analyzeTask(task);
      
      return this.success({
        routed: true,
        targetType: routing.targetType,
        confidence: routing.confidence,
        suggestedAgents: routing.suggestedAgents,
      }, {
        taskId: context.taskId,
        sessionId: context.sessionId,
      });
    });
  }

  private analyzeTask(task: { type?: string; target?: string; payload?: unknown }): {
    targetType: string;
    confidence: number;
    suggestedAgents: string[];
  } {
    const type = task.type?.toLowerCase() || '';
    
    if (type.includes('git') || type.includes('commit') || type.includes('branch')) {
      return {
        targetType: 'git',
        confidence: 0.95,
        suggestedAgents: ['sin_git_orchestrator', 'sin_git_conflict_resolver'],
      };
    }
    
    if (type.includes('health') || type.includes('monitor')) {
      return {
        targetType: 'health',
        confidence: 0.9,
        suggestedAgents: ['sin_health_server', 'sin_monitor'],
      };
    }
    
    if (type.includes('edit') || type.includes('modify')) {
      return {
        targetType: 'edit',
        confidence: 0.85,
        suggestedAgents: ['sin_hash_edit'],
      };
    }

    return {
      targetType: 'general',
      confidence: 0.5,
      suggestedAgents: ['sin_swarm'],
    };
  }
}
