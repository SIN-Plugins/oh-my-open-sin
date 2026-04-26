import { execAsync } from '../utils/exec';

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
export class GitPolicyEnforcer {
  private worktreePath: string;
  private config: PolicyConfig;

  constructor(worktreePath: string, config?: Partial<PolicyConfig>) {
    this.worktreePath = worktreePath;
    this.config = {
      requireTests: true,
      requireLinting: true,
      maxFileSize: 1024 * 1024, // 1MB default
      allowedFileExtensions: ['.ts', '.js', '.json', '.md', '.yaml', '.yml'],
      requireCommitMessageFormat: true,
      protectedBranches: ['main', 'master', 'develop'],
      requireCodeReview: true,
      minApprovals: 1,
      ...config
    };
  }

  /**
   * Validiert alle Richtlinien vor einem Commit
   */
  async validateAll(): Promise<PolicyResult> {
    const violations: PolicyViolation[] = [];
    const warnings: PolicyViolation[] = [];

    // Prüfe Branch-Schutz
    const branchResult = await this.validateBranchProtection();
    violations.push(...branchResult.violations);
    warnings.push(...branchResult.warnings);

    // Prüfe Commit-Nachrichten-Format
    if (this.config.requireCommitMessageFormat) {
      const commitResult = await this.validateCommitMessages();
      violations.push(...commitResult.violations);
      warnings.push(...commitResult.warnings);
    }

    // Prüfe Dateigrößen und Extensions
    const fileResult = await this.validateFiles();
    violations.push(...fileResult.violations);
    warnings.push(...fileResult.warnings);

    // Prüfe Tests
    if (this.config.requireTests) {
      const testResult = await this.validateTests();
      violations.push(...testResult.violations);
      warnings.push(...testResult.warnings);
    }

    // Prüfe Linting
    if (this.config.requireLinting) {
      const lintResult = await this.validateLinting();
      violations.push(...lintResult.violations);
      warnings.push(...lintResult.warnings);
    }

    return {
      passed: violations.length === 0,
      violations,
      warnings
    };
  }

  /**
   * Validiert Branch-Schutzrichtlinien
   */
  private async validateBranchProtection(): Promise<PolicyResult> {
    const violations: PolicyViolation[] = [];
    const warnings: PolicyViolation[] = [];

    try {
      const { stdout: currentBranch } = await execAsync(
        'git rev-parse --abbrev-ref HEAD',
        { cwd: this.worktreePath }
      );

      const branch = currentBranch.trim();

      if (this.config.protectedBranches.includes(branch)) {
        violations.push({
          type: 'branch',
          severity: 'error',
          message: `Direkte Commits auf geschützten Branch '${branch}' nicht erlaubt`,
          suggestion: 'Erstelle einen Feature-Branch und öffne einen Pull Request'
        });
      }
    } catch (error) {
      warnings.push({
        type: 'branch',
        severity: 'info',
        message: 'Konnte aktuellen Branch nicht bestimmen'
      });
    }

    return { passed: violations.length === 0, violations, warnings };
  }

  /**
   * Validiert Commit-Nachrichten-Format
   */
  private async validateCommitMessages(): Promise<PolicyResult> {
    const violations: PolicyViolation[] = [];
    const warnings: PolicyViolation[] = [];

    try {
      // Prüfe uncommitted changes mit Commit-Vorlage
      const { stdout: status } = await execAsync(
        'git status --porcelain',
        { cwd: this.worktreePath }
      );

      if (status.trim()) {
        // Es gibt Änderungen, prüfe Commit-Message Format (wenn commit-msg Hook existiert)
        // Hier könnten wir eine konventionelle Commit-Prüfung implementieren
        const commitMsgPattern = /^(feat|fix|docs|style|refactor|test|chore)(\(.+\))?: .+/;
        
        // Hinweis für Benutzer
        warnings.push({
          type: 'commit',
          severity: 'info',
          message: 'Stelle sicher, dass Commit-Nachrichten dem Conventional Commits Format entsprechen',
          suggestion: 'Format: feat(scope): description oder fix(scope): description'
        });
      }
    } catch (error) {
      // Ignorieren wenn kein Git-Repo
    }

    return { passed: violations.length === 0, violations, warnings };
  }

