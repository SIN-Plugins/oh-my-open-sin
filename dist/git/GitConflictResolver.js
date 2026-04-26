"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GitConflictResolver = void 0;
const exec_1 = require("../utils/exec");
/**
 * GitConflictResolver - Intelligente Konfliktlösung für parallele Branches
 * Teil des oh-my-open-sin Frameworks
 */
class GitConflictResolver {
    worktreePath;
    constructor(worktreePath) {
        this.worktreePath = worktreePath;
    }
    /**
     * Analysiert Konflikte in einem Worktree
     */
    async analyzeConflicts() {
        const conflicts = [];
        try {
            // Hole Liste der konfliktbehafteten Dateien
            const { stdout } = await (0, exec_1.execAsync)(`git diff --name-only --diff-filter=U`, { cwd: this.worktreePath });
            const files = stdout.trim().split('\n').filter(f => f.length > 0);
            for (const file of files) {
                const conflict = await this.analyzeFileConflict(file);
                if (conflict) {
                    conflicts.push(conflict);
                }
            }
        }
        catch (error) {
            console.error('Fehler bei der Konfliktanalyse:', error);
        }
        return conflicts;
    }
    /**
     * Analysiert einen einzelnen Dateikonflikt
     */
    async analyzeFileConflict(file) {
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
        }
        catch (error) {
            console.error(`Fehler bei Analyse von ${file}:`, error);
            return null;
        }
    }
    /**
     * Holt eine spezifische Version einer Datei
     */
    async getFileVersion(file, version) {
        try {
            const { stdout } = await (0, exec_1.execAsync)(`git show ${version}:${file}`, { cwd: this.worktreePath });
            return stdout;
        }
        catch {
            return '';
        }
    }
    /**
     * Erkennt den Typ des Konflikts
     */
    detectConflictType(file, ours, theirs) {
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
    async recommendStrategy(conflict) {
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
    areComplementary(ours, theirs) {
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
    async applyResolution(conflict, strategy) {
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
            await (0, exec_1.execAsync)(`git add ${conflict.file}`, { cwd: this.worktreePath });
            return true;
        }
        catch (error) {
            console.error(`Fehler bei Lösung von ${conflict.file}:`, error);
            return false;
        }
    }
    /**
     * Wendet eine spezifische Version an
     */
    async applyVersion(file, version) {
        await (0, exec_1.execAsync)(`git checkout ${version} -- ${file}`, { cwd: this.worktreePath });
    }
    /**
     * Führt automatisches Merge durch
     */
    async autoMerge(conflict) {
        // Verwende git merge-file für automatisches Merge
        const basePath = `${this.worktreePath}/${conflict.file}.base`;
        const oursPath = `${this.worktreePath}/${conflict.file}.ours`;
        const theirsPath = `${this.worktreePath}/${conflict.file}.theirs`;
        // Temporäre Dateien schreiben
        await this.writeTempFile(basePath, conflict.base);
        await this.writeTempFile(oursPath, conflict.ours);
        await this.writeTempFile(theirsPath, conflict.theirs);
        try {
            await (0, exec_1.execAsync)(`git merge-file -p ${oursPath} ${basePath} ${theirsPath} > ${conflict.file}`, { cwd: this.worktreePath });
        }
        finally {
            // Aufräumen
            await this.cleanupTempFiles([basePath, oursPath, theirsPath]);
        }
    }
    /**
     * Führt hybrides Merge durch (intelligent kombiniert)
     */
    async hybridMerge(conflict) {
        // Hier könnte komplexere Logik implementiert werden
        // Für jetzt: einfaches Merge mit Präferenz für nicht-konfliktäre Teile
        await this.autoMerge(conflict);
    }
    /**
     * Schreibt temporäre Datei
     */
    async writeTempFile(path, content) {
        const fs = await import('fs');
        await fs.promises.writeFile(path, content);
    }
    /**
     * Räumt temporäre Dateien auf
     */
    async cleanupTempFiles(paths) {
        const fs = await import('fs');
        for (const path of paths) {
            try {
                await fs.promises.unlink(path);
            }
            catch {
                // Ignorieren wenn Datei nicht existiert
            }
        }
    }
    /**
     * Löst alle Konflikte automatisch mit empfohlenen Strategien
     */
    async resolveAllConflicts(autoApply = false) {
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
                }
                else {
                    result.failed++;
                }
            }
            else {
                result.manual++;
            }
        }
        return result;
    }
    /**
     * Generiert Konfliktbericht für Monitoring
     */
    async generateConflictReport() {
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
exports.GitConflictResolver = GitConflictResolver;
//# sourceMappingURL=GitConflictResolver.js.map