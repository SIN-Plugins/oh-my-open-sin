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
    allowedTransitions: Array<{
        from: State;
        to: State;
        actions?: string[];
    }>;
    onEnter?: (state: State) => void;
    onExit?: (state: State) => void;
    onError?: (error: Error, state: State) => void;
}
export declare class NativeStateMachine {
    private currentState;
    private history;
    private config;
    private listeners;
    constructor(config: StateMachineConfig);
    canTransition(to: State): boolean;
    transition(to: State, action?: string): Promise<boolean>;
    getState(): State;
    getHistory(): StateTransition[];
    addListener(callback: (state: State) => void): void;
    removeListener(callback: (state: State) => void): void;
    private notifyListeners;
    reset(): void;
    start(): Promise<boolean>;
    pause(): Promise<boolean>;
    resume(): Promise<boolean>;
    wait(): Promise<boolean>;
    complete(): Promise<boolean>;
    fail(error?: Error): Promise<boolean>;
    cancel(): Promise<boolean>;
}
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
export declare class TaskQueueManager {
    private queue;
    private processing;
    private maxConcurrent;
    private activeCount;
    setMaxConcurrent(max: number): void;
    enqueue(task: Omit<QueuedTask, 'state' | 'createdAt'>): string;
    private processNext;
    private createTaskStateMachine;
    private executeTask;
    getQueueStatus(): {
        queued: number;
        processing: number;
        activeCount: number;
        maxConcurrent: number;
    };
    cancelTask(taskId: string): boolean;
}
export declare const StateMachineModule: {
    NativeStateMachine: typeof NativeStateMachine;
    TaskQueueManager: typeof TaskQueueManager;
};
//# sourceMappingURL=state_machine.d.ts.map