import fs from 'fs/promises';
import path from 'path';
import Ajv from 'ajv';
import addFormats from 'ajv-formats';

export interface GlobalConfig {
  budget?: {
    warning_threshold_pct?: number;
    critical_threshold_pct?: number;
  };
  telemetry?: {
    enabled?: boolean;
    log_file?: string;
  };
  healing?: {
    max_attempts_base?: number;
    strategy_learning_enabled?: boolean;
  };
}

export interface AgentConfig {
  models: string[];
  category?: 'quick' | 'deep' | 'visual-engineering' | 'ultrabrain';
  max_concurrent?: number;
  timeout_ms?: number;
}

export interface ProjectConfig {
  verification?: {
    test_cmd?: string;
    min_coverage_delta?: number;
    max_new_lsp_errors?: number;
  };
  skills?: string[];
}

export interface SessionConfig {
  active_agents?: string[];
  context_limit_mb?: number;
}

export interface SinConfig {
  version: string;
  global?: GlobalConfig;
  agents: Record<string, AgentConfig>;
  project?: ProjectConfig;
  session?: SessionConfig;
}

export interface ConfigLayer {
  layer: 'global' | 'project' | 'session';
  path: string;
  config: Partial<SinConfig>;
}

export class ConfigValidationError extends Error {
  constructor(message: string, public errors: Array<{ path: string; message: string }>) {
    super(message);
    this.name = 'ConfigValidationError';
  }
}

const GLOBAL_CONFIG_PATH = path.join(process.env.HOME || '', '.config', 'oh-my-open-sin', 'config.json');
const PROJECT_CONFIG_PATH = path.join(process.cwd(), '.opencode', 'oh-my-open-sin.json');

const DEFAULT_CONFIG: SinConfig = {
  version: '1.0.0',
  global: {
    budget: {
      warning_threshold_pct: 80,
      critical_threshold_pct: 95
    },
    telemetry: {
      enabled: true,
      log_file: path.join(process.env.HOME || '', '.config', 'oh-my-open-sin', 'logs', 'telemetry.jsonl')
    },
    healing: {
      max_attempts_base: 3,
      strategy_learning_enabled: true
    }
  },
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
  project: {
    verification: {
      test_cmd: 'npm test',
      min_coverage_delta: 0,
      max_new_lsp_errors: 0
    },
    skills: []
  },
  session: {}
};

let schema: any = null;
let ajv: Ajv | null = null;

async function loadSchema(): Promise<any> {
  if (!schema) {
    const schemaPath = path.join(__dirname, '..', 'schema', 'config-schema.json');
    const raw = await fs.readFile(schemaPath, 'utf-8');
    schema = JSON.parse(raw);
  }
  return schema;
}

function getAjv(): Ajv {
  if (!ajv) {
    ajv = new Ajv({ allErrors: true, strict: false });
    addFormats(ajv);
  }
  return ajv;
}

export async function validateConfig(config: SinConfig): Promise<boolean> {
  const schema = await loadSchema();
  const ajv = getAjv();
  const validate = ajv.compile(schema);
  const valid = validate(config);
  
  if (!valid) {
    const errors = (validate.errors || []).map(err => ({
      path: err.instancePath || 'root',
      message: err.message || 'Unknown error'
    }));
    throw new ConfigValidationError('Configuration validation failed', errors);
  }
  
  return true;
}

async function loadConfigFile(filePath: string): Promise<Partial<SinConfig>> {
  try {
    const raw = await fs.readFile(filePath, 'utf-8');
    const config = JSON.parse(raw);
    await validateConfig(config as SinConfig);
    return config;
  } catch (error) {
    if (error instanceof ConfigValidationError) {
      throw error;
    }
    return {};
  }
}

