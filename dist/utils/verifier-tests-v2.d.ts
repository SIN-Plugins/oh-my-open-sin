export interface TestResultV2 {
    passed: boolean;
    coverage_pct: number;
    coverage_delta: number;
    failed_tests: string[];
    flaky_tests: string[];
    framework: string;
    raw_output: string;
}
export declare function runTestsV2(testCmd: string, cwd?: string, baselineDir?: string): Promise<TestResultV2>;
//# sourceMappingURL=verifier-tests-v2.d.ts.map