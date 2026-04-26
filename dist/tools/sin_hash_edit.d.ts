/**
 * sin-hash_edit Tool
 *
 * Ermöglicht präzise Code-Änderungen mittels Hash-anchored Edits.
 * Verwendet Content-Hashes um sicherzustellen, dass Änderungen nur am erwarteten Ort vorgenommen werden.
 */
export interface HashEdit {
    filePath: string;
    targetHash: string;
    targetContent: string;
    replacementContent: string;
    description: string;
}
export interface HashEditResult {
    success: boolean;
    message: string;
    newHash?: string;
    lineNumber?: number;
}
export interface FileSection {
    startLine: number;
    endLine: number;
    content: string;
    hash: string;
}
export declare class SinHashEdit {
    private algorithm;
    /**
     * Berechnet Hash für Content
     */
    computeHash(content: string): string;
    /**
     * Extrahiert alle Sections mit Hashes aus einer Datei
     */
    extractSections(filePath: string, windowSize?: number): FileSection[];
    /**
     * Findet eine Section anhand ihres Hashes
     */
    findSectionByHash(filePath: string, targetHash: string, windowSizes?: number[]): FileSection | null;
    /**
     * Führt einen Hash-anchored Edit durch
     */
    applyEdit(edit: HashEdit): HashEditResult;
    /**
     * Erstellt einen Hash-Edit aus einem Diff
     */
    createEditFromDiff(filePath: string, oldContent: string, newContent: string, description: string): HashEdit;
    /**
     * Validiert ob eine Datei noch dem erwarteten Hash entspricht
     */
    validateFile(filePath: string, expectedHash: string): boolean;
    /**
     * Generiert Hashes für alle Funktionen in einer Datei
     */
    generateFunctionHashes(filePath: string): Array<{
        name: string;
        hash: string;
        line: number;
    }>;
    /**
     * Batch-Operation: Mehrere Edits atomar anwenden
     */
    applyBatchEdits(edits: HashEdit[]): Array<{
        edit: HashEdit;
        result: HashEditResult;
    }>;
}
export declare const sinHashEdit: SinHashEdit;
export declare const CLI_HELP = "\nsin-hash_edit - Pr\u00E4zise Code-\u00C4nderungen mit Hash-Anchors\n\nVerwendung:\n  sin-hash_edit apply <file> --hash <target-hash> --replacement <new-content>\n  sin-hash_edit validate <file> --hash <expected-hash>\n  sin-hash-edit functions <file>\n\nBeispiel:\n  sin-hash_edit apply src/example.ts \\\n    --hash abc123... \\\n    --replacement \"console.log('new code')\" \\\n    --description \"Update logging\"\n\nFeatures:\n  - Content-Hash Validation vor jeder \u00C4nderung\n  - Automatische Section-Erkennung mit variablen Fenstergr\u00F6\u00DFen\n  - Batch-Operationen mit atomarem Rollback\n  - Function-Level Hashing f\u00FCr pr\u00E4zise Tracking\n";
//# sourceMappingURL=sin_hash_edit.d.ts.map