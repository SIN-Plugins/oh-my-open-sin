import { HealthStatus } from '../types/index.js';
/**
 * HealthServer - HTTP server for health checks and metrics
 * Provides endpoints for monitoring system status
 */
export declare class HealthServer {
    private server;
    private port;
    private startTime;
    private customChecks;
    constructor(port?: number);
    /**
     * Register a custom health check
     */
    registerCheck(name: string, checkFn: () => Promise<boolean>): void;
    /**
     * Start the health server
     */
    start(): Promise<void>;
    /**
     * Stop the health server
     */
    stop(): Promise<void>;
    /**
     * Get comprehensive health status
     */
    getHealthStatus(): Promise<HealthStatus>;
    /**
     * Check if system is ready to accept traffic
     */
    checkReadiness(): Promise<boolean>;
    /**
     * Get system metrics
     */
    getMetrics(): Promise<Record<string, unknown>>;
    /**
     * Get server port
     */
    getPort(): number;
    /**
     * Check if server is running
     */
    isRunning(): boolean;
}
//# sourceMappingURL=HealthServer.d.ts.map