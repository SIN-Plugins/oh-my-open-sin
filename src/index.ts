/**
 * oh-my-open-sin
 * Native OpenCode SubAgent Framework
 * 
 * Replacing broken plugins with session-aware, non-blocking subagents
 */

import { AgentOrchestrator } from './core/AgentOrchestrator.js';
import { SinDelegate } from './agents/sin_delegate.js';
import { SinSwarm } from './agents/sin_swarm.js';
import { SinMonitor } from './agents/sin_monitor.js';

// Core exports
export { SubAgent } from './core/SubAgent.js';
export { AgentOrchestrator } from './core/AgentOrchestrator.js';

// Built-in agents
export { SinDelegate } from './agents/sin_delegate.js';
export { SinSwarm } from './agents/sin_swarm.js';
export { SinMonitor } from './agents/sin_monitor.js';

// Cognitive Assembly Line - Research Swarm
export { Athena, Argus, Daedalus, Hermes, ResearchSwarm } from './agents/research_swarm.js';

// Cognitive Assembly Line - Planning Swarm
export { Prometheus, Metis, Themis, Apollo, PlanningSwarm } from './agents/planning_swarm.js';

// Cognitive Assembly Line - Validation Superlayer
export { Zeus, Aegis, Hephaestus, Chronos, Nemesis, ValidationSuperlayer } from './agents/validation_layer.js';

// Cognitive Assembly Line - Execution Layer
export { Atlas, Iris, Hades, Janus, Asclepius, ExecutionLayer } from './agents/execution_layer.js';

// Git utilities
export { GitOrchestrator } from './git/GitOrchestrator.js';
export { GitConflictResolver, type ConflictInfo, type ResolutionStrategy } from './git/GitConflictResolver.js';
export { GitPolicyEnforcer, type PolicyConfig, type PolicyViolation, type PolicyResult } from './git/GitPolicyEnforcer.js';

// Exec utilities
export { 
  execAsync, 
  runCommand, 
  runParallelCommands, 
  runWithRetry, 
  commandExists,
  withTempFile,
  CommandQueue,
  type ExecResult 
} from './utils/exec.js';

// Health server
export { HealthServer } from './health/HealthServer.js';

// Advanced Features
export { 
  DynamicSkillInjector, 
  skillInjector,
  ContextAwareRouter, 
  contextRouter,
  SelfHealingExecutor, 
  selfHealingExecutorInstance as selfHealingExecutor,
  MultiModalVerifier, 
  StateCheckpointManager, 
  AdvancedFeatures 
} from './advanced/features.js';

// New Advanced Modules
export {
  SinHashEdit,
  sinHashEdit,
  type HashEdit,
  type HashEditResult,
  type FileSection,
  CLI_HELP as HASH_EDIT_CLI_HELP
} from './tools/sin_hash_edit.js';

// Telemetry & Monitoring
export {
  TelemetryManager,
  PrometheusExporter,
  GrafanaDashboardGenerator,
  FleetSync,
  TelemetryModule,
  type TelemetryEvent,
  type AgentMetrics,
  type FleetNode
} from './advanced/telemetry.js';

// State Machine
export {
  NativeStateMachine,
  TaskQueueManager,
  StateMachineModule,
  type State,
  type StateTransition,
  type QueuedTask
} from './advanced/state_machine.js';

// Types
export * from './types/index.js';

/**
 * Create a pre-configured orchestrator with all built-in agents
 */
export function createDefaultOrchestrator() {
  const orchestrator = new AgentOrchestrator();
  
  // Register built-in agents
  orchestrator.register(new SinDelegate());
  orchestrator.register(new SinSwarm());
  orchestrator.register(new SinMonitor());
  
  return orchestrator;
}

/**
 * Framework version
 */
export const VERSION = '1.0.0';

/**
 * Framework name
 */
export const FRAMEWORK_NAME = 'oh-my-open-sin';