export async function loadConfig(sessionOverrides?: SessionConfig): Promise<SinConfig> {
  const layers: ConfigLayer[] = [];
  
  // Load global config
  try {
    const globalConfig = await loadConfigFile(GLOBAL_CONFIG_PATH);
    if (Object.keys(globalConfig).length > 0) {
      layers.push({ layer: 'global', path: GLOBAL_CONFIG_PATH, config: globalConfig });
    }
  } catch (error) {
    // Ignore if global config doesn't exist
  }
  
  // Load project config
  try {
    const projectConfig = await loadConfigFile(PROJECT_CONFIG_PATH);
    if (Object.keys(projectConfig).length > 0) {
      layers.push({ layer: 'project', path: PROJECT_CONFIG_PATH, config: projectConfig });
    }
  } catch (error) {
    // Ignore if project config doesn't exist
  }
  
  // Merge configs with priority: session > project > global > default
  let merged: SinConfig = { ...DEFAULT_CONFIG };
  
  for (const layer of layers) {
    merged = mergeConfigs(merged, layer.config);
  }
  
  // Apply session overrides
  if (sessionOverrides) {
    merged.session = { ...merged.session, ...sessionOverrides };
  }
  
  return merged;
}

function mergeConfigs(base: SinConfig, override: Partial<SinConfig>): SinConfig {
  const result: SinConfig = {
    version: override.version || base.version,
    global: {
      budget: { ...base.global?.budget, ...override.global?.budget },
      telemetry: { ...base.global?.telemetry, ...override.global?.telemetry },
      healing: { ...base.global?.healing, ...override.global?.healing }
    },
    agents: { ...base.agents },
    project: {
      verification: { ...base.project?.verification, ...override.project?.verification },
      skills: override.project?.skills || base.project?.skills || []
    },
    session: { ...base.session, ...override.session }
  };
  
  // Merge agents
  if (override.agents) {
    for (const [name, agent] of Object.entries(override.agents)) {
      result.agents[name] = { ...result.agents[name], ...agent };
    }
  }
  
  return result;
}

export async function saveConfig(config: SinConfig, layer: 'global' | 'project' = 'project'): Promise<void> {
  const configPath = layer === 'global' ? GLOBAL_CONFIG_PATH : PROJECT_CONFIG_PATH;
  
  // Validate before saving
  await validateConfig(config);
  
  await fs.mkdir(path.dirname(configPath), { recursive: true });
  
  // Only save relevant parts for each layer
  const toSave: Partial<SinConfig> = {
    version: config.version
  };
  
  if (layer === 'global' && config.global) {
    toSave.global = config.global;
  }
  
  if (layer === 'project') {
    if (config.global) toSave.global = config.global;
    if (config.agents) toSave.agents = config.agents;
    if (config.project) toSave.project = config.project;
  }
  
  await fs.writeFile(configPath, JSON.stringify(toSave, null, 2), 'utf-8');
}

export function getDefaultConfig(): SinConfig {
  return { ...DEFAULT_CONFIG };
}

// Hot reload support
type ConfigChangeListener = (newConfig: SinConfig) => void;
const listeners = new Set<ConfigChangeListener>();
let currentConfig: SinConfig | null = null;
let watchTimeout: NodeJS.Timeout | null = null;

export async function startConfigWatch(): Promise<void> {
  const chokidar = await import('chokidar').catch(() => null);
  if (!chokidar) {
    console.warn('Chokidar not available, config hot-reload disabled');
    return;
  }
  
  const paths = [GLOBAL_CONFIG_PATH, PROJECT_CONFIG_PATH];
  const watcher = chokidar.default.watch(paths, {
    ignoreInitial: true,
    persistent: true
  });
  
  watcher.on('change', async (filePath) => {
    if (watchTimeout) clearTimeout(watchTimeout);
    
    watchTimeout = setTimeout(async () => {
      try {
        currentConfig = await loadConfig(currentConfig?.session);
        for (const listener of listeners) {
          listener(currentConfig);
        }
        console.log(`[Config] Reloaded config from ${filePath}`);
      } catch (error) {
        console.error(`[Config] Failed to reload config: ${error}`);
      }
    }, 500);
  });
  
  // Initial load
  currentConfig = await loadConfig();
}

export function onConfigChange(listener: ConfigChangeListener): void {
  listeners.add(listener);
}

export function offConfigChange(listener: ConfigChangeListener): void {
  listeners.delete(listener);
}

export function getCurrentConfig(): SinConfig | null {
  return currentConfig;
}
