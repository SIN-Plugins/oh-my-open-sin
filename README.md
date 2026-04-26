# oh-my-open-sin

**Native OpenCode SubAgent Framework**

Replacing broken plugins with session-aware, non-blocking subagents.

## Overview

oh-my-open-sin is a TypeScript-based framework for building and orchestrating native subagents that replace traditional plugin architectures. It provides:

- **Session-aware execution** - No more hanging sessions or deadlocks
- **Non-blocking operations** - All agents run asynchronously
- **Git worktree isolation** - Safe parallel branch operations
- **Health monitoring** - Built-in health checks and metrics
- **Swarm orchestration** - Coordinate multiple agents for complex tasks

## Architecture

### 5-Layer Design

1. **Research Layer** - Information gathering and analysis
2. **Planning Layer** - Task decomposition and strategy
3. **Validation Layer** - Quality assurance and verification
4. **Execution Layer** - Task implementation
5. **Dispatch Layer** - Result delivery and integration

### Core Components

- **SubAgent** - Base class for all subagents
- **AgentOrchestrator** - Manages agent registration and task routing
- **HealthServer** - HTTP server for health checks and metrics
- **GitOrchestrator** - Git operations with worktree isolation

## Installation

```bash
npm install oh-my-open-sin
```

## Quick Start

```typescript
import { createDefaultOrchestrator } from 'oh-my-open-sin';

// Create pre-configured orchestrator with built-in agents
const orchestrator = createDefaultOrchestrator();

// Execute a task
const context = orchestrator.getSessionContext('session-1', '/path/to/workspace');
const result = await orchestrator.execute('sin_delegate', context, {
  type: 'git',
  target: 'create-branch',
});

console.log(result);
```

## Built-in Agents

### sin_delegate
Routes tasks to appropriate subagents based on task type and capabilities.

**Capabilities:** task-routing, delegation, load-balancing

### sin_swarm
Coordinates swarm-based multi-agent collaboration with parallel or sequential execution.

**Capabilities:** swarm-orchestration, parallel-execution, collaborative-tasks

### sin_monitor
Monitors system health, agent status, and performance metrics.

**Capabilities:** health-check, metrics, alerting, performance-tracking

## Git Orchestration

The `GitOrchestrator` provides safe Git operations with worktree isolation:

```typescript
import { GitOrchestrator, GitConflictResolver, GitPolicyEnforcer } from 'oh-my-open-sin';

const git = new GitOrchestrator('/path/to/repo');

// Create isolated worktree
await git.createWorktree({
  path: '/tmp/worktree-feature',
  branch: 'feature/my-feature',
});

// Create feature branch
const branch = await git.createFeatureBranch('new-feature');

// Commit and push
await git.commitChanges('feat: add new feature');
await git.pushBranch();

// Resolve conflicts intelligently
const resolver = new GitConflictResolver(worktreePath);
const conflicts = await resolver.analyzeConflicts();
for (const conflict of conflicts) {
  const strategy = await resolver.recommendStrategy(conflict);
  await resolver.applyResolution(conflict, strategy);
}

// Enforce policies
const enforcer = new GitPolicyEnforcer(worktreePath, {
  requireTests: true,
  protectedBranches: ['main', 'develop']
});
const result = await enforcer.validateAll();
if (!result.passed) {
  console.error('Policy violations:', result.violations);
}
```

## Health Server

Start the health server for monitoring:

```typescript
import { HealthServer } from 'oh-my-open-sin';

const server = new HealthServer(3000);

// Register custom health checks
server.registerCheck('database', async () => {
  // Check database connection
  return true;
});

await server.start();

// Endpoints:
// GET /health - Comprehensive health status
// GET /metrics - System metrics
// GET /ready - Readiness check
```

## Creating Custom Agents

Extend the `SubAgent` base class:

```typescript
import { SubAgent, TaskContext, SubAgentResult } from 'oh-my-open-sin';

export class MyCustomAgent extends SubAgent {
  constructor() {
    super({
      name: 'my_custom_agent',
      description: 'Does something useful',
      capabilities: ['capability-1', 'capability-2'],
    });
  }

  async execute(context: TaskContext, input: unknown): Promise<SubAgentResult> {
    return this.trackExecution(context.taskId, async () => {
      // Your implementation
      return this.success({ result: 'done' });
    });
  }
}
```

## Cognitive Assembly Line (Implemented)

The framework includes pre-built swarms with 18 specialized agents:

- **Research Swarm**: Athena (strategy), Argus (surveillance), Daedalus (architecture), Hermes (communication)
- **Planning Swarm**: Prometheus (forecasting), Metis (tactics), Themis (compliance), Apollo (clarity)
- **Validation Superlayer**: Zeus (final approval), Aegis (security), Hephaestus (quality), Chronos (performance), Nemesis (adversarial)
- **Execution Layer**: Atlas (load balancing), Iris (visual), Hades (debugging), Janus (gateway), Asclepius (healing)

## Advanced Features

### Exec Utilities

Powerful command execution utilities:

```typescript
import { runCommand, runWithRetry, CommandQueue, runParallelCommands } from 'oh-my-open-sin';

// Simple command execution
const { stdout, stderr } = await runCommand('git status', { cwd: '/path/to/repo' });

// Retry with exponential backoff
const result = await runWithRetry('flaky-command', { 
  retries: 3, 
  delayMs: 1000, 
  backoff: 2 
});

// Sequential command queue
const queue = new CommandQueue('/path/to/repo');
await queue.enqueue('git add .');
await queue.enqueue('git commit -m "update"');

// Parallel execution with concurrency limit
const commands = ['task1', 'task2', 'task3', 'task4'];
const results = await runParallelCommands(commands, { concurrency: 2 });
```

## Roadmap

- [x] Core SubAgent framework
- [x] Agent Orchestrator
- [x] Built-in agents (delegate, swarm, monitor)
- [x] Git Orchestrator with worktree support
- [x] Health Server
- [x] Cognitive Assembly Line (18 agents across 4 swarms)
- [x] Git Conflict Resolver with intelligent strategies
- [x] Git Policy Enforcer with automated validation
- [x] Exec Utilities (CommandQueue, retry logic, parallel execution)
- [x] Dynamic Skill Injection
- [x] Context-Aware Routing
- [x] Self-Healing Execution Loops
- [x] Multi-Modal Verification
- [x] State Checkpointing
- [x] Telemetry & Monitoring (Prometheus, Grafana, FleetSync)
- [x] Native State Machine
- [ ] LSP Integration (sin_lsp)
- [ ] Hash-based Editing (sin_hash_edit)
- [ ] ULW Integration (sin_ulw)

## License

MIT
