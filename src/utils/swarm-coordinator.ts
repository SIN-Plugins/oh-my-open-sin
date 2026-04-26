import { structuredLog } from "./telemetry";

export interface SwarmHealth {
  agent: string;
  score: number; // 0-1
  latency_ms: number;
  error_rate: number;
  budget_consumed_pct: number;
  status: "healthy" | "degraded" | "critical";
}

export interface ConsensusVote {
  agent: string;
  decision: string;
  confidence: number;
  ts: number;
}

const swarmState: Record<string, { health: SwarmHealth[]; votes: ConsensusVote[]; deadlock_timer?: NodeJS.Timeout }> = {};

export function updateSwarmHealth(sessionId: string, agent: string, metrics: Partial<SwarmHealth>) {
  if (!swarmState[sessionId]) swarmState[sessionId] = { health: [], votes: [] };
  const existing = swarmState[sessionId].health.find(h => h.agent === agent);
  const updated: SwarmHealth = {
    agent,
    score: metrics.score ?? existing?.score ?? 1,
    latency_ms: metrics.latency_ms ?? existing?.latency_ms ?? 0,
    error_rate: metrics.error_rate ?? existing?.error_rate ?? 0,
    budget_consumed_pct: metrics.budget_consumed_pct ?? existing?.budget_consumed_pct ?? 0,
    status: "healthy"
  };
  updated.status = updated.score < 0.4 ? "critical" : updated.score < 0.7 ? "degraded" : "healthy";
  
  if (existing) Object.assign(existing, updated);
  else swarmState[sessionId].health.push(updated);

  structuredLog("info", "swarm_health_updated", { session_id: sessionId, agent, status: updated.status, score: updated.score });
}

export async function rebalanceSwarm(sessionId: string, failedAgent: string, availableAgents: string[]): Promise<string | null> {
  const state = swarmState[sessionId];
  if (!state) return null;
  
  const healthy = state.health.filter(h => h.status === "healthy" && availableAgents.includes(h.agent));
  if (healthy.length === 0) {
    structuredLog("warn", "swarm_rebalance_failed", { session_id: sessionId, reason: "no_healthy_agents" });
    return null;
  }
  
  const best = healthy.sort((a, b) => b.score - a.score)[0];
  structuredLog("info", "swarm_rebalanced", { session_id: sessionId, from: failedAgent, to: best.agent });
  return best.agent;
}

export function castConsensusVote(sessionId: string, agent: string, decision: string, confidence: number) {
  if (!swarmState[sessionId]) swarmState[sessionId] = { health: [], votes: [] };
  swarmState[sessionId].votes.push({ agent, decision, confidence, ts: Date.now() });
}

export function getConsensus(sessionId: string, minConfidence = 0.7): { decision: string; confidence: number; agreed: boolean } {
  const votes = swarmState[sessionId]?.votes || [];
  if (votes.length === 0) return { decision: "none", confidence: 0, agreed: false };

  const grouped: Record<string, { totalConf: number; count: number }> = {};
  for (const v of votes) {
    if (!grouped[v.decision]) grouped[v.decision] = { totalConf: 0, count: 0 };
    grouped[v.decision].totalConf += v.confidence;
    grouped[v.decision].count++;
  }

  const best = Object.entries(grouped).sort((a, b) => b[1].totalConf - a[1].totalConf)[0];
  const avgConf = best[1].totalConf / best[1].count;
  const agreed = avgConf >= minConfidence && best[1].count >= Math.ceil(votes.length * 0.6);

  return { decision: best[0], confidence: parseFloat(avgConf.toFixed(2)), agreed };
}

export function startDeadlockGuard(sessionId: string, timeoutMs = 180000, onDeadlock: () => void) {
  if (swarmState[sessionId]?.deadlock_timer) clearTimeout(swarmState[sessionId].deadlock_timer);
  swarmState[sessionId] = swarmState[sessionId] || { health: [], votes: [] };
  swarmState[sessionId].deadlock_timer = setTimeout(() => {
    structuredLog("warn", "swarm_deadlock_detected", { session_id: sessionId, timeout_ms: timeoutMs });
    onDeadlock();
  }, timeoutMs);
}

export function clearDeadlockGuard(sessionId: string) {
  if (swarmState[sessionId]?.deadlock_timer) {
    clearTimeout(swarmState[sessionId].deadlock_timer);
    delete swarmState[sessionId].deadlock_timer;
  }
}
