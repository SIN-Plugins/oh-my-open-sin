import fs from "fs/promises";
import path from "path";
import { structuredLog } from "./telemetry";

const MATRIX_FILE = path.join(process.cwd(), ".opencode", "healing-matrix.json");

export interface MatrixEntry {
  attempts: number;
  successes: number;
  success_rate: number;
  last_used: number;
}

export async function loadMatrix(): Promise<Record<string, Record<string, MatrixEntry>>> {
  try {
    const raw = await fs.readFile(MATRIX_FILE, "utf-8");
    return JSON.parse(raw);
  } catch { return {}; }
}

export async function updateMatrix(failureType: string, strategy: string, success: boolean): Promise<void> {
  const matrix = await loadMatrix();
  if (!matrix[failureType]) matrix[failureType] = {};
  if (!matrix[failureType][strategy]) matrix[failureType][strategy] = { attempts: 0, successes: 0, success_rate: 0, last_used: 0 };

  const entry = matrix[failureType][strategy];
  entry.attempts++;
  if (success) entry.successes++;
  entry.success_rate = entry.successes / entry.attempts;
  entry.last_used = Date.now();

  await fs.writeFile(MATRIX_FILE, JSON.stringify(matrix, null, 2));
  structuredLog("info", "healing_matrix_updated", { failure_type: failureType, strategy, success, rate: entry.success_rate });
}

export function recommendStrategy(failureType: string, matrix: Record<string, Record<string, MatrixEntry>>): string {
  const strategies = matrix[failureType] || {};
  const entries = Object.entries(strategies).filter(([, v]) => v.attempts >= 2);
  if (entries.length === 0) return "lsp_auto_fix"; // default
  entries.sort((a, b) => b[1].success_rate - a[1].success_rate);
  return entries[0][0];
}
