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
import { createHash } from 'crypto';

export interface Task {
  id: string;
  name: string;
  action: string;
  payload: any;
  dependencies: string[]; // Task IDs
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

export type TaskStatus = 
  | 'pending'
  | 'queued'
  | 'running'
  | 'completed'
  | 'failed'
  | 'cancelled'
  | 'speculative';

export interface DAGNode {
  task: Task;
  predecessors: Set<string>;
  successors: Set<string>;
}

export interface ScheduleResult {
  scheduledTasks: string[];
  blockedTasks: string[];
  circularDependencies: string[];
  executionOrder: string[][]; // Parallel groups
  parallelGroups: string[][];
  estimatedDuration: number;
  executionId: string;
}

export class DAGTaskScheduler extends EventEmitter {
  private tasks: Map<string, Task> = new Map();
  private dag: Map<string, DAGNode> = new Map();
  private completedTasks: Set<string> = new Set();
  private runningTasks: Set<string> = new Set();
  private maxConcurrency: number = 10;
  private stats = {
    total: 0,
    completed: 0,
    failed: 0,
    cancelled: 0,
    speculative: 0
  };

  constructor(options?: { maxConcurrency?: number }) {
    super();
    if (options) {
      this.maxConcurrency = options.maxConcurrency ?? this.maxConcurrency;
    }
  }

  addTask(task: Partial<Task> & { name: string; action: string }): string {
    const taskId = task.id || this.generateTaskId();
    
    const fullTask: Task = {
      id: taskId,
      name: task.name,
      action: task.action,
      payload: task.payload || {},
      dependencies: task.dependencies || [],
      priority: task.priority ?? 5,
      status: 'pending',
      retryCount: 0,
      maxRetries: task.maxRetries ?? 3,
      speculative: task.speculative ?? false
    };

    this.tasks.set(taskId, fullTask);
    this.updateDAG(fullTask);
    this.stats.total++;

    this.emit('task:added', fullTask);
    return taskId;
  }

