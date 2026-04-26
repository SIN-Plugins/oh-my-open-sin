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

// Skill system
export {
  discoverSkills,
  matchSkills,
  resolveDependencies,
  startSkillMCPs,
  stopSkillMCPs,
  getSkillPromptInjection,
  getSkillPermissions,
  getSkillHealth
} from './utils/skill-loader.js';

export {
  validateSkillManifest,
  type SkillManifest
} from './utils/skill-schema.js';

// Context-Aware Routing v2
export {
  scanPaths,
  type CodeMetrics
} from './utils/ast-scanner.js';

export {
  classifyIntent,
  type IntentCategory
} from './utils/intent-classifier.js';

export {
  scoreAgents,
  type AgentScore
} from './utils/agent-scorer.js';

export {
  updateRoutingWeights,
  syncWeightsFromTelemetry
} from './utils/routing-feedback.js';

export {
  routeTaskV2,
  type RoutingDecisionV2
} from './utils/router-v2.js';

// CLI Tools
export {
  SinSkillsCLI,
  sinSkillsCLI
} from './tools/sin-skills.js';

export {
  SinRouteDebug,
  sinRouteDebug
} from './tools/sin-route-debug.js';

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
  PrometheusExporter,
  GrafanaDashboardGenerator,
  FleetSync,
  TelemetryModule,
  type TelemetryEvent,
  type AgentMetrics,
  type FleetNode
} from './advanced/telemetry.js';

// Self-Healing v2
export {
  createCheckpoint,
  restoreCheckpoint,
  rollbackPartial,
  cleanupCheckpoints,
  type CheckpointMeta
} from './utils/checkpoint-manager-v2.js';

export {
  classifyFailureV2,
  type FailureType,
  type RootCause,
  type FailureAnalysis
} from './utils/failure-classifier-v2.js';

export {
  STRATEGY_MAP,
  runLspAutoFix,
  runDepReinstall,
  runTestDebugRerun,
  runScopeSplit,
  type StrategyResult
} from './utils/healing-strategies.js';

export {
  loadMatrix,
  updateMatrix,
  recommendStrategy,
  type MatrixEntry
} from './utils/healing-learner.js';

export {
  initHealingLoopV2,
  executeHealingStepV2,
  calculateDynamicBudget,
  type HealingContextV2
} from './utils/healing-loop-v2.js';

export {
  SinHealingDebugV2,
  sinHealingDebugV2
} from './tools/sin-healing-debug-v2.js';

// Multi-Modal Verification v2
export {
  runVerificationGateV2,
  type VerificationConfigV2,
  type VerificationReportV2
} from './utils/verification-gate-v2.js';

export {
  diffUIV2,
  captureDOMStructure,
  type UIDiffResultV2
} from './utils/verifier-ui-v2.js';

export {
  runTestsV2,
  type TestResultV2
} from './utils/verifier-tests-v2.js';

export {
  runLSPV2,
  type LSPResultV2
} from './utils/verifier-lsp-v2.js';

export {
  SinVerifyDebug,
  sinVerifyDebug
} from './tools/sin-verify-debug.js';

// Deterministic Checkpointing v2
export {
  serializeState,
  deserializeState,
  type CheckpointState
} from './utils/checkpoint-state.js';

export {
  saveCheckpoint,
  loadCheckpoint,
  listCheckpoints,
  cleanupStaleCheckpoints
} from './utils/checkpoint-storage.js';

export {
  prepareResume,
  type ResumePayload
} from './utils/checkpoint-resume.js';

export {
  SinResumeCLI,
  sinResumeCLI
} from './tools/sin-resume.js';

// Tri-Temple Audit & Fabric Controller
export {
  verifyChain,
  verifyHMAC,
  computeHash,
  loadChain,
  generateBoardReport,
  formatBoardReport,
  runAuditVerify,
  watchAuditChain,
  appendAuditEntry,
  getTelemetryMetrics,
  parseArgs,
  type AuditEntry,
  type ChainReport,
  type BoardReport
} from './utils/audit-verify.js';

export {
  loadFabricState,
  saveFabricState,
  safeRun,
  BudgetAllocator,
  RiskController,
  PortfolioScheduler,
  CrossTempleRouter,
  runFabricController,
  type FabricState,
  type TempleMeta
} from './utils/fabric-controller.js';

// SIN Fabric World - CRDT Sync & Bootstrap
export {
  SinFabricWorldSync,
  sinFabricWorldSync,
  discoverFleet,
  reconcileBlackboard,
  aggregateAuditChains,
  propagatePatterns,
  broadcastToFleet
} from './tools/sin-fabric-world-sync.js';

export {
  SinFabricWorldInit,
  sinFabricWorldInit,
  initDirectories,
  initAuditChain,
  initPatternSeed,
  initFleetSSH,
  initDashboardAutoStart
} from './tools/sin-fabric-world-init.js';

export {
  SinFabricDashboard,
  sinFabricDashboard
} from './tools/sin-fabric-dashboard.js';

// Planet Router - Cross-Planet Dispatch
export {
  analyzeDomain,
  evaluateConstraints,
  enforceGravityPolicy,
  dispatchCrossPlanet,
  type RouteDecision,
  type GravityPolicy
} from './bin/sin-planet-router.js';

// Galaxy Core - Event Horizon Engine
export {
  aggregateTelemetry,
  macroConsensus,
  gravitationalRoute,
  supernovaFallback,
  type ClusterHealth,
  type ConsensusVote,
  type TelemetryAggregate,
  type RoutingDecision,
  type FallbackPlan
} from './bin/sin-galaxy-core.js';

// Galaxy Manifest Generator
export {
  loadJSON as loadGalaxyManifest,
  SinGalaxyManifestGen
} from './bin/sin-galaxy-manifest-gen.js';

// Enterprise Swarm Core - Issue #12
export {
  PolicyEngine,
  getPolicyEngine,
  type PolicyContext,
  type PolicyDecision,
  type PolicyRule
} from './core/PolicyEngine.js';

export {
  SigstoreSigner,
  getSigstoreSigner,
  type SignOptions,
  type SignatureResult,
  type VerificationResult,
  type SignedArtifact
} from './core/SigstoreSigner.js';

export {
  NATSMessageBus,
  getNATSMessageBus,
  type Message,
  type Subscription,
  type MessageStats
} from './core/NATSMessageBus.js';

export {
  DAGTaskScheduler,
  getDAGTaskScheduler,
  type Task,
  type TaskStatus,
  type ScheduleResult
} from './core/DAGTaskScheduler.js';

// CRDT State Store - Issue #13
export {
  CRDTStateStore,
  CRDTStoreFactory,
  getCRDTFactory,
  getSessionStore,
  type StateEvent,
  type CRDTStateOptions
} from './core/CRDTStateStore.js';

// Telemetry Manager - Issue #13
export {
  TelemetryManager,
  getTelemetryManager,
  traced,
  type SLOConfig,
  type TelemetryConfig,
  type SLABreach
} from './core/TelemetryManager.js';

// Chaos Engine - Issue #13
export {
  ChaosEngine,
  getChaosEngine,
  runChaosCLI,
  ChaosScenarios,
  type FaultType,
  type ChaosFault,
  type RecoveryCheck,
  type ChaosResult,
  type ChaosManifest
} from './core/ChaosEngine.js';

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
