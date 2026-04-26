import { structuredLog } from "./telemetry";
import { castConsensusVote, getConsensus } from "./swarm-coordinator";
import { writeBlackboard, readBlackboard } from "./swarm-memory";

export interface CritiqueResult {
  agent: string;
  score: number; // 0-1
  issues: string[];
  suggestion: string;
  ts: number;
}

export async function runCrossAgentCritique(sessionId: string, artifact: any, critics: string[]): Promise<CritiqueResult[]> {
  const results: CritiqueResult[] = [];
  for (const critic of critics) {
    // Native task spawn for critique - placeholder for actual OpenCode task() call
    // In real integration: const critiqueTask = await task({ subagent_type: critic, ... })
    structuredLog("info", "swarm_critique_spawned", { session_id: sessionId, critic });
    // Simulated result structure - real implementation would parse task output
    results.push({ 
      agent: critic, 
      score: 0.8, 
      issues: [], 
      suggestion: "approved", 
      ts: Date.now() 
    });
  }
  structuredLog("info", "swarm_critique_complete", { 
    session_id: sessionId, 
    critics: critics.length, 
    avg_score: results.reduce((a, r) => a + r.score, 0) / results.length 
  });
  return results;
}

export async function fuseResults(sessionId: string, results: any[], strategy: "consensus" | "best_score" | "merge" = "consensus"): Promise<any> {
  if (strategy === "best_score") {
    return results.sort((a, b) => (b.score || 0) - (a.score || 0))[0];
  }
  if (strategy === "merge") {
    const merged: Record<string, any> = {};
    for (const r of results) Object.assign(merged, r);
    return merged;
  }
  // Consensus via voting
  for (const r of results) {
    castConsensusVote(sessionId, r.agent || "unknown", JSON.stringify(r), r.score || 0.5);
  }
  const consensus = getConsensus(sessionId, 0.7);
  structuredLog("info", "swarm_fusion", { session_id: sessionId, strategy, agreed: consensus.agreed, decision: consensus.decision.slice(0, 100) });
  return consensus.agreed ? JSON.parse(consensus.decision) : results[0];
}

export async function runDebateLoop(sessionId: string, topic: string, agents: string[], maxRounds = 3): Promise<string> {
  let currentTopic = topic;
  for (let round = 1; round <= maxRounds; round++) {
    const critiques = await runCrossAgentCritique(sessionId, { topic: currentTopic }, agents);
    const avgScore = critiques.reduce((a, c) => a + c.score, 0) / critiques.length;
    if (avgScore >= 0.85) break; // Consensus reached
    currentTopic = critiques.sort((a, b) => b.score - a.score)[0].suggestion;
    await writeBlackboard(`debate_round_${round}`, { topic: currentTopic, scores: critiques.map(c => ({ agent: c.agent, score: c.score })) }, "swarm_debate");
  }
  structuredLog("info", "swarm_debate_complete", { session_id: sessionId, rounds: maxRounds, final_topic: currentTopic.slice(0, 100) });
  return currentTopic;
}
