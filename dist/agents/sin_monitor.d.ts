import { SubAgent } from '../core/SubAgent.js';
import { TaskContext, SubAgentResult } from '../types/index.js';
/**
 * sin_monitor - Monitors system health and agent status
 * Provides real-time metrics and alerting
 */
export declare class SinMonitor extends SubAgent {
    private metrics;
    private startTime;
    constructor();
    execute(context: TaskContext, input: unknown): Promise<SubAgentResult>;
    private getHealthStatus;
    private getMetrics;
    private getStatus;
    /**
     * Record a metric value
     */
    recordMetric(key: string, value: unknown): void;
    /**
     * Clear old metrics
     */
    clearMetrics(olderThan?: number): void;
}
//# sourceMappingURL=sin_monitor.d.ts.map