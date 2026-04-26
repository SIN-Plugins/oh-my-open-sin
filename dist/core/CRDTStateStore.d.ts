/**
 * CRDT Shared State & Event Sourcing Module
 *
 * Implements Yjs-based CRDT for conflict-free replicated state
 * with immutable event sourcing for deterministic replay.
 *
 * Features:
 * - Append-only event store with SHA-256 hashing
 * - Yjs CRDT for concurrent writes without conflicts
 * - Deterministic state replay from event log
 * - GDPR-compliant pruning capabilities
 * - SLSA-conformant integrity chain
 */
export interface StateEvent {
    id: string;
    type: string;
    payload: unknown;
    timestamp: number;
    agent: string;
    sessionId?: string;
    hash: string;
    signature?: string;
}
export interface CRDTStateOptions {
    docName?: string;
    enableSigning?: boolean;
    maxEvents?: number;
    compactionThreshold?: number;
}
export declare class CRDTStateStore {
    private doc;
    private state;
    private events;
    private eventIndex;
    private options;
    private pendingTransactions;
    constructor(options?: CRDTStateOptions);
    /**
     * Create a state event with integrity hash
     */
    private createEvent;
    /**
     * Apply an event to the CRDT state
     */
    applyEvent(event: StateEvent): void;
    /**
     * Apply multiple events atomically
     */
    applyEvents(events: StateEvent[]): void;
    /**
     * Get current state as typed object
     */
    getState<T = Record<string, unknown>>(): T;
    /**
     * Get specific state key
     */
    get<TKey extends string>(key: TKey): unknown;
    /**
     * Set state directly (creates implicit event)
     */
    set(key: string, value: unknown, agent: string, sessionId?: string): void;
    /**
     * Delete state key (creates tombstone event)
     */
    delete(key: string, agent: string, sessionId?: string): void;
    /**
     * Replay events to restore state deterministically
     */
    replay(events: StateEvent[], verifyChain?: boolean): Promise<Record<string, unknown>>;
    /**
     * Get all events (for export/replication)
     */
    getEvents(sinceTimestamp?: number): StateEvent[];
    /**
     * Get event by ID
     */
    getEvent(id: string): StateEvent | undefined;
    /**
     * Get event count
     */
    getEventCount(): number;
    /**
     * Compact old events (keep recent + checkpoints)
     */
    compact(checkpointInterval?: number): void;
    /**
     * Export state snapshot for backup
     */
    exportSnapshot(): {
        state: Record<string, unknown>;
        events: StateEvent[];
        docState: Uint8Array;
    };
    /**
     * Import state snapshot
     */
    importSnapshot(snapshot: {
        state?: Record<string, unknown>;
        events?: StateEvent[];
        docState?: Uint8Array;
    }): void;
    /**
     * Verify event hash integrity
     */
    private verifyHash;
    /**
     * Sign event with Sigstore (if enabled)
     */
    signEvent(event: StateEvent, signer: (data: string) => Promise<string>): Promise<StateEvent>;
    /**
     * Subscribe to state changes
     */
    observe(callback: (state: Record<string, unknown>, event: StateEvent) => void): () => void;
    /**
     * Queue transaction for next apply
     */
    queueTransaction(fn: () => void): void;
    private flushPendingTransactions;
    /**
     * Get statistics
     */
    getStats(): {
        eventCount: number;
        stateKeys: number;
        docSize: number;
        pendingTransactions: number;
    };
    /**
     * Clear all state and events
     */
    clear(): void;
}
/**
 * Factory for creating shared CRDT stores per session
 */
export declare class CRDTStoreFactory {
    private stores;
    getStore(sessionId: string, options?: CRDTStateOptions): CRDTStateStore;
    removeStore(sessionId: string): void;
    getAllStores(): Map<string, CRDTStateStore>;
    getStats(): Record<string, ReturnType<CRDTStateStore['getStats']>>;
}
export declare function getCRDTFactory(): CRDTStoreFactory;
export declare function getSessionStore(sessionId: string, options?: CRDTStateOptions): CRDTStateStore;
//# sourceMappingURL=CRDTStateStore.d.ts.map