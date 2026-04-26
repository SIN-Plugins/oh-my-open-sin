import { exec } from 'child_process';
import { promisify } from 'util';

export const execAsync = promisify(exec);

export interface ExecResult {
  stdout: string;
  stderr: string;
}

/**
 * Führt einen Shell-Befehl aus und gibt stdout/stderr zurück
 */
export async function runCommand(
  command: string,
  options?: { cwd?: string; timeout?: number; env?: Record<string, string> }
): Promise<ExecResult> {
  try {
    const { stdout, stderr } = await execAsync(command, {
      cwd: options?.cwd,
      timeout: options?.timeout || 30000,
      env: { ...process.env, ...options?.env }
    });

    return { stdout, stderr };
  } catch (error: any) {
    // Füge stdout/stderr zum Fehler hinzu für bessere Debugging-Infos
    error.stdout = error.stdout || '';
    error.stderr = error.stderr || '';
    throw error;
  }
}

/**
 * Parallele Ausführung mehrerer Befehle mit Begrenzung
 */
export async function runParallelCommands(
  commands: string[],
  options?: { cwd?: string; concurrency?: number }
): Promise<ExecResult[]> {
  const concurrency = options?.concurrency || 4;
  const results: ExecResult[] = [];
  
  // Führe Befehle in Batches aus
  for (let i = 0; i < commands.length; i += concurrency) {
    const batch = commands.slice(i, i + concurrency);
    const batchResults = await Promise.all(
      batch.map(cmd => runCommand(cmd, { cwd: options?.cwd }))
    );
    results.push(...batchResults);
  }
  
  return results;
}

/**
 * Warteschlange für sequentielle Befehlsausführung
 */
export class CommandQueue {
  private queue: Array<{
    command: string;
    resolve: (result: ExecResult) => void;
    reject: (error: any) => void;
  }> = [];
  
  private processing: boolean = false;
  private cwd?: string;

  constructor(cwd?: string) {
    this.cwd = cwd;
  }

  /**
   * Fügt einen Befehl zur Warteschlange hinzu
   */
  enqueue(command: string): Promise<ExecResult> {
    return new Promise((resolve, reject) => {
      this.queue.push({ command, resolve, reject });
      this.processQueue();
    });
  }

  /**
   * Verarbeitet die Warteschlange
   */
  private async processQueue(): Promise<void> {
    if (this.processing || this.queue.length === 0) {
      return;
    }

    this.processing = true;

    while (this.queue.length > 0) {
      const { command, resolve, reject } = this.queue.shift()!;
      
      try {
        const result = await runCommand(command, { cwd: this.cwd });
        resolve(result);
      } catch (error) {
        reject(error);
      }
    }

    this.processing = false;
  }

  /**
   * Anzahl der wartenden Befehle
   */
  get length(): number {
    return this.queue.length;
  }
}

/**
 * Retry-Logik für fehlgeschlagene Befehle
 */
export async function runWithRetry(
  command: string,
  options?: { 
    cwd?: string; 
    retries?: number; 
    delayMs?: number;
    backoff?: number;
  }
): Promise<ExecResult> {
  const retries = options?.retries || 3;
  const delayMs = options?.delayMs || 1000;
  const backoff = options?.backoff || 2;
  
  let lastError: any;
  let currentDelay = delayMs;
  
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await runCommand(command, { cwd: options?.cwd });
    } catch (error: any) {
      lastError = error;
      
      if (attempt < retries) {
        console.warn(
          `Befehl fehlgeschlagen (Attempt ${attempt + 1}/${retries + 1}): ${command}`,
          `Warte ${currentDelay}ms...`
        );
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
export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Prüft ob ein Befehl verfügbar ist
 */
export async function commandExists(command: string): Promise<boolean> {
  try {
    const checkCommand = process.platform === 'win32' 
      ? `where ${command}` 
      : `which ${command}`;
    
    await execAsync(checkCommand);
    return true;
  } catch {
    return false;
  }
}

/**
 * Erstellt eine temporäre Datei und führt Befehl aus
 */
export async function withTempFile<T>(
  prefix: string,
  content: string,
  fn: (filePath: string) => Promise<T>
): Promise<T> {
  const fs = await import('fs');
  const os = await import('os');
  const path = await import('path');
  
  const tempDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), prefix));
  const tempFile = path.join(tempDir, 'temp.txt');
  
  try {
    await fs.promises.writeFile(tempFile, content);
    return await fn(tempFile);
  } finally {
    // Aufräumen
    await fs.promises.unlink(tempFile);
    await fs.promises.rmdir(tempDir);
  }
}
