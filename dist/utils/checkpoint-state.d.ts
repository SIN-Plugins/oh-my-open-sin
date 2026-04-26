export interface CheckpointState {
    version: "1.0.0";
    session_id: string;
    parent_session?: string;
    timestamp: number;
    phase: string;
    agent: string;
    model: string;
    description: string;
    routing_context?: Record<string, any>;
    verification_state?: Record<string, any>;
    healing_state?: Record<string, any>;
    active_skills?: string[];
    pending_tasks?: string[];
    file_deltas?: Record<string, {
        hash: string;
        content?: string;
    }>;
    metadata?: Record<string, any>;
    checksum?: string;
}
export declare function serializeState(state: Omit<CheckpointState, "checksum">): string;
export declare function deserializeState(raw: string): CheckpointState;
//# sourceMappingURL=checkpoint-state.d.ts.map