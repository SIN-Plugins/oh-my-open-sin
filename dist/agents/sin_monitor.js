"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SinMonitor = void 0;
const SubAgent_js_1 = require("../core/SubAgent.js");
/**
 * sin_monitor - Monitors system health and agent status
 * Provides real-time metrics and alerting
 */
class SinMonitor extends SubAgent_js_1.SubAgent {
    metrics = new Map();
    startTime = Date.now();
    constructor() {
        super({
            name: 'sin_monitor',
            description: 'Monitors system health, agent status, and performance metrics',
            capabilities: ['health-check', 'metrics', 'alerting', 'performance-tracking'],
            priority: 3,
        });
    }
    async execute(context, input) {
        return this.trackExecution(context.taskId, async () => {
            const request = input;
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
    getHealthStatus() {
        const uptime = Date.now() - this.startTime;
        const metricCount = this.metrics.size;
        let status = 'healthy';
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
    getMetrics() {
        const result = {};
        for (const [key, value] of this.metrics.entries()) {
            result[key] = value.value;
        }
        return result;
    }
    getStatus() {
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
    recordMetric(key, value) {
        this.metrics.set(key, {
            timestamp: Date.now(),
            value,
        });
    }
    /**
     * Clear old metrics
     */
    clearMetrics(olderThan) {
        const threshold = olderThan || 60000; // Default 1 minute
        const now = Date.now();
        for (const [key, data] of this.metrics.entries()) {
            if (now - data.timestamp > threshold) {
                this.metrics.delete(key);
            }
        }
    }
}
exports.SinMonitor = SinMonitor;
//# sourceMappingURL=sin_monitor.js.map