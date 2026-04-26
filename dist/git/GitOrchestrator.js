"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GitOrchestrator = void 0;
const child_process_1 = require("child_process");
const util_1 = require("util");
const PolicyEngine_js_1 = require("../core/PolicyEngine.js");
const TelemetryManager_js_1 = require("../core/TelemetryManager.js");
const SigstoreSigner_js_1 = require("../core/SigstoreSigner.js");
const execAsync = (0, util_1.promisify)(child_process_1.exec);
/**
 * GitOrchestrator - Manages Git operations with worktree isolation and enterprise features
 * Provides safe, isolated branch operations for parallel tasks with:
 * - Policy enforcement for Git operations
 * - Cryptographic commit signing (Sigstore)
 * - Telemetry tracking for Git metrics
 * - Audit logging for compliance
 */
class GitOrchestrator {
    workspace;
    worktrees = new Map();
    policyEngine;
    telemetry;
    sigstoreSigner;
    constructor(workspace) {
        this.workspace = workspace;
        this.policyEngine = (0, PolicyEngine_js_1.getPolicyEngine)();
        this.telemetry = (0, TelemetryManager_js_1.getTelemetryManager)();
        this.sigstoreSigner = (0, SigstoreSigner_js_1.getSigstoreSigner)();
    }
    /**
     * Get current branch name
     */
    async getCurrentBranch() {
        const startTime = Date.now();
        try {
            const { stdout } = await execAsync('git rev-parse --abbrev-ref HEAD', {
                cwd: this.workspace,
            });
            const branch = stdout.trim();
            this.telemetry.recordEvent('git_operation', {
                operation: 'getCurrentBranch',
                workspace: this.workspace,
                branch,
                duration: Date.now() - startTime
            });
            return branch;
        }
        catch (error) {
            this.telemetry.recordEvent('git_error', {
                operation: 'getCurrentBranch',
                workspace: this.workspace,
                error: error instanceof Error ? error.message : 'Unknown error'
            });
            throw error;
        }
    }
    /**
     * Create a new worktree for isolated operations with policy check
     */
    async createWorktree(config) {
        const startTime = Date.now();
        // Policy check for worktree creation
        const policyCheck = await this.policyEngine.evaluate({
            agentId: 'git-orchestrator',
            action: 'git.worktree.create',
            resource: `branch:${config.branch}`,
            capabilities: ['git', 'worktree'],
            timestamp: Date.now(),
            subject: 'orchestrator',
            context: {
                workspace: this.workspace,
                detached: config.detached,
                path: config.path
            }
        });
        if (!policyCheck.allowed) {
            this.telemetry.recordEvent('git_policy_violation', {
                operation: 'createWorktree',
                branch: config.branch,
                reason: policyCheck.reason
            });
            throw new Error(`Worktree creation blocked by policy: ${policyCheck.reason}`);
        }
        try {
            const args = ['worktree', 'add', '-b', config.branch, config.path];
            if (config.detached) {
                args.splice(2, 0, '--detach');
            }
            await execAsync(`git ${args.join(' ')}`, {
                cwd: this.workspace,
            });
            this.worktrees.set(config.branch, config);
            const duration = Date.now() - startTime;
            this.telemetry.recordEvent('git_operation', {
                operation: 'createWorktree',
                workspace: this.workspace,
                branch: config.branch,
                path: config.path,
                detached: config.detached,
                duration
            });
        }
        catch (error) {
            this.telemetry.recordEvent('git_error', {
                operation: 'createWorktree',
                branch: config.branch,
                workspace: this.workspace,
                error: error instanceof Error ? error.message : 'Unknown error'
            });
            throw error;
        }
    }
    /**
     * Remove a worktree
     */
    async removeWorktree(branch) {
        const worktree = this.worktrees.get(branch);
        if (!worktree) {
            throw new Error(`Worktree for branch "${branch}" not found`);
        }
        const startTime = Date.now();
        try {
            await execAsync(`git worktree remove ${worktree.path}`, {
                cwd: this.workspace,
            });
            this.worktrees.delete(branch);
            this.telemetry.recordEvent('git_operation', {
                operation: 'removeWorktree',
                workspace: this.workspace,
                branch,
                duration: Date.now() - startTime
            });
        }
        catch (error) {
            this.telemetry.recordEvent('git_error', {
                operation: 'removeWorktree',
                branch,
                workspace: this.workspace,
                error: error instanceof Error ? error.message : 'Unknown error'
            });
            throw error;
        }
    }
    /**
     * List all active worktrees
     */
    listWorktrees() {
        return Array.from(this.worktrees.values());
    }
    /**
     * Create a feature branch with standard naming and policy check
     */
    async createFeatureBranch(featureName) {
        const startTime = Date.now();
        // Policy check for branch creation
        const policyCheck = await this.policyEngine.evaluate({
            agentId: 'git-orchestrator',
            action: 'git.branch.create',
            resource: `feature:${featureName}`,
            capabilities: ['git', 'branch'],
            timestamp: Date.now(),
            subject: 'orchestrator',
            context: { workspace: this.workspace }
        });
        if (!policyCheck.allowed) {
            this.telemetry.recordEvent('git_policy_violation', {
                operation: 'createFeatureBranch',
                feature: featureName,
                reason: policyCheck.reason
            });
            throw new Error(`Feature branch creation blocked by policy: ${policyCheck.reason}`);
        }
        const timestamp = Date.now();
        const branchName = `feature/${featureName}-${timestamp}`;
        try {
            await execAsync(`git checkout -b ${branchName}`, {
                cwd: this.workspace,
            });
            this.telemetry.recordEvent('git_operation', {
                operation: 'createFeatureBranch',
                workspace: this.workspace,
                branch: branchName,
                feature: featureName,
                duration: Date.now() - startTime
            });
            return branchName;
        }
        catch (error) {
            this.telemetry.recordEvent('git_error', {
                operation: 'createFeatureBranch',
                feature: featureName,
                workspace: this.workspace,
                error: error instanceof Error ? error.message : 'Unknown error'
            });
            throw error;
        }
    }
    /**
     * Commit changes with conventional commit format and optional Sigstore signing
     */
    async commitChanges(message, files, signWithSigstore = true) {
        const startTime = Date.now();
        try {
            if (files && files.length > 0) {
                await execAsync(`git add ${files.join(' ')}`, {
                    cwd: this.workspace,
                });
            }
            else {
                await execAsync('git add .', {
                    cwd: this.workspace,
                });
            }
            await execAsync(`git commit -m "${message}"`, {
                cwd: this.workspace,
            });
            // Sign commit with Sigstore for provenance
            if (signWithSigstore) {
                const commitHash = await this.getLatestCommitHash();
                const signature = await this.sigstoreSigner.signCommit(commitHash, 'orchestrator', 'orchestrator@sin.local');
                this.telemetry.recordEvent('git_commit_signed', {
                    workspace: this.workspace,
                    commitHash,
                    transparencyLogId: signature.transparencyLogId || 'pending'
                });
            }
            const duration = Date.now() - startTime;
            this.telemetry.recordEvent('git_operation', {
                operation: 'commitChanges',
                workspace: this.workspace,
                message,
                signed: signWithSigstore,
                filesCount: files?.length || 0,
                duration
            });
        }
        catch (error) {
            this.telemetry.recordEvent('git_error', {
                operation: 'commitChanges',
                workspace: this.workspace,
                error: error instanceof Error ? error.message : 'Unknown error'
            });
            throw error;
        }
    }
    /**
     * Get latest commit hash
     */
    async getLatestCommitHash() {
        const { stdout } = await execAsync('git rev-parse HEAD', {
            cwd: this.workspace,
        });
        return stdout.trim();
    }
    /**
     * Push branch to remote with policy check
     */
    async pushBranch(branch, setUpstream = true) {
        const startTime = Date.now();
        const currentBranch = branch || await this.getCurrentBranch();
        // Policy check for push (main branch protection)
        const policyCheck = await this.policyEngine.evaluate({
            agentId: 'git-orchestrator',
            action: 'git.push',
            resource: `branch:${currentBranch}`,
            capabilities: ['git', 'push'],
            timestamp: Date.now(),
            subject: 'orchestrator',
            context: { workspace: this.workspace, setUpstream }
        });
        if (!policyCheck.allowed) {
            this.telemetry.recordEvent('git_policy_violation', {
                operation: 'pushBranch',
                branch: currentBranch,
                reason: policyCheck.reason
            });
            throw new Error(`Push blocked by policy: ${policyCheck.reason}`);
        }
        try {
            const flags = setUpstream ? '-u origin' : '';
            await execAsync(`git push ${flags} origin ${currentBranch}`, {
                cwd: this.workspace,
            });
            const duration = Date.now() - startTime;
            this.telemetry.recordEvent('git_operation', {
                operation: 'pushBranch',
                workspace: this.workspace,
                branch: currentBranch,
                setUpstream,
                duration
            });
        }
        catch (error) {
            this.telemetry.recordEvent('git_error', {
                operation: 'pushBranch',
                branch: currentBranch,
                workspace: this.workspace,
                error: error instanceof Error ? error.message : 'Unknown error'
            });
            throw error;
        }
    }
    /**
     * Create a pull request via CLI (requires gh CLI)
     */
    async createPullRequest(title, body) {
        const startTime = Date.now();
        const branch = await this.getCurrentBranch();
        try {
            const cmd = body
                ? `gh pr create --title \"${title}\" --body \"${body}\"`
                : `gh pr create --title \"${title}\"`;
            const { stdout } = await execAsync(cmd, {
                cwd: this.workspace,
            });
            const prUrl = stdout.trim();
            this.telemetry.recordEvent('git_operation', {
                operation: 'createPullRequest',
                workspace: this.workspace,
                branch,
                title,
                prUrl,
                duration: Date.now() - startTime
            });
            return prUrl;
        }
        catch (error) {
            this.telemetry.recordEvent('git_error', {
                operation: 'createPullRequest',
                branch,
                workspace: this.workspace,
                error: error instanceof Error ? error.message : 'Unknown error'
            });
            throw error;
        }
    }
    /**
     * Check for conflicts before merge
     */
    async checkConflicts(targetBranch) {
        const startTime = Date.now();
        try {
            await execAsync(`git merge-tree $(git merge-base HEAD ${targetBranch}) HEAD ${targetBranch}`, {
                cwd: this.workspace,
            });
            this.telemetry.recordEvent('git_operation', {
                operation: 'checkConflicts',
                workspace: this.workspace,
                targetBranch,
                hasConflicts: false,
                duration: Date.now() - startTime
            });
            return { hasConflicts: false };
        }
        catch (error) {
            const details = error instanceof Error ? error.message : 'Unknown conflict';
            this.telemetry.recordEvent('git_operation', {
                operation: 'checkConflicts',
                workspace: this.workspace,
                targetBranch,
                hasConflicts: true,
                details,
                duration: Date.now() - startTime
            });
            return {
                hasConflicts: true,
                details,
            };
        }
    }
    /**
     * Cleanup all worktrees
     */
    async cleanup() {
        const startTime = Date.now();
        const removed = [];
        const failed = [];
        for (const branch of this.worktrees.keys()) {
            try {
                await this.removeWorktree(branch);
                removed.push(branch);
            }
            catch (error) {
                failed.push(branch);
                console.error(`Failed to remove worktree ${branch}:`, error);
            }
        }
        this.telemetry.recordEvent('git_cleanup', {
            workspace: this.workspace,
            removed,
            failed,
            duration: Date.now() - startTime
        });
    }
    /**
     * Get orchestrator statistics
     */
    getStats() {
        return {
            workspace: this.workspace,
            activeWorktrees: this.worktrees.size,
            worktrees: Array.from(this.worktrees.entries()).map(([branch, config]) => ({
                branch,
                path: config.path,
                detached: config.detached
            }))
        };
    }
}
exports.GitOrchestrator = GitOrchestrator;
//# sourceMappingURL=GitOrchestrator.js.map