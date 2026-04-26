/**
 * Native State Machine Implementation
 * Deterministische Zustandsverwaltung für zuverlässige Ausführung
 */

export type State = 'idle' | 'running' | 'paused' | 'waiting' | 'completed' | 'failed' | 'cancelled';

export interface StateTransition {
  from: State;
  to: State;
  action: string;
  timestamp: number;
}

export interface StateMachineConfig {
  initialState: State;
  allowedTransitions: Array<{ from: State; to: State; actions?: string[] }>;
  onEnter?: (state: State) => void;
  onExit?: (state: State) => void;
  onError?: (error: Error, state: State) => void;
}

export class NativeStateMachine {
  private currentState: State;
  private history: StateTransition[] = [];
  private config: StateMachineConfig;
  private listeners: Array<(state: State) => void> = [];

  constructor(config: StateMachineConfig) {
    this.config = config;
    this.currentState = config.initialState;
    
    // Initiale Transition记录
    this.history.push({
      from: 'idle' as State,
      to: config.initialState,
      action: 'init',
      timestamp: Date.now()
    });
  }

  canTransition(to: State): boolean {
    return this.config.allowedTransitions.some(
      t => t.from === this.currentState && t.to === to
    );
  }

  async transition(to: State, action: string = 'manual'): Promise<boolean> {
    if (!this.canTransition(to)) {
      console.error(
        `[StateMachine] Invalid transition: ${this.currentState} -> ${to}`
      );
      return false;
    }

    // Exit-Handler aufrufen
    if (this.config.onExit) {
      try {
        await this.config.onExit(this.currentState);
      } catch (e) {
        console.error('[StateMachine] onExit error:', e);
      }
    }

    const previousState = this.currentState;
    this.currentState = to;

    // Transition记录
    this.history.push({
      from: previousState,
      to,
      action,
      timestamp: Date.now()
    });

    // Enter-Handler aufrufen
    if (this.config.onEnter) {
      try {
        await this.config.onEnter(to);
      } catch (e) {
        if (this.config.onError) {
          this.config.onError(e as Error, to);
        }
      }
    }

    // Listener benachrichtigen
    this.notifyListeners();

    return true;
  }

  getState(): State {
    return this.currentState;
  }

  getHistory(): StateTransition[] {
    return [...this.history];
  }

  addListener(callback: (state: State) => void): void {
    this.listeners.push(callback);
  }

  removeListener(callback: (state: State) => void): void {
    const index = this.listeners.indexOf(callback);
    if (index > -1) {
      this.listeners.splice(index, 1);
    }
  }

  private notifyListeners(): void {
    for (const listener of this.listeners) {
      try {
        listener(this.currentState);
      } catch (e) {
        console.error('[StateMachine] Listener error:', e);
      }
    }
  }

  reset(): void {
    const previousState = this.currentState;
    this.currentState = this.config.initialState;
    
    this.history.push({
      from: previousState,
      to: this.config.initialState,
      action: 'reset',
      timestamp: Date.now()
    });

    this.notifyListeners();
  }

  // Convenience methods für häufige Transitions
  async start(): Promise<boolean> {
    return this.transition('running', 'start');
  }

  async pause(): Promise<boolean> {
    return this.transition('paused', 'pause');
  }

  async resume(): Promise<boolean> {
    return this.transition('running', 'resume');
  }

  async wait(): Promise<boolean> {
    return this.transition('waiting', 'wait');
  }

  async complete(): Promise<boolean> {
    return this.transition('completed', 'complete');
  }

  async fail(error?: Error): Promise<boolean> {
    if (this.config.onError && error) {
      this.config.onError(error, 'failed');
    }
    return this.transition('failed', 'fail');
  }

  async cancel(): Promise<boolean> {
    return this.transition('cancelled', 'cancel');
  }
}

// Task Queue mit State Machine Integration
export interface QueuedTask {
  id: string;
  agent: string;
  task: string;
  context?: any;
  priority: number;
  state: State;
  createdAt: number;
  startedAt?: number;
  completedAt?: number;
  result?: any;
  error?: string;
}

