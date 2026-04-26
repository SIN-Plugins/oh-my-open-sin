import { execAsync } from '../utils/exec';

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
export class GitConflictResolver {
  private worktreePath: string;

  constructor(worktreePath: string) {
    this.worktreePath = worktreePath;
  }

  /**
   * Analysiert Konflikte in einem Worktree
   */
  async analyzeConflicts(): Promise<ConflictInfo[]> {
    const conflicts: ConflictInfo[] = [];
    
    try {
      // Hole Liste der konfliktbehafteten Dateien
      const { stdout } = await execAsync(
        `git diff --name-only --diff-filter=U`,
        { cwd: this.worktreePath }
      );

      const files = stdout.trim().split('\n').filter(f => f.length > 0);

      for (const file of files) {
        const conflict = await this.analyzeFileConflict(file);
        if (conflict) {
          conflicts.push(conflict);
        }
      }
    } catch (error) {
      console.error('Fehler bei der Konfliktanalyse:', error);
    }

    return conflicts;
  }

  /**
   * Analysiert einen einzelnen Dateikonflikt
   */
  private async analyzeFileConflict(file: string): Promise<ConflictInfo | null> {
    try {
      // Extrahiere die verschiedenen Versionen
      const [ours, theirs, base] = await Promise.all([
        this.getFileVersion(file, '--ours'),
        this.getFileVersion(file, '--theirs'),
        this.getFileVersion(file, '--base')
      ]);

      // Bestimme Konflikttyp
      const conflictType = this.detectConflictType(file, ours, theirs);

      return {
        file,
        ours,
        theirs,
        base,
        conflictType
      };
    } catch (error) {
      console.error(`Fehler bei Analyse von ${file}:`, error);
      return null;
    }
  }

  /**
   * Holt eine spezifische Version einer Datei
   */
  private async getFileVersion(file: string, version: string): Promise<string> {
    try {
      const { stdout } = await execAsync(
        `git show ${version}:${file}`,
        { cwd: this.worktreePath }
      );
      return stdout;
    } catch {
      return '';
    }
  }

  /**
   * Erkennt den Typ des Konflikts
   */
  private detectConflictType(
    file: string,
    ours: string,
    theirs: string
  ): 'content' | 'binary' | 'rename' {
    // Prüfe auf binäre Inhalte
    if (ours.includes('\0') || theirs.includes('\0')) {
      return 'binary';
    }

    // Prüfe auf Rename-Konflikte (einfache Heuristik)
    if (file.includes('->')) {
      return 'rename';
    }

    return 'content';
  }

  /**
   * Empfiehlt eine Lösungsstrategie basierend auf Konfliktanalyse
   */
  async recommendStrategy(conflict: ConflictInfo): Promise<ResolutionStrategy> {
    // Einfache Heuristiken für Strategiewahl
    
    // Bei kleinen Änderungen in theirs -> theirs bevorzugen
    const theirsLines = conflict.theirs.split('\n').length;
    const oursLines = conflict.ours.split('\n').length;
    
    if (theirsLines < 5 && oursLines > 20) {
      return {
        type: 'theirs',
        confidence: 0.7,
        reasoning: 'Kleine Änderung in theirs, große Basis in ours'
      };
    }

    // Bei komplementären Änderungen -> merge versuchen
    if (this.areComplementary(conflict.ours, conflict.theirs)) {
      return {
        type: 'merge',
        confidence: 0.6,
        reasoning: 'Änderungen scheinen komplementär zu sein'
      };
    }

    // Standard: manuelle Prüfung erforderlich
    return {
      type: 'manual',
      confidence: 0.3,
      reasoning: 'Komplexer Konflikt erfordert manuelle Prüfung'
    };
  }

  /**
   * Prüft ob Änderungen komplementär sind
   */
  private areComplementary(ours: string, theirs: string): boolean {
    // Einfache Heuristik: Keine überlappenden Zeilen geändert
    const oursLines = new Set(ours.split('\n'));
    const theirsLines = new Set(theirs.split('\n'));
    
    // Wenn wenig Überlappung, könnten sie komplementär sein
    const intersection = [...oursLines].filter(l => theirsLines.has(l));
    return intersection.length < Math.min(oursLines.size, theirsLines.size) * 0.3;
  }

