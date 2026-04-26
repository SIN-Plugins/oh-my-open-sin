export interface CodeMetrics {
    language: string;
    framework: string[];
    complexity: "low" | "medium" | "high";
    layer: "frontend" | "backend" | "database" | "config" | "test" | "unknown";
    fileCount: number;
    totalLines: number;
    imports: number;
    hasUI: boolean;
    hasDB: boolean;
    hasTests: boolean;
}
export declare function scanPaths(targetPaths: string[]): Promise<CodeMetrics>;
//# sourceMappingURL=ast-scanner.d.ts.map