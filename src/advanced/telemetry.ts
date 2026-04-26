/**
 * Telemetry & Monitoring Module
 * Erweiterte Telemetrie, Metriken und Observability
 */

export interface TelemetryEvent {
  timestamp: number;
  type: string;
  agent: string;
  task?: string;
  duration_ms?: number;
  success: boolean;
  error?: string;
  metadata?: any;
}

export interface AgentMetrics {
  name: string;
  total_executions: number;
  successful_executions: number;
  failed_executions: number;
  avg_duration_ms: number;
  success_rate: number;
  last_execution?: number;
}

export class TelemetryManager {
  private events: TelemetryEvent[] = [];
  private metrics: Map<string, AgentMetrics> = new Map();
  private listeners: Array<(event: TelemetryEvent) => void> = [];
  private maxEvents = 10000;

  recordEvent(event: Omit<TelemetryEvent, 'timestamp'>): void {
    const fullEvent: TelemetryEvent = {
      ...event,
      timestamp: Date.now()
    };

    this.events.push(fullEvent);
    
    // Event-Buffer begrenzen
    if (this.events.length > this.maxEvents) {
      this.events.shift();
    }

    // Metriken aktualisieren
    this.updateMetrics(fullEvent);

    // Listener benachrichtigen
    this.notifyListeners(fullEvent);
  }

  private updateMetrics(event: TelemetryEvent): void {
    let agentMetrics = this.metrics.get(event.agent);
    
    if (!agentMetrics) {
      agentMetrics = {
        name: event.agent,
        total_executions: 0,
        successful_executions: 0,
        failed_executions: 0,
        avg_duration_ms: 0,
        success_rate: 1.0
      };
      this.metrics.set(event.agent, agentMetrics);
    }

    agentMetrics.total_executions++;
    
    if (event.success) {
      agentMetrics.successful_executions++;
    } else {
      agentMetrics.failed_executions++;
    }

    if (event.duration_ms !== undefined) {
      // Laufender Durchschnitt für Dauer
      const totalDuration = agentMetrics.avg_duration_ms * (agentMetrics.total_executions - 1);
      agentMetrics.avg_duration_ms = (totalDuration + event.duration_ms) / agentMetrics.total_executions;
    }

    agentMetrics.success_rate = agentMetrics.successful_executions / agentMetrics.total_executions;
    agentMetrics.last_execution = event.timestamp;
  }

  addListener(callback: (event: TelemetryEvent) => void): void {
    this.listeners.push(callback);
  }

  removeListener(callback: (event: TelemetryEvent) => void): void {
    const index = this.listeners.indexOf(callback);
    if (index > -1) {
      this.listeners.splice(index, 1);
    }
  }

  private notifyListeners(event: TelemetryEvent): void {
    for (const listener of this.listeners) {
      try {
        listener(event);
      } catch (e) {
        console.error('[Telemetry] Listener error:', e);
      }
    }
  }

  getMetrics(agentName?: string): AgentMetrics[] | AgentMetrics | null {
    if (agentName) {
      return this.metrics.get(agentName) || null;
    }
    return Array.from(this.metrics.values());
  }

  getEvents(filters?: {
    agent?: string;
    type?: string;
    success?: boolean;
    since?: number;
  }): TelemetryEvent[] {
    let filtered = [...this.events];

    if (filters?.agent) {
      filtered = filtered.filter(e => e.agent === filters.agent);
    }
    if (filters?.type) {
      filtered = filtered.filter(e => e.type === filters.type);
    }
    if (filters?.success !== undefined) {
      filtered = filtered.filter(e => e.success === filters.success);
    }
    if (filters?.since) {
      filtered = filtered.filter(e => e.timestamp >= filters.since!);
    }

    return filtered;
  }

  exportMetrics(): string {
    return JSON.stringify({
      exported_at: new Date().toISOString(),
      agents: Array.from(this.metrics.values()),
      event_count: this.events.length
    }, null, 2);
  }

  clear(): void {
    this.events = [];
    this.metrics.clear();
  }
}

// Prometheus Metrics Exporter
export class PrometheusExporter {
  constructor(private telemetry: TelemetryManager) {}

