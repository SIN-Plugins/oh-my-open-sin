export interface CheckpointMeta {
    id: string;
    type: "git-ref" | "file-delta" | "milestone";
    hash: string;
    files?: string[];
    worktree?: string;
    ts: number;
    validation_passed?: boolean;
}
export declare function createCheckpoint(sessionId: string, worktreePath?: string, milestone?: boolean): Promise<CheckpointMeta>;
export declare function rollbackPartial(sessionId: string, files: string[], worktreePath?: string): Promise<boolean>;
export declare function restoreCheckpoint(sessionId: string, worktreePath?: string): Promise<boolean>;
export declare function cleanupCheckpoints(maxAgeHours?: number): Promise<void>;
//# sourceMappingURL=checkpoint-manager-v2.d.ts.map