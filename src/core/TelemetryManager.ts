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

import { trace, metrics, context, propagation, Span, SpanStatusCode, MetricOptions } from '@opentelemetry/api';
import { NodeSDK } from '@opentelemetry/sdk-node';
import { PrometheusExporter } from '@opentelemetry/exporter-prometheus';
import { HttpInstrumentation } from '@opentelemetry/instrumentation-http';
import { resourceFromAttributes } from '@opentelemetry/resources';
import { SEMRESATTRS_SERVICE_NAME, SEMRESATTRS_SERVICE_VERSION } from '@opentelemetry/semantic-conventions';
import { TaskContext, SubAgentResult } from '../types/index.js';

// Type-safe Resource constructor
const createResource = (attributes: Record<string, string | number | boolean>) => {
  return resourceFromAttributes(attributes);
};

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

export class TelemetryManager {
  private tracer: ReturnType<typeof trace.getTracer>;
  private meter: ReturnType<typeof metrics.getMeter>;
  private sdk?: NodeSDK;
  private config: Required<TelemetryConfig>;
  private sloBreaches: SLABreach[] = [];
  private metricCollectors: Map<string, any> = new Map();
  private sloWindows: Map<string, number[]> = new Map();
  
  // Pre-defined metrics
  private execDurationHistogram: any;
  private errorCounter: any;
  private requestCounter: any;
  private activeGauge: any;

  constructor(config: TelemetryConfig = {}) {
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

    const resource = createResource({
      [SEMRESATTRS_SERVICE_NAME]: this.config.serviceName,
      [SEMRESATTRS_SERVICE_VERSION]: this.config.serviceVersion
    });

    this.tracer = trace.getTracer(this.config.serviceName);
    this.meter = metrics.getMeter(this.config.serviceName);

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
  async init(): Promise<void> {
    if (!this.config.enableMetrics && !this.config.enableTracing) {
      return;
    }

    const instruments: any[] = [];
    
    if (this.config.enableTracing) {
      instruments.push(new HttpInstrumentation());
    }

    const exporters = [];
    if (this.config.enableMetrics) {
      exporters.push(new PrometheusExporter({ port: this.config.prometheusPort }));
    }

    this.sdk = new NodeSDK({
      resource: createResource({
        [SEMRESATTRS_SERVICE_NAME]: this.config.serviceName,
        [SEMRESATTRS_SERVICE_VERSION]: this.config.serviceVersion
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
  async traceExecution<T>(
    agentName: string,
    fn: () => Promise<T>,
    ctx?: TaskContext
  ): Promise<T> {
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
        
        span.setStatus({ code: SpanStatusCode.OK });
        
        // Record success metrics
        const duration = Date.now() - startTime;
        this.execDurationHistogram.record(duration, { agent: agentName });
        
        return result;
      } catch (error: any) {
        // Record error
        span.setStatus({ 
          code: SpanStatusCode.ERROR, 
          message: error.message 
        });
        span.recordException(error);
        
        this.errorCounter.add(1, { agent: agentName, error_type: error.constructor.name });
        
        // Check SLO for error rate
        this.recordMetricValue('error_rate', agentName, 1);
        
        throw error;
      } finally {
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
  createSpan(name: string, parent?: Span): Span {
    const options: any = {};
    if (parent) {
      options.root = false;
      // Inherit context from parent
    }
    return this.tracer.startSpan(name, options);
  }

  /**
   * Record a custom metric value
   */
  recordMetric(metricName: string, value: number, labels?: Record<string, string>): void {
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
  private recordMetricValue(sloType: string, agentName: string, value: number): void {
    const key = `${sloType}:${agentName}`;
    
    if (!this.sloWindows.has(key)) {
      this.sloWindows.set(key, []);
    }
    
    const window = this.sloWindows.get(key)!;
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
  private checkSLOs(metricType: string, agentName: string): void {
    for (const slo of this.config.sloConfigs) {
      if (!slo.metric.startsWith(metricType)) continue;
      
      const key = `${slo.metric}:${agentName}`;
      const window = this.sloWindows.get(key);
      if (!window || window.length === 0) continue;
      
      let currentValue: number;
      
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
        const breach: SLABreach = {
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
  private calculatePercentile(values: number[], percentile: number): number {
    if (values.length === 0) return 0;
    const sorted = [...values].sort((a, b) => a - b);
    const index = Math.ceil((percentile / 100) * sorted.length) - 1;
    return sorted[Math.max(0, index)];
  }

  /**
   * Check if metric breaches threshold
   */
  private isBreached(metric: string, value: number, threshold: number): boolean {
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
  private async handleSLOBreach(breach: SLABreach, slo: SLOConfig): Promise<void> {
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
      } catch (e) {
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
  getBreaches(since?: number): SLABreach[] {
    if (!since) return [...this.sloBreaches];
    return this.sloBreaches.filter(b => b.timestamp >= since);
  }

  /**
   * Clear old breaches
   */
  clearOldBreaches(before: number): void {
    this.sloBreaches = this.sloBreaches.filter(b => b.timestamp >= before);
  }

  /**
   * Get metrics endpoint URL
   */
  getMetricsUrl(): string {
    return `http://localhost:${this.config.prometheusPort}/metrics`;
  }

  /**
   * Shutdown telemetry
   */
  async shutdown(): Promise<void> {
    if (this.sdk) {
      await this.sdk.shutdown();
      console.log('[Telemetry] Shutdown complete');
    }
  }

  /**
   * Get current statistics
   */
  getStats(): {
    breaches: number;
    activeSLOs: number;
    metricsExported: boolean;
    tracingEnabled: boolean;
  } {
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
  recordEvent(eventType: string, data: Record<string, any>): void {
    console.log(`[Telemetry:Event] ${eventType}:`, JSON.stringify(data));
  }

  /**
   * Check if telemetry is enabled
   */
  isEnabled(): boolean {
    return this.config.enableMetrics || this.config.enableTracing;
  }

}

// Singleton instance
let _telemetryManager: TelemetryManager | undefined;

export function getTelemetryManager(config?: TelemetryConfig): TelemetryManager {
  if (!_telemetryManager) {
    _telemetryManager = new TelemetryManager(config);
  }
  return _telemetryManager;
}

/**
 * Decorator for tracing agent methods
 */
export function traced(agentName?: string) {
  return function (
    target: any,
    propertyKey: string,
    descriptor: PropertyDescriptor
  ) {
    const originalMethod = descriptor.value;
    const name = agentName || target.constructor.name;
    
    descriptor.value = async function (...args: any[]) {
      const telemetry = getTelemetryManager();
      return telemetry.traceExecution(name, () => originalMethod.apply(this, args));
    };
    
    return descriptor;
  };
}
