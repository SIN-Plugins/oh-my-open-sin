import { exec } from 'child_process';
export declare const execAsync: typeof exec.__promisify__;
export interface ExecResult {
    stdout: string;
    stderr: string;
}
/**
 * Führt einen Shell-Befehl aus und gibt stdout/stderr zurück
 */
export declare function runCommand(command: string, options?: {
    cwd?: string;
    timeout?: number;
    env?: Record<string, string>;
}): Promise<ExecResult>;
/**
 * Parallele Ausführung mehrerer Befehle mit Begrenzung
 */
export declare function runParallelCommands(commands: string[], options?: {
    cwd?: string;
    concurrency?: number;
}): Promise<ExecResult[]>;
/**
 * Warteschlange für sequentielle Befehlsausführung
 */
export declare class CommandQueue {
    private queue;
    private processing;
    private cwd?;
    constructor(cwd?: string);
    /**
     * Fügt einen Befehl zur Warteschlange hinzu
     */
    enqueue(command: string): Promise<ExecResult>;
    /**
     * Verarbeitet die Warteschlange
     */
    private processQueue;
    /**
     * Anzahl der wartenden Befehle
     */
    get length(): number;
}
/**
 * Retry-Logik für fehlgeschlagene Befehle
 */
export declare function runWithRetry(command: string, options?: {
    cwd?: string;
    retries?: number;
    delayMs?: number;
    backoff?: number;
}): Promise<ExecResult>;
/**
 * Sleep-Helferfunktion
 */
export declare function sleep(ms: number): Promise<void>;
/**
 * Prüft ob ein Befehl verfügbar ist
 */
export declare function commandExists(command: string): Promise<boolean>;
/**
 * Erstellt eine temporäre Datei und führt Befehl aus
 */
export declare function withTempFile<T>(prefix: string, content: string, fn: (filePath: string) => Promise<T>): Promise<T>;
//# sourceMappingURL=exec.d.ts.map