  generateMetrics(): string {
    const metrics = this.telemetry.getMetrics() as AgentMetrics[];
    let output = '';

    // Help und Type Definitionen
    output += '# HELP sin_agent_executions_total Total number of agent executions\n';
    output += '# TYPE sin_agent_executions_total counter\n';
    
    output += '# HELP sin_agent_success_total Total number of successful executions\n';
    output += '# TYPE sin_agent_success_total counter\n';
    
    output += '# HELP sin_agent_failure_total Total number of failed executions\n';
    output += '# TYPE sin_agent_failure_total counter\n';
    
    output += '# HELP sin_agent_duration_ms Average execution duration in milliseconds\n';
    output += '# TYPE sin_agent_duration_ms gauge\n';
    
    output += '# HELP sin_agent_success_rate Success rate (0-1)\n';
    output += '# TYPE sin_agent_success_rate gauge\n';

    // Metrikwerte
    for (const agent of metrics) {
      output += `sin_agent_executions_total{agent="${agent.name}"} ${agent.total_executions}\n`;
      output += `sin_agent_success_total{agent="${agent.name}"} ${agent.successful_executions}\n`;
      output += `sin_agent_failure_total{agent="${agent.name}"} ${agent.failed_executions}\n`;
      output += `sin_agent_duration_ms{agent="${agent.name}"} ${agent.avg_duration_ms.toFixed(2)}\n`;
      output += `sin_agent_success_rate{agent="${agent.name}"} ${agent.success_rate.toFixed(4)}\n`;
    }

    return output;
  }
}

// Grafana Dashboard Config Generator
export class GrafanaDashboardGenerator {
  generateDashboard(): any {
    return {
      dashboard: {
        title: 'OH-MY-OPEN-SIN Monitoring',
        refresh: '5s',
        panels: [
          {
            title: 'Agent Success Rate',
            type: 'gauge',
            targets: [{ expr: 'sin_agent_success_rate' }]
          },
          {
            title: 'Execution Duration',
            type: 'graph',
            targets: [{ expr: 'sin_agent_duration_ms' }]
          },
          {
            title: 'Executions Over Time',
            type: 'graph',
            targets: [{ expr: 'rate(sin_agent_executions_total[1m])' }]
          },
          {
            title: 'Error Rate',
            type: 'stat',
            targets: [{ expr: 'rate(sin_agent_failure_total[5m])' }]
          }
        ]
      }
    };
  }
}

// Fleet Sync Integration (für verteilte Systeme)
export interface FleetNode {
  id: string;
  host: string;
  port: number;
  status: 'active' | 'inactive' | 'degraded';
  last_heartbeat: number;
  load: number; // 0-1
}

export class FleetSync {
  private nodes: Map<string, FleetNode> = new Map();
  private nodeId: string;
  private heartbeatInterval = 5000; // ms
  private heartbeatTimer?: NodeJS.Timeout;

  constructor(nodeId: string) {
    this.nodeId = nodeId;
  }

  registerNode(node: FleetNode): void {
    this.nodes.set(node.id, node);
  }

  unregisterNode(nodeId: string): void {
    this.nodes.delete(nodeId);
  }

  startHeartbeat(): void {
    this.heartbeatTimer = setInterval(() => {
      this.sendHeartbeat();
    }, this.heartbeatInterval);
  }

  stopHeartbeat(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
    }
  }

  private sendHeartbeat(): void {
    const node = this.nodes.get(this.nodeId);
    if (node) {
      node.last_heartbeat = Date.now();
      // Hier würde die tatsächliche Netzwerk-Kommunikation stattfinden
      console.log(`[FleetSync] Heartbeat from ${this.nodeId}`);
    }
  }

  getHealthyNodes(): FleetNode[] {
    const now = Date.now();
    const timeout = 30000; // 30s
    
    return Array.from(this.nodes.values()).filter(
      node => node.status === 'active' && (now - node.last_heartbeat) < timeout
    );
  }

  getLoadBalancedNode(): FleetNode | null {
    const healthy = this.getHealthyNodes();
    if (healthy.length === 0) return null;
    
    // Node mit niedrigster Last auswählen
    return healthy.reduce((min, node) => node.load < min.load ? node : min);
  }

  getNodeCount(): number {
    return this.nodes.size;
  }
}

export const TelemetryModule = {
  TelemetryManager,
  PrometheusExporter,
  GrafanaDashboardGenerator,
  FleetSync
};
