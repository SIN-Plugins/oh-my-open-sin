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
import { EventEmitter } from 'events';
export type FaultType = 'crash' | 'latency' | 'packet-loss' | 'deny' | 'conflict' | 'oom' | 'disk-full';
export interface ChaosFault {
    id: string;
    type: FaultType;
    target: string;
    duration?: number;
    probability?: number;
    metadata?: Record<string, unknown>;
    safeMode?: boolean;
}
export interface RecoveryCheck {
    name: string;
    check: () => Promise<boolean>;
    timeoutMs: number;
    intervalMs: number;
}
export interface ChaosResult {
    faultId: string;
    injected: boolean;
    recovered: boolean;
    recoveryTimeMs?: number;
    slaBreached: boolean;
    error?: string;
}
export interface ChaosManifest {
    name: string;
    description?: string;
    faults: ChaosFault[];
    recoveryChecks: RecoveryCheck[];
    slaTimeoutMs: number;
    safeMode?: boolean;
}
export declare class ChaosEngine extends EventEmitter {
    private activeFaults;
    private faultHistory;
    private safeMode;
    private cleanupHandlers;
    constructor(safeMode?: boolean);
    /**
     * Inject a fault into the system
     */
    injectFault(fault: ChaosFault): Promise<void>;
    /**
     * Remove an active fault
     */
    removeFault(faultId: string): Promise<void>;
    /**
     * Validate recovery within SLA
     */
    validateRecovery(check: RecoveryCheck, slaTimeoutMs?: number): Promise<{
        success: boolean;
        timeMs: number;
    }>;
    /**
     * Run a complete chaos test scenario
     */
    runChaosTest(manifest: ChaosManifest): Promise<ChaosResult[]>;
    /**
     * Get active faults
     */
    getActiveFaults(): ChaosFault[];
    /**
     * Get fault history
     */
    getHistory(): ChaosResult[];
    /**
     * Register cleanup handler for fault
     */
    registerCleanup(faultId: string, handler: () => Promise<void>): void;
    private injectCrash;
    private injectLatency;
    private injectPacketLoss;
    private injectDeny;
    private injectConflict;
    private injectOOM;
    private injectDiskFull;
}
export declare const ChaosScenarios: {
    agentCrash: () => ChaosManifest;
    networkPartition: () => ChaosManifest;
    policyStorm: () => ChaosManifest;
    gitConflictFlood: () => ChaosManifest;
};
export declare function getChaosEngine(safeMode?: boolean): ChaosEngine;
/**
 * CLI runner for chaos tests
 */
export declare function runChaosCLI(manifestPath: string, options?: {
    safeMode?: boolean;
}): Promise<number>;
//# sourceMappingURL=ChaosEngine.d.ts.map