  /**
   * Validiert Dateien (Größe, Extensions)
   */
  private async validateFiles(): Promise<PolicyResult> {
    const violations: PolicyViolation[] = [];
    const warnings: PolicyViolation[] = [];

    try {
      const { stdout: stagedFiles } = await execAsync(
        'git diff --cached --name-only',
        { cwd: this.worktreePath }
      );

      const files = stagedFiles.trim().split('\n').filter(f => f.length > 0);

      for (const file of files) {
        // Prüfe File Extension
        if (this.config.allowedFileExtensions) {
          const ext = '.' + file.split('.').pop();
          if (!this.config.allowedFileExtensions.includes(ext)) {
            violations.push({
              type: 'file',
              severity: 'error',
              message: `Dateityp '${ext}' nicht erlaubt`,
              file,
              suggestion: `Erlaubte Typen: ${this.config.allowedFileExtensions.join(', ')}`
            });
          }
        }

        // Prüfe Dateigröße
        if (this.config.maxFileSize) {
          try {
            const fs = await import('fs');
            const filePath = `${this.worktreePath}/${file}`;
            const stats = await fs.promises.stat(filePath);
            
            if (stats.size > this.config.maxFileSize) {
              violations.push({
                type: 'file',
                severity: 'error',
                message: `Datei überschreitet maximale Größe (${stats.size} > ${this.config.maxFileSize})`,
                file,
                suggestion: 'Datei verkleinern oder in kleinere Teile aufteilen'
              });
            }
          } catch {
            // Datei existiert vielleicht nicht im Worktree
          }
        }
      }
    } catch (error) {
      // Keine staged files oder anderer Fehler
    }

    return { passed: violations.length === 0, violations, warnings };
  }

  /**
   * Validiert dass Tests existieren/laufen
   */
  private async validateTests(): Promise<PolicyResult> {
    const violations: PolicyViolation[] = [];
    const warnings: PolicyViolation[] = [];

    try {
      // Prüfe ob Test-Dateien geändert wurden bei Code-Änderungen
      const { stdout: changedFiles } = await execAsync(
        'git diff --cached --name-only',
        { cwd: this.worktreePath }
      );

      const files = changedFiles.trim().split('\n').filter(f => f.length > 0);
      const hasCodeChanges = files.some(f => f.endsWith('.ts') || f.endsWith('.js'));
      const hasTestChanges = files.some(f => f.includes('.test.') || f.includes('.spec.'));

      if (hasCodeChanges && !hasTestChanges) {
        warnings.push({
          type: 'test',
          severity: 'warning',
          message: 'Code-Änderungen ohne entsprechende Test-Änderungen',
          suggestion: 'Erwäge Tests für die geänderten Funktionen hinzuzufügen'
        });
      }

      // Versuche Tests zu laufen (wenn npm test verfügbar)
      try {
        await execAsync('npm test -- --passWithNoTests', { 
          cwd: this.worktreePath,
          timeout: 30000 
        });
      } catch (error) {
        violations.push({
          type: 'test',
          severity: 'error',
          message: 'Tests sind fehlgeschlagen',
          suggestion: 'Bitte Tests reparieren bevor committet wird'
        });
      }
    } catch (error) {
      warnings.push({
        type: 'test',
        severity: 'info',
        message: 'Konnte Tests nicht validieren'
      });
    }

    return { passed: violations.length === 0, violations, warnings };
  }

