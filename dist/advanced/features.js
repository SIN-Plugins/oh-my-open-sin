"use strict";
/**
 * Advanced Features Module
 * Dynamic Skill Injection, Context-Aware Routing, Self-Healing Execution
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.selfHealingExecutorInstance = exports.contextRouter = exports.skillInjector = exports.AdvancedFeatures = exports.StateCheckpointManager = exports.MultiModalVerifier = exports.SelfHealingExecutor = exports.ContextAwareRouter = exports.DynamicSkillInjector = void 0;
const AgentOrchestrator_1 = require("../core/AgentOrchestrator");
// Dynamic Skill Injection System
class DynamicSkillInjector {
    skills = new Map();
    injectionQueue = [];
    registerSkill(name, skill) {
        this.skills.set(name, skill);
        console.log(`[DynamicSkillInjector] Registered skill: ${name}`);
    }
    async injectSkill(agentName, skillName) {
        const skill = this.skills.get(skillName);
        if (!skill) {
            console.error(`[DynamicSkillInjector] Skill not found: ${skillName}`);
            return false;
        }
        this.injectionQueue.push({ agent: agentName, skill });
        console.log(`[DynamicSkillInjector] Queued injection: ${skillName} -> ${agentName}`);
        return true;
    }
    async processInjectionQueue() {
        while (this.injectionQueue.length > 0) {
            const { agent, skill } = this.injectionQueue.shift();
            await this.performInjection(agent, skill);
        }
    }
    async performInjection(agentName, skill) {
        console.log(`[DynamicSkillInjector] Injecting skill into ${agentName}`);
    }
    getAvailableSkills() {
        return Array.from(this.skills.keys());
    }
}
exports.DynamicSkillInjector = DynamicSkillInjector;
// Context-Aware Routing System
class ContextAwareRouter {
    routingRules = [];
    addRoutingRule(pattern, targetAgent, priority = 1, context) {
        this.routingRules.push({
            pattern: new RegExp(pattern, 'i'),
            targetAgent,
            priority,
            context: context || {}
        });
        this.routingRules.sort((a, b) => b.priority - a.priority);
    }
    async routeTask(task, context) {
        for (const rule of this.routingRules) {
            if (rule.pattern.test(task)) {
                const confidence = await this.calculateConfidence(task, rule, context);
                return { agent: rule.targetAgent, confidence };
            }
        }
        return this.defaultRoute(task, context);
    }
    async calculateConfidence(task, rule, context) {
        const match = task.match(rule.pattern);
        const baseConfidence = match ? match[0].length / task.length : 0.5;
        const contextBonus = context ? 0.1 : 0;
        return Math.min(baseConfidence + contextBonus, 1.0);
    }
    async defaultRoute(task, context) {
        const taskLower = task.toLowerCase();
        if (taskLower.includes('research') || taskLower.includes('analyze')) {
            return { agent: 'athena', confidence: 0.7 };
        }
        if (taskLower.includes('plan') || taskLower.includes('strategy')) {
            return { agent: 'prometheus', confidence: 0.7 };
        }
        if (taskLower.includes('validate') || taskLower.includes('check')) {
            return { agent: 'zeus', confidence: 0.7 };
        }
        if (taskLower.includes('fix') || taskLower.includes('debug')) {
            return { agent: 'hades', confidence: 0.7 };
        }
        if (taskLower.includes('heal') || taskLower.includes('recover')) {
            return { agent: 'asclepius', confidence: 0.7 };
        }
        return { agent: 'sin_delegate', confidence: 0.5 };
    }
    getRoutingRules() {
        return this.routingRules.map(r => ({
            pattern: r.pattern.source,
            target: r.targetAgent,
            priority: r.priority
        }));
    }
}
exports.ContextAwareRouter = ContextAwareRouter;
// Self-Healing Execution Loop
class SelfHealingExecutor {
    orchestrator;
    maxRetries = 3;
    retryDelays = [1000, 5000, 15000];
    healthChecks = [];
    constructor(orchestrator) {
        this.orchestrator = orchestrator;
    }
    addHealthCheck(check) {
        this.healthChecks.push(check);
    }
    async executeWithHealing(agentName, context, input) {
        let lastError = null;
        let retries = 0;
        let healed = false;
        for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
            try {
                const healthy = await this.performHealthCheck();
                if (!healthy && attempt < this.maxRetries) {
                    healed = await this.attemptHealing();
                    if (!healed) {
                        throw new Error('System unhealthy and healing failed');
                    }
                }
                const result = await this.orchestrator.execute(agentName, context, input);
                return { ...result, healed, retries };
            }
            catch (error) {
                lastError = error;
                retries = attempt;
                if (attempt < this.maxRetries) {
                    console.log(`[SelfHealingExecutor] Attempt ${attempt + 1} failed, retrying...`);
                    await this.delay(this.retryDelays[attempt]);
                    healed = await this.attemptHealing();
                }
            }
        }
        return {
            success: false,
            error: lastError?.message || 'Unknown error',
            metadata: { healed, retries, final_failure: true }
        };
    }
    async performHealthCheck() {
        for (const check of this.healthChecks) {
            try {
                if (!await check())
                    return false;
            }
            catch (e) {
                return false;
            }
        }
        return true;
    }
    async attemptHealing() {
        console.log('[SelfHealingExecutor] Attempting system healing...');
        try {
            const mockContext = { sessionId: 'heal', taskId: 'recovery', workspace: '/tmp' };
            const result = await this.orchestrator.execute('asclepius', mockContext, {});
            return result.success;
        }
        catch (e) {
            console.error('[SelfHealingExecutor] Healing failed:', e);
            return false;
        }
    }
    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
    setMaxRetries(max) {
        this.maxRetries = max;
    }
}
exports.SelfHealingExecutor = SelfHealingExecutor;
// Multi-Modal Verification System
class MultiModalVerifier {
    verifiers = [];
    addVerifier(type, verifyFn) {
        this.verifiers.push({ type, verify: verifyFn });
    }
    async verify(data) {
        const results = await Promise.all(this.verifiers.map(async (v) => ({ type: v.type, ...(await v.verify(data)) })));
        const overall_valid = results.every(r => r.valid);
        const confidence = results.reduce((sum, r) => sum + (r.valid ? 1 : 0), 0) / results.length;
        return { overall_valid, results, confidence };
    }
}
exports.MultiModalVerifier = MultiModalVerifier;
// Deterministic State Checkpointing
class StateCheckpointManager {
    checkpoints = new Map();
    checkpointHistory = [];
    createCheckpoint(id, state) {
        const checkpoint = { id, timestamp: Date.now(), state: JSON.parse(JSON.stringify(state)) };
        this.checkpoints.set(id, checkpoint.state);
        this.checkpointHistory.push(checkpoint);
        console.log(`[StateCheckpoint] Created checkpoint: ${id}`);
    }
    restoreCheckpoint(id) {
        const state = this.checkpoints.get(id);
        if (state !== undefined) {
            console.log(`[StateCheckpoint] Restored checkpoint: ${id}`);
            return JSON.parse(JSON.stringify(state));
        }
        console.warn(`[StateCheckpoint] Checkpoint not found: ${id}`);
        return null;
    }
    getCheckpointHistory() {
        return this.checkpointHistory.map(c => ({ id: c.id, timestamp: c.timestamp }));
    }
    clearOlderThan(ageMs) {
        const cutoff = Date.now() - ageMs;
        this.checkpointHistory = this.checkpointHistory.filter(c => c.timestamp > cutoff);
        const validIds = new Set(this.checkpointHistory.map(c => c.id));
        for (const key of this.checkpoints.keys()) {
            if (!validIds.has(key))
                this.checkpoints.delete(key);
        }
    }
}
exports.StateCheckpointManager = StateCheckpointManager;
exports.AdvancedFeatures = {
    DynamicSkillInjector,
    ContextAwareRouter,
    SelfHealingExecutor,
    MultiModalVerifier,
    StateCheckpointManager
};
// Singleton instances for convenience
exports.skillInjector = new DynamicSkillInjector();
exports.contextRouter = new ContextAwareRouter();
exports.selfHealingExecutorInstance = new SelfHealingExecutor(new AgentOrchestrator_1.AgentOrchestrator());
//# sourceMappingURL=features.js.map