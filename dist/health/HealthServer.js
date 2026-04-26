"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.HealthServer = void 0;
const http_1 = require("http");
/**
 * HealthServer - HTTP server for health checks and metrics
 * Provides endpoints for monitoring system status
 */
class HealthServer {
    server = null;
    port;
    startTime;
    customChecks = new Map();
    constructor(port = 3000) {
        this.port = port;
        this.startTime = Date.now();
    }
    /**
     * Register a custom health check
     */
    registerCheck(name, checkFn) {
        this.customChecks.set(name, checkFn);
    }
    /**
     * Start the health server
     */
    async start() {
        return new Promise((resolve, reject) => {
            this.server = (0, http_1.createServer)(async (req, res) => {
                const url = req.url || '/';
                res.setHeader('Content-Type', 'application/json');
                if (url === '/health' || url === '/') {
                    const health = await this.getHealthStatus();
                    res.statusCode = health.status === 'unhealthy' ? 503 : 200;
                    res.end(JSON.stringify(health, null, 2));
                }
                else if (url === '/metrics') {
                    const metrics = await this.getMetrics();
                    res.end(JSON.stringify(metrics, null, 2));
                }
                else if (url === '/ready') {
                    const ready = await this.checkReadiness();
                    res.statusCode = ready ? 200 : 503;
                    res.end(JSON.stringify({ ready }));
                }
                else {
                    res.statusCode = 404;
                    res.end(JSON.stringify({ error: 'Not found' }));
                }
            });
            this.server.listen(this.port, () => {
                console.log(`Health server listening on port ${this.port}`);
                resolve();
            });
            this.server.on('error', reject);
        });
    }
    /**
     * Stop the health server
     */
    async stop() {
        return new Promise((resolve, reject) => {
            if (!this.server) {
                resolve();
                return;
            }
            this.server.close((err) => {
                if (err)
                    reject(err);
                else {
                    this.server = null;
                    resolve();
                }
            });
        });
    }
    /**
     * Get comprehensive health status
     */
    async getHealthStatus() {
        const uptime = Date.now() - this.startTime;
        const details = {
            uptime,
            timestamp: Date.now(),
            version: '1.0.0',
        };
        // Run custom checks
        const checkResults = {};
        let allHealthy = true;
        for (const [name, checkFn] of this.customChecks.entries()) {
            try {
                const result = await checkFn();
                checkResults[name] = result;
                if (!result)
                    allHealthy = false;
            }
            catch (error) {
                checkResults[name] = false;
                allHealthy = false;
            }
        }
        details.checks = checkResults;
        let status = 'healthy';
        if (!allHealthy) {
            status = Object.keys(checkResults).some(k => checkResults[k]) ? 'degraded' : 'unhealthy';
        }
        return {
            status,
            uptime,
            lastCheck: Date.now(),
            details,
        };
    }
    /**
     * Check if system is ready to accept traffic
     */
    async checkReadiness() {
        for (const [, checkFn] of this.customChecks.entries()) {
            try {
                if (!await checkFn()) {
                    return false;
                }
            }
            catch {
                return false;
            }
        }
        return true;
    }
    /**
     * Get system metrics
     */
    async getMetrics() {
        const memUsage = process.memoryUsage();
        return {
            memory: {
                heapUsed: memUsage.heapUsed,
                heapTotal: memUsage.heapTotal,
                rss: memUsage.rss,
                external: memUsage.external,
            },
            uptime: Date.now() - this.startTime,
            platform: process.platform,
            nodeVersion: process.version,
            customChecksCount: this.customChecks.size,
        };
    }
    /**
     * Get server port
     */
    getPort() {
        return this.port;
    }
    /**
     * Check if server is running
     */
    isRunning() {
        return this.server !== null;
    }
}
exports.HealthServer = HealthServer;
//# sourceMappingURL=HealthServer.js.map