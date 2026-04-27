import { GitWorktreeConfig } from '../types/index.js';
/**
 * GitOrchestrator - Manages Git operations with worktree isolation and enterprise features
 * Provides safe, isolated branch operations for parallel tasks with:
 * - Policy enforcement for Git operations
 * - Cryptographic commit signing (Sigstore)
 * - Telemetry tracking for Git metrics
 * - Audit logging for compliance
 */
export declare class GitOrchestrator {
    private workspace;
    private worktrees;
    private policyEngine;
    private telemetry;
    private sigstoreSigner;
    constructor(workspace: string);
    /**
     * Get current branch name
     */
    getCurrentBranch(): Promise<string>;
    /**
     * Create a new worktree for isolated operations with policy check
     */
    createWorktree(config: GitWorktreeConfig, sessionId?: string, taskId?: string): Promise<void>;
    /**
     * Remove a worktree
     */
    removeWorktree(branch: string): Promise<void>;
    /**
     * List all active worktrees
     */
    listWorktrees(): GitWorktreeConfig[];
    /**
     * Create a feature branch with standard naming and policy check
     */
    createFeatureBranch(featureName: string, sessionId?: string, taskId?: string): Promise<string>;
    /**
     * Commit changes with conventional commit format and optional Sigstore signing
     */
    commitChanges(message: string, files?: string[], signWithSigstore?: boolean): Promise<void>;
    /**
     * Get latest commit hash
     */
    private getLatestCommitHash;
    /**
     * Push branch to remote with policy check
     */
    pushBranch(branch?: string, setUpstream?: boolean, sessionId?: string, taskId?: string): Promise<void>;
    /**
     * Create a pull request via CLI (requires gh CLI)
     */
    createPullRequest(title: string, body?: string): Promise<string>;
    /**
     * Check for conflicts before merge
     */
    checkConflicts(targetBranch: string): Promise<{
        hasConflicts: boolean;
        details?: string;
    }>;
    /**
     * Cleanup all worktrees
     */
    cleanup(): Promise<void>;
    /**
     * Get orchestrator statistics
     */
    getStats(): any;
}
//# sourceMappingURL=GitOrchestrator.d.ts.map