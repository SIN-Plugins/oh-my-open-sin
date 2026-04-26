"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.runCrossAgentCritique = runCrossAgentCritique;
exports.fuseResults = fuseResults;
exports.runDebateLoop = runDebateLoop;
const telemetry_1 = require("./telemetry");
const swarm_coordinator_1 = require("./swarm-coordinator");
const swarm_memory_1 = require("./swarm-memory");
async function runCrossAgentCritique(sessionId, artifact, critics) {
    const results = [];
    for (const critic of critics) {
        // Native task spawn for critique - placeholder for actual OpenCode task() call
        // In real integration: const critiqueTask = await task({ subagent_type: critic, ... })
        (0, telemetry_1.structuredLog)("info", "swarm_critique_spawned", { session_id: sessionId, critic });
        // Simulated result structure - real implementation would parse task output
        results.push({
            agent: critic,
            score: 0.8,
            issues: [],
            suggestion: "approved",
            ts: Date.now()
        });
    }
    (0, telemetry_1.structuredLog)("info", "swarm_critique_complete", {
        session_id: sessionId,
        critics: critics.length,
        avg_score: results.reduce((a, r) => a + r.score, 0) / results.length
    });
    return results;
}
async function fuseResults(sessionId, results, strategy = "consensus") {
    if (strategy === "best_score") {
        return results.sort((a, b) => (b.score || 0) - (a.score || 0))[0];
    }
    if (strategy === "merge") {
        const merged = {};
        for (const r of results)
            Object.assign(merged, r);
        return merged;
    }
    // Consensus via voting
    for (const r of results) {
        (0, swarm_coordinator_1.castConsensusVote)(sessionId, r.agent || "unknown", JSON.stringify(r), r.score || 0.5);
    }
    const consensus = (0, swarm_coordinator_1.getConsensus)(sessionId, 0.7);
    (0, telemetry_1.structuredLog)("info", "swarm_fusion", { session_id: sessionId, strategy, agreed: consensus.agreed, decision: consensus.decision.slice(0, 100) });
    return consensus.agreed ? JSON.parse(consensus.decision) : results[0];
}
async function runDebateLoop(sessionId, topic, agents, maxRounds = 3) {
    let currentTopic = topic;
    for (let round = 1; round <= maxRounds; round++) {
        const critiques = await runCrossAgentCritique(sessionId, { topic: currentTopic }, agents);
        const avgScore = critiques.reduce((a, c) => a + c.score, 0) / critiques.length;
        if (avgScore >= 0.85)
            break; // Consensus reached
        currentTopic = critiques.sort((a, b) => b.score - a.score)[0].suggestion;
        await (0, swarm_memory_1.writeBlackboard)(`debate_round_${round}`, { topic: currentTopic, scores: critiques.map(c => ({ agent: c.agent, score: c.score })) }, "swarm_debate");
    }
    (0, telemetry_1.structuredLog)("info", "swarm_debate_complete", { session_id: sessionId, rounds: maxRounds, final_topic: currentTopic.slice(0, 100) });
    return currentTopic;
}
//# sourceMappingURL=swarm-collaboration.js.map