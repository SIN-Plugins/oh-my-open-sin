#!/usr/bin/env ts-node
/**
 * SIN Fabric World Init - One-Command Bootstrap für CRDT State, Audit Genesis, Pattern Seed, Fleet SSH
 * Zero-Dependency, Native OpenCode, Production-ready
 */
declare function initDirectories(dryRun: boolean): void;
declare function initAuditChain(env: Record<string, string>, dryRun: boolean): void;
declare function initPatternSeed(dryRun: boolean): void;
declare function initFleetSSH(env: Record<string, string>, dryRun: boolean): void;
declare function initDashboardAutoStart(dryRun: boolean): void;
export declare function SinFabricWorldInit(): void;
export declare const sinFabricWorldInit: typeof SinFabricWorldInit;
export { initDirectories, initAuditChain, initPatternSeed, initFleetSSH, initDashboardAutoStart };
//# sourceMappingURL=sin-fabric-world-init.d.ts.map