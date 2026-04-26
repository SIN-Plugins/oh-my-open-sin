import fs from 'fs/promises';
import path from 'path';

export interface SinConfig {
  version: string;
  agents: Record<string, {
    models: string[];
    category?: string;
    max_concurrent?: number;
    timeout_ms?: number;
  }>;
  budget?: {
    warning_threshold_pct: number;
    critical_threshold_pct: number;
  };
  verification?: {
    test_cmd?: string;
    min_coverage_delta?: number;
    max_new_lsp_errors?: number;
  };
  healing?: {
    max_attempts_base: number;
    strategy_learning_enabled: boolean;
  };
  telemetry?: {
    enabled: boolean;
    log_file?: string;
  };
}

const CONFIG_PATH = path.join(process.cwd(), '.opencode', 'oh-my-open-sin.json');
const DEFAULT_CONFIG: SinConfig = {
  version: '1.0.0',
  agents: {
    hermes: { models: ['openai/gpt-5.4-mini-fast'], category: 'quick' },
    hermes_scout: { models: ['openai/gpt-5.4-mini-fast'], category: 'quick' },
    iris: { models: ['openai/gpt-5.4'], category: 'visual-engineering' },
    atlas: { models: ['openai/o3-pro'], category: 'deep' },
    prometheus: { models: ['openai/o3-pro'], category: 'ultrabrain' },
    asclepius: { models: ['openai/gpt-5.4'], category: 'deep' },
    hades: { models: ['openai/gpt-5.4'], category: 'deep' },
    aegis: { models: ['openai/gpt-5.4'], category: 'deep' },
    hephaestus: { models: ['openai/o3-pro'], category: 'deep' },
    athena: { models: ['openai/gpt-5.4-mini-fast'], category: 'quick' }
  },
  budget: {
    warning_threshold_pct: 80,
    critical_threshold_pct: 95
  },
  verification: {
    test_cmd: 'npm test',
    min_coverage_delta: 0,
    max_new_lsp_errors: 0
  },
  healing: {
    max_attempts_base: 3,
    strategy_learning_enabled: true
  },
  telemetry: {
    enabled: true,
    log_file: path.join(process.env.HOME || '', '.config', 'opencode', 'logs', 'sin-telemetry.jsonl')
  }
};

export async function loadConfig(): Promise<SinConfig> {
  try {
    const raw = await fs.readFile(CONFIG_PATH, 'utf-8');
    const userConfig = JSON.parse(raw);
    return { ...DEFAULT_CONFIG, ...userConfig, agents: { ...DEFAULT_CONFIG.agents, ...userConfig.agents } };
  } catch {
    return DEFAULT_CONFIG;
  }
}

export async function saveConfig(config: SinConfig): Promise<void> {
  await fs.mkdir(path.dirname(CONFIG_PATH), { recursive: true });
  await fs.writeFile(CONFIG_PATH, JSON.stringify(config, null, 2), 'utf-8');
}

export function getDefaultConfig(): SinConfig {
  return { ...DEFAULT_CONFIG };
}
