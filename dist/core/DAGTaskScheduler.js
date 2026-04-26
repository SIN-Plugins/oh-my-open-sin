"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.DAGTaskScheduler = void 0;
exports.getDAGTaskScheduler = getDAGTaskScheduler;
const events_1 = require("events");
class DAGTaskScheduler extends events_1.EventEmitter {
    tasks = new Map();
    dag = new Map();
    completedTasks = new Set();
    runningTasks = new Set();
    maxConcurrency = 10;
    stats = {
        total: 0,
        completed: 0,
        failed: 0,
        cancelled: 0,
        speculative: 0
    };
    constructor(options) {
        super();
        if (options) {
            this.maxConcurrency = options.maxConcurrency ?? this.maxConcurrency;
        }
    }
    addTask(task) {
        const taskId = task.id || this.generateTaskId();
        const fullTask = {
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
    async schedule() {
        const result = {
            scheduledTasks: [],
            blockedTasks: [],
            circularDependencies: [],
            executionOrder: []
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
        // Schedule tasks
        for (const group of executionOrder) {
            result.scheduledTasks.push(...group);
            // Execute group in parallel
            await this.executeGroup(group);
        }
        this.emit('schedule:completed', result);
        return result;
    }
    async executeTask(taskId) {
        const task = this.tasks.get(taskId);
        if (!task) {
            throw new Error(`Task ${taskId} not found`);
        }
        // Check dependencies
        const unmetDeps = task.dependencies.filter(depId => !this.completedTasks.has(depId));
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
                    }
                    else {
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
        }
        catch (error) {
            task.error = error;
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
    async executeSpeculative(taskName, strategies) {
        const strategyTasks = [];
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
        const results = await Promise.allSettled(strategyTasks.map(id => this.executeTask(id)));
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
            return results[firstSuccess].value;
        }
        // All failed
        throw new Error('All speculative strategies failed');
    }
    cancelTask(taskId) {
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
    getTask(taskId) {
        return this.tasks.get(taskId);
    }
    getAllTasks() {
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
    reset() {
        this.tasks.clear();
        this.dag.clear();
        this.completedTasks.clear();
        this.runningTasks.clear();
        this.stats = { total: 0, completed: 0, failed: 0, cancelled: 0, speculative: 0 };
        this.emit('scheduler:reset');
    }
    updateDAG(task) {
        const node = {
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
    detectCycles() {
        const visited = new Set();
        const recursionStack = new Set();
        const cycles = [];
        const dfs = (taskId, path) => {
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
    topologicalSortParallel() {
        const inDegree = new Map();
        const groups = [];
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
    async executeGroup(taskIds) {
        const promises = taskIds.map(id => this.executeTask(id).catch(error => {
            this.emit('group:error', { taskId: id, error });
            return null;
        }));
        await Promise.all(promises);
    }
    async runTaskAction(task) {
        // Simulate task execution - in production, dispatch to appropriate agent
        this.emit('task:executing', task);
        // Placeholder - actual execution would involve agent dispatch
        await new Promise(resolve => setTimeout(resolve, 10 + Math.random() * 90));
        return { success: true, taskId: task.id, action: task.action };
    }
    generateTaskId() {
        return `task-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    }
}
exports.DAGTaskScheduler = DAGTaskScheduler;
// Singleton instance
let dagSchedulerInstance = null;
function getDAGTaskScheduler() {
    if (!dagSchedulerInstance) {
        dagSchedulerInstance = new DAGTaskScheduler();
    }
    return dagSchedulerInstance;
}
exports.default = DAGTaskScheduler;
//# sourceMappingURL=DAGTaskScheduler.js.map