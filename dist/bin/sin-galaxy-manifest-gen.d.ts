#!/usr/bin/env tsx
export interface GalaxyPatterns {
    verification_thresholds?: {
        min_coverage_delta?: number;
        [key: string]: any;
    };
    [key: string]: any;
}
export interface ClusterTopology {
    domains: {
        [key: string]: {
            max_concurrency: number;
            [k: string]: any;
        };
    };
}
export interface AuditSchema {
    board_report_mapping: {
        [key: string]: {
            healing_attempts: number;
            [k: string]: any;
        };
    };
}
export interface SupernovaTriggers {
    budget_exhaustion_pct: number;
    error_rate_spike: number;
}
export interface ConsensusEngine {
    min_confidence_score: number;
}
export interface GalaxyManifest {
    cluster_topology: ClusterTopology;
    policy_matrix: any;
    consensus_engine: ConsensusEngine;
    supernova_triggers: SupernovaTriggers;
    audit_schema: AuditSchema;
    telemetry_evolution: any;
    fleet_sync: any;
    generated_at?: string;
    version?: string;
    [key: string]: any;
}
export declare function loadJSON<T>(p: string, fallback: T): Promise<T>;
export declare class SinGalaxyManifestGen {
    generate(): Promise<void>;
    validate(): Promise<boolean>;
}
//# sourceMappingURL=sin-galaxy-manifest-gen.d.ts.map