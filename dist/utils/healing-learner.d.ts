export interface MatrixEntry {
    attempts: number;
    successes: number;
    success_rate: number;
    last_used: number;
}
export declare function loadMatrix(): Promise<Record<string, Record<string, MatrixEntry>>>;
export declare function updateMatrix(failureType: string, strategy: string, success: boolean): Promise<void>;
export declare function recommendStrategy(failureType: string, matrix: Record<string, Record<string, MatrixEntry>>): string;
//# sourceMappingURL=healing-learner.d.ts.map