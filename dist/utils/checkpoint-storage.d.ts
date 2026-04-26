import { CheckpointState } from "./checkpoint-state";
export declare function saveCheckpoint(state: Omit<CheckpointState, "checksum">): Promise<string>;
export declare function loadCheckpoint(sessionId: string): Promise<CheckpointState | null>;
export declare function listCheckpoints(): Promise<{
    id: string;
    phase: string;
    ts: number;
    size: number;
}[]>;
export declare function cleanupStaleCheckpoints(): Promise<number>;
//# sourceMappingURL=checkpoint-storage.d.ts.map