"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateSwarmHealth = updateSwarmHealth;
exports.rebalanceSwarm = rebalanceSwarm;
exports.castConsensusVote = castConsensusVote;
exports.getConsensus = getConsensus;
exports.startDeadlockGuard = startDeadlockGuard;
exports.clearDeadlockGuard = clearDeadlockGuard;
const telemetry_1 = require("./telemetry");
const swarmState = {};
function updateSwarmHealth(sessionId, agent, metrics) {
    if (!swarmState[sessionId])
        swarmState[sessionId] = { health: [], votes: [] };
    const existing = swarmState[sessionId].health.find(h => h.agent === agent);
    const updated = {
        agent,
        score: metrics.score ?? existing?.score ?? 1,
        latency_ms: metrics.latency_ms ?? existing?.latency_ms ?? 0,
        error_rate: metrics.error_rate ?? existing?.error_rate ?? 0,
        budget_consumed_pct: metrics.budget_consumed_pct ?? existing?.budget_consumed_pct ?? 0,
        status: "healthy"
    };
    updated.status = updated.score < 0.4 ? "critical" : updated.score < 0.7 ? "degraded" : "healthy";
    if (existing)
        Object.assign(existing, updated);
    else
        swarmState[sessionId].health.push(updated);
    (0, telemetry_1.structuredLog)("info", "swarm_health_updated", { session_id: sessionId, agent, status: updated.status, score: updated.score });
}
async function rebalanceSwarm(sessionId, failedAgent, availableAgents) {
    const state = swarmState[sessionId];
    if (!state)
        return null;
    const healthy = state.health.filter(h => h.status === "healthy" && availableAgents.includes(h.agent));
    if (healthy.length === 0) {
        (0, telemetry_1.structuredLog)("warn", "swarm_rebalance_failed", { session_id: sessionId, reason: "no_healthy_agents" });
        return null;
    }
    const best = healthy.sort((a, b) => b.score - a.score)[0];
    (0, telemetry_1.structuredLog)("info", "swarm_rebalanced", { session_id: sessionId, from: failedAgent, to: best.agent });
    return best.agent;
}
function castConsensusVote(sessionId, agent, decision, confidence) {
    if (!swarmState[sessionId])
        swarmState[sessionId] = { health: [], votes: [] };
    swarmState[sessionId].votes.push({ agent, decision, confidence, ts: Date.now() });
}
function getConsensus(sessionId, minConfidence = 0.7) {
    const votes = swarmState[sessionId]?.votes || [];
    if (votes.length === 0)
        return { decision: "none", confidence: 0, agreed: false };
    const grouped = {};
    for (const v of votes) {
        if (!grouped[v.decision])
            grouped[v.decision] = { totalConf: 0, count: 0 };
        grouped[v.decision].totalConf += v.confidence;
        grouped[v.decision].count++;
    }
    const best = Object.entries(grouped).sort((a, b) => b[1].totalConf - a[1].totalConf)[0];
    const avgConf = best[1].totalConf / best[1].count;
    const agreed = avgConf >= minConfidence && best[1].count >= Math.ceil(votes.length * 0.6);
    return { decision: best[0], confidence: parseFloat(avgConf.toFixed(2)), agreed };
}
function startDeadlockGuard(sessionId, timeoutMs = 180000, onDeadlock) {
    if (swarmState[sessionId]?.deadlock_timer)
        clearTimeout(swarmState[sessionId].deadlock_timer);
    swarmState[sessionId] = swarmState[sessionId] || { health: [], votes: [] };
    swarmState[sessionId].deadlock_timer = setTimeout(() => {
        (0, telemetry_1.structuredLog)("warn", "swarm_deadlock_detected", { session_id: sessionId, timeout_ms: timeoutMs });
        onDeadlock();
    }, timeoutMs);
}
function clearDeadlockGuard(sessionId) {
    if (swarmState[sessionId]?.deadlock_timer) {
        clearTimeout(swarmState[sessionId].deadlock_timer);
        delete swarmState[sessionId].deadlock_timer;
    }
}
//# sourceMappingURL=swarm-coordinator.js.map