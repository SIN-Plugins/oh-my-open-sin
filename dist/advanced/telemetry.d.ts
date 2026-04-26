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
export declare class TelemetryManager {
    private events;
    private metrics;
    private listeners;
    private maxEvents;
    recordEvent(event: Omit<TelemetryEvent, 'timestamp'>): void;
    private updateMetrics;
    addListener(callback: (event: TelemetryEvent) => void): void;
    removeListener(callback: (event: TelemetryEvent) => void): void;
    private notifyListeners;
    getMetrics(agentName?: string): AgentMetrics[] | AgentMetrics | null;
    getEvents(filters?: {
        agent?: string;
        type?: string;
        success?: boolean;
        since?: number;
    }): TelemetryEvent[];
    exportMetrics(): string;
    clear(): void;
}
export declare class PrometheusExporter {
    private telemetry;
    constructor(telemetry: TelemetryManager);
    generateMetrics(): string;
}
export declare class GrafanaDashboardGenerator {
    generateDashboard(): any;
}
export interface FleetNode {
    id: string;
    host: string;
    port: number;
    status: 'active' | 'inactive' | 'degraded';
    last_heartbeat: number;
    load: number;
}
export declare class FleetSync {
    private nodes;
    private nodeId;
    private heartbeatInterval;
    private heartbeatTimer?;
    constructor(nodeId: string);
    registerNode(node: FleetNode): void;
    unregisterNode(nodeId: string): void;
    startHeartbeat(): void;
    stopHeartbeat(): void;
    private sendHeartbeat;
    getHealthyNodes(): FleetNode[];
    getLoadBalancedNode(): FleetNode | null;
    getNodeCount(): number;
}
export declare const TelemetryModule: {
    TelemetryManager: typeof TelemetryManager;
    PrometheusExporter: typeof PrometheusExporter;
    GrafanaDashboardGenerator: typeof GrafanaDashboardGenerator;
    FleetSync: typeof FleetSync;
};
//# sourceMappingURL=telemetry.d.ts.map