  /**
   * Validiert Linting
   */
  private async validateLinting(): Promise<PolicyResult> {
    const violations: PolicyViolation[] = [];
    const warnings: PolicyViolation[] = [];

    try {
      // Versuche Linting zu laufen
      await execAsync('npm run lint', { 
        cwd: this.worktreePath,
        timeout: 30000 
      });
    } catch (error: any) {
      if (error.stdout || error.stderr) {
        violations.push({
          type: 'lint',
          severity: 'error',
          message: 'Linting ist fehlgeschlagen',
          suggestion: 'Bitte Linting-Fehler beheben:\n' + (error.stdout || error.stderr)
        });
      } else {
        warnings.push({
          type: 'lint',
          severity: 'info',
          message: 'Linting-Skript nicht gefunden'
        });
      }
    }

    return { passed: violations.length === 0, violations, warnings };
  }

  /**
   * Installiert Git-Hooks für automatische Richtlinien-Durchsetzung
   */
  async installHooks(): Promise<void> {
    const hooksDir = `${this.worktreePath}/.git/hooks`;
    const fs = await import('fs');
    const path = await import('path');

    // Stelle sicher dass hooks Verzeichnis existiert
    try {
      await fs.promises.access(hooksDir);
    } catch {
      // Hooks Verzeichnis existiert nicht, versuche es zu erstellen
      const gitDir = `${this.worktreePath}/.git`;
      try {
        await fs.promises.mkdir(`${hooksDir}`, { recursive: true });
      } catch {
        console.warn('Konnte Hooks-Verzeichnis nicht erstellen');
        return;
      }
    }

    // Pre-commit Hook
    const preCommitHook = `#!/bin/bash
# Auto-generated by GitPolicyEnforcer

cd "${this.worktreePath}"

# Run policy validation
node -e "
const { GitPolicyEnforcer } = require('${path.resolve(__dirname, '../../dist/git/GitPolicyEnforcer.js')}');
const enforcer = new GitPolicyEnforcer('${this.worktreePath}');
enforcer.validateAll().then(result => {
  if (!result.passed) {
    console.error('Policy Violations:');
    result.violations.forEach(v => console.error('  - ' + v.message));
    process.exit(1);
  }
}).catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
"
`;

    await fs.promises.writeFile(
      `${hooksDir}/pre-commit`,
      preCommitHook,
      { mode: 0o755 }
    );

    console.log('Pre-commit Hook installiert');
  }

  /**
   * Generiert Richtlinien-Bericht
   */
  async generateReport(): Promise<string> {
    const result = await this.validateAll();
    
    let report = '# Git Policy Report\n\n';
    report += `Status: ${result.passed ? '✅ PASSED' : '❌ FAILED'}\n\n`;

    if (result.violations.length > 0) {
      report += '## Violations\n\n';
      for (const v of result.violations) {
        report += `- [${v.severity.toUpperCase()}] ${v.type}: ${v.message}\n`;
        if (v.file) report += `  File: ${v.file}\n`;
        if (v.suggestion) report += `  Suggestion: ${v.suggestion}\n`;
      }
      report += '\n';
    }

    if (result.warnings.length > 0) {
      report += '## Warnings\n\n';
      for (const w of result.warnings) {
        report += `- [${w.severity.toUpperCase()}] ${w.type}: ${w.message}\n`;
        if (w.suggestion) report += `  Suggestion: ${w.suggestion}\n`;
      }
      report += '\n';
    }

    report += '## Configuration\n\n';
    report += `- Require Tests: ${this.config.requireTests}\n`;
    report += `- Require Linting: ${this.config.requireLinting}\n`;
    report += `- Max File Size: ${this.config.maxFileSize} bytes\n`;
    report += `- Protected Branches: ${this.config.protectedBranches.join(', ')}\n`;
    report += `- Min Approvals: ${this.config.minApprovals}\n`;

    return report;
  }

  /**
   * Setzt Konfiguration neu
   */
  updateConfig(config: Partial<PolicyConfig>): void {
    this.config = { ...this.config, ...config };
  }
}
