"use strict";
/**
 * sin-hash_edit Tool
 *
 * Ermöglicht präzise Code-Änderungen mittels Hash-anchored Edits.
 * Verwendet Content-Hashes um sicherzustellen, dass Änderungen nur am erwarteten Ort vorgenommen werden.
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.CLI_HELP = exports.sinHashEdit = exports.SinHashEdit = void 0;
const crypto = __importStar(require("crypto"));
const fs = __importStar(require("fs"));
class SinHashEdit {
    algorithm = 'sha256';
    /**
     * Berechnet Hash für Content
     */
    computeHash(content) {
        return crypto.createHash(this.algorithm).update(content, 'utf8').digest('hex');
    }
    /**
     * Extrahiert alle Sections mit Hashes aus einer Datei
     */
    extractSections(filePath, windowSize = 5) {
        const content = fs.readFileSync(filePath, 'utf8');
        const lines = content.split('\n');
        const sections = [];
        for (let i = 0; i < lines.length; i++) {
            const startLine = i;
            const endLine = Math.min(i + windowSize - 1, lines.length - 1);
            const sectionContent = lines.slice(startLine, endLine + 1).join('\n');
            sections.push({
                startLine: startLine + 1, // 1-basiert
                endLine: endLine + 1,
                content: sectionContent,
                hash: this.computeHash(sectionContent)
            });
        }
        return sections;
    }
    /**
     * Findet eine Section anhand ihres Hashes
     */
    findSectionByHash(filePath, targetHash, windowSizes = [3, 5, 10]) {
        for (const windowSize of windowSizes) {
            const sections = this.extractSections(filePath, windowSize);
            const found = sections.find(s => s.hash === targetHash);
            if (found) {
                return found;
            }
        }
        return null;
    }
    /**
     * Führt einen Hash-anchored Edit durch
     */
    applyEdit(edit) {
        try {
            if (!fs.existsSync(edit.filePath)) {
                return {
                    success: false,
                    message: `Datei nicht gefunden: ${edit.filePath}`
                };
            }
            // Suche Target-Content
            const section = this.findSectionByHash(edit.filePath, edit.targetHash);
            if (!section) {
                // Alternative: Suche nach exaktem Content-Match
                const content = fs.readFileSync(edit.filePath, 'utf8');
                const targetIndex = content.indexOf(edit.targetContent);
                if (targetIndex === -1) {
                    return {
                        success: false,
                        message: 'Target-Content nicht gefunden. Hash und Content stimmen nicht überein.'
                    };
                }
                // Berechne Line Number
                const linesBefore = content.substring(0, targetIndex).split('\n');
                const lineNumber = linesBefore.length;
                // Führe Ersetzung durch
                const newContent = content.replace(edit.targetContent, edit.replacementContent);
                fs.writeFileSync(edit.filePath, newContent, 'utf8');
                const newHash = this.computeHash(edit.replacementContent);
                return {
                    success: true,
                    message: `Edit erfolgreich in Zeile ${lineNumber}`,
                    newHash,
                    lineNumber
                };
            }
            // Ersetze gefundene Section
            const content = fs.readFileSync(edit.filePath, 'utf8');
            const lines = content.split('\n');
            const beforeLines = lines.slice(0, section.startLine - 1);
            const afterLines = lines.slice(section.endLine);
            const replacementLines = edit.replacementContent.split('\n');
            const newLines = [...beforeLines, ...replacementLines, ...afterLines];
            const newContent = newLines.join('\n');
            fs.writeFileSync(edit.filePath, newContent, 'utf8');
            const newHash = this.computeHash(edit.replacementContent);
            return {
                success: true,
                message: `Edit erfolgreich in Zeilen ${section.startLine}-${section.startLine + replacementLines.length - 1}`,
                newHash,
                lineNumber: section.startLine
            };
        }
        catch (error) {
            return {
                success: false,
                message: `Edit fehlgeschlagen: ${error.message}`
            };
        }
    }
    /**
     * Erstellt einen Hash-Edit aus einem Diff
     */
    createEditFromDiff(filePath, oldContent, newContent, description) {
        const targetHash = this.computeHash(oldContent);
        return {
            filePath,
            targetHash,
            targetContent: oldContent,
            replacementContent: newContent,
            description
        };
    }
    /**
     * Validiert ob eine Datei noch dem erwarteten Hash entspricht
     */
    validateFile(filePath, expectedHash) {
        try {
            const content = fs.readFileSync(filePath, 'utf8');
            const actualHash = this.computeHash(content);
            return actualHash === expectedHash;
        }
        catch {
            return false;
        }
    }
    /**
     * Generiert Hashes für alle Funktionen in einer Datei
     */
    generateFunctionHashes(filePath) {
        const content = fs.readFileSync(filePath, 'utf8');
        const functionRegex = /(?:async\s+)?function\s+(\w+)\s*\([^)]*\)\s*(?::\s*[\w<>]+)?\s*\{/g;
        const results = [];
        let match;
        while ((match = functionRegex.exec(content)) !== null) {
            const funcName = match[1];
            const startIndex = match.index;
            // Finde Ende der Funktion (vereinfacht - zählt Klammern)
            let braceCount = 1;
            let endIndex = startIndex + match[0].length;
            while (braceCount > 0 && endIndex < content.length) {
                if (content[endIndex] === '{')
                    braceCount++;
                if (content[endIndex] === '}')
                    braceCount--;
                endIndex++;
            }
            const funcContent = content.substring(startIndex, endIndex);
            const line = content.substring(0, startIndex).split('\n').length;
            results.push({
                name: funcName,
                hash: this.computeHash(funcContent),
                line
            });
        }
        return results;
    }
    /**
     * Batch-Operation: Mehrere Edits atomar anwenden
     */
    applyBatchEdits(edits) {
        const results = [];
        const backupContents = new Map();
        // Backup aller betroffenen Dateien
        for (const edit of edits) {
            if (!backupContents.has(edit.filePath) && fs.existsSync(edit.filePath)) {
                backupContents.set(edit.filePath, fs.readFileSync(edit.filePath, 'utf8'));
            }
        }
        // Versuche alle Edits
        for (const edit of edits) {
            const result = this.applyEdit(edit);
            results.push({ edit, result });
            if (!result.success) {
                // Rollback bei Fehler
                console.error(`[sin-hash_edit] Edit failed: ${edit.description}. Rolling back...`);
                for (const [filePath, content] of backupContents.entries()) {
                    fs.writeFileSync(filePath, content, 'utf8');
                }
                break;
            }
        }
        return results;
    }
}
exports.SinHashEdit = SinHashEdit;
// Singleton Instance
exports.sinHashEdit = new SinHashEdit();
// CLI-Hilfe
exports.CLI_HELP = `
sin-hash_edit - Präzise Code-Änderungen mit Hash-Anchors

Verwendung:
  sin-hash_edit apply <file> --hash <target-hash> --replacement <new-content>
  sin-hash_edit validate <file> --hash <expected-hash>
  sin-hash-edit functions <file>

Beispiel:
  sin-hash_edit apply src/example.ts \\
    --hash abc123... \\
    --replacement "console.log('new code')" \\
    --description "Update logging"

Features:
  - Content-Hash Validation vor jeder Änderung
  - Automatische Section-Erkennung mit variablen Fenstergrößen
  - Batch-Operationen mit atomarem Rollback
  - Function-Level Hashing für präzise Tracking
`;
//# sourceMappingURL=sin_hash_edit.js.map