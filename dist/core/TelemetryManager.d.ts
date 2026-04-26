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
import { Span } from '@opentelemetry/api';
import { TaskContext } from '../types/index.js';
export interface SLOConfig {
    name: string;
    metric: 'latency_p99' | 'error_rate' | 'throughput' | 'availability';
    threshold: number;
    windowMs: number;
    action: 'alert' | 'degrade' | 'halt';
}
export interface TelemetryConfig {
    serviceName?: string;
    serviceVersion?: string;
    prometheusPort?: number;
    enableTracing?: boolean;
    enableMetrics?: boolean;
    samplingRate?: number;
    sloConfigs?: SLOConfig[];
    alertWebhook?: string;
}
export interface SLABreach {
    sloName: string;
    currentValue: number;
    threshold: number;
    timestamp: number;
    severity: 'warning' | 'critical';
}
export declare class TelemetryManager {
    private tracer;
    private meter;
    private sdk?;
    private config;
    private sloBreaches;
    private metricCollectors;
    private sloWindows;
    private execDurationHistogram;
    private errorCounter;
    private requestCounter;
    private activeGauge;
    constructor(config?: TelemetryConfig);
    /**
     * Initialize the telemetry SDK
     */
    init(): Promise<void>;
    /**
     * Trace agent execution with automatic span management
     */
    traceExecution<T>(agentName: string, fn: () => Promise<T>, ctx?: TaskContext): Promise<T>;
    /**
     * Create a custom span for complex operations
     */
    createSpan(name: string, parent?: Span): Span;
    /**
     * Record a custom metric value
     */
    recordMetric(metricName: string, value: number, labels?: Record<string, string>): void;
    /**
     * Record metric value for SLO tracking
     */
    private recordMetricValue;
    /**
     * Check SLO configurations for breaches
     */
    private checkSLOs;
    /**
     * Calculate percentile from array
     */
    private calculatePercentile;
    /**
     * Check if metric breaches threshold
     */
    private isBreached;
    /**
     * Handle SLO breach with configured action
     */
    private handleSLOBreach;
    /**
     * Get current SLO breaches
     */
    getBreaches(since?: number): SLABreach[];
    /**
     * Clear old breaches
     */
    clearOldBreaches(before: number): void;
    /**
     * Get metrics endpoint URL
     */
    getMetricsUrl(): string;
    /**
     * Shutdown telemetry
     */
    shutdown(): Promise<void>;
    /**
     * Get current statistics
     */
    getStats(): {
        breaches: number;
        activeSLOs: number;
        metricsExported: boolean;
        tracingEnabled: boolean;
    };
    /**
     * Record an event for logging and auditing
     */
    recordEvent(eventType: string, data: Record<string, any>): void;
    /**
     * Check if telemetry is enabled
     */
    isEnabled(): boolean;
}
export declare function getTelemetryManager(config?: TelemetryConfig): TelemetryManager;
/**
 * Decorator for tracing agent methods
 */
export declare function traced(agentName?: string): (target: any, propertyKey: string, descriptor: PropertyDescriptor) => PropertyDescriptor;
//# sourceMappingURL=TelemetryManager.d.ts.map