  /**
   * Wendet eine Lösungsstrategie an
   */
  async applyResolution(
    conflict: ConflictInfo,
    strategy: ResolutionStrategy
  ): Promise<boolean> {
    try {
      switch (strategy.type) {
        case 'ours':
          await this.applyVersion(conflict.file, '--ours');
          break;
        case 'theirs':
          await this.applyVersion(conflict.file, '--theirs');
          break;
        case 'merge':
          await this.autoMerge(conflict);
          break;
        case 'hybrid':
          await this.hybridMerge(conflict);
          break;
        case 'manual':
          // Bei manueller Strategie nur markieren
          console.log(`Manuelle Lösung erforderlich für: ${conflict.file}`);
          return false;
      }

      // Stage die gelöste Datei
      await execAsync(`git add ${conflict.file}`, { cwd: this.worktreePath });
      return true;
    } catch (error) {
      console.error(`Fehler bei Lösung von ${conflict.file}:`, error);
      return false;
    }
  }

  /**
   * Wendet eine spezifische Version an
   */
  private async applyVersion(file: string, version: string): Promise<void> {
    await execAsync(
      `git checkout ${version} -- ${file}`,
      { cwd: this.worktreePath }
    );
  }

  /**
   * Führt automatisches Merge durch
   */
  private async autoMerge(conflict: ConflictInfo): Promise<void> {
    // Verwende git merge-file für automatisches Merge
    const basePath = `${this.worktreePath}/${conflict.file}.base`;
    const oursPath = `${this.worktreePath}/${conflict.file}.ours`;
    const theirsPath = `${this.worktreePath}/${conflict.file}.theirs`;

    // Temporäre Dateien schreiben
    await this.writeTempFile(basePath, conflict.base);
    await this.writeTempFile(oursPath, conflict.ours);
    await this.writeTempFile(theirsPath, conflict.theirs);

    try {
      await execAsync(
        `git merge-file -p ${oursPath} ${basePath} ${theirsPath} > ${conflict.file}`,
        { cwd: this.worktreePath }
      );
    } finally {
      // Aufräumen
      await this.cleanupTempFiles([basePath, oursPath, theirsPath]);
    }
  }

  /**
   * Führt hybrides Merge durch (intelligent kombiniert)
   */
  private async hybridMerge(conflict: ConflictInfo): Promise<void> {
    // Hier könnte komplexere Logik implementiert werden
    // Für jetzt: einfaches Merge mit Präferenz für nicht-konfliktäre Teile
    await this.autoMerge(conflict);
  }

  /**
   * Schreibt temporäre Datei
   */
  private async writeTempFile(path: string, content: string): Promise<void> {
    const fs = await import('fs');
    await fs.promises.writeFile(path, content);
  }

  /**
   * Räumt temporäre Dateien auf
   */
  private async cleanupTempFiles(paths: string[]): Promise<void> {
    const fs = await import('fs');
    for (const path of paths) {
      try {
        await fs.promises.unlink(path);
      } catch {
        // Ignorieren wenn Datei nicht existiert
      }
    }
  }

  /**
   * Löst alle Konflikte automatisch mit empfohlenen Strategien
   */
  async resolveAllConflicts(
    autoApply: boolean = false
  ): Promise<{ resolved: number; manual: number; failed: number }> {
    const conflicts = await this.analyzeConflicts();
    const result = { resolved: 0, manual: 0, failed: 0 };

    for (const conflict of conflicts) {
      const strategy = await this.recommendStrategy(conflict);

      if (strategy.type === 'manual') {
        result.manual++;
        continue;
      }

      if (autoApply && strategy.confidence && strategy.confidence >= 0.6) {
        const success = await this.applyResolution(conflict, strategy);
        if (success) {
          result.resolved++;
        } else {
          result.failed++;
        }
      } else {
        result.manual++;
      }
    }

    return result;
  }

  /**
   * Generiert Konfliktbericht für Monitoring
   */
  async generateConflictReport(): Promise<string> {
    const conflicts = await this.analyzeConflicts();
    
    let report = '# Git Conflict Report\n\n';
    report += `Total Conflicts: ${conflicts.length}\n\n`;

    for (const conflict of conflicts) {
      const strategy = await this.recommendStrategy(conflict);
      report += `## ${conflict.file}\n`;
      report += `- Type: ${conflict.conflictType}\n`;
      report += `- Recommended: ${strategy.type} (confidence: ${strategy.confidence})\n`;
      report += `- Reasoning: ${strategy.reasoning}\n\n`;
    }

    return report;
  }
}
