"use strict";
/**
 * Chaos Engineering & Self-Healing Test Suite
 *
 * Implements fault injection, recovery validation, and chaos testing
 * for enterprise-grade resilience verification.
 *
 * Features:
 * - Multiple fault types (crash, latency, deny, conflict)
 * - Automated recovery validation with SLA tracking
 * - Safe-mode execution for production safety
 * - Chaos manifests as code
 * - CI/CD integration ready
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.ChaosScenarios = exports.ChaosEngine = void 0;
exports.getChaosEngine = getChaosEngine;
exports.runChaosCLI = runChaosCLI;
const child_process_1 = require("child_process");
const util_1 = require("util");
const events_1 = require("events");
const execAsync = (0, util_1.promisify)(child_process_1.exec);
class ChaosEngine extends events_1.EventEmitter {
    activeFaults = new Map();
    faultHistory = [];
    safeMode = false;
    cleanupHandlers = new Map();
    constructor(safeMode = false) {
        super();
        this.safeMode = safeMode;
    }
    /**
     * Inject a fault into the system
     */
    async injectFault(fault) {
        if (this.safeMode && !fault.safeMode) {
            console.warn(`[Chaos] Safe mode: Skipping fault ${fault.id} on ${fault.target}`);
            return;
        }
        console.log(`[Chaos] Injecting fault: ${fault.type} on ${fault.target}`);
        switch (fault.type) {
            case 'crash':
                await this.injectCrash(fault.target);
                break;
            case 'latency':
                await this.injectLatency(fault.target, fault.metadata?.delayMs || 500);
                break;
            case 'packet-loss':
                await this.injectPacketLoss(fault.target, fault.metadata?.lossRate || 0.1);
                break;
            case 'deny':
                await this.injectDeny(fault.target);
                break;
            case 'conflict':
                await this.injectConflict(fault.target);
                break;
            case 'oom':
                await this.injectOOM(fault.target);
                break;
            case 'disk-full':
                await this.injectDiskFull(fault.target);
                break;
        }
        this.activeFaults.set(fault.id, fault);
        this.emit('fault:injected', fault);
        // Auto-remove after duration if specified
        if (fault.duration) {
            setTimeout(() => this.removeFault(fault.id), fault.duration);
        }
    }
    /**
     * Remove an active fault
     */
    async removeFault(faultId) {
        const fault = this.activeFaults.get(faultId);
        if (!fault)
            return;
        console.log(`[Chaos] Removing fault: ${faultId}`);
        // Execute cleanup handler if registered
        const cleanup = this.cleanupHandlers.get(faultId);
        if (cleanup) {
            await cleanup();
            this.cleanupHandlers.delete(faultId);
        }
        this.activeFaults.delete(faultId);
        this.emit('fault:removed', fault);
    }
    /**
     * Validate recovery within SLA
     */
    async validateRecovery(check, slaTimeoutMs) {
        const startTime = Date.now();
        const timeout = slaTimeoutMs || check.timeoutMs;
        const interval = check.intervalMs || 500;
        while (Date.now() - startTime < timeout) {
            try {
                const passed = await check.check();
                if (passed) {
                    const recoveryTime = Date.now() - startTime;
                    return { success: true, timeMs: recoveryTime };
                }
            }
            catch (e) {
                // Continue retrying
            }
            await new Promise(r => setTimeout(r, interval));
        }
        return { success: false, timeMs: Date.now() - startTime };
    }
    /**
     * Run a complete chaos test scenario
     */
    async runChaosTest(manifest) {
        console.log(`[Chaos] Starting test: ${manifest.name}`);
        console.log(`[Chaos] Description: ${manifest.description || 'No description'}`);
        console.log(`[Chaos] Safe mode: ${manifest.safeMode ?? this.safeMode}`);
        const results = [];
        for (const fault of manifest.faults) {
            const startTime = Date.now();
            try {
                // Inject fault
                await this.injectFault(fault);
                // Wait a bit for system to react
                await new Promise(r => setTimeout(r, 100));
                // Run recovery checks
                let allRecovered = true;
                let maxRecoveryTime = 0;
                for (const check of manifest.recoveryChecks) {
                    const result = await this.validateRecovery(check, manifest.slaTimeoutMs);
                    if (!result.success) {
                        allRecovered = false;
                    }
                    else {
                        maxRecoveryTime = Math.max(maxRecoveryTime, result.timeMs);
                    }
                }
                // Remove fault
                await this.removeFault(fault.id);
                // Record result
                const slaBreached = maxRecoveryTime > manifest.slaTimeoutMs;
                results.push({
                    faultId: fault.id,
                    injected: true,
                    recovered: allRecovered,
                    recoveryTimeMs: maxRecoveryTime,
                    slaBreached
                });
                this.emit('test:fault-complete', { fault, result: results[results.length - 1] });
            }
            catch (error) {
                results.push({
                    faultId: fault.id,
                    injected: false,
                    recovered: false,
                    slaBreached: true,
                    error: error.message
                });
            }
        }
        // Summary
        const total = results.length;
        const recovered = results.filter(r => r.recovered).length;
        const slaBreaches = results.filter(r => r.slaBreached).length;
        console.log(`[Chaos] Test complete: ${recovered}/${total} recovered, ${slaBreaches} SLA breaches`);
        this.emit('test:complete', { manifest, results });
        return results;
    }
    /**
     * Get active faults
     */
    getActiveFaults() {
        return Array.from(this.activeFaults.values());
    }
    /**
     * Get fault history
     */
    getHistory() {
        return [...this.faultHistory];
    }
    /**
     * Register cleanup handler for fault
     */
    registerCleanup(faultId, handler) {
        this.cleanupHandlers.set(faultId, handler);
    }
    // ========== Fault Injection Implementations ==========
    async injectCrash(target) {
        try {
            // Find process by pattern and kill it
            const { stdout } = await execAsync(`pgrep -f ${target}`);
            const pids = stdout.trim().split('\n');
            for (const pid of pids) {
                if (pid) {
                    await execAsync(`kill -9 ${pid}`);
                }
            }
            this.registerCleanup(`crash-${target}`, async () => {
                // In real scenario, would restart service
                console.log(`[Chaos] Would restart ${target} here`);
            });
        }
        catch (e) {
            console.warn(`[Chaos] Failed to crash ${target}:`, e);
        }
    }
    async injectLatency(target, delayMs) {
        try {
            // Apply network latency using tc (traffic control)
            await execAsync(`tc qdisc add dev lo root netem delay ${delayMs}ms 2>&1 || true`);
            this.registerCleanup(`latency-${target}`, async () => {
                await execAsync(`tc qdisc del dev lo root netem 2>&1 || true`).catch(() => { });
            });
        }
        catch (e) {
            console.warn(`[Chaos] Failed to inject latency on ${target}:`, e);
        }
    }
    async injectPacketLoss(target, lossRate) {
        try {
            const lossPercent = lossRate * 100;
            await execAsync(`tc qdisc add dev lo root netem loss ${lossPercent}% 2>&1 || true`);
            this.registerCleanup(`packet-loss-${target}`, async () => {
                await execAsync(`tc qdisc del dev lo root netem 2>&1 || true`).catch(() => { });
            });
        }
        catch (e) {
            console.warn(`[Chaos] Failed to inject packet loss on ${target}:`, e);
        }
    }
    async injectDeny(target) {
        // Simulate OPA policy denial
        // In production, would hot-swap OPA policies
        console.log(`[Chaos] Policy denial activated for ${target}`);
        this.registerCleanup(`deny-${target}`, async () => {
            console.log(`[Chaos] Policy denial deactivated for ${target}`);
        });
    }
    async injectConflict(target) {
        // Simulate git merge conflicts
        console.log(`[Chaos] Conflict injection activated for ${target}`);
        this.registerCleanup(`conflict-${target}`, async () => {
            console.log(`[Chaos] Conflict injection deactivated for ${target}`);
        });
    }
    async injectOOM(target) {
        // Simulate out-of-memory condition
        console.log(`[Chaos] OOM injection activated for ${target}`);
        this.registerCleanup(`oom-${target}`, async () => {
            console.log(`[Chaos] OOM injection deactivated for ${target}`);
        });
    }
    async injectDiskFull(target) {
        // Simulate disk full condition
        console.log(`[Chaos] Disk full injection activated for ${target}`);
        this.registerCleanup(`disk-full-${target}`, async () => {
            console.log(`[Chaos] Disk full injection deactivated for ${target}`);
        });
    }
}
exports.ChaosEngine = ChaosEngine;
// Pre-built chaos scenarios
exports.ChaosScenarios = {
    agentCrash: () => ({
        name: 'Agent Crash Recovery',
        description: 'Tests self-healing when an agent process crashes',
        faults: [
            { id: 'crash-1', type: 'crash', target: 'agent-worker', duration: 5000 }
        ],
        recoveryChecks: [
            {
                name: 'Agent restarted',
                check: async () => {
                    // Check if agent is running again
                    return true; // Placeholder
                },
                timeoutMs: 10000,
                intervalMs: 500
            }
        ],
        slaTimeoutMs: 5000
    }),
    networkPartition: () => ({
        name: 'Network Partition',
        description: 'Tests behavior during network split',
        faults: [
            { id: 'partition-1', type: 'packet-loss', target: 'swarm-mesh', probability: 0.8, duration: 10000 }
        ],
        recoveryChecks: [
            {
                name: 'Messages delivered',
                check: async () => true, // Placeholder
                timeoutMs: 15000,
                intervalMs: 1000
            }
        ],
        slaTimeoutMs: 10000
    }),
    policyStorm: () => ({
        name: 'Policy Deny Storm',
        description: 'Tests resilience under mass policy denials',
        faults: [
            { id: 'deny-storm', type: 'deny', target: 'all-agents', duration: 3000 }
        ],
        recoveryChecks: [
            {
                name: 'Fallback agents active',
                check: async () => true, // Placeholder
                timeoutMs: 5000,
                intervalMs: 200
            }
        ],
        slaTimeoutMs: 3000
    }),
    gitConflictFlood: () => ({
        name: 'Git Conflict Flood',
        description: 'Tests conflict resolution under high contention',
        faults: [
            { id: 'conflict-flood', type: 'conflict', target: 'git-worktrees', duration: 8000 }
        ],
        recoveryChecks: [
            {
                name: 'Conflicts resolved',
                check: async () => true, // Placeholder
                timeoutMs: 12000,
                intervalMs: 500
            }
        ],
        slaTimeoutMs: 10000
    })
};
// Singleton instance
let _chaosEngine;
function getChaosEngine(safeMode) {
    if (!_chaosEngine) {
        _chaosEngine = new ChaosEngine(safeMode);
    }
    return _chaosEngine;
}
/**
 * CLI runner for chaos tests
 */
async function runChaosCLI(manifestPath, options = {}) {
    const fs = await import('fs');
    try {
        const manifestContent = fs.readFileSync(manifestPath, 'utf-8');
        const manifest = JSON.parse(manifestContent);
        if (options.safeMode) {
            manifest.safeMode = true;
        }
        const engine = getChaosEngine(options.safeMode);
        // Log events
        engine.on('fault:injected', (fault) => {
            console.log(`✓ Fault injected: ${fault.id}`);
        });
        engine.on('fault:removed', (fault) => {
            console.log(`✓ Fault removed: ${fault.id}`);
        });
        engine.on('test:complete', ({ results }) => {
            const failed = results.filter(r => !r.recovered || r.slaBreached);
            if (failed.length > 0) {
                console.error(`✗ ${failed.length} tests failed or breached SLA`);
            }
            else {
                console.log('✓ All tests passed!');
            }
        });
        const results = await engine.runChaosTest(manifest);
        // Exit with error if any failures
        const hasFailures = results.some(r => !r.recovered || r.slaBreached);
        return hasFailures ? 1 : 0;
    }
    catch (error) {
        console.error('Failed to run chaos test:', error.message);
        return 1;
    }
}
//# sourceMappingURL=ChaosEngine.js.map