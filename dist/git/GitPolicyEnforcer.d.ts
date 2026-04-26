export interface PolicyConfig {
    requireTests: boolean;
    requireLinting: boolean;
    maxFileSize?: number;
    allowedFileExtensions?: string[];
    requireCommitMessageFormat: boolean;
    protectedBranches: string[];
    requireCodeReview: boolean;
    minApprovals: number;
}
export interface PolicyViolation {
    type: 'file' | 'commit' | 'branch' | 'test' | 'lint';
    severity: 'error' | 'warning' | 'info';
    message: string;
    file?: string;
    suggestion?: string;
}
export interface PolicyResult {
    passed: boolean;
    violations: PolicyViolation[];
    warnings: PolicyViolation[];
}
/**
 * GitPolicyEnforcer - Erzwingt Git-Richtlinien für sichere Commits
 * Teil des oh-my-open-sin Frameworks
 */
export declare class GitPolicyEnforcer {
    private worktreePath;
    private config;
    constructor(worktreePath: string, config?: Partial<PolicyConfig>);
    /**
     * Validiert alle Richtlinien vor einem Commit
     */
    validateAll(): Promise<PolicyResult>;
    /**
     * Validiert Branch-Schutzrichtlinien
     */
    private validateBranchProtection;
    /**
     * Validiert Commit-Nachrichten-Format
     */
    private validateCommitMessages;
    /**
     * Validiert Dateien (Größe, Extensions)
     */
    private validateFiles;
    /**
     * Validiert dass Tests existieren/laufen
     */
    private validateTests;
    /**
     * Validiert Linting
     */
    private validateLinting;
    /**
     * Installiert Git-Hooks für automatische Richtlinien-Durchsetzung
     */
    installHooks(): Promise<void>;
    /**
     * Generiert Richtlinien-Bericht
     */
    generateReport(): Promise<string>;
    /**
     * Setzt Konfiguration neu
     */
    updateConfig(config: Partial<PolicyConfig>): void;
}
//# sourceMappingURL=GitPolicyEnforcer.d.ts.map