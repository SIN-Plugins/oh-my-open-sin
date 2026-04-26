export interface CritiqueResult {
    agent: string;
    score: number;
    issues: string[];
    suggestion: string;
    ts: number;
}
export declare function runCrossAgentCritique(sessionId: string, artifact: any, critics: string[]): Promise<CritiqueResult[]>;
export declare function fuseResults(sessionId: string, results: any[], strategy?: "consensus" | "best_score" | "merge"): Promise<any>;
export declare function runDebateLoop(sessionId: string, topic: string, agents: string[], maxRounds?: number): Promise<string>;
//# sourceMappingURL=swarm-collaboration.d.ts.map