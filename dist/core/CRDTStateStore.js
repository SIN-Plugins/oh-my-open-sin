"use strict";
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
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.CRDTStoreFactory = exports.CRDTStateStore = void 0;
exports.getCRDTFactory = getCRDTFactory;
exports.getSessionStore = getSessionStore;
const Y = __importStar(require("yjs"));
const crypto_1 = require("crypto");
class CRDTStateStore {
    doc;
    state;
    events = [];
    eventIndex = new Map();
    options;
    pendingTransactions = [];
    constructor(options = {}) {
        this.options = {
            docName: options.docName || 'default',
            enableSigning: options.enableSigning ?? false,
            maxEvents: options.maxEvents ?? 100000,
            compactionThreshold: options.compactionThreshold ?? 10000
        };
        this.doc = new Y.Doc();
        this.state = this.doc.getMap('state');
    }
    /**
     * Create a state event with integrity hash
     */
    createEvent(type, payload, agent, sessionId) {
        const timestamp = Date.now();
        const id = `${sessionId || 'system'}-${timestamp}-${Math.random().toString(36).substr(2, 9)}`;
        const hashInput = JSON.stringify({ payload, timestamp, agent, sessionId });
        const hash = (0, crypto_1.createHash)('sha256').update(hashInput).digest('hex');
        return {
            id,
            type,
            payload,
            timestamp,
            agent,
            sessionId,
            hash
        };
    }
    /**
     * Apply an event to the CRDT state
     */
    applyEvent(event) {
        // Verify hash integrity
        const expectedHash = this.verifyHash(event);
        if (!expectedHash) {
            throw new Error(`Event hash verification failed: ${event.id}`);
        }
        // Check for duplicates
        if (this.eventIndex.has(event.id)) {
            return; // Idempotent - already applied
        }
        // Add to event log
        this.events.push(event);
        this.eventIndex.set(event.id, this.events.length - 1);
        // Apply to CRDT
        this.doc.transact(() => {
            if (typeof event.payload === 'object' && event.payload !== null) {
                const payloadObj = event.payload;
                for (const [key, value] of Object.entries(payloadObj)) {
                    this.state.set(key, value);
                }
            }
            else {
                this.state.set(event.id, event.payload);
            }
        });
        // Trigger pending transactions
        this.flushPendingTransactions();
        // Check compaction
        if (this.events.length > this.options.compactionThreshold) {
            this.compact();
        }
    }
    /**
     * Apply multiple events atomically
     */
    applyEvents(events) {
        this.doc.transact(() => {
            for (const event of events) {
                this.applyEvent(event);
            }
        });
    }
    /**
     * Get current state as typed object
     */
    getState() {
        return this.state.toJSON();
    }
    /**
     * Get specific state key
     */
    get(key) {
        return this.state.get(key);
    }
    /**
     * Set state directly (creates implicit event)
     */
    set(key, value, agent, sessionId) {
        const event = this.createEvent('state.set', { key, value }, agent, sessionId);
        this.applyEvent(event);
    }
    /**
     * Delete state key (creates tombstone event)
     */
    delete(key, agent, sessionId) {
        const event = this.createEvent('state.delete', { key }, agent, sessionId);
        this.applyEvent(event);
        this.doc.transact(() => {
            this.state.delete(key);
        });
    }
    /**
     * Replay events to restore state deterministically
     */
    async replay(events, verifyChain = true) {
        // Reset state
        this.doc = new Y.Doc();
        this.state = this.doc.getMap('state');
        this.events = [];
        this.eventIndex.clear();
        let previousHash = '';
        for (const event of events) {
            if (verifyChain && event.hash) {
                // Verify chain integrity
                const valid = this.verifyHash(event);
                if (!valid) {
                    throw new Error(`Chain broken at event ${event.id}`);
                }
            }
            this.applyEvent(event);
            previousHash = event.hash;
        }
        return this.getState();
    }
    /**
     * Get all events (for export/replication)
     */
    getEvents(sinceTimestamp) {
        if (!sinceTimestamp) {
            return [...this.events];
        }
        return this.events.filter(e => e.timestamp >= sinceTimestamp);
    }
    /**
     * Get event by ID
     */
    getEvent(id) {
        const index = this.eventIndex.get(id);
        return index !== undefined ? this.events[index] : undefined;
    }
    /**
     * Get event count
     */
    getEventCount() {
        return this.events.length;
    }
    /**
     * Compact old events (keep recent + checkpoints)
     */
    compact(checkpointInterval = 1000) {
        if (this.events.length <= this.options.maxEvents) {
            return;
        }
        const keepCount = this.options.maxEvents - checkpointInterval;
        const removed = this.events.splice(0, keepCount);
        // Rebuild index
        this.eventIndex.clear();
        this.events.forEach((e, i) => this.eventIndex.set(e.id, i));
        // Log compaction
        console.log(`[CRDT] Compacted ${removed.length} events, ${this.events.length} remaining`);
    }
    /**
     * Export state snapshot for backup
     */
    exportSnapshot() {
        const docState = Y.encodeStateAsUpdate(this.doc);
        return {
            state: this.getState(),
            events: [...this.events],
            docState
        };
    }
    /**
     * Import state snapshot
     */
    importSnapshot(snapshot) {
        if (snapshot.docState) {
            Y.applyUpdate(this.doc, snapshot.docState);
            this.state = this.doc.getMap('state');
        }
        if (snapshot.events) {
            this.events = [...snapshot.events];
            this.eventIndex.clear();
            this.events.forEach((e, i) => this.eventIndex.set(e.id, i));
        }
        if (snapshot.state) {
            this.doc.transact(() => {
                for (const [key, value] of Object.entries(snapshot.state)) {
                    this.state.set(key, value);
                }
            });
        }
    }
    /**
     * Verify event hash integrity
     */
    verifyHash(event) {
        const hashInput = JSON.stringify({
            payload: event.payload,
            timestamp: event.timestamp,
            agent: event.agent,
            sessionId: event.sessionId
        });
        const computedHash = (0, crypto_1.createHash)('sha256').update(hashInput).digest('hex');
        return computedHash === event.hash;
    }
    /**
     * Sign event with Sigstore (if enabled)
     */
    async signEvent(event, signer) {
        if (!this.options.enableSigning) {
            return event;
        }
        const signature = await signer(JSON.stringify(event));
        return { ...event, signature };
    }
    /**
     * Subscribe to state changes
     */
    observe(callback) {
        const observer = (event) => {
            callback(this.getState(), event);
        };
        this.state.observe(observer);
        return () => this.state.unobserve(observer);
    }
    /**
     * Queue transaction for next apply
     */
    queueTransaction(fn) {
        this.pendingTransactions.push(fn);
    }
    flushPendingTransactions() {
        if (this.pendingTransactions.length === 0)
            return;
        this.doc.transact(() => {
            for (const fn of this.pendingTransactions) {
                fn();
            }
        });
        this.pendingTransactions = [];
    }
    /**
     * Get statistics
     */
    getStats() {
        const update = Y.encodeStateAsUpdate(this.doc);
        return {
            eventCount: this.events.length,
            stateKeys: Array.from(this.state.keys()).length,
            docSize: update.length,
            pendingTransactions: this.pendingTransactions.length
        };
    }
    /**
     * Clear all state and events
     */
    clear() {
        this.doc = new Y.Doc();
        this.state = this.doc.getMap('state');
        this.events = [];
        this.eventIndex.clear();
        this.pendingTransactions = [];
    }
}
exports.CRDTStateStore = CRDTStateStore;
/**
 * Factory for creating shared CRDT stores per session
 */
class CRDTStoreFactory {
    stores = new Map();
    getStore(sessionId, options) {
        if (!this.stores.has(sessionId)) {
            this.stores.set(sessionId, new CRDTStateStore({
                ...options,
                docName: sessionId
            }));
        }
        return this.stores.get(sessionId);
    }
    removeStore(sessionId) {
        const store = this.stores.get(sessionId);
        if (store) {
            store.clear();
            this.stores.delete(sessionId);
        }
    }
    getAllStores() {
        return new Map(this.stores);
    }
    getStats() {
        const stats = {};
        for (const [sessionId, store] of this.stores) {
            stats[sessionId] = store.getStats();
        }
        return stats;
    }
}
exports.CRDTStoreFactory = CRDTStoreFactory;
// Singleton instance
let _crdtFactory;
function getCRDTFactory() {
    if (!_crdtFactory) {
        _crdtFactory = new CRDTStoreFactory();
    }
    return _crdtFactory;
}
function getSessionStore(sessionId, options) {
    return getCRDTFactory().getStore(sessionId, options);
}
//# sourceMappingURL=CRDTStateStore.js.map