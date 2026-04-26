/**
 * SIN DAG Task Scheduler - Hyper-Parallele Schwarm-Orchestrierung
 * Aufgaben als gerichteter azyklischer Graph mit paralleler Execution
 *
 * Features:
 * - DAG-basierte Task-Abhängigkeiten
 * - Parallele Execution wo möglich
 * - Speculative Execution
 * - Dynamic Role Assignment
 * - Priority Scheduling
 */
import { EventEmitter } from 'events';
export interface Task {
    id: string;
    name: string;
    action: string;
    payload: any;
    dependencies: string[];
    priority: number;
    status: TaskStatus;
    agent?: string;
    result?: any;
    error?: Error;
    startTime?: number;
    endTime?: number;
    retryCount: number;
    maxRetries: number;
    speculative?: boolean;
}
export type TaskStatus = 'pending' | 'queued' | 'running' | 'completed' | 'failed' | 'cancelled' | 'speculative';
export interface DAGNode {
    task: Task;
    predecessors: Set<string>;
    successors: Set<string>;
}
export interface ScheduleResult {
    scheduledTasks: string[];
    blockedTasks: string[];
    circularDependencies: string[];
    executionOrder: string[][];
}
export declare class DAGTaskScheduler extends EventEmitter {
    private tasks;
    private dag;
    private completedTasks;
    private runningTasks;
    private maxConcurrency;
    private stats;
    constructor(options?: {
        maxConcurrency?: number;
    });
    addTask(task: Partial<Task> & {
        name: string;
        action: string;
    }): string;
    schedule(): Promise<ScheduleResult>;
    executeTask(taskId: string): Promise<any>;
    executeSpeculative(taskName: string, strategies: Array<{
        action: string;
        payload: any;
    }>): Promise<any>;
    cancelTask(taskId: string): boolean;
    getTask(taskId: string): Task | undefined;
    getAllTasks(): Task[];
    getStats(): {
        running: number;
        pending: number;
        concurrency: number;
        total: number;
        completed: number;
        failed: number;
        cancelled: number;
        speculative: number;
    };
    reset(): void;
    private updateDAG;
    private detectCycles;
    private topologicalSortParallel;
    private executeGroup;
    private runTaskAction;
    private generateTaskId;
}
export declare function getDAGTaskScheduler(): DAGTaskScheduler;
export default DAGTaskScheduler;
//# sourceMappingURL=DAGTaskScheduler.d.ts.map