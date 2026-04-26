import { createServer, Server } from 'http';
import { HealthStatus } from '../types/index.js';

/**
 * HealthServer - HTTP server for health checks and metrics
 * Provides endpoints for monitoring system status
 */
export class HealthServer {
  private server: Server | null = null;
  private port: number;
  private startTime: number;
  private customChecks: Map<string, () => Promise<boolean>> = new Map();

  constructor(port: number = 3000) {
    this.port = port;
    this.startTime = Date.now();
  }

  /**
   * Register a custom health check
   */
  registerCheck(name: string, checkFn: () => Promise<boolean>): void {
    this.customChecks.set(name, checkFn);
  }

  /**
   * Start the health server
   */
  async start(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.server = createServer(async (req, res) => {
        const url = req.url || '/';
        
        res.setHeader('Content-Type', 'application/json');

        if (url === '/health' || url === '/') {
          const health = await this.getHealthStatus();
          res.statusCode = health.status === 'unhealthy' ? 503 : 200;
          res.end(JSON.stringify(health, null, 2));
        } else if (url === '/metrics') {
          const metrics = await this.getMetrics();
          res.end(JSON.stringify(metrics, null, 2));
        } else if (url === '/ready') {
          const ready = await this.checkReadiness();
          res.statusCode = ready ? 200 : 503;
          res.end(JSON.stringify({ ready }));
        } else {
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
  async stop(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.server) {
        resolve();
        return;
      }

      this.server.close((err) => {
        if (err) reject(err);
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
  async getHealthStatus(): Promise<HealthStatus> {
    const uptime = Date.now() - this.startTime;
    const details: Record<string, unknown> = {
      uptime,
      timestamp: Date.now(),
      version: '1.0.0',
    };

    // Run custom checks
    const checkResults: Record<string, boolean> = {};
    let allHealthy = true;

    for (const [name, checkFn] of this.customChecks.entries()) {
      try {
        const result = await checkFn();
        checkResults[name] = result;
        if (!result) allHealthy = false;
      } catch (error) {
        checkResults[name] = false;
        allHealthy = false;
      }
    }

    details.checks = checkResults;

    let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
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
  async checkReadiness(): Promise<boolean> {
    for (const [, checkFn] of this.customChecks.entries()) {
      try {
        if (!await checkFn()) {
          return false;
        }
      } catch {
        return false;
      }
    }
    return true;
  }

  /**
   * Get system metrics
   */
  async getMetrics(): Promise<Record<string, unknown>> {
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
  getPort(): number {
    return this.port;
  }

  /**
   * Check if server is running
   */
  isRunning(): boolean {
    return this.server !== null;
  }
}
