import { SubAgentConfig, SubAgentResult, TaskContext } from '../types/index.js';

/**
 * Base class for all SubAgents in the oh-my-open-sin framework
 * Provides non-blocking, session-aware execution
 */
export abstract class SubAgent {
  protected config: SubAgentConfig;
  private isActive: boolean = false;
  private currentTaskId?: string;

  constructor(config: SubAgentConfig) {
    this.config = config;
  }

  getName(): string {
    return this.config.name;
  }

  getDescription(): string {
    return this.config.description;
  }

  getCapabilities(): string[] {
    return this.config.capabilities;
  }

  /**
   * Execute the subagent task - must be implemented by subclasses
   */
  abstract execute(context: TaskContext, input: unknown): Promise<SubAgentResult>;

  /**
   * Check if the agent is currently busy
   */
  isBusy(): boolean {
    return this.isActive;
  }

  /**
   * Get current task ID if any
   */
  getCurrentTaskId(): string | undefined {
    return this.currentTaskId;
  }

  /**
   * Internal method to track task execution
   */
  protected async trackExecution<T>(
    taskId: string,
    fn: () => Promise<T>
  ): Promise<T> {
    this.isActive = true;
    this.currentTaskId = taskId;
    
    try {
      const result = await fn();
      return result;
    } finally {
      this.isActive = false;
      this.currentTaskId = undefined;
    }
  }

  /**
   * Validate input before execution
   */
  protected validateInput(input: unknown): boolean {
    return input !== null && input !== undefined;
  }

  /**
   * Create a success result
   */
  protected success<T>(data: T, metadata?: Record<string, unknown>): SubAgentResult<T> {
    return {
      success: true,
      data,
      metadata,
    };
  }

  /**
   * Create an error result
   */
  protected error(message: string, metadata?: Record<string, unknown>): SubAgentResult {
    return {
      success: false,
      error: message,
      metadata,
    };
  }
}
