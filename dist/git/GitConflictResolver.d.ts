export interface ConflictInfo {
    file: string;
    ours: string;
    theirs: string;
    base: string;
    conflictType: 'content' | 'binary' | 'rename';
}
export interface ResolutionStrategy {
    type: 'ours' | 'theirs' | 'manual' | 'merge' | 'hybrid';
    confidence?: number;
    reasoning?: string;
}
/**
 * GitConflictResolver - Intelligente Konfliktlösung für parallele Branches
 * Teil des oh-my-open-sin Frameworks
 */
export declare class GitConflictResolver {
    private worktreePath;
    constructor(worktreePath: string);
    /**
     * Analysiert Konflikte in einem Worktree
     */
    analyzeConflicts(): Promise<ConflictInfo[]>;
    /**
     * Analysiert einen einzelnen Dateikonflikt
     */
    private analyzeFileConflict;
    /**
     * Holt eine spezifische Version einer Datei
     */
    private getFileVersion;
    /**
     * Erkennt den Typ des Konflikts
     */
    private detectConflictType;
    /**
     * Empfiehlt eine Lösungsstrategie basierend auf Konfliktanalyse
     */
    recommendStrategy(conflict: ConflictInfo): Promise<ResolutionStrategy>;
    /**
     * Prüft ob Änderungen komplementär sind
     */
    private areComplementary;
    /**
     * Wendet eine Lösungsstrategie an
     */
    applyResolution(conflict: ConflictInfo, strategy: ResolutionStrategy): Promise<boolean>;
    /**
     * Wendet eine spezifische Version an
     */
    private applyVersion;
    /**
     * Führt automatisches Merge durch
     */
    private autoMerge;
    /**
     * Führt hybrides Merge durch (intelligent kombiniert)
     */
    private hybridMerge;
    /**
     * Schreibt temporäre Datei
     */
    private writeTempFile;
    /**
     * Räumt temporäre Dateien auf
     */
    private cleanupTempFiles;
    /**
     * Löst alle Konflikte automatisch mit empfohlenen Strategien
     */
    resolveAllConflicts(autoApply?: boolean): Promise<{
        resolved: number;
        manual: number;
        failed: number;
    }>;
    /**
     * Generiert Konfliktbericht für Monitoring
     */
    generateConflictReport(): Promise<string>;
}
//# sourceMappingURL=GitConflictResolver.d.ts.map