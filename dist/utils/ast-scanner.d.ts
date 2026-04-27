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
export interface SymbolInfo {
    name: string;
    kind: string;
    start: number;
    end: number;
    documentation?: string;
}
/**
 * ASTScanner - Statische Code-Analyse mit TypeScript AST
 */
export declare class ASTScanner {
    /**
     * Analysiert Code und extrahiert Symbole
     */
    scanCode(code: string, filePath?: string): {
        symbols: SymbolInfo[];
        complexity: number;
        dependencies: string[];
        taskType: string;
    };
    /**
     * Erkennt den Task-Typ basierend auf AST-Analyse
     */
    private detectTaskType;
    /**
     * Bestimmt Script-Element-Kind für ein Node
     */
    private getScriptElementKind;
}
export declare function scanPaths(targetPaths: string[]): Promise<CodeMetrics>;
//# sourceMappingURL=ast-scanner.d.ts.map