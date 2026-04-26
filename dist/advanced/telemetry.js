"use strict";
/**
 * Telemetry & Monitoring Module
 * Erweiterte Telemetrie, Metriken und Observability
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.TelemetryModule = exports.FleetSync = exports.GrafanaDashboardGenerator = exports.PrometheusExporter = exports.TelemetryManager = void 0;
class TelemetryManager {
    events = [];
    metrics = new Map();
    listeners = [];
    maxEvents = 10000;
    recordEvent(event) {
        const fullEvent = {
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
    updateMetrics(event) {
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
        }
        else {
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
    addListener(callback) {
        this.listeners.push(callback);
    }
    removeListener(callback) {
        const index = this.listeners.indexOf(callback);
        if (index > -1) {
            this.listeners.splice(index, 1);
        }
    }
    notifyListeners(event) {
        for (const listener of this.listeners) {
            try {
                listener(event);
            }
            catch (e) {
                console.error('[Telemetry] Listener error:', e);
            }
        }
    }
    getMetrics(agentName) {
        if (agentName) {
            return this.metrics.get(agentName) || null;
        }
        return Array.from(this.metrics.values());
    }
    getEvents(filters) {
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
            filtered = filtered.filter(e => e.timestamp >= filters.since);
        }
        return filtered;
    }
    exportMetrics() {
        return JSON.stringify({
            exported_at: new Date().toISOString(),
            agents: Array.from(this.metrics.values()),
            event_count: this.events.length
        }, null, 2);
    }
    clear() {
        this.events = [];
        this.metrics.clear();
    }
}
exports.TelemetryManager = TelemetryManager;
// Prometheus Metrics Exporter
class PrometheusExporter {
    telemetry;
    constructor(telemetry) {
        this.telemetry = telemetry;
    }
    generateMetrics() {
        const metrics = this.telemetry.getMetrics();
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
exports.PrometheusExporter = PrometheusExporter;
// Grafana Dashboard Config Generator
class GrafanaDashboardGenerator {
    generateDashboard() {
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
exports.GrafanaDashboardGenerator = GrafanaDashboardGenerator;
class FleetSync {
    nodes = new Map();
    nodeId;
    heartbeatInterval = 5000; // ms
    heartbeatTimer;
    constructor(nodeId) {
        this.nodeId = nodeId;
    }
    registerNode(node) {
        this.nodes.set(node.id, node);
    }
    unregisterNode(nodeId) {
        this.nodes.delete(nodeId);
    }
    startHeartbeat() {
        this.heartbeatTimer = setInterval(() => {
            this.sendHeartbeat();
        }, this.heartbeatInterval);
    }
    stopHeartbeat() {
        if (this.heartbeatTimer) {
            clearInterval(this.heartbeatTimer);
        }
    }
    sendHeartbeat() {
        const node = this.nodes.get(this.nodeId);
        if (node) {
            node.last_heartbeat = Date.now();
            // Hier würde die tatsächliche Netzwerk-Kommunikation stattfinden
            console.log(`[FleetSync] Heartbeat from ${this.nodeId}`);
        }
    }
    getHealthyNodes() {
        const now = Date.now();
        const timeout = 30000; // 30s
        return Array.from(this.nodes.values()).filter(node => node.status === 'active' && (now - node.last_heartbeat) < timeout);
    }
    getLoadBalancedNode() {
        const healthy = this.getHealthyNodes();
        if (healthy.length === 0)
            return null;
        // Node mit niedrigster Last auswählen
        return healthy.reduce((min, node) => node.load < min.load ? node : min);
    }
    getNodeCount() {
        return this.nodes.size;
    }
}
exports.FleetSync = FleetSync;
exports.TelemetryModule = {
    TelemetryManager,
    PrometheusExporter,
    GrafanaDashboardGenerator,
    FleetSync
};
//# sourceMappingURL=telemetry.js.map