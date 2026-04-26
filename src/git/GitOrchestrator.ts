import { exec } from 'child_process';
import { promisify } from 'util';
import { GitWorktreeConfig } from '../types/index.js';

const execAsync = promisify(exec);

/**
 * GitOrchestrator - Manages Git operations with worktree isolation
 * Provides safe, isolated branch operations for parallel tasks
 */
export class GitOrchestrator {
  private workspace: string;
  private worktrees: Map<string, GitWorktreeConfig> = new Map();

  constructor(workspace: string) {
    this.workspace = workspace;
  }

  /**
   * Get current branch name
   */
  async getCurrentBranch(): Promise<string> {
    const { stdout } = await execAsync('git rev-parse --abbrev-ref HEAD', {
      cwd: this.workspace,
    });
    return stdout.trim();
  }

  /**
   * Create a new worktree for isolated operations
   */
  async createWorktree(config: GitWorktreeConfig): Promise<void> {
    const args = ['worktree', 'add', '-b', config.branch, config.path];
    
    if (config.detached) {
      args.splice(2, 0, '--detach');
    }

    await execAsync(`git ${args.join(' ')}`, {
      cwd: this.workspace,
    });

    this.worktrees.set(config.branch, config);
  }

  /**
   * Remove a worktree
   */
  async removeWorktree(branch: string): Promise<void> {
    const worktree = this.worktrees.get(branch);
    if (!worktree) {
      throw new Error(`Worktree for branch "${branch}" not found`);
    }

    await execAsync(`git worktree remove ${worktree.path}`, {
      cwd: this.workspace,
    });

    this.worktrees.delete(branch);
  }

  /**
   * List all active worktrees
   */
  listWorktrees(): GitWorktreeConfig[] {
    return Array.from(this.worktrees.values());
  }

  /**
   * Create a feature branch with standard naming
   */
  async createFeatureBranch(featureName: string): Promise<string> {
    const timestamp = Date.now();
    const branchName = `feature/${featureName}-${timestamp}`;
    
    await execAsync(`git checkout -b ${branchName}`, {
      cwd: this.workspace,
    });

    return branchName;
  }

  /**
   * Commit changes with conventional commit format
   */
  async commitChanges(message: string, files?: string[]): Promise<void> {
    if (files && files.length > 0) {
      await execAsync(`git add ${files.join(' ')}`, {
        cwd: this.workspace,
      });
    } else {
      await execAsync('git add .', {
        cwd: this.workspace,
      });
    }

    await execAsync(`git commit -m "${message}"`, {
      cwd: this.workspace,
    });
  }

  /**
   * Push branch to remote
   */
  async pushBranch(branch?: string, setUpstream: boolean = true): Promise<void> {
    const currentBranch = branch || await this.getCurrentBranch();
    const flags = setUpstream ? '-u origin' : '';
    
    await execAsync(`git push ${flags} origin ${currentBranch}`, {
      cwd: this.workspace,
    });
  }

  /**
   * Create a pull request via CLI (requires gh CLI)
   */
  async createPullRequest(title: string, body?: string): Promise<string> {
    const branch = await this.getCurrentBranch();
    
    const cmd = body 
      ? `gh pr create --title "${title}" --body "${body}"`
      : `gh pr create --title "${title}"`;

    const { stdout } = await execAsync(cmd, {
      cwd: this.workspace,
    });

    return stdout.trim();
  }

  /**
   * Check for conflicts before merge
   */
  async checkConflicts(targetBranch: string): Promise<{ hasConflicts: boolean; details?: string }> {
    try {
      await execAsync(`git merge-tree $(git merge-base HEAD ${targetBranch}) HEAD ${targetBranch}`, {
        cwd: this.workspace,
      });
      return { hasConflicts: false };
    } catch (error) {
      return { 
        hasConflicts: true, 
        details: error instanceof Error ? error.message : 'Unknown conflict',
      };
    }
  }

  /**
   * Cleanup all worktrees
   */
  async cleanup(): Promise<void> {
    for (const branch of this.worktrees.keys()) {
      try {
        await this.removeWorktree(branch);
      } catch (error) {
        console.error(`Failed to remove worktree ${branch}:`, error);
      }
    }
  }
}
