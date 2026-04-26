import { SubAgent } from '../core/SubAgent.js';
import { TaskContext, SubAgentResult, HealthStatus } from '../types/index.js';

/**
 * sin_monitor - Monitors system health and agent status
 * Provides real-time metrics and alerting
 */
export class SinMonitor extends SubAgent {
  private metrics: Map<string, { timestamp: number; value: unknown }> = new Map();
  private startTime: number = Date.now();

  constructor() {
    super({
      name: 'sin_monitor',
      description: 'Monitors system health, agent status, and performance metrics',
      capabilities: ['health-check', 'metrics', 'alerting', 'performance-tracking'],
      priority: 3,
    });
  }

  async execute(context: TaskContext, input: unknown): Promise<SubAgentResult> {
    return this.trackExecution(context.taskId, async () => {
      const request = input as { action?: string; target?: string } | undefined;
      const action = request?.action || 'status';

      switch (action) {
        case 'health':
          return this.success(this.getHealthStatus());
        case 'metrics':
          return this.success(this.getMetrics());
        case 'status':
        default:
          return this.success(this.getStatus());
      }
    });
  }

  private getHealthStatus(): HealthStatus {
    const uptime = Date.now() - this.startTime;
    const metricCount = this.metrics.size;
    
    let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
    if (metricCount > 1000) {
      status = 'degraded';
    }

    return {
      status,
      uptime,
      lastCheck: Date.now(),
      details: {
        metricCount,
        memoryUsage: process.memoryUsage().heapUsed,
        platform: process.platform,
      },
    };
  }

  private getMetrics(): Record<string, unknown> {
    const result: Record<string, unknown> = {};
    for (const [key, value] of this.metrics.entries()) {
      result[key] = value.value;
    }
    return result;
  }

  private getStatus(): Record<string, unknown> {
    return {
      name: this.getName(),
      active: !this.isBusy(),
      uptime: Date.now() - this.startTime,
      metricsTracked: this.metrics.size,
      currentTask: this.getCurrentTaskId(),
    };
  }

  /**
   * Record a metric value
   */
  recordMetric(key: string, value: unknown): void {
    this.metrics.set(key, {
      timestamp: Date.now(),
      value,
    });
  }

  /**
   * Clear old metrics
   */
  clearMetrics(olderThan?: number): void {
    const threshold = olderThan || 60000; // Default 1 minute
    const now = Date.now();
    
    for (const [key, data] of this.metrics.entries()) {
      if (now - data.timestamp > threshold) {
        this.metrics.delete(key);
      }
    }
  }
}
