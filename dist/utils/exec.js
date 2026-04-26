"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CommandQueue = exports.execAsync = void 0;
exports.runCommand = runCommand;
exports.runParallelCommands = runParallelCommands;
exports.runWithRetry = runWithRetry;
exports.sleep = sleep;
exports.commandExists = commandExists;
exports.withTempFile = withTempFile;
const child_process_1 = require("child_process");
const util_1 = require("util");
exports.execAsync = (0, util_1.promisify)(child_process_1.exec);
/**
 * Führt einen Shell-Befehl aus und gibt stdout/stderr zurück
 */
async function runCommand(command, options) {
    try {
        const { stdout, stderr } = await (0, exports.execAsync)(command, {
            cwd: options?.cwd,
            timeout: options?.timeout || 30000,
            env: { ...process.env, ...options?.env }
        });
        return { stdout, stderr };
    }
    catch (error) {
        // Füge stdout/stderr zum Fehler hinzu für bessere Debugging-Infos
        error.stdout = error.stdout || '';
        error.stderr = error.stderr || '';
        throw error;
    }
}
/**
 * Parallele Ausführung mehrerer Befehle mit Begrenzung
 */
async function runParallelCommands(commands, options) {
    const concurrency = options?.concurrency || 4;
    const results = [];
    // Führe Befehle in Batches aus
    for (let i = 0; i < commands.length; i += concurrency) {
        const batch = commands.slice(i, i + concurrency);
        const batchResults = await Promise.all(batch.map(cmd => runCommand(cmd, { cwd: options?.cwd })));
        results.push(...batchResults);
    }
    return results;
}
/**
 * Warteschlange für sequentielle Befehlsausführung
 */
class CommandQueue {
    queue = [];
    processing = false;
    cwd;
    constructor(cwd) {
        this.cwd = cwd;
    }
    /**
     * Fügt einen Befehl zur Warteschlange hinzu
     */
    enqueue(command) {
        return new Promise((resolve, reject) => {
            this.queue.push({ command, resolve, reject });
            this.processQueue();
        });
    }
    /**
     * Verarbeitet die Warteschlange
     */
    async processQueue() {
        if (this.processing || this.queue.length === 0) {
            return;
        }
        this.processing = true;
        while (this.queue.length > 0) {
            const { command, resolve, reject } = this.queue.shift();
            try {
                const result = await runCommand(command, { cwd: this.cwd });
                resolve(result);
            }
            catch (error) {
                reject(error);
            }
        }
        this.processing = false;
    }
    /**
     * Anzahl der wartenden Befehle
     */
    get length() {
        return this.queue.length;
    }
}
exports.CommandQueue = CommandQueue;
/**
 * Retry-Logik für fehlgeschlagene Befehle
 */
async function runWithRetry(command, options) {
    const retries = options?.retries || 3;
    const delayMs = options?.delayMs || 1000;
    const backoff = options?.backoff || 2;
    let lastError;
    let currentDelay = delayMs;
    for (let attempt = 0; attempt <= retries; attempt++) {
        try {
            return await runCommand(command, { cwd: options?.cwd });
        }
        catch (error) {
            lastError = error;
            if (attempt < retries) {
                console.warn(`Befehl fehlgeschlagen (Attempt ${attempt + 1}/${retries + 1}): ${command}`, `Warte ${currentDelay}ms...`);
                await sleep(currentDelay);
                currentDelay *= backoff;
            }
        }
    }
    throw lastError;
}
/**
 * Sleep-Helferfunktion
 */
function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}
/**
 * Prüft ob ein Befehl verfügbar ist
 */
async function commandExists(command) {
    try {
        const checkCommand = process.platform === 'win32'
            ? `where ${command}`
            : `which ${command}`;
        await (0, exports.execAsync)(checkCommand);
        return true;
    }
    catch {
        return false;
    }
}
/**
 * Erstellt eine temporäre Datei und führt Befehl aus
 */
async function withTempFile(prefix, content, fn) {
    const fs = await import('fs');
    const os = await import('os');
    const path = await import('path');
    const tempDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), prefix));
    const tempFile = path.join(tempDir, 'temp.txt');
    try {
        await fs.promises.writeFile(tempFile, content);
        return await fn(tempFile);
    }
    finally {
        // Aufräumen
        await fs.promises.unlink(tempFile);
        await fs.promises.rmdir(tempDir);
    }
}
//# sourceMappingURL=exec.js.map