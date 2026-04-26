"use strict";
/**
 * Native State Machine Implementation
 * Deterministische Zustandsverwaltung für zuverlässige Ausführung
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.StateMachineModule = exports.TaskQueueManager = exports.NativeStateMachine = void 0;
class NativeStateMachine {
    currentState;
    history = [];
    config;
    listeners = [];
    constructor(config) {
        this.config = config;
        this.currentState = config.initialState;
        // Initiale Transition记录
        this.history.push({
            from: 'idle',
            to: config.initialState,
            action: 'init',
            timestamp: Date.now()
        });
    }
    canTransition(to) {
        return this.config.allowedTransitions.some(t => t.from === this.currentState && t.to === to);
    }
    async transition(to, action = 'manual') {
        if (!this.canTransition(to)) {
            console.error(`[StateMachine] Invalid transition: ${this.currentState} -> ${to}`);
            return false;
        }
        // Exit-Handler aufrufen
        if (this.config.onExit) {
            try {
                await this.config.onExit(this.currentState);
            }
            catch (e) {
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
            }
            catch (e) {
                if (this.config.onError) {
                    this.config.onError(e, to);
                }
            }
        }
        // Listener benachrichtigen
        this.notifyListeners();
        return true;
    }
    getState() {
        return this.currentState;
    }
    getHistory() {
        return [...this.history];
    }
    addListener(callback) {
        this.listeners.push(callback);
    }
    removeListener(callback) {
        const index = this.listeners.indexOf(callback);
        if (index > -1) {
            this.listeners.splice(index, 1);
        }
    }
    notifyListeners() {
        for (const listener of this.listeners) {
            try {
                listener(this.currentState);
            }
            catch (e) {
                console.error('[StateMachine] Listener error:', e);
            }
        }
    }
    reset() {
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
    async start() {
        return this.transition('running', 'start');
    }
    async pause() {
        return this.transition('paused', 'pause');
    }
    async resume() {
        return this.transition('running', 'resume');
    }
    async wait() {
        return this.transition('waiting', 'wait');
    }
    async complete() {
        return this.transition('completed', 'complete');
    }
    async fail(error) {
        if (this.config.onError && error) {
            this.config.onError(error, 'failed');
        }
        return this.transition('failed', 'fail');
    }
    async cancel() {
        return this.transition('cancelled', 'cancel');
    }
}
exports.NativeStateMachine = NativeStateMachine;
class TaskQueueManager {
    queue = [];
    processing = new Map();
    maxConcurrent = 5;
    activeCount = 0;
    setMaxConcurrent(max) {
        this.maxConcurrent = max;
    }
    enqueue(task) {
        const id = task.id || `task_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        const queuedTask = {
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
    async processNext() {
        if (this.activeCount >= this.maxConcurrent || this.queue.length === 0) {
            return;
        }
        const task = this.queue.shift();
        if (!task)
            return;
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
        }
        catch (error) {
            task.state = 'failed';
            task.error = error.message;
            await stateMachine.fail(error);
        }
        finally {
            this.processing.delete(task.id);
            this.activeCount--;
            // Nächsten Task verarbeiten
            this.processNext();
        }
    }
    createTaskStateMachine(task) {
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
    async executeTask(task) {
        // Hier würde die tatsächliche Task-Ausführung stattfinden
        // Simulation mit zufälliger Dauer
        const duration = Math.random() * 1000 + 500;
        await new Promise(resolve => setTimeout(resolve, duration));
        return { success: true, data: `Result for ${task.task}` };
    }
    getQueueStatus() {
        return {
            queued: this.queue.length,
            processing: this.processing.size,
            activeCount: this.activeCount,
            maxConcurrent: this.maxConcurrent
        };
    }
    cancelTask(taskId) {
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
exports.TaskQueueManager = TaskQueueManager;
exports.StateMachineModule = {
    NativeStateMachine,
    TaskQueueManager
};
// Types are already exported above
//# sourceMappingURL=state_machine.js.map