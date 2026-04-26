/**
 * Self-Healing Execution Loop mit Auto-Rollback
 *
 * Überwacht Ausführung, erkennt Fehler und führt automatische Recovery-Maßnahmen durch.
 * Unterstützt Checkpoint-basiertes Rollback und alternative Ausführungsstrategien.
 */
import { EventEmitter } from 'events';
export interface ExecutionCheckpoint {
    id: string;
    timestamp: Date;
    state: Record<string, any>;
    gitCommit?: string;
    description: string;
}
export interface HealingStrategy {
    name: string;
    priority: number;
    canHandle: (error: Error) => boolean;
    execute: (context: HealingContext) => Promise<HealingResult>;
}
export interface HealingContext {
    error: Error;
    checkpoint: ExecutionCheckpoint;
    retryCount: number;
    metadata: Record<string, any>;
}
export interface HealingResult {
    success: boolean;
    action: string;
    newState?: Record<string, any>;
    requiresHumanIntervention?: boolean;
}
export interface ExecutionMetrics {
    totalExecutions: number;
    successfulExecutions: number;
    failedExecutions: number;
    healedExecutions: number;
    rollbackCount: number;
    averageRecoveryTime: number;
}
export declare class SelfHealingExecutor extends EventEmitter {
    private checkpoints;
    private strategies;
    private metrics;
    private recoveryTimes;
    private currentCheckpointId;
    private maxRetries;
    /**
     * Registriert eine Healing-Strategie
     */
    registerStrategy(strategy: HealingStrategy): void;
    /**
     * Erstellt einen neuen Checkpoint
     */
    createCheckpoint(description: string, state: Record<string, any>, gitCommit?: string): string;
    /**
     * Führt Operation mit Self-Healing aus
     */
    executeWithHealing<T>(operation: () => Promise<T>, metadata?: Record<string, any>): Promise<T>;
    /**
     * Versucht Fehler mit registrierten Strategien zu heilen
     */
    private attemptHealing;
    /**
     * Rollback zum letzten Checkpoint
     */
    private rollbackToLastCheckpoint;
    /**
     * Stellt State wieder her
     */
    private restoreState;
    /**
     * Führt Git Reset durch
     */
    private gitReset;
    /**
     * Aktualisiert durchschnittliche Wiederherstellungszeit
     */
    private updateAverageRecoveryTime;
    /**
     * Gibt aktuellen Checkpoint zurück
     */
    private getCurrentCheckpoint;
    /**
     * Gibt Metriken zurück
     */
    getMetrics(): ExecutionMetrics;
    /**
     * Listet verfügbare Checkpoints
     */
    listCheckpoints(): ExecutionCheckpoint[];
    /**
     * Löscht alten Checkpoint
     */
    deleteCheckpoint(id: string): boolean;
    /**
     * Setzt Metriken zurück
     */
    resetMetrics(): void;
}
export declare const retryStrategy: HealingStrategy;
export declare const cacheClearStrategy: HealingStrategy;
export declare const fallbackStrategy: HealingStrategy;
export declare const selfHealingExecutor: SelfHealingExecutor;
//# sourceMappingURL=self_healing.d.ts.map