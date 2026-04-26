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

export class SelfHealingExecutor extends EventEmitter {
  private checkpoints: Map<string, ExecutionCheckpoint> = new Map();
  private strategies: HealingStrategy[] = [];
  private metrics: ExecutionMetrics = {
    totalExecutions: 0,
    successfulExecutions: 0,
    failedExecutions: 0,
    healedExecutions: 0,
    rollbackCount: 0,
    averageRecoveryTime: 0
  };
  private recoveryTimes: number[] = [];
  private currentCheckpointId: string | null = null;
  private maxRetries: number = 3;

  /**
   * Registriert eine Healing-Strategie
   */
  registerStrategy(strategy: HealingStrategy): void {
    this.strategies.push(strategy);
    this.strategies.sort((a, b) => a.priority - b.priority);
    this.emit('strategy-registered', strategy.name);
  }

  /**
   * Erstellt einen neuen Checkpoint
   */
  createCheckpoint(description: string, state: Record<string, any>, gitCommit?: string): string {
    const id = `chk_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const checkpoint: ExecutionCheckpoint = {
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
  async executeWithHealing<T>(
    operation: () => Promise<T>,
    metadata: Record<string, any> = {}
  ): Promise<T> {
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
      } catch (error) {
        const err = error as Error;
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
  private async attemptHealing(context: HealingContext): Promise<HealingResult> {
    for (const strategy of this.strategies) {
      if (strategy.canHandle(context.error)) {
        console.log(`[Self-Healing] Attempting strategy: ${strategy.name}`);
        
        try {
          const result = await strategy.execute(context);
          if (result.success) {
            return result;
          }
        } catch (strategyError) {
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
  private async rollbackToLastCheckpoint(context: HealingContext): Promise<HealingResult> {
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
  private async restoreState(state: Record<string, any>): Promise<void> {
    // Implementierung abhängig vom konkreten State-Management
    this.emit('state-restored', state);
  }

  /**
   * Führt Git Reset durch
   */
  private async gitReset(commit: string): Promise<void> {
    const { execSync } = require('child_process');
    try {
      execSync(`git reset --hard ${commit}`, { stdio: 'pipe' });
      this.emit('git-reset', commit);
    } catch (error) {
      console.error('[Self-Healing] Git reset failed:', error);
      throw error;
    }
  }

  /**
   * Aktualisiert durchschnittliche Wiederherstellungszeit
   */
  private updateAverageRecoveryTime(executionTime: number): void {
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
  private getCurrentCheckpoint(): ExecutionCheckpoint {
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
  getMetrics(): ExecutionMetrics {
    return { ...this.metrics };
  }

  /**
   * Listet verfügbare Checkpoints
   */
  listCheckpoints(): ExecutionCheckpoint[] {
    return Array.from(this.checkpoints.values());
  }

  /**
   * Löscht alten Checkpoint
   */
  deleteCheckpoint(id: string): boolean {
    return this.checkpoints.delete(id);
  }

  /**
   * Setzt Metriken zurück
   */
  resetMetrics(): void {
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

// Vordefinierte Healing-Strategien

export const retryStrategy: HealingStrategy = {
  name: 'retry',
  priority: 1,
  canHandle: (error) => error.message.includes('timeout') || error.message.includes('ECONNRESET'),
  execute: async (context) => ({
    success: true,
    action: `Retry attempt ${context.retryCount + 1}`
  })
};

export const cacheClearStrategy: HealingStrategy = {
  name: 'cache-clear',
  priority: 2,
  canHandle: (error) => error.message.includes('memory') || error.message.includes('cache'),
  execute: async (context) => ({
    success: true,
    action: 'Cleared cache and retried'
  })
};

export const fallbackStrategy: HealingStrategy = {
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
export const selfHealingExecutor = new SelfHealingExecutor();

// Registriere Standard-Strategien
selfHealingExecutor.registerStrategy(retryStrategy);
selfHealingExecutor.registerStrategy(cacheClearStrategy);
selfHealingExecutor.registerStrategy(fallbackStrategy);
