export interface BlackboardEntry {
    key: string;
    value: any;
    version: number;
    author: string;
    ts: number;
    hash: string;
}
export declare function writeBlackboard(key: string, value: any, author: string): Promise<BlackboardEntry>;
export declare function readBlackboard(key: string): Promise<BlackboardEntry | null>;
export declare function resolveConflict(key: string, newValue: any, author: string): Promise<BlackboardEntry>;
export declare function gcBlackboard(): Promise<number>;
//# sourceMappingURL=swarm-memory.d.ts.map