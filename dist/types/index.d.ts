/**
 * Core types for oh-my-open-sin framework
 */
export interface SubAgentConfig {
    name: string;
    description: string;
    capabilities: string[];
    priority?: number;
    timeout?: number;
}
export interface SubAgentResult<T = unknown> {
    success: boolean;
    data?: T;
    error?: string;
    duration?: number;
    metadata?: Record<string, unknown>;
}
export interface TaskContext {
    sessionId: string;
    taskId: string;
    workspace: string;
    branch?: string;
    parentTaskId?: string;
    metadata?: Record<string, unknown>;
    task?: {
        id: string;
        description?: string;
    };
}
export interface AgentMessage {
    type: 'request' | 'response' | 'error' | 'progress' | 'task_queued';
    from: string;
    to: string;
    payload: unknown;
    timestamp: number;
    correlationId?: string;
}
export interface HealthStatus {
    status: 'healthy' | 'degraded' | 'unhealthy';
    uptime: number;
    lastCheck: number;
    details: Record<string, unknown>;
}
export interface GitWorktreeConfig {
    path: string;
    branch: string;
    detached?: boolean;
}
export interface SwarmConfig {
    name: string;
    agents: string[];
    orchestration: 'sequential' | 'parallel' | 'dynamic';
}
//# sourceMappingURL=index.d.ts.map