  async schedule(tasks?: Array<{ id: string; name: string; action: string; payload?: any; dependencies?: string[]; priority?: number }>): Promise<ScheduleResult> {
    const executionId = `exec-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    // If tasks are provided, add them to the scheduler
    if (tasks && tasks.length > 0) {
      for (const task of tasks) {
        this.addTask(task);
      }
    }
    
    const result: ScheduleResult = {
      scheduledTasks: [],
      blockedTasks: [],
      circularDependencies: [],
      executionOrder: [],
      parallelGroups: [],
      estimatedDuration: 0,
      executionId
    };

    // Check for circular dependencies
    const cycles = this.detectCycles();
    if (cycles.length > 0) {
      result.circularDependencies = cycles;
      this.emit('schedule:error', { type: 'circular_dependency', cycles });
      return result;
    }

    // Topological sort with parallel grouping
    const executionOrder = this.topologicalSortParallel();
    result.executionOrder = executionOrder;
    result.parallelGroups = executionOrder;

    // Estimate duration based on task count and concurrency
    const totalTasks = this.tasks.size;
    const avgTaskDuration = 50; // ms
    const estimatedGroups = executionOrder.length;
    result.estimatedDuration = estimatedGroups * avgTaskDuration;

    // Schedule tasks
    for (const group of executionOrder) {
      result.scheduledTasks.push(...group);
      
      // Execute group in parallel
      await this.executeGroup(group);
    }

    this.emit('schedule:completed', result);
    return result;
  }

  async executeTask(taskId: string): Promise<any> {
    const task = this.tasks.get(taskId);
    
    if (!task) {
      throw new Error(`Task ${taskId} not found`);
    }

    // Check dependencies
    const unmetDeps = task.dependencies.filter(
      depId => !this.completedTasks.has(depId)
    );

    if (unmetDeps.length > 0) {
      this.emit('task:blocked', { task, unmetDeps });
      throw new Error(`Unmet dependencies: ${unmetDeps.join(', ')}`);
    }

    // Check concurrency limit
    if (this.runningTasks.size >= this.maxConcurrency) {
      this.emit('task:queued', task);
      task.status = 'queued';
      return new Promise((resolve, reject) => {
        const checkQueue = () => {
          if (this.runningTasks.size < this.maxConcurrency) {
            this.executeTask(taskId).then(resolve).catch(reject);
          } else {
            setTimeout(checkQueue, 100);
          }
        };
        checkQueue();
      });
    }

    // Execute task
    task.status = 'running';
    task.startTime = Date.now();
    this.runningTasks.add(taskId);
    this.emit('task:started', task);

    try {
      // Simulate task execution - in production, dispatch to agent
      const result = await this.runTaskAction(task);
      
      task.status = 'completed';
      task.endTime = Date.now();
      task.result = result;
      this.completedTasks.add(taskId);
      this.runningTasks.delete(taskId);
      this.stats.completed++;

      this.emit('task:completed', task);
      return result;
    } catch (error) {
      task.error = error as Error;
      this.runningTasks.delete(taskId);

      // Retry logic
      if (task.retryCount < task.maxRetries) {
        task.retryCount++;
        task.status = 'pending';
        this.emit('task:retry', task);
        
        // Exponential backoff
        const delay = Math.pow(2, task.retryCount) * 100;
        await new Promise(resolve => setTimeout(resolve, delay));
        
        return this.executeTask(taskId);
      }

      task.status = 'failed';
      this.stats.failed++;
      this.emit('task:failed', task);
      throw error;
    }
  }

  async executeSpeculative(taskName: string, strategies: Array<{ action: string; payload: any }>): Promise<any> {
    const strategyTasks: string[] = [];

    // Create speculative tasks for each strategy
    for (const strategy of strategies) {
      const taskId = this.addTask({
        name: `${taskName}-speculative-${strategy.action}`,
        action: strategy.action,
        payload: strategy.payload,
        priority: 10,
        speculative: true
      });
      strategyTasks.push(taskId);
    }

    this.stats.speculative += strategies.length;

    // Execute all strategies in parallel
    const results = await Promise.allSettled(
      strategyTasks.map(id => this.executeTask(id))
    );

    // Cancel remaining tasks when first completes
    const firstSuccess = results.findIndex(r => r.status === 'fulfilled');
    
    if (firstSuccess !== -1) {
      // Cancel other speculative tasks
      for (let i = 0; i < strategyTasks.length; i++) {
        if (i !== firstSuccess) {
          this.cancelTask(strategyTasks[i]);
        }
      }

      const winningTask = this.tasks.get(strategyTasks[firstSuccess]);
      this.emit('task:speculative-winner', winningTask);
      return (results[firstSuccess] as PromiseFulfilledResult<any>).value;
    }

    // All failed
    throw new Error('All speculative strategies failed');
  }

  cancelTask(taskId: string): boolean {
    const task = this.tasks.get(taskId);
    
    if (!task || task.status === 'completed' || task.status === 'cancelled') {
      return false;
    }

    task.status = 'cancelled';
    this.stats.cancelled++;
    
    // Cancel successors
    const node = this.dag.get(taskId);
    if (node) {
      for (const successorId of node.successors) {
        this.cancelTask(successorId);
      }
    }

    this.emit('task:cancelled', task);
    return true;
  }

  getTask(taskId: string): Task | undefined {
    return this.tasks.get(taskId);
  }

  getAllTasks(): Task[] {
    return Array.from(this.tasks.values());
  }

  getStats() {
    return {
      ...this.stats,
      running: this.runningTasks.size,
      pending: Array.from(this.tasks.values()).filter(t => t.status === 'pending').length,
      concurrency: this.maxConcurrency
    };
  }

  reset(): void {
    this.tasks.clear();
    this.dag.clear();
    this.completedTasks.clear();
    this.runningTasks.clear();
    this.stats = { total: 0, completed: 0, failed: 0, cancelled: 0, speculative: 0 };
    this.emit('scheduler:reset');
  }

  private updateDAG(task: Task): void {
    const node: DAGNode = {
      task,
      predecessors: new Set(task.dependencies),
      successors: new Set()
    };

    this.dag.set(task.id, node);

    // Update successors of dependencies
    for (const depId of task.dependencies) {
      const depNode = this.dag.get(depId);
      if (depNode) {
        depNode.successors.add(task.id);
      }
    }
  }

  private detectCycles(): string[] {
    const visited = new Set<string>();
    const recursionStack = new Set<string>();
    const cycles: string[] = [];

    const dfs = (taskId: string, path: string[]): boolean => {
      if (recursionStack.has(taskId)) {
        const cycleStart = path.indexOf(taskId);
        cycles.push(path.slice(cycleStart).join(' -> '));
        return true;
      }

      if (visited.has(taskId)) {
        return false;
      }

      visited.add(taskId);
      recursionStack.add(taskId);
      path.push(taskId);

      const node = this.dag.get(taskId);
      if (node) {
        for (const successor of node.successors) {
          if (dfs(successor, [...path])) {
            return true;
          }
        }
      }

      recursionStack.delete(taskId);
      return false;
    };

    for (const taskId of this.tasks.keys()) {
      if (!visited.has(taskId)) {
        dfs(taskId, []);
      }
    }

    return cycles;
  }

  private topologicalSortParallel(): string[][] {
    const inDegree = new Map<string, number>();
    const groups: string[][] = [];

    // Calculate in-degrees
    for (const [taskId, node] of this.dag.entries()) {
      inDegree.set(taskId, node.predecessors.size);
    }

    // Process level by level
    while (inDegree.size > 0) {
      // Find all nodes with in-degree 0
      const ready = Array.from(inDegree.entries())
        .filter(([_, degree]) => degree === 0)
        .map(([id]) => id);

      if (ready.length === 0) {
        break; // Should not happen if no cycles
      }

      // Sort by priority
      ready.sort((a, b) => {
        const taskA = this.tasks.get(a);
        const taskB = this.tasks.get(b);
        return (taskB?.priority || 0) - (taskA?.priority || 0);
      });

      groups.push(ready);

      // Remove processed nodes
      for (const taskId of ready) {
        inDegree.delete(taskId);
        
        // Decrease in-degree of successors
        const node = this.dag.get(taskId);
        if (node) {
          for (const successor of node.successors) {
            const degree = inDegree.get(successor) || 0;
            inDegree.set(successor, degree - 1);
          }
        }
      }
    }

    return groups;
  }

  private async executeGroup(taskIds: string[]): Promise<void> {
    const promises = taskIds.map(id => this.executeTask(id).catch(error => {
      this.emit('group:error', { taskId: id, error });
      return null;
    }));

    await Promise.all(promises);
  }

  private async runTaskAction(task: Task): Promise<any> {
    // Simulate task execution - in production, dispatch to appropriate agent
    this.emit('task:executing', task);
    
    // Placeholder - actual execution would involve agent dispatch
    await new Promise(resolve => setTimeout(resolve, 10 + Math.random() * 90));
    
    return { success: true, taskId: task.id, action: task.action };
  }

  private generateTaskId(): string {
    return `task-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
}

// Singleton instance
let dagSchedulerInstance: DAGTaskScheduler | null = null;

export function getDAGTaskScheduler(): DAGTaskScheduler {
  if (!dagSchedulerInstance) {
    dagSchedulerInstance = new DAGTaskScheduler();
  }
  return dagSchedulerInstance;
}

export default DAGTaskScheduler;
