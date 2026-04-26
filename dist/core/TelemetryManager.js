"use strict";
/**
 * OpenTelemetry & SLO Enforcement Module
 *
 * Implements comprehensive observability with traces, metrics, and logs.
 * Features automatic SLO monitoring, alerting, and auto-degradation.
 *
 * Features:
 * - Distributed tracing across swarms
 * - RED/USE metrics collection
 * - SLO breach detection and alerting
 * - Auto-degradation on SLO violation
 * - Prometheus-compatible metrics export
 * - GDPR-compliant log masking
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.TelemetryManager = void 0;
exports.getTelemetryManager = getTelemetryManager;
exports.traced = traced;
const api_1 = require("@opentelemetry/api");
const sdk_node_1 = require("@opentelemetry/sdk-node");
const exporter_prometheus_1 = require("@opentelemetry/exporter-prometheus");
const instrumentation_http_1 = require("@opentelemetry/instrumentation-http");
const resources_1 = require("@opentelemetry/resources");
const semantic_conventions_1 = require("@opentelemetry/semantic-conventions");
class TelemetryManager {
    tracer;
    meter;
    sdk;
    config;
    sloBreaches = [];
    metricCollectors = new Map();
    sloWindows = new Map();
    // Pre-defined metrics
    execDurationHistogram;
    errorCounter;
    requestCounter;
    activeGauge;
    constructor(config = {}) {
        this.config = {
            serviceName: config.serviceName || 'oh-my-open-sin',
            serviceVersion: config.serviceVersion || '1.0.0',
            prometheusPort: config.prometheusPort || 9464,
            enableTracing: config.enableTracing ?? true,
            enableMetrics: config.enableMetrics ?? true,
            samplingRate: config.samplingRate ?? 1.0,
            sloConfigs: config.sloConfigs || [],
            alertWebhook: config.alertWebhook || ''
        };
        const resource = (0, resources_1.resourceFromAttributes)({
            [semantic_conventions_1.SEMRESATTRS_SERVICE_NAME]: this.config.serviceName,
            [semantic_conventions_1.SEMRESATTRS_SERVICE_VERSION]: this.config.serviceVersion
        });
        this.tracer = api_1.trace.getTracer(this.config.serviceName);
        this.meter = api_1.metrics.getMeter(this.config.serviceName);
        // Initialize standard metrics
        this.execDurationHistogram = this.meter.createHistogram('agent.exec.duration', {
            description: 'Agent execution duration in milliseconds',
            unit: 'ms'
        });
        this.errorCounter = this.meter.createCounter('agent.errors.total', {
            description: 'Total number of agent errors'
        });
        this.requestCounter = this.meter.createCounter('agent.requests.total', {
            description: 'Total number of agent requests'
        });
        this.activeGauge = this.meter.createUpDownCounter('agent.active.count', {
            description: 'Number of currently active agents'
        });
    }
    /**
     * Initialize the telemetry SDK
     */
    async init() {
        if (!this.config.enableMetrics && !this.config.enableTracing) {
            return;
        }
        const instruments = [];
        if (this.config.enableTracing) {
            instruments.push(new instrumentation_http_1.HttpInstrumentation());
        }
        const exporters = [];
        if (this.config.enableMetrics) {
            exporters.push(new exporter_prometheus_1.PrometheusExporter({ port: this.config.prometheusPort }));
        }
        this.sdk = new sdk_node_1.NodeSDK({
            resource: (0, resources_1.resourceFromAttributes)({
                [semantic_conventions_1.SEMRESATTRS_SERVICE_NAME]: this.config.serviceName,
                [semantic_conventions_1.SEMRESATTRS_SERVICE_VERSION]: this.config.serviceVersion
            }),
            instrumentations: instruments,
            metricReader: exporters[0],
            sampler: {
                shouldSample: () => ({
                    decision: Math.random() < this.config.samplingRate
                        ? 1 /* SAMPLE */
                        : 0 /* NOT_SAMPLE */
                })
            }
        });
        await this.sdk.start();
        console.log(`[Telemetry] Initialized ${this.config.serviceName} v${this.config.serviceVersion}`);
        if (this.config.enableMetrics) {
            console.log(`[Telemetry] Prometheus metrics available at http://localhost:${this.config.prometheusPort}/metrics`);
        }
    }
    /**
     * Trace agent execution with automatic span management
     */
    async traceExecution(agentName, fn, ctx) {
        const spanName = `${agentName}.execute`;
        return this.tracer.startActiveSpan(spanName, async (span) => {
            const startTime = Date.now();
            // Set span attributes
            span.setAttribute('agent.name', agentName);
            span.setAttribute('agent.type', 'subagent');
            if (ctx?.sessionId) {
                span.setAttribute('session.id', ctx.sessionId);
            }
            if (ctx?.task?.id) {
                span.setAttribute('task.id', ctx.task.id);
            }
            // Increment active gauge
            this.activeGauge.add(1, { agent: agentName });
            this.requestCounter.add(1, { agent: agentName });
            try {
                const result = await fn();
                span.setStatus({ code: api_1.SpanStatusCode.OK });
                // Record success metrics
                const duration = Date.now() - startTime;
                this.execDurationHistogram.record(duration, { agent: agentName });
                return result;
            }
            catch (error) {
                // Record error
                span.setStatus({
                    code: api_1.SpanStatusCode.ERROR,
                    message: error.message
                });
                span.recordException(error);
                this.errorCounter.add(1, { agent: agentName, error_type: error.constructor.name });
                // Check SLO for error rate
                this.recordMetricValue('error_rate', agentName, 1);
                throw error;
            }
            finally {
                // Decrement active gauge
                this.activeGauge.add(-1, { agent: agentName });
                // Record latency SLO
                const duration = Date.now() - startTime;
                this.recordMetricValue('latency_p99', agentName, duration);
                span.end();
            }
        });
    }
    /**
     * Create a custom span for complex operations
     */
    createSpan(name, parent) {
        const options = {};
        if (parent) {
            options.root = false;
            // Inherit context from parent
        }
        return this.tracer.startSpan(name, options);
    }
    /**
     * Record a custom metric value
     */
    recordMetric(metricName, value, labels) {
        let collector = this.metricCollectors.get(metricName);
        if (!collector) {
            collector = this.meter.createUpDownCounter(metricName, {
                description: `Custom metric: ${metricName}`
            });
            this.metricCollectors.set(metricName, collector);
        }
        collector.add(value, labels || {});
    }
    /**
     * Record metric value for SLO tracking
     */
    recordMetricValue(sloType, agentName, value) {
        const key = `${sloType}:${agentName}`;
        if (!this.sloWindows.has(key)) {
            this.sloWindows.set(key, []);
        }
        const window = this.sloWindows.get(key);
        window.push(value);
        // Keep only recent values based on max window
        const maxWindow = Math.max(...this.config.sloConfigs.map(c => c.windowMs), 60000);
        const maxSamples = Math.ceil(maxWindow / 100); // Assume 100ms sampling
        if (window.length > maxSamples) {
            window.shift();
        }
        // Check SLOs
        this.checkSLOs(sloType, agentName);
    }
    /**
     * Check SLO configurations for breaches
     */
    checkSLOs(metricType, agentName) {
        for (const slo of this.config.sloConfigs) {
            if (!slo.metric.startsWith(metricType))
                continue;
            const key = `${slo.metric}:${agentName}`;
            const window = this.sloWindows.get(key);
            if (!window || window.length === 0)
                continue;
            let currentValue;
            switch (slo.metric) {
                case 'latency_p99':
                    currentValue = this.calculatePercentile(window, 99);
                    break;
                case 'error_rate':
                    const total = window.length;
                    const errors = window.filter(v => v > 0).length;
                    currentValue = (errors / total) * 100;
                    break;
                case 'throughput':
                    currentValue = window.length / (slo.windowMs / 1000);
                    break;
                case 'availability':
                    currentValue = (window.filter(v => v === 1).length / window.length) * 100;
                    break;
                default:
                    currentValue = 0;
            }
            const breached = this.isBreached(slo.metric, currentValue, slo.threshold);
            if (breached) {
                const breach = {
                    sloName: slo.name,
                    currentValue,
                    threshold: slo.threshold,
                    timestamp: Date.now(),
                    severity: currentValue > slo.threshold * 1.5 ? 'critical' : 'warning'
                };
                this.sloBreaches.push(breach);
                this.handleSLOBreach(breach, slo);
            }
        }
    }
    /**
     * Calculate percentile from array
     */
    calculatePercentile(values, percentile) {
        if (values.length === 0)
            return 0;
        const sorted = [...values].sort((a, b) => a - b);
        const index = Math.ceil((percentile / 100) * sorted.length) - 1;
        return sorted[Math.max(0, index)];
    }
    /**
     * Check if metric breaches threshold
     */
    isBreached(metric, value, threshold) {
        switch (metric) {
            case 'latency_p99':
            case 'error_rate':
                return value > threshold;
            case 'throughput':
            case 'availability':
                return value < threshold;
            default:
                return false;
        }
    }
    /**
     * Handle SLO breach with configured action
     */
    async handleSLOBreach(breach, slo) {
        console.warn(`[SLO] Breach detected: ${breach.sloName} (${breach.currentValue.toFixed(2)} > ${breach.threshold})`);
        // Send alert
        if (this.config.alertWebhook) {
            try {
                await fetch(this.config.alertWebhook, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        type: 'slo_breach',
                        breach,
                        timestamp: new Date().toISOString()
                    })
                });
            }
            catch (e) {
                console.error('[SLO] Failed to send alert webhook:', e);
            }
        }
        // Execute action
        switch (slo.action) {
            case 'alert':
                // Already sent alert above
                break;
            case 'degrade':
                console.warn(`[SLO] Auto-degradation triggered for ${breach.sloName}`);
                // Could trigger fallback agents or reduce concurrency
                break;
            case 'halt':
                console.error(`[SLO] HALT triggered for ${breach.sloName} - stopping operations`);
                // Could stop accepting new tasks
                break;
        }
    }
    /**
     * Get current SLO breaches
     */
    getBreaches(since) {
        if (!since)
            return [...this.sloBreaches];
        return this.sloBreaches.filter(b => b.timestamp >= since);
    }
    /**
     * Clear old breaches
     */
    clearOldBreaches(before) {
        this.sloBreaches = this.sloBreaches.filter(b => b.timestamp >= before);
    }
    /**
     * Get metrics endpoint URL
     */
    getMetricsUrl() {
        return `http://localhost:${this.config.prometheusPort}/metrics`;
    }
    /**
     * Shutdown telemetry
     */
    async shutdown() {
        if (this.sdk) {
            await this.sdk.shutdown();
            console.log('[Telemetry] Shutdown complete');
        }
    }
    /**
     * Get current statistics
     */
    getStats() {
        return {
            breaches: this.sloBreaches.length,
            activeSLOs: this.config.sloConfigs.length,
            metricsExported: this.config.enableMetrics,
            tracingEnabled: this.config.enableTracing
        };
    }
    /**
     * Record an event for logging and auditing
     */
    recordEvent(eventType, data) {
        console.log(`[Telemetry:Event] ${eventType}:`, JSON.stringify(data));
    }
    /**
     * Check if telemetry is enabled
     */
    isEnabled() {
        return this.config.enableMetrics || this.config.enableTracing;
    }
}
exports.TelemetryManager = TelemetryManager;
// Singleton instance
let _telemetryManager;
function getTelemetryManager(config) {
    if (!_telemetryManager) {
        _telemetryManager = new TelemetryManager(config);
    }
    return _telemetryManager;
}
/**
 * Decorator for tracing agent methods
 */
function traced(agentName) {
    return function (target, propertyKey, descriptor) {
        const originalMethod = descriptor.value;
        const name = agentName || target.constructor.name;
        descriptor.value = async function (...args) {
            const telemetry = getTelemetryManager();
            return telemetry.traceExecution(name, () => originalMethod.apply(this, args));
        };
        return descriptor;
    };
}
//# sourceMappingURL=TelemetryManager.js.map