#!/usr/bin/env ts-node
/**
 * SIN Fabric World Sync - CRDT Blackboard + Audit Aggregation + Pattern Propagation
 * Zero-Dependency, Native OpenCode, Fleet-Sync über SSH/RSync
 */
declare function discoverFleet(env: Record<string, string>): string[];
declare function reconcileBlackboard(reachable: string[], dryRun: boolean): void;
declare function aggregateAuditChains(reachable: string[], dryRun: boolean): void;
declare function propagatePatterns(reachable: string[], dryRun: boolean): void;
declare function broadcastToFleet(reachable: string[], dryRun: boolean): void;
export declare function SinFabricWorldSync(): void;
export declare const sinFabricWorldSync: typeof SinFabricWorldSync;
export { discoverFleet, reconcileBlackboard, aggregateAuditChains, propagatePatterns, broadcastToFleet };
//# sourceMappingURL=sin-fabric-world-sync.d.ts.map