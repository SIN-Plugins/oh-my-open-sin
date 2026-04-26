export interface StrategyResult {
    success: boolean;
    output: string;
    artifacts: string[];
    strategy: string;
}
export declare function runLspAutoFix(worktree: string, files: string[]): Promise<StrategyResult>;
export declare function runDepReinstall(worktree: string): Promise<StrategyResult>;
export declare function runTestDebugRerun(worktree: string, testCmd: string): Promise<StrategyResult>;
export declare function runScopeSplit(sessionId: string, description: string): Promise<StrategyResult>;
export declare const STRATEGY_MAP: Record<string, (wt: string, ctx: any) => Promise<StrategyResult>>;
//# sourceMappingURL=healing-strategies.d.ts.map