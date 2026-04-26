"use strict";
/**
 * oh-my-open-sin
 * Native OpenCode SubAgent Framework
 *
 * Replacing broken plugins with session-aware, non-blocking subagents
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __exportStar = (this && this.__exportStar) || function(m, exports) {
    for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports, p)) __createBinding(exports, m, p);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateRoutingWeights = exports.scoreAgents = exports.classifyIntent = exports.scanPaths = exports.validateSkillManifest = exports.getSkillHealth = exports.getSkillPermissions = exports.getSkillPromptInjection = exports.stopSkillMCPs = exports.startSkillMCPs = exports.resolveDependencies = exports.matchSkills = exports.discoverSkills = exports.CommandQueue = exports.withTempFile = exports.commandExists = exports.runWithRetry = exports.runParallelCommands = exports.runCommand = exports.execAsync = exports.GitPolicyEnforcer = exports.GitConflictResolver = exports.GitOrchestrator = exports.ExecutionLayer = exports.Asclepius = exports.Janus = exports.Hades = exports.Iris = exports.Atlas = exports.ValidationSuperlayer = exports.Nemesis = exports.Chronos = exports.Hephaestus = exports.Aegis = exports.Zeus = exports.PlanningSwarm = exports.Apollo = exports.Themis = exports.Metis = exports.Prometheus = exports.ResearchSwarm = exports.Hermes = exports.Daedalus = exports.Argus = exports.Athena = exports.SinMonitor = exports.SinSwarm = exports.SinDelegate = exports.AgentOrchestrator = exports.SubAgent = void 0;
exports.deserializeState = exports.serializeState = exports.sinVerifyDebug = exports.SinVerifyDebug = exports.runLSPV2 = exports.runTestsV2 = exports.captureDOMStructure = exports.diffUIV2 = exports.runVerificationGateV2 = exports.sinHealingDebugV2 = exports.SinHealingDebugV2 = exports.calculateDynamicBudget = exports.executeHealingStepV2 = exports.initHealingLoopV2 = exports.recommendStrategy = exports.updateMatrix = exports.loadMatrix = exports.runScopeSplit = exports.runTestDebugRerun = exports.runDepReinstall = exports.runLspAutoFix = exports.STRATEGY_MAP = exports.classifyFailureV2 = exports.cleanupCheckpoints = exports.rollbackPartial = exports.restoreCheckpoint = exports.createCheckpoint = exports.TelemetryModule = exports.FleetSync = exports.GrafanaDashboardGenerator = exports.PrometheusExporter = exports.HASH_EDIT_CLI_HELP = exports.sinHashEdit = exports.SinHashEdit = exports.AdvancedFeatures = exports.StateCheckpointManager = exports.MultiModalVerifier = exports.selfHealingExecutor = exports.SelfHealingExecutor = exports.contextRouter = exports.ContextAwareRouter = exports.skillInjector = exports.DynamicSkillInjector = exports.HealthServer = exports.sinRouteDebug = exports.SinRouteDebug = exports.sinSkillsCLI = exports.SinSkillsCLI = exports.routeTaskV2 = exports.syncWeightsFromTelemetry = void 0;
exports.supernovaFallback = exports.gravitationalRoute = exports.macroConsensus = exports.aggregateTelemetry = exports.dispatchCrossPlanet = exports.enforceGravityPolicy = exports.evaluateConstraints = exports.analyzeDomain = exports.sinFabricDashboard = exports.SinFabricDashboard = exports.initDashboardAutoStart = exports.initFleetSSH = exports.initPatternSeed = exports.initAuditChain = exports.initDirectories = exports.sinFabricWorldInit = exports.SinFabricWorldInit = exports.broadcastToFleet = exports.propagatePatterns = exports.aggregateAuditChains = exports.reconcileBlackboard = exports.discoverFleet = exports.sinFabricWorldSync = exports.SinFabricWorldSync = exports.runFabricController = exports.CrossTempleRouter = exports.PortfolioScheduler = exports.RiskController = exports.BudgetAllocator = exports.safeRun = exports.saveFabricState = exports.loadFabricState = exports.parseArgs = exports.getTelemetryMetrics = exports.appendAuditEntry = exports.watchAuditChain = exports.runAuditVerify = exports.formatBoardReport = exports.generateBoardReport = exports.loadChain = exports.computeHash = exports.verifyHMAC = exports.verifyChain = exports.sinResumeCLI = exports.SinResumeCLI = exports.prepareResume = exports.cleanupStaleCheckpoints = exports.listCheckpoints = exports.loadCheckpoint = exports.saveCheckpoint = void 0;
exports.FRAMEWORK_NAME = exports.VERSION = exports.StateMachineModule = exports.TaskQueueManager = exports.NativeStateMachine = exports.ChaosScenarios = exports.runChaosCLI = exports.getChaosEngine = exports.ChaosEngine = exports.traced = exports.getTelemetryManager = exports.TelemetryManager = exports.getSessionStore = exports.getCRDTFactory = exports.CRDTStoreFactory = exports.CRDTStateStore = exports.getDAGTaskScheduler = exports.DAGTaskScheduler = exports.getNATSMessageBus = exports.NATSMessageBus = exports.getSigstoreSigner = exports.SigstoreSigner = exports.getPolicyEngine = exports.PolicyEngine = exports.SinGalaxyManifestGen = exports.loadGalaxyManifest = void 0;
exports.createDefaultOrchestrator = createDefaultOrchestrator;
const AgentOrchestrator_js_1 = require("./core/AgentOrchestrator.js");
const sin_delegate_js_1 = require("./agents/sin_delegate.js");
const sin_swarm_js_1 = require("./agents/sin_swarm.js");
const sin_monitor_js_1 = require("./agents/sin_monitor.js");
// Core exports
var SubAgent_js_1 = require("./core/SubAgent.js");
Object.defineProperty(exports, "SubAgent", { enumerable: true, get: function () { return SubAgent_js_1.SubAgent; } });
var AgentOrchestrator_js_2 = require("./core/AgentOrchestrator.js");
Object.defineProperty(exports, "AgentOrchestrator", { enumerable: true, get: function () { return AgentOrchestrator_js_2.AgentOrchestrator; } });
// Built-in agents
var sin_delegate_js_2 = require("./agents/sin_delegate.js");
Object.defineProperty(exports, "SinDelegate", { enumerable: true, get: function () { return sin_delegate_js_2.SinDelegate; } });
var sin_swarm_js_2 = require("./agents/sin_swarm.js");
Object.defineProperty(exports, "SinSwarm", { enumerable: true, get: function () { return sin_swarm_js_2.SinSwarm; } });
var sin_monitor_js_2 = require("./agents/sin_monitor.js");
Object.defineProperty(exports, "SinMonitor", { enumerable: true, get: function () { return sin_monitor_js_2.SinMonitor; } });
// Cognitive Assembly Line - Research Swarm
var research_swarm_js_1 = require("./agents/research_swarm.js");
Object.defineProperty(exports, "Athena", { enumerable: true, get: function () { return research_swarm_js_1.Athena; } });
Object.defineProperty(exports, "Argus", { enumerable: true, get: function () { return research_swarm_js_1.Argus; } });
Object.defineProperty(exports, "Daedalus", { enumerable: true, get: function () { return research_swarm_js_1.Daedalus; } });
Object.defineProperty(exports, "Hermes", { enumerable: true, get: function () { return research_swarm_js_1.Hermes; } });
Object.defineProperty(exports, "ResearchSwarm", { enumerable: true, get: function () { return research_swarm_js_1.ResearchSwarm; } });
// Cognitive Assembly Line - Planning Swarm
var planning_swarm_js_1 = require("./agents/planning_swarm.js");
Object.defineProperty(exports, "Prometheus", { enumerable: true, get: function () { return planning_swarm_js_1.Prometheus; } });
Object.defineProperty(exports, "Metis", { enumerable: true, get: function () { return planning_swarm_js_1.Metis; } });
Object.defineProperty(exports, "Themis", { enumerable: true, get: function () { return planning_swarm_js_1.Themis; } });
Object.defineProperty(exports, "Apollo", { enumerable: true, get: function () { return planning_swarm_js_1.Apollo; } });
Object.defineProperty(exports, "PlanningSwarm", { enumerable: true, get: function () { return planning_swarm_js_1.PlanningSwarm; } });
// Cognitive Assembly Line - Validation Superlayer
var validation_layer_js_1 = require("./agents/validation_layer.js");
Object.defineProperty(exports, "Zeus", { enumerable: true, get: function () { return validation_layer_js_1.Zeus; } });
Object.defineProperty(exports, "Aegis", { enumerable: true, get: function () { return validation_layer_js_1.Aegis; } });
Object.defineProperty(exports, "Hephaestus", { enumerable: true, get: function () { return validation_layer_js_1.Hephaestus; } });
Object.defineProperty(exports, "Chronos", { enumerable: true, get: function () { return validation_layer_js_1.Chronos; } });
Object.defineProperty(exports, "Nemesis", { enumerable: true, get: function () { return validation_layer_js_1.Nemesis; } });
Object.defineProperty(exports, "ValidationSuperlayer", { enumerable: true, get: function () { return validation_layer_js_1.ValidationSuperlayer; } });
// Cognitive Assembly Line - Execution Layer
var execution_layer_js_1 = require("./agents/execution_layer.js");
Object.defineProperty(exports, "Atlas", { enumerable: true, get: function () { return execution_layer_js_1.Atlas; } });
Object.defineProperty(exports, "Iris", { enumerable: true, get: function () { return execution_layer_js_1.Iris; } });
Object.defineProperty(exports, "Hades", { enumerable: true, get: function () { return execution_layer_js_1.Hades; } });
Object.defineProperty(exports, "Janus", { enumerable: true, get: function () { return execution_layer_js_1.Janus; } });
Object.defineProperty(exports, "Asclepius", { enumerable: true, get: function () { return execution_layer_js_1.Asclepius; } });
Object.defineProperty(exports, "ExecutionLayer", { enumerable: true, get: function () { return execution_layer_js_1.ExecutionLayer; } });
// Git utilities
var GitOrchestrator_js_1 = require("./git/GitOrchestrator.js");
Object.defineProperty(exports, "GitOrchestrator", { enumerable: true, get: function () { return GitOrchestrator_js_1.GitOrchestrator; } });
var GitConflictResolver_js_1 = require("./git/GitConflictResolver.js");
Object.defineProperty(exports, "GitConflictResolver", { enumerable: true, get: function () { return GitConflictResolver_js_1.GitConflictResolver; } });
var GitPolicyEnforcer_js_1 = require("./git/GitPolicyEnforcer.js");
Object.defineProperty(exports, "GitPolicyEnforcer", { enumerable: true, get: function () { return GitPolicyEnforcer_js_1.GitPolicyEnforcer; } });
// Exec utilities
var exec_js_1 = require("./utils/exec.js");
Object.defineProperty(exports, "execAsync", { enumerable: true, get: function () { return exec_js_1.execAsync; } });
Object.defineProperty(exports, "runCommand", { enumerable: true, get: function () { return exec_js_1.runCommand; } });
Object.defineProperty(exports, "runParallelCommands", { enumerable: true, get: function () { return exec_js_1.runParallelCommands; } });
Object.defineProperty(exports, "runWithRetry", { enumerable: true, get: function () { return exec_js_1.runWithRetry; } });
Object.defineProperty(exports, "commandExists", { enumerable: true, get: function () { return exec_js_1.commandExists; } });
Object.defineProperty(exports, "withTempFile", { enumerable: true, get: function () { return exec_js_1.withTempFile; } });
Object.defineProperty(exports, "CommandQueue", { enumerable: true, get: function () { return exec_js_1.CommandQueue; } });
// Skill system
var skill_loader_js_1 = require("./utils/skill-loader.js");
Object.defineProperty(exports, "discoverSkills", { enumerable: true, get: function () { return skill_loader_js_1.discoverSkills; } });
Object.defineProperty(exports, "matchSkills", { enumerable: true, get: function () { return skill_loader_js_1.matchSkills; } });
Object.defineProperty(exports, "resolveDependencies", { enumerable: true, get: function () { return skill_loader_js_1.resolveDependencies; } });
Object.defineProperty(exports, "startSkillMCPs", { enumerable: true, get: function () { return skill_loader_js_1.startSkillMCPs; } });
Object.defineProperty(exports, "stopSkillMCPs", { enumerable: true, get: function () { return skill_loader_js_1.stopSkillMCPs; } });
Object.defineProperty(exports, "getSkillPromptInjection", { enumerable: true, get: function () { return skill_loader_js_1.getSkillPromptInjection; } });
Object.defineProperty(exports, "getSkillPermissions", { enumerable: true, get: function () { return skill_loader_js_1.getSkillPermissions; } });
Object.defineProperty(exports, "getSkillHealth", { enumerable: true, get: function () { return skill_loader_js_1.getSkillHealth; } });
var skill_schema_js_1 = require("./utils/skill-schema.js");
Object.defineProperty(exports, "validateSkillManifest", { enumerable: true, get: function () { return skill_schema_js_1.validateSkillManifest; } });
// Context-Aware Routing v2
var ast_scanner_js_1 = require("./utils/ast-scanner.js");
Object.defineProperty(exports, "scanPaths", { enumerable: true, get: function () { return ast_scanner_js_1.scanPaths; } });
var intent_classifier_js_1 = require("./utils/intent-classifier.js");
Object.defineProperty(exports, "classifyIntent", { enumerable: true, get: function () { return intent_classifier_js_1.classifyIntent; } });
var agent_scorer_js_1 = require("./utils/agent-scorer.js");
Object.defineProperty(exports, "scoreAgents", { enumerable: true, get: function () { return agent_scorer_js_1.scoreAgents; } });
var routing_feedback_js_1 = require("./utils/routing-feedback.js");
Object.defineProperty(exports, "updateRoutingWeights", { enumerable: true, get: function () { return routing_feedback_js_1.updateRoutingWeights; } });
Object.defineProperty(exports, "syncWeightsFromTelemetry", { enumerable: true, get: function () { return routing_feedback_js_1.syncWeightsFromTelemetry; } });
var router_v2_js_1 = require("./utils/router-v2.js");
Object.defineProperty(exports, "routeTaskV2", { enumerable: true, get: function () { return router_v2_js_1.routeTaskV2; } });
// CLI Tools
var sin_skills_js_1 = require("./tools/sin-skills.js");
Object.defineProperty(exports, "SinSkillsCLI", { enumerable: true, get: function () { return sin_skills_js_1.SinSkillsCLI; } });
Object.defineProperty(exports, "sinSkillsCLI", { enumerable: true, get: function () { return sin_skills_js_1.sinSkillsCLI; } });
var sin_route_debug_js_1 = require("./tools/sin-route-debug.js");
Object.defineProperty(exports, "SinRouteDebug", { enumerable: true, get: function () { return sin_route_debug_js_1.SinRouteDebug; } });
Object.defineProperty(exports, "sinRouteDebug", { enumerable: true, get: function () { return sin_route_debug_js_1.sinRouteDebug; } });
// Health server
var HealthServer_js_1 = require("./health/HealthServer.js");
Object.defineProperty(exports, "HealthServer", { enumerable: true, get: function () { return HealthServer_js_1.HealthServer; } });
// Advanced Features
var features_js_1 = require("./advanced/features.js");
Object.defineProperty(exports, "DynamicSkillInjector", { enumerable: true, get: function () { return features_js_1.DynamicSkillInjector; } });
Object.defineProperty(exports, "skillInjector", { enumerable: true, get: function () { return features_js_1.skillInjector; } });
Object.defineProperty(exports, "ContextAwareRouter", { enumerable: true, get: function () { return features_js_1.ContextAwareRouter; } });
Object.defineProperty(exports, "contextRouter", { enumerable: true, get: function () { return features_js_1.contextRouter; } });
Object.defineProperty(exports, "SelfHealingExecutor", { enumerable: true, get: function () { return features_js_1.SelfHealingExecutor; } });
Object.defineProperty(exports, "selfHealingExecutor", { enumerable: true, get: function () { return features_js_1.selfHealingExecutorInstance; } });
Object.defineProperty(exports, "MultiModalVerifier", { enumerable: true, get: function () { return features_js_1.MultiModalVerifier; } });
Object.defineProperty(exports, "StateCheckpointManager", { enumerable: true, get: function () { return features_js_1.StateCheckpointManager; } });
Object.defineProperty(exports, "AdvancedFeatures", { enumerable: true, get: function () { return features_js_1.AdvancedFeatures; } });
// New Advanced Modules
var sin_hash_edit_js_1 = require("./tools/sin_hash_edit.js");
Object.defineProperty(exports, "SinHashEdit", { enumerable: true, get: function () { return sin_hash_edit_js_1.SinHashEdit; } });
Object.defineProperty(exports, "sinHashEdit", { enumerable: true, get: function () { return sin_hash_edit_js_1.sinHashEdit; } });
Object.defineProperty(exports, "HASH_EDIT_CLI_HELP", { enumerable: true, get: function () { return sin_hash_edit_js_1.CLI_HELP; } });
// Telemetry & Monitoring
var telemetry_js_1 = require("./advanced/telemetry.js");
Object.defineProperty(exports, "PrometheusExporter", { enumerable: true, get: function () { return telemetry_js_1.PrometheusExporter; } });
Object.defineProperty(exports, "GrafanaDashboardGenerator", { enumerable: true, get: function () { return telemetry_js_1.GrafanaDashboardGenerator; } });
Object.defineProperty(exports, "FleetSync", { enumerable: true, get: function () { return telemetry_js_1.FleetSync; } });
Object.defineProperty(exports, "TelemetryModule", { enumerable: true, get: function () { return telemetry_js_1.TelemetryModule; } });
// Self-Healing v2
var checkpoint_manager_v2_js_1 = require("./utils/checkpoint-manager-v2.js");
Object.defineProperty(exports, "createCheckpoint", { enumerable: true, get: function () { return checkpoint_manager_v2_js_1.createCheckpoint; } });
Object.defineProperty(exports, "restoreCheckpoint", { enumerable: true, get: function () { return checkpoint_manager_v2_js_1.restoreCheckpoint; } });
Object.defineProperty(exports, "rollbackPartial", { enumerable: true, get: function () { return checkpoint_manager_v2_js_1.rollbackPartial; } });
Object.defineProperty(exports, "cleanupCheckpoints", { enumerable: true, get: function () { return checkpoint_manager_v2_js_1.cleanupCheckpoints; } });
var failure_classifier_v2_js_1 = require("./utils/failure-classifier-v2.js");
Object.defineProperty(exports, "classifyFailureV2", { enumerable: true, get: function () { return failure_classifier_v2_js_1.classifyFailureV2; } });
var healing_strategies_js_1 = require("./utils/healing-strategies.js");
Object.defineProperty(exports, "STRATEGY_MAP", { enumerable: true, get: function () { return healing_strategies_js_1.STRATEGY_MAP; } });
Object.defineProperty(exports, "runLspAutoFix", { enumerable: true, get: function () { return healing_strategies_js_1.runLspAutoFix; } });
Object.defineProperty(exports, "runDepReinstall", { enumerable: true, get: function () { return healing_strategies_js_1.runDepReinstall; } });
Object.defineProperty(exports, "runTestDebugRerun", { enumerable: true, get: function () { return healing_strategies_js_1.runTestDebugRerun; } });
Object.defineProperty(exports, "runScopeSplit", { enumerable: true, get: function () { return healing_strategies_js_1.runScopeSplit; } });
var healing_learner_js_1 = require("./utils/healing-learner.js");
Object.defineProperty(exports, "loadMatrix", { enumerable: true, get: function () { return healing_learner_js_1.loadMatrix; } });
Object.defineProperty(exports, "updateMatrix", { enumerable: true, get: function () { return healing_learner_js_1.updateMatrix; } });
Object.defineProperty(exports, "recommendStrategy", { enumerable: true, get: function () { return healing_learner_js_1.recommendStrategy; } });
var healing_loop_v2_js_1 = require("./utils/healing-loop-v2.js");
Object.defineProperty(exports, "initHealingLoopV2", { enumerable: true, get: function () { return healing_loop_v2_js_1.initHealingLoopV2; } });
Object.defineProperty(exports, "executeHealingStepV2", { enumerable: true, get: function () { return healing_loop_v2_js_1.executeHealingStepV2; } });
Object.defineProperty(exports, "calculateDynamicBudget", { enumerable: true, get: function () { return healing_loop_v2_js_1.calculateDynamicBudget; } });
var sin_healing_debug_v2_js_1 = require("./tools/sin-healing-debug-v2.js");
Object.defineProperty(exports, "SinHealingDebugV2", { enumerable: true, get: function () { return sin_healing_debug_v2_js_1.SinHealingDebugV2; } });
Object.defineProperty(exports, "sinHealingDebugV2", { enumerable: true, get: function () { return sin_healing_debug_v2_js_1.sinHealingDebugV2; } });
// Multi-Modal Verification v2
var verification_gate_v2_js_1 = require("./utils/verification-gate-v2.js");
Object.defineProperty(exports, "runVerificationGateV2", { enumerable: true, get: function () { return verification_gate_v2_js_1.runVerificationGateV2; } });
var verifier_ui_v2_js_1 = require("./utils/verifier-ui-v2.js");
Object.defineProperty(exports, "diffUIV2", { enumerable: true, get: function () { return verifier_ui_v2_js_1.diffUIV2; } });
Object.defineProperty(exports, "captureDOMStructure", { enumerable: true, get: function () { return verifier_ui_v2_js_1.captureDOMStructure; } });
var verifier_tests_v2_js_1 = require("./utils/verifier-tests-v2.js");
Object.defineProperty(exports, "runTestsV2", { enumerable: true, get: function () { return verifier_tests_v2_js_1.runTestsV2; } });
var verifier_lsp_v2_js_1 = require("./utils/verifier-lsp-v2.js");
Object.defineProperty(exports, "runLSPV2", { enumerable: true, get: function () { return verifier_lsp_v2_js_1.runLSPV2; } });
var sin_verify_debug_js_1 = require("./tools/sin-verify-debug.js");
Object.defineProperty(exports, "SinVerifyDebug", { enumerable: true, get: function () { return sin_verify_debug_js_1.SinVerifyDebug; } });
Object.defineProperty(exports, "sinVerifyDebug", { enumerable: true, get: function () { return sin_verify_debug_js_1.sinVerifyDebug; } });
// Deterministic Checkpointing v2
var checkpoint_state_js_1 = require("./utils/checkpoint-state.js");
Object.defineProperty(exports, "serializeState", { enumerable: true, get: function () { return checkpoint_state_js_1.serializeState; } });
Object.defineProperty(exports, "deserializeState", { enumerable: true, get: function () { return checkpoint_state_js_1.deserializeState; } });
var checkpoint_storage_js_1 = require("./utils/checkpoint-storage.js");
Object.defineProperty(exports, "saveCheckpoint", { enumerable: true, get: function () { return checkpoint_storage_js_1.saveCheckpoint; } });
Object.defineProperty(exports, "loadCheckpoint", { enumerable: true, get: function () { return checkpoint_storage_js_1.loadCheckpoint; } });
Object.defineProperty(exports, "listCheckpoints", { enumerable: true, get: function () { return checkpoint_storage_js_1.listCheckpoints; } });
Object.defineProperty(exports, "cleanupStaleCheckpoints", { enumerable: true, get: function () { return checkpoint_storage_js_1.cleanupStaleCheckpoints; } });
var checkpoint_resume_js_1 = require("./utils/checkpoint-resume.js");
Object.defineProperty(exports, "prepareResume", { enumerable: true, get: function () { return checkpoint_resume_js_1.prepareResume; } });
var sin_resume_js_1 = require("./tools/sin-resume.js");
Object.defineProperty(exports, "SinResumeCLI", { enumerable: true, get: function () { return sin_resume_js_1.SinResumeCLI; } });
Object.defineProperty(exports, "sinResumeCLI", { enumerable: true, get: function () { return sin_resume_js_1.sinResumeCLI; } });
// Tri-Temple Audit & Fabric Controller
var audit_verify_js_1 = require("./utils/audit-verify.js");
Object.defineProperty(exports, "verifyChain", { enumerable: true, get: function () { return audit_verify_js_1.verifyChain; } });
Object.defineProperty(exports, "verifyHMAC", { enumerable: true, get: function () { return audit_verify_js_1.verifyHMAC; } });
Object.defineProperty(exports, "computeHash", { enumerable: true, get: function () { return audit_verify_js_1.computeHash; } });
Object.defineProperty(exports, "loadChain", { enumerable: true, get: function () { return audit_verify_js_1.loadChain; } });
Object.defineProperty(exports, "generateBoardReport", { enumerable: true, get: function () { return audit_verify_js_1.generateBoardReport; } });
Object.defineProperty(exports, "formatBoardReport", { enumerable: true, get: function () { return audit_verify_js_1.formatBoardReport; } });
Object.defineProperty(exports, "runAuditVerify", { enumerable: true, get: function () { return audit_verify_js_1.runAuditVerify; } });
Object.defineProperty(exports, "watchAuditChain", { enumerable: true, get: function () { return audit_verify_js_1.watchAuditChain; } });
Object.defineProperty(exports, "appendAuditEntry", { enumerable: true, get: function () { return audit_verify_js_1.appendAuditEntry; } });
Object.defineProperty(exports, "getTelemetryMetrics", { enumerable: true, get: function () { return audit_verify_js_1.getTelemetryMetrics; } });
Object.defineProperty(exports, "parseArgs", { enumerable: true, get: function () { return audit_verify_js_1.parseArgs; } });
var fabric_controller_js_1 = require("./utils/fabric-controller.js");
Object.defineProperty(exports, "loadFabricState", { enumerable: true, get: function () { return fabric_controller_js_1.loadFabricState; } });
Object.defineProperty(exports, "saveFabricState", { enumerable: true, get: function () { return fabric_controller_js_1.saveFabricState; } });
Object.defineProperty(exports, "safeRun", { enumerable: true, get: function () { return fabric_controller_js_1.safeRun; } });
Object.defineProperty(exports, "BudgetAllocator", { enumerable: true, get: function () { return fabric_controller_js_1.BudgetAllocator; } });
Object.defineProperty(exports, "RiskController", { enumerable: true, get: function () { return fabric_controller_js_1.RiskController; } });
Object.defineProperty(exports, "PortfolioScheduler", { enumerable: true, get: function () { return fabric_controller_js_1.PortfolioScheduler; } });
Object.defineProperty(exports, "CrossTempleRouter", { enumerable: true, get: function () { return fabric_controller_js_1.CrossTempleRouter; } });
Object.defineProperty(exports, "runFabricController", { enumerable: true, get: function () { return fabric_controller_js_1.runFabricController; } });
// SIN Fabric World - CRDT Sync & Bootstrap
var sin_fabric_world_sync_js_1 = require("./tools/sin-fabric-world-sync.js");
Object.defineProperty(exports, "SinFabricWorldSync", { enumerable: true, get: function () { return sin_fabric_world_sync_js_1.SinFabricWorldSync; } });
Object.defineProperty(exports, "sinFabricWorldSync", { enumerable: true, get: function () { return sin_fabric_world_sync_js_1.sinFabricWorldSync; } });
Object.defineProperty(exports, "discoverFleet", { enumerable: true, get: function () { return sin_fabric_world_sync_js_1.discoverFleet; } });
Object.defineProperty(exports, "reconcileBlackboard", { enumerable: true, get: function () { return sin_fabric_world_sync_js_1.reconcileBlackboard; } });
Object.defineProperty(exports, "aggregateAuditChains", { enumerable: true, get: function () { return sin_fabric_world_sync_js_1.aggregateAuditChains; } });
Object.defineProperty(exports, "propagatePatterns", { enumerable: true, get: function () { return sin_fabric_world_sync_js_1.propagatePatterns; } });
Object.defineProperty(exports, "broadcastToFleet", { enumerable: true, get: function () { return sin_fabric_world_sync_js_1.broadcastToFleet; } });
var sin_fabric_world_init_js_1 = require("./tools/sin-fabric-world-init.js");
Object.defineProperty(exports, "SinFabricWorldInit", { enumerable: true, get: function () { return sin_fabric_world_init_js_1.SinFabricWorldInit; } });
Object.defineProperty(exports, "sinFabricWorldInit", { enumerable: true, get: function () { return sin_fabric_world_init_js_1.sinFabricWorldInit; } });
Object.defineProperty(exports, "initDirectories", { enumerable: true, get: function () { return sin_fabric_world_init_js_1.initDirectories; } });
Object.defineProperty(exports, "initAuditChain", { enumerable: true, get: function () { return sin_fabric_world_init_js_1.initAuditChain; } });
Object.defineProperty(exports, "initPatternSeed", { enumerable: true, get: function () { return sin_fabric_world_init_js_1.initPatternSeed; } });
Object.defineProperty(exports, "initFleetSSH", { enumerable: true, get: function () { return sin_fabric_world_init_js_1.initFleetSSH; } });
Object.defineProperty(exports, "initDashboardAutoStart", { enumerable: true, get: function () { return sin_fabric_world_init_js_1.initDashboardAutoStart; } });
var sin_fabric_dashboard_js_1 = require("./tools/sin-fabric-dashboard.js");
Object.defineProperty(exports, "SinFabricDashboard", { enumerable: true, get: function () { return sin_fabric_dashboard_js_1.SinFabricDashboard; } });
Object.defineProperty(exports, "sinFabricDashboard", { enumerable: true, get: function () { return sin_fabric_dashboard_js_1.sinFabricDashboard; } });
// Planet Router - Cross-Planet Dispatch
var sin_planet_router_js_1 = require("./bin/sin-planet-router.js");
Object.defineProperty(exports, "analyzeDomain", { enumerable: true, get: function () { return sin_planet_router_js_1.analyzeDomain; } });
Object.defineProperty(exports, "evaluateConstraints", { enumerable: true, get: function () { return sin_planet_router_js_1.evaluateConstraints; } });
Object.defineProperty(exports, "enforceGravityPolicy", { enumerable: true, get: function () { return sin_planet_router_js_1.enforceGravityPolicy; } });
Object.defineProperty(exports, "dispatchCrossPlanet", { enumerable: true, get: function () { return sin_planet_router_js_1.dispatchCrossPlanet; } });
// Galaxy Core - Event Horizon Engine
var sin_galaxy_core_js_1 = require("./bin/sin-galaxy-core.js");
Object.defineProperty(exports, "aggregateTelemetry", { enumerable: true, get: function () { return sin_galaxy_core_js_1.aggregateTelemetry; } });
Object.defineProperty(exports, "macroConsensus", { enumerable: true, get: function () { return sin_galaxy_core_js_1.macroConsensus; } });
Object.defineProperty(exports, "gravitationalRoute", { enumerable: true, get: function () { return sin_galaxy_core_js_1.gravitationalRoute; } });
Object.defineProperty(exports, "supernovaFallback", { enumerable: true, get: function () { return sin_galaxy_core_js_1.supernovaFallback; } });
// Galaxy Manifest Generator
var sin_galaxy_manifest_gen_js_1 = require("./bin/sin-galaxy-manifest-gen.js");
Object.defineProperty(exports, "loadGalaxyManifest", { enumerable: true, get: function () { return sin_galaxy_manifest_gen_js_1.loadJSON; } });
Object.defineProperty(exports, "SinGalaxyManifestGen", { enumerable: true, get: function () { return sin_galaxy_manifest_gen_js_1.SinGalaxyManifestGen; } });
// Enterprise Swarm Core - Issue #12
var PolicyEngine_js_1 = require("./core/PolicyEngine.js");
Object.defineProperty(exports, "PolicyEngine", { enumerable: true, get: function () { return PolicyEngine_js_1.PolicyEngine; } });
Object.defineProperty(exports, "getPolicyEngine", { enumerable: true, get: function () { return PolicyEngine_js_1.getPolicyEngine; } });
var SigstoreSigner_js_1 = require("./core/SigstoreSigner.js");
Object.defineProperty(exports, "SigstoreSigner", { enumerable: true, get: function () { return SigstoreSigner_js_1.SigstoreSigner; } });
Object.defineProperty(exports, "getSigstoreSigner", { enumerable: true, get: function () { return SigstoreSigner_js_1.getSigstoreSigner; } });
var NATSMessageBus_js_1 = require("./core/NATSMessageBus.js");
Object.defineProperty(exports, "NATSMessageBus", { enumerable: true, get: function () { return NATSMessageBus_js_1.NATSMessageBus; } });
Object.defineProperty(exports, "getNATSMessageBus", { enumerable: true, get: function () { return NATSMessageBus_js_1.getNATSMessageBus; } });
var DAGTaskScheduler_js_1 = require("./core/DAGTaskScheduler.js");
Object.defineProperty(exports, "DAGTaskScheduler", { enumerable: true, get: function () { return DAGTaskScheduler_js_1.DAGTaskScheduler; } });
Object.defineProperty(exports, "getDAGTaskScheduler", { enumerable: true, get: function () { return DAGTaskScheduler_js_1.getDAGTaskScheduler; } });
// CRDT State Store - Issue #13
var CRDTStateStore_js_1 = require("./core/CRDTStateStore.js");
Object.defineProperty(exports, "CRDTStateStore", { enumerable: true, get: function () { return CRDTStateStore_js_1.CRDTStateStore; } });
Object.defineProperty(exports, "CRDTStoreFactory", { enumerable: true, get: function () { return CRDTStateStore_js_1.CRDTStoreFactory; } });
Object.defineProperty(exports, "getCRDTFactory", { enumerable: true, get: function () { return CRDTStateStore_js_1.getCRDTFactory; } });
Object.defineProperty(exports, "getSessionStore", { enumerable: true, get: function () { return CRDTStateStore_js_1.getSessionStore; } });
// Telemetry Manager - Issue #13
var TelemetryManager_js_1 = require("./core/TelemetryManager.js");
Object.defineProperty(exports, "TelemetryManager", { enumerable: true, get: function () { return TelemetryManager_js_1.TelemetryManager; } });
Object.defineProperty(exports, "getTelemetryManager", { enumerable: true, get: function () { return TelemetryManager_js_1.getTelemetryManager; } });
Object.defineProperty(exports, "traced", { enumerable: true, get: function () { return TelemetryManager_js_1.traced; } });
// Chaos Engine - Issue #13
var ChaosEngine_js_1 = require("./core/ChaosEngine.js");
Object.defineProperty(exports, "ChaosEngine", { enumerable: true, get: function () { return ChaosEngine_js_1.ChaosEngine; } });
Object.defineProperty(exports, "getChaosEngine", { enumerable: true, get: function () { return ChaosEngine_js_1.getChaosEngine; } });
Object.defineProperty(exports, "runChaosCLI", { enumerable: true, get: function () { return ChaosEngine_js_1.runChaosCLI; } });
Object.defineProperty(exports, "ChaosScenarios", { enumerable: true, get: function () { return ChaosEngine_js_1.ChaosScenarios; } });
// State Machine
var state_machine_js_1 = require("./advanced/state_machine.js");
Object.defineProperty(exports, "NativeStateMachine", { enumerable: true, get: function () { return state_machine_js_1.NativeStateMachine; } });
Object.defineProperty(exports, "TaskQueueManager", { enumerable: true, get: function () { return state_machine_js_1.TaskQueueManager; } });
Object.defineProperty(exports, "StateMachineModule", { enumerable: true, get: function () { return state_machine_js_1.StateMachineModule; } });
// Types
__exportStar(require("./types/index.js"), exports);
/**
 * Create a pre-configured orchestrator with all built-in agents
 */
function createDefaultOrchestrator() {
    const orchestrator = new AgentOrchestrator_js_1.AgentOrchestrator();
    // Register built-in agents
    orchestrator.register(new sin_delegate_js_1.SinDelegate());
    orchestrator.register(new sin_swarm_js_1.SinSwarm());
    orchestrator.register(new sin_monitor_js_1.SinMonitor());
    return orchestrator;
}
/**
 * Framework version
 */
exports.VERSION = '1.0.0';
/**
 * Framework name
 */
exports.FRAMEWORK_NAME = 'oh-my-open-sin';
//# sourceMappingURL=index.js.map