export class TaskQueueManager {
  private queue: QueuedTask[] = [];
  private processing: Map<string, NativeStateMachine> = new Map();
  private maxConcurrent = 5;
  private activeCount = 0;

  setMaxConcurrent(max: number): void {
    this.maxConcurrent = max;
  }

  enqueue(task: Omit<QueuedTask, 'state' | 'createdAt'>): string {
    const id = task.id || `task_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const queuedTask: QueuedTask = {
      ...task,
      id,
      state: 'idle',
      createdAt: Date.now()
    };

    this.queue.push(queuedTask);
    
    // Nach Priorität sortieren (höhere Priorität zuerst)
    this.queue.sort((a, b) => b.priority - a.priority);

    console.log(`[TaskQueue] Enqueued task: ${id} (priority: ${task.priority})`);
    
    // Processing starten wenn Kapazität verfügbar
    this.processNext();

    return id;
  }

  private async processNext(): Promise<void> {
    if (this.activeCount >= this.maxConcurrent || this.queue.length === 0) {
      return;
    }

    const task = this.queue.shift();
    if (!task) return;

    this.activeCount++;
    task.state = 'running';
    task.startedAt = Date.now();

    // State Machine für diesen Task erstellen
    const stateMachine = this.createTaskStateMachine(task);
    this.processing.set(task.id, stateMachine);

    console.log(`[TaskQueue] Processing task: ${task.id}`);

    // Simuliere Task-Ausführung (würde tatsächlich den Agenten aufrufen)
    try {
      await this.executeTask(task);
      task.state = 'completed';
      task.completedAt = Date.now();
      await stateMachine.complete();
    } catch (error) {
      task.state = 'failed';
      task.error = (error as Error).message;
      await stateMachine.fail(error as Error);
    } finally {
      this.processing.delete(task.id);
      this.activeCount--;
      
      // Nächsten Task verarbeiten
      this.processNext();
    }
  }

  private createTaskStateMachine(task: QueuedTask): NativeStateMachine {
    return new NativeStateMachine({
      initialState: 'running',
      allowedTransitions: [
        { from: 'running', to: 'paused' },
        { from: 'paused', to: 'running' },
        { from: 'running', to: 'waiting' },
        { from: 'waiting', to: 'running' },
        { from: 'running', to: 'completed' },
        { from: 'running', to: 'failed' },
        { from: 'running', to: 'cancelled' },
        { from: 'paused', to: 'cancelled' },
        { from: 'waiting', to: 'cancelled' }
      ],
      onEnter: async (state) => {
        task.state = state;
        console.log(`[TaskQueue] Task ${task.id} entered state: ${state}`);
      }
    });
  }

  private async executeTask(task: QueuedTask): Promise<any> {
    // Hier würde die tatsächliche Task-Ausführung stattfinden
    // Simulation mit zufälliger Dauer
    const duration = Math.random() * 1000 + 500;
    await new Promise(resolve => setTimeout(resolve, duration));
    
    return { success: true, data: `Result for ${task.task}` };
  }

  getQueueStatus(): {
    queued: number;
    processing: number;
    activeCount: number;
    maxConcurrent: number;
  } {
    return {
      queued: this.queue.length,
      processing: this.processing.size,
      activeCount: this.activeCount,
      maxConcurrent: this.maxConcurrent
    };
  }

  cancelTask(taskId: string): boolean {
    const task = this.queue.find(t => t.id === taskId);
    if (task) {
      task.state = 'cancelled';
      const index = this.queue.indexOf(task);
      this.queue.splice(index, 1);
      console.log(`[TaskQueue] Cancelled task: ${taskId}`);
      return true;
    }

    const stateMachine = this.processing.get(taskId);
    if (stateMachine) {
      stateMachine.cancel();
      console.log(`[TaskQueue] Cancelling running task: ${taskId}`);
      return true;
    }

    return false;
  }
}

export const StateMachineModule = {
  NativeStateMachine,
  TaskQueueManager
};

// Types are already exported above
