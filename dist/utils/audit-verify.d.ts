#!/usr/bin/env tsx
export interface AuditEntry {
    id: string;
    parent_hash: string;
    payload_hash: string;
    signature: string;
    ts: number;
    phase: string;
    agent: string;
    temple_id?: string;
    node_id?: string;
    verification_score?: number;
}
export interface ChainReport {
    valid: boolean;
    total_entries: number;
    broken_links: number;
    signature_failures: number;
    append_violations: number;
    first_ts: number;
    last_ts: number;
    merkle_root: string;
}
export interface BoardReport {
    chainReport: ChainReport;
    totalCost: number;
    totalTokens: number;
    verificationGates: number;
    healingAttempts: number;
    swarmHealth: Record<string, number>;
    riskScore: string;
    complianceStatus: string;
}
export declare function parseArgs(args: string[]): {
    mode: string;
    json: boolean;
    watch: boolean;
    output: string | null;
};
export declare function loadChain(): Promise<AuditEntry[]>;
export declare function computeHash(data: string): string;
export declare function verifyHMAC(entry: AuditEntry): boolean;
export declare function verifyChain(): Promise<ChainReport>;
export declare function getTelemetryMetrics(): Promise<{
    totalCost: number;
    totalTokens: number;
    verificationGates: number;
    healingAttempts: number;
    swarmHealth: Record<string, number>;
}>;
export declare function generateBoardReport(chainReport: ChainReport): Promise<BoardReport>;
export declare function formatBoardReport(report: BoardReport): string;
export declare function runAuditVerify(mode: string, json: boolean, output: string | null): Promise<void>;
export declare function watchAuditChain(): Promise<void>;
export declare function appendAuditEntry(entry: Omit<AuditEntry, "parent_hash" | "payload_hash" | "signature">): Promise<AuditEntry>;
//# sourceMappingURL=audit-verify.d.ts.map