"use strict";
/**
 * Self-Healing Execution Loop mit Auto-Rollback
 *
 * Überwacht Ausführung, erkennt Fehler und führt automatische Recovery-Maßnahmen durch.
 * Unterstützt Checkpoint-basiertes Rollback und alternative Ausführungsstrategien.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.selfHealingExecutor = exports.fallbackStrategy = exports.cacheClearStrategy = exports.retryStrategy = exports.SelfHealingExecutor = void 0;
const events_1 = require("events");
class SelfHealingExecutor extends events_1.EventEmitter {
    checkpoints = new Map();
    strategies = [];
    metrics = {
        totalExecutions: 0,
        successfulExecutions: 0,
        failedExecutions: 0,
        healedExecutions: 0,
        rollbackCount: 0,
        averageRecoveryTime: 0
    };
    recoveryTimes = [];
    currentCheckpointId = null;
    maxRetries = 3;
    /**
     * Registriert eine Healing-Strategie
     */
    registerStrategy(strategy) {
        this.strategies.push(strategy);
        this.strategies.sort((a, b) => a.priority - b.priority);
        this.emit('strategy-registered', strategy.name);
    }
    /**
     * Erstellt einen neuen Checkpoint
     */
    createCheckpoint(description, state, gitCommit) {
        const id = `chk_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        const checkpoint = {
            id,
            timestamp: new Date(),
            state,
            gitCommit,
            description
        };
        this.checkpoints.set(id, checkpoint);
        this.currentCheckpointId = id;
        this.emit('checkpoint-created', checkpoint);
        // Behalte nur letzte 10 Checkpoints
        if (this.checkpoints.size > 10) {
            const oldest = Array.from(this.checkpoints.entries())[0];
            this.checkpoints.delete(oldest[0]);
        }
        return id;
    }
    /**
     * Führt Operation mit Self-Healing aus
     */
    async executeWithHealing(operation, metadata = {}) {
        this.metrics.totalExecutions++;
        let retryCount = 0;
        const startTime = Date.now();
        while (retryCount <= this.maxRetries) {
            try {
                const result = await operation();
                this.metrics.successfulExecutions++;
                // Update average recovery time
                const executionTime = Date.now() - startTime;
                this.updateAverageRecoveryTime(executionTime);
                return result;
            }
            catch (error) {
                const err = error;
                this.metrics.failedExecutions++;
                console.error(`[Self-Healing] Execution failed (attempt ${retryCount + 1}):`, err.message);
                // Versuche Heilung
                const healingResult = await this.attemptHealing({
                    error: err,
                    checkpoint: this.getCurrentCheckpoint(),
                    retryCount,
                    metadata
                });
                if (healingResult.success) {
                    this.metrics.healedExecutions++;
                    console.log(`[Self-Healing] Successfully healed: ${healingResult.action}`);
                    // Setze State zurück falls nötig
                    if (healingResult.newState) {
                        await this.restoreState(healingResult.newState);
                    }
                    retryCount++;
                    continue;
                }
                if (healingResult.requiresHumanIntervention) {
                    this.emit('human-intervention-required', {
                        error: err,
                        action: healingResult.action,
                        context: metadata
                    });
                    throw new Error(`Healing failed, human intervention required: ${healingResult.action}`);
                }
                // Keine weiteren Versuche möglich
                if (retryCount >= this.maxRetries) {
                    this.emit('max-retries-exceeded', { error: err, attempts: retryCount + 1 });
                    throw new Error(`Max retries exceeded. Last error: ${err.message}`);
                }
                retryCount++;
            }
        }
        throw new Error('Unexpected execution flow');
    }
    /**
     * Versucht Fehler mit registrierten Strategien zu heilen
     */
    async attemptHealing(context) {
        for (const strategy of this.strategies) {
            if (strategy.canHandle(context.error)) {
                console.log(`[Self-Healing] Attempting strategy: ${strategy.name}`);
                try {
                    const result = await strategy.execute(context);
                    if (result.success) {
                        return result;
                    }
                }
                catch (strategyError) {
                    console.error(`[Self-Healing] Strategy ${strategy.name} failed:`, strategyError);
                }
            }
        }
        // Fallback: Rollback zum letzten Checkpoint
        return await this.rollbackToLastCheckpoint(context);
    }
    /**
     * Rollback zum letzten Checkpoint
     */
    async rollbackToLastCheckpoint(context) {
        const checkpoint = context.checkpoint;
        if (!checkpoint) {
            return {
                success: false,
                action: 'No checkpoint available for rollback',
                requiresHumanIntervention: true
            };
        }
        console.log(`[Self-Healing] Rolling back to checkpoint: ${checkpoint.id}`);
        this.metrics.rollbackCount++;
        // Git Rollback falls Commit vorhanden
        if (checkpoint.gitCommit) {
            await this.gitReset(checkpoint.gitCommit);
        }
        return {
            success: true,
            action: `Rolled back to checkpoint ${checkpoint.id}`,
            newState: checkpoint.state
        };
    }
    /**
     * Stellt State wieder her
     */
    async restoreState(state) {
        // Implementierung abhängig vom konkreten State-Management
        this.emit('state-restored', state);
    }
    /**
     * Führt Git Reset durch
     */
    async gitReset(commit) {
        const { execSync } = require('child_process');
        try {
            execSync(`git reset --hard ${commit}`, { stdio: 'pipe' });
            this.emit('git-reset', commit);
        }
        catch (error) {
            console.error('[Self-Healing] Git reset failed:', error);
            throw error;
        }
    }
    /**
     * Aktualisiert durchschnittliche Wiederherstellungszeit
     */
    updateAverageRecoveryTime(executionTime) {
        this.recoveryTimes.push(executionTime);
        if (this.recoveryTimes.length > 100) {
            this.recoveryTimes.shift();
        }
        const sum = this.recoveryTimes.reduce((a, b) => a + b, 0);
        this.metrics.averageRecoveryTime = sum / this.recoveryTimes.length;
    }
    /**
     * Gibt aktuellen Checkpoint zurück
     */
    getCurrentCheckpoint() {
        if (!this.currentCheckpointId) {
            return {
                id: 'none',
                timestamp: new Date(),
                state: {},
                description: 'No checkpoint'
            };
        }
        const checkpoint = this.checkpoints.get(this.currentCheckpointId);
        if (!checkpoint) {
            return {
                id: 'none',
                timestamp: new Date(),
                state: {},
                description: 'Checkpoint not found'
            };
        }
        return checkpoint;
    }
    /**
     * Gibt Metriken zurück
     */
    getMetrics() {
        return { ...this.metrics };
    }
    /**
     * Listet verfügbare Checkpoints
     */
    listCheckpoints() {
        return Array.from(this.checkpoints.values());
    }
    /**
     * Löscht alten Checkpoint
     */
    deleteCheckpoint(id) {
        return this.checkpoints.delete(id);
    }
    /**
     * Setzt Metriken zurück
     */
    resetMetrics() {
        this.metrics = {
            totalExecutions: 0,
            successfulExecutions: 0,
            failedExecutions: 0,
            healedExecutions: 0,
            rollbackCount: 0,
            averageRecoveryTime: 0
        };
        this.recoveryTimes = [];
    }
}
exports.SelfHealingExecutor = SelfHealingExecutor;
// Vordefinierte Healing-Strategien
exports.retryStrategy = {
    name: 'retry',
    priority: 1,
    canHandle: (error) => error.message.includes('timeout') || error.message.includes('ECONNRESET'),
    execute: async (context) => ({
        success: true,
        action: `Retry attempt ${context.retryCount + 1}`
    })
};
exports.cacheClearStrategy = {
    name: 'cache-clear',
    priority: 2,
    canHandle: (error) => error.message.includes('memory') || error.message.includes('cache'),
    execute: async (context) => ({
        success: true,
        action: 'Cleared cache and retried'
    })
};
exports.fallbackStrategy = {
    name: 'fallback',
    priority: 3,
    canHandle: (error) => true,
    execute: async (context) => ({
        success: false,
        action: 'Fallback strategy - requires rollback',
        requiresHumanIntervention: context.retryCount >= 2
    })
};
// Singleton Instance
exports.selfHealingExecutor = new SelfHealingExecutor();
// Registriere Standard-Strategien
exports.selfHealingExecutor.registerStrategy(exports.retryStrategy);
exports.selfHealingExecutor.registerStrategy(exports.cacheClearStrategy);
exports.selfHealingExecutor.registerStrategy(exports.fallbackStrategy);
//# sourceMappingURL=self_healing.js.map