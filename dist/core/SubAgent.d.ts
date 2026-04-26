import { SubAgentConfig, SubAgentResult, TaskContext } from '../types/index.js';
/**
 * Base class for all SubAgents in the oh-my-open-sin framework
 * Provides non-blocking, session-aware execution
 */
export declare abstract class SubAgent {
    protected config: SubAgentConfig;
    private isActive;
    private currentTaskId?;
    constructor(config: SubAgentConfig);
    getName(): string;
    getDescription(): string;
    getCapabilities(): string[];
    /**
     * Execute the subagent task - must be implemented by subclasses
     */
    abstract execute(context: TaskContext, input: unknown): Promise<SubAgentResult>;
    /**
     * Check if the agent is currently busy
     */
    isBusy(): boolean;
    /**
     * Get current task ID if any
     */
    getCurrentTaskId(): string | undefined;
    /**
     * Internal method to track task execution
     */
    protected trackExecution<T>(taskId: string, fn: () => Promise<T>): Promise<T>;
    /**
     * Validate input before execution
     */
    protected validateInput(input: unknown): boolean;
    /**
     * Create a success result
     */
    protected success<T>(data: T, metadata?: Record<string, unknown>): SubAgentResult<T>;
    /**
     * Create an error result
     */
    protected error(message: string, metadata?: Record<string, unknown>): SubAgentResult;
}
//# sourceMappingURL=SubAgent.